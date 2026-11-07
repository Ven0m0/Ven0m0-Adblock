# Filter lists

One-click subscribe links for the lists in `lists/adblock/` and `lists/hostlist/`.

## Requirements

Use a content blocker that accepts filter lists, such as [uBlock Origin](https://github.com/gorhill/uBlock) or
[AdGuard](https://adguard.com/).

Click a **Subscribe** link below. The blocker opens its import dialog for that URL.
Updates are checked against the same URL, so new commits on `main` arrive automatically.

## Combined lists

Pick **one**. Each one bundles the individual lists below via `!#include`.

| List                     | Includes                                                          | Subscribe                      |
| ------------------------ | ----------------------------------------------------------------- | ------------------------------ |
| [Desktop][combo-desktop] | General, Other, Reddit, Search Engines, YouTube, Twitch           | [Subscribe][sub-combo-desktop] |
| [Full][combo-full]       | General, Other, Reddit, Search Engines, Spotify, Twitter, YouTube | [Subscribe][sub-combo-full]    |
| [Minimal][combo-minimal] | General, Other, Reddit, Search Engines, Twitter, YouTube          | [Subscribe][sub-combo-minimal] |
| [Mobile][combo-mobile]   | General, Other, Reddit, Search Engines                            | [Subscribe][sub-combo-mobile]  |

## Individual lists

If you only want part of it:
[General][general] · [Other][other] · [Reddit][reddit] · [Search Engines][search] · [Spotify][spotify] ·
[Twitch][twitch] · [Twitter][twitter] · [YouTube][youtube]

## Android apps hostlist

[Android.txt][android] ([raw][android-raw]) is a plain-domain list for patched Android apps, not a browser filter list.
In Morphe Manager add the Adobo patch source, enable _Block ads, trackers, and analytics_, download the file to the
device and select it as the Hosts file.

[combo-desktop]: ../lists/adblock/Combination-desktop.txt
[combo-full]: ../lists/adblock/Combination.txt
[combo-minimal]: ../lists/adblock/Combination-Minimal.txt
[combo-mobile]: ../lists/adblock/Combination-mobile.txt
[sub-combo-desktop]: https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/lists/adblock/Combination-desktop.txt&title=Ven0m0%20Desktop
[sub-combo-full]: https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/lists/adblock/Combination.txt&title=Ven0m0%20Full
[sub-combo-minimal]: https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/lists/adblock/Combination-Minimal.txt&title=Ven0m0%20Minimal
[sub-combo-mobile]: https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/lists/adblock/Combination-mobile.txt&title=Ven0m0%20Mobile
[general]: ../lists/adblock/General.txt
[other]: ../lists/adblock/Other.txt
[reddit]: ../lists/adblock/Reddit.txt
[search]: ../lists/adblock/Search-Engines.txt
[spotify]: ../lists/adblock/Spotify.txt
[twitch]: ../lists/adblock/Twitch.txt
[twitter]: ../lists/adblock/Twitter.txt
[youtube]: ../lists/adblock/Youtube.txt
[android]: ../lists/hostlist/Android.txt
[android-raw]: https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/lists/hostlist/Android.txt
