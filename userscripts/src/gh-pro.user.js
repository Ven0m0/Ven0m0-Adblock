// ==UserScript==
// @name         GitHub Enhanced: File Size Viewer & Editor Settings
// @namespace    Ven0m0
// @homepageURL  https://github.com/Ven0m0/Ven0m0-Adblock
// @version      2025.12.04.1
// @description  Merges "GitHub File Size Viewer" and "GitHub Editor - Change Default Settings". Displays file sizes in repo listings and configures default editor settings (indent, wrap).
// @auth or       Abhay, People's Servant, aspen138, Adrien Pyke
// @match        https://github.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @require      https://cdn.jsdelivr.net/gh/kufii/My-UserScripts@22210afba13acf7303fc91590b8265faf3c7eda7/libs/gm_config.js
// @require      https://cdn.jsdelivr.net/gh/fuzetsu/userscripts@ec863aa92cea78a20431f92e80ac0e93262136df/wait-for-elements/wait-for-elements.js
// @license      MIT
// @icon         https://github.githubassets.com/favicons/favicon.svg
// ==/UserScript==

(() => {
    // PART 1: Editor settings
    function initEditorSettings() {
        console.log("[MergedScript] Initializing Editor Settings...");

        const Config = GM_config([{
                key: "indentMode",
                label: "Indent mode",
                default: "space",
                type: "dropdown",
                values: [{
                        value: "space",
                        text: "Spaces"
                    },
                    {
                        value: "tab",
                        text: "Tabs"
                    }
                ]
            },
            {
                key: "indentWidth",
                label: "Indent size",
                default: 2,
                type: "dropdown",
                values: [2, 4, 8]
            },
            {
                key: "wrapMode",
                label: "Line wrap mode",
                default: "on",
                type: "dropdown",
                values: [{
                        value: "off",
                        text: "No wrap"
                    },
                    {
                        value: "on",
                        text: "Soft wrap"
                    }
                ]
            }
        ]);

        const updateDropdown = (dropdown, value) => {
            if (!dropdown) return;
            dropdown.value = value;
            const evt = document.createEvent("HTMLEvents");
            evt.initEvent("change", false, true);
            dropdown.dispatchEvent(evt);
        };

        const applySettings = (cfg) => {
            const indentMode = document.querySelector(".js-code-indent-mode");
            const indentWidth = document.querySelector(".js-code-indent-width");
            const wrapMode = document.querySelector(".js-code-wrap-mode");

            if (location.href.match(/^https?:\/\/github.com\/[^/]*\/[^/]*\/new\/.*/u)) {
                updateDropdown(indentMode, cfg.indentMode);
                updateDropdown(indentWidth, cfg.indentWidth);
                updateDropdown(wrapMode, cfg.wrapMode);
            } else if (location.href.match(/^https?:\/\/github.com\/[^/]*\/[^/]*\/edit\/.*/u)) {
                if (indentMode && indentMode.value === "tab") {
                    updateDropdown(indentWidth, cfg.indentWidth);
                }
                updateDropdown(wrapMode, cfg.wrapMode);
            }
        };

        GM_registerMenuCommand("GitHub Editor Settings", Config.setup);
        const settings = Config.load();

        waitForElems({
            sel: ".CodeMirror-code",
            onmatch() {
                applySettings(settings);
            }
        });
    }

    // PART 2: File size viewer
    function initFileSizeViewer() {
        console.log("[MergedScript] Initializing File Size Viewer...");

        let GITHUB_TOKEN = GM_getValue("GITHUB_TOKEN", "");

        function checkToken() {
            if (!GITHUB_TOKEN) {
                const token = prompt(
                    "GitHub File Size Viewer:\nPlease enter your GitHub Token to avoid rate limits."
                );
                if (token) {
                    GM_setValue("GITHUB_TOKEN", token);
                    GITHUB_TOKEN = token;
                }
            }
            return GITHUB_TOKEN;
        }

        const formatSize = (bytes) => {
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
            if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
            return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
        };

        const calculateFolderSize = async (apiUrl, headers, depth = 0) => {
            const MAX_DEPTH = 5;
            if (depth > MAX_DEPTH) {
                console.warn("Max folder depth reached:", apiUrl);
                return {
                    size: 0,
                    fileCount: 0
                };
            }
            try {
                const response = await fetch(apiUrl, {
                    headers
                });
                if (!response.ok) {
                    if (response.status === 404) return {
                        size: 0,
                        fileCount: 0
                    };
                    console.error("Folder API error:", response.status, response.statusText);
                    return {
                        size: 0,
                        fileCount: 0
                    };
                }
                const data = await response.json();
                if (!Array.isArray(data)) return {
                    size: 0,
                    fileCount: 0
                };
                const results = await Promise.all(
                    data.map(async (item) => {
                        if (!item || !item.type) return {
                            size: 0,
                            fileCount: 0
                        };
                        if (item.type === "file" && typeof item.size === "number")
                            return {
                                size: item.size,
                                fileCount: 1
                            };
                        if (item.type === "dir" && item.url)
                            return calculateFolderSize(item.url, headers, depth + 1);
                        return {
                            size: 0,
                            fileCount: 0
                        };
                    })
                );
                const totalSize = results.reduce((sum, r) => sum + r.size, 0);
                const fileCount = results.reduce((sum, r) => sum + r.fileCount, 0);
                return {
                    size: totalSize,
                    fileCount
                };
            } catch (error) {
                console.error("Error calculating folder size:", error.message || error);
                return {
                    size: 0,
                    fileCount: 0
                };
            }
        };

        const fetchFileSize = async (apiUrl) => {
            checkToken();
            const token = GITHUB_TOKEN;
            const headers = {
                Accept: "application/vnd.github.v3+json"
            };
            if (token) headers.Authorization = `token ${token}`;
            try {
                const response = await fetch(apiUrl, {
                    headers
                });
                if (!response.ok) {
                    console.error("GitHub API responded with error:", response.status, response.statusText);
                    return "N/A";
                }
                const data = await response.json();
                if (data?.message) {
                    console.error("GitHub API error message:", data.message);
                    return "N/A";
                }
                if (data && !Array.isArray(data) && data.type === "file") {
                    if (typeof data.size === "number") return `${formatSize(data.size)} (1 file)`;
                    return "N/A";
                } else if (Array.isArray(data)) {
                    const {
                        size,
                        fileCount
                    } = await calculateFolderSize(apiUrl, headers);
                    return size > 0 ?
                        `${formatSize(size)} (${fileCount} ${fileCount === 1 ? "file" : "files"})` :
                        `Folder (${fileCount} ${fileCount === 1 ? "file" : "files"})`;
                }
                return "N/A";
            } catch (error) {
                console.error("Error fetching file size:", error);
                return "N/A";
            }
        };

        const insertSizeAfterLink = (link, infoText) => {
            if (link.nextSibling?.classList?.contains("gh-size-viewer")) return;
            const infoSpan = document.createElement("span");
            infoSpan.className = "gh-size-viewer";
            infoSpan.style.marginLeft = "10px";
            infoSpan.style.fontSize = "smaller";
            infoSpan.style.color = "#6a737d";
            infoSpan.textContent = `(${infoText})`;
            link.insertAdjacentElement("afterend", infoSpan);
        };

        const displayFileSizes = async () => {
            try {
                const tableBody = document.querySelector("table tbody");
                if (!tableBody) return;
                const links = tableBody.querySelectorAll('a[href*="/blob/"], a[href*="/tree/"]');
                if (!links.length) return;
                const unprocessedLinks = Array.from(links).filter((link) => {
                    const next = link.nextSibling;
                    return !next?.classList?.contains("gh-size-viewer");
                });
                if (!unprocessedLinks.length) return;
                console.log("[GH-Tweaks] Processing", unprocessedLinks.length, "file/folder links");
                const promises = unprocessedLinks.map(async (link) => {
                    try {
                        if (!link.href) return;
                        const urlParts = link.href.split("/");
                        if (urlParts.length < 7) return;
                        const user = urlParts[3];
                        const repo = urlParts[4];
                        if (!user || !repo) return;
                        const typeSegment = link.href.includes("/blob/") ? "blob" : "tree";
                        const branchIndex = urlParts.indexOf(typeSegment);
                        if (branchIndex === -1 || branchIndex + 1 >= urlParts.length) return;
                        const branch = urlParts[branchIndex + 1];
                        const filePath = urlParts.slice(branchIndex + 2).join("/");
                        if (!branch) return;
                        const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/${encodeURIComponent(
              filePath
            )}?ref=${encodeURIComponent(branch)}`;
                        const infoText = await fetchFileSize(apiUrl);
                        if (infoText && infoText !== "N/A") insertSizeAfterLink(link, infoText);
                    } catch (e) {
                        console.error("[GH-Tweaks] Error parsing link:", link.href, e.message || e);
                    }
                });
                await Promise.all(promises);
            } catch (e) {
                console.error("[GH-Tweaks] Error in displayFileSizes:", e.message || e);
            }
        };
        setTimeout(displayFileSizes, 2000);
        const observeUrlChanges = (callback, delay = 1000) => {
            let lastUrl = location.href;
            const observer = new MutationObserver(() => {
                const url = location.href;
                if (url !== lastUrl) {
                    lastUrl = url;
                    setTimeout(() => {
                        callback();
                    }, delay);
                }
            });
            observer.observe(document, {
                subtree: true,
                childList: true
            });
            return observer;
        };
        observeUrlChanges(displayFileSizes, 2000);
    }

    initEditorSettings();
    window.addEventListener("load", () => {
        initFileSizeViewer();
    });
})();
