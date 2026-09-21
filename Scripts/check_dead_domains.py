#!/usr/bin/env python3
import asyncio
import re
import sys
from pathlib import Path

import aiohttp

DNS_QUERIES = [
    "https://cloudflare-dns.com/dns-query?name={hn}&type=A",
    "https://dns.google/resolve?name={hn}&type=A",
]
THROTTLE = 0.25

PARKED_RE = [
    re.compile(r"^traff-\d+\.hugedomains\.com\.?$"),
    re.compile(r"^\d+\.parkingcrew\.net\.?$"),
    re.compile(r"^ns\d\.centralnic\.net\.?(\s|$)"),
    re.compile(r"^ns\d\.pananames\.com\.?(\s|$)"),
]

dns_cache: dict[str, bool] = {}


async def validate_hostname(session: aiohttp.ClientSession, hn: str) -> dict[str, object] | None:
    await asyncio.sleep(THROTTLE)
    for url_tpl in DNS_QUERIES:
        url = url_tpl.format(hn=hn)
        try:
            async with session.get(
                url,
                headers={"accept": "application/dns-json"},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                data = await resp.json(content_type=None)
                if data.get("Status") != 2:
                    return data
        except Exception:  # noqa: S112  (fall through to the next resolver)
            continue
    return None


def check_hostname(result: object) -> str | None:
    if not isinstance(result, dict):
        return None
    status = result.get("Status")
    if status == 1:
        return "format error"
    if status == 2:
        return "dns server failure"
    if status == 3:
        return "name error"
    if status == 4:
        return "not implemented"
    if status == 5:
        return "refused"
    answers = result.get("Answer") or []
    for entry in answers:
        data = entry.get("data", "")
        for pat in PARKED_RE:
            if pat.search(data):
                return "parked"
    return None


async def is_dead(session: aiohttp.ClientSession, hn: str) -> bool:
    if hn in dns_cache:
        return dns_cache[hn]
    result = await validate_hostname(session, hn)
    dead = check_hostname(result) is not None
    dns_cache[hn] = dead
    return dead


# Cosmetic rules: domain-list##selector
RULE_RE = re.compile(
    r"^((?:~?[a-zA-Z0-9\-\*]+(?:\.[a-zA-Z0-9\-\*]+)*)(?:,(?:~?[a-zA-Z0-9\-\*]+(?:\.[a-zA-Z0-9\-\*]+)*))*)(##.+)$"
)

# Network filters: domain= or from= pipe-separated list in options
NET_OPT_RE = re.compile(r"(?<=[,$])(domain|from)=([^,\s\n]+)")

# Basic blocking rules: ||hostname^ or @@||hostname^
HOSTNAME_RE = re.compile(r"^(@@)?\|\|([a-zA-Z0-9\-\.]+)\^")


def should_skip(hn: str) -> bool:
    if hn.endswith(".onion"):
        return True
    if re.match(r"^\d+\.\d+\.\d+\.\d+$", hn):
        return True
    return "*" in hn


async def check_pipe_domains(session: aiohttp.ClientSession, domains_str: str) -> tuple[list[str], list[str]]:
    domains = domains_str.split("|")
    checked = []
    for d in domains:
        bare = d.lstrip("~")
        if d.startswith("~") or should_skip(bare):
            checked.append((d, False))
            continue
        dead = await is_dead(session, bare)
        checked.append((d, dead))
    alive = [d for d, dead in checked if not dead]
    return domains, alive


async def process(input_path: Path) -> list[str]:
    with input_path.open(encoding="utf-8") as f:
        lines = f.readlines()

    out = []
    backup_commented = set()
    connector = aiohttp.TCPConnector(limit=5)
    async with aiohttp.ClientSession(connector=connector) as session:
        for line in lines:
            raw = line.rstrip("\n")

            if not raw or raw.startswith(("!", "[")):
                out.append(line)
                continue

            # --- Cosmetic rules (domain,list##selector) ---
            m = RULE_RE.match(raw)
            if m:
                domains_str, rule = m.group(1), m.group(2)
                domains = [d for d in domains_str.split(",") if d]
                checked = []
                for d in domains:
                    bare = d.lstrip("~")
                    if should_skip(bare):
                        checked.append((d, False))
                        continue
                    dead = await is_dead(session, bare)
                    checked.append((d, dead))
                alive_domains = [d for d, dead in checked if not dead]
                if alive_domains:
                    if len(alive_domains) == len(domains):
                        out.append(line)
                    else:
                        out.append(",".join(alive_domains) + rule + "\n")
                else:
                    if domains[0] not in backup_commented:
                        out.append("! All Dead Kept One Backup\n")
                        backup_commented.add(domains[0])
                    out.append(domains[0] + rule + "\n")
                continue

            # --- Network filters with domain= or from= ---
            m2 = NET_OPT_RE.search(raw)
            if m2:
                domains_str = m2.group(2)
                domains, alive = await check_pipe_domains(session, domains_str)
                if len(alive) == len(domains):
                    out.append(line)
                elif alive:
                    new_raw = raw[: m2.start(2)] + "|".join(alive) + raw[m2.end(2) :]
                    out.append(new_raw + "\n")
                else:
                    first = domains[0]
                    if first not in backup_commented:
                        out.append("! All Dead Kept One Backup\n")
                        backup_commented.add(first)
                    new_raw = raw[: m2.start(2)] + first + raw[m2.end(2) :]
                    out.append(new_raw + "\n")
                continue

            # --- Basic ||hostname^ rules ---
            m3 = HOSTNAME_RE.match(raw)
            if m3:
                hn = m3.group(2)
                if should_skip(hn):
                    out.append(line)
                    continue
                dead = await is_dead(session, hn)
                if dead:
                    out.append("! All Dead Kept One Backup\n")
                    out.append(line)
                else:
                    out.append(line)
                continue

            out.append(line)

    return out


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: check_dead_domains.py <filter_file>")
        sys.exit(1)

    inp = Path(sys.argv[1])
    out_path = inp.with_name(f"{inp.stem}_Dead Domain Cleaned{inp.suffix}")

    result = asyncio.run(process(inp))

    with out_path.open("w", encoding="utf-8") as f:
        f.writelines(result)

    print(f"Done → {out_path}")


if __name__ == "__main__":
    main()
