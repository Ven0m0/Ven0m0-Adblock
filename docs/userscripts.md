# Userscripts

One-click install for the userscripts in `userscripts/src/`.

## Requirements

Install a userscript manager first:

- [Tampermonkey](https://www.tampermonkey.net/)
- [Violentmonkey](https://violentmonkey.github.io/)

Click an **Install** link below. Both managers detect the `.user.js` URL and open their install dialog.
Updates are checked against the same URL, so new commits on `main` arrive automatically.

## Scripts

### Web

| Script | Sites | Description | Install |
| ------ | ----- | ----------- | ------- |
| Web Pro | All sites | Lazy load, URL cleaning, CPU/RAF tamer, capped link prefetch | [Install][web-pro] |
| Google Search Fixer | Google Search | Port of the google-search-fixer Firefox extension (Android-friendly) | [Install][google-search-fixer] |

### YouTube

| Script | Sites | Description | Install |
| ------ | ----- | ----------- | ------- |
| YouTube Unified Optimizer | YouTube | CPU/GPU/UI tweaks, quality lock, flags, engine tame | [Install][yt-pro] |
| YouTube Music Complete | YouTube Music | Opus codec preference, autopause prevention, UI tweaks | [Install][yt-music] |

### GitHub

| Script | Sites | Description | Install |
| ------ | ----- | ----------- | ------- |
| GitHub Enhanced: Size & Editor (Lean) | GitHub | Shows file/folder sizes and sets editor defaults | [Install][gh-pro] |
| GitHub Complete Enhancer | GitHub | Useful Forks button, auto device authorization, image preview with zoom | [Install][gh-enhancer] |

### AI chat

| Script | Sites | Description | Install |
| ------ | ----- | ----------- | ------- |
| ChatGPT/Gemini/Claude Optimizer (Lean) | ChatGPT, Gemini, Claude | Width, cleanup, auto-continue/regenerate with minimal overhead | [Install][llm-pro] |
| AI Chat Universal Enhancer | ChatGPT, Claude, Gemini, DeepSeek, Perplexity, Grok | Width, Enter key behavior, code block improvements | [Install][llm-enhancer] |
| Claude Complete Enhancement | Claude | Theme, token monitor, code block collapser, usage monitor, conversation fork | [Install][claude-complete] |

Overlapping scripts (for example `LLM-pro` and `llm-enhancer` on the same site) can conflict.
Enable one per site.

## Troubleshooting

- **Browser shows source code instead of an install dialog:** make sure the manager extension is enabled,
  then reload the link.
- **Chromium-based browsers:** Tampermonkey and Violentmonkey need "Allow user scripts" (or developer mode)
  enabled on the extension's details page.

[web-pro]: https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/userscripts/src/web-pro.user.js
[google-search-fixer]: https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/userscripts/src/google-search-fixer.user.js
[yt-pro]: https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/userscripts/src/yt-pro.user.js
[yt-music]: https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/userscripts/src/yt-music.user.js
[gh-pro]: https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/userscripts/src/gh-pro.user.js
[gh-enhancer]: https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/userscripts/src/gh-enhancer.user.js
[llm-pro]: https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/userscripts/src/LLM-pro.user.js
[llm-enhancer]: https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/userscripts/src/llm-enhancer.user.js
[claude-complete]: https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/userscripts/src/claude-complete.user.js
