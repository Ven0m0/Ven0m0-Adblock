// ==UserScript==
// @name         GitHub Enhanced: File Size Viewer & Editor Settings
// @namespace    Ven0m0
// @homepageURL  https://github.com/Ven0m0/Ven0m0-Adblock
// @version      2025.12.04.1
// @description  Merges "GitHub File Size Viewer" and "GitHub Editor - Change Default Settings". Displays file sizes in repo listings and configures default editor settings (indent, wrap).
// @author       Abhay, People's Servant, aspen138, Adrien Pyke
// @match        https://github.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @require      https://cdn.jsdelivr.net/gh/kufii/My-UserScripts@22210afba13acf7303fc91590b8265faf3c7eda7/libs/gm_config.js
// @require      https://cdn.jsdelivr.net/gh/fuzetsu/userscripts@ec863aa92cea78a20431f92e80ac0e93262136df/wait-for-elements/wait-for-elements.js
// @license      MIT
// @icon         https://github.githubassets.com/favicons/favicon.svg
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================================================
    // PART 1: GitHub Editor - Change Default Settings
    // Author: Adrien Pyke
    // =========================================================================================
    function initEditorSettings() {
        console.log('[MergedScript] Initializing Editor Settings...');

        const Config = GM_config([
            {
                key: 'indentMode',
                label: 'Indent mode',
                default: 'space',
                type: 'dropdown',
                values: [
                    { value: 'space', text: 'Spaces' },
                    { value: 'tab', text: 'Tabs' }
                ]
            },
            {
                key: 'indentWidth',
                label: 'Indent size',
                default: 2,
                type: 'dropdown',
                values: [2, 4, 8]
            },
            {
                key: 'wrapMode',
                label: 'Line wrap mode',
                default: 'on',
                type: 'dropdown',
                values: [
                    { value: 'off', text: 'No wrap' },
                    { value: 'on', text: 'Soft wrap' }
                ]
            }
        ]);

        const updateDropdown = function (dropdown, value) {
            if (!dropdown) return;
            dropdown.value = value;
            const evt = document.createEvent('HTMLEvents');
            evt.initEvent('change', false, true);
            dropdown.dispatchEvent(evt);
        };

        const applySettings = function (cfg) {
            const indentMode = document.querySelector('.js-code-indent-mode');
            const indentWidth = document.querySelector('.js-code-indent-width');
            const wrapMode = document.querySelector('.js-code-wrap-mode');

            // Check context
            if (location.href.match(/^https?:\/\/github.com\/[^/]*\/[^/]*\/new\/.*/u)) {
                // New file
                updateDropdown(indentMode, cfg.indentMode);
                updateDropdown(indentWidth, cfg.indentWidth);
                updateDropdown(wrapMode, cfg.wrapMode);
            } else if (location.href.match(/^https?:\/\/github.com\/[^/]*\/[^/]*\/edit\/.*/u)) {
                // Edit file
                // If the file is using space indentation we don't want to change it forcibly if set to tab, usually
                // But following original logic:
                if (indentMode && indentMode.value === 'tab') {
                    updateDropdown(indentWidth, cfg.indentWidth);
                }
                updateDropdown(wrapMode, cfg.wrapMode);
            }
        };

        GM_registerMenuCommand('GitHub Editor Settings', Config.setup);
        const settings = Config.load();

        waitForElems({
            sel: '.CodeMirror-code',
            onmatch() {
                applySettings(settings);
            }
        });
    }

    // =========================================================================================
    // PART 2: GitHub File Size Viewer
    // Author: Abhay, People's Servant, aspen138
    // =========================================================================================
    function initFileSizeViewer() {
        console.log('[MergedScript] Initializing File Size Viewer...');

        let GITHUB_TOKEN = GM_getValue('GITHUB_TOKEN', '');
        
        // Lazy token prompt only if we are actually listing files
        function checkToken() {
            if (!GITHUB_TOKEN) {
                const token = prompt('GitHub File Size Viewer:\nPlease enter your GitHub Token to avoid rate limits.');
                if (token) {
                    GM_setValue('GITHUB_TOKEN', token);
                    GITHUB_TOKEN = token;
                }
            }
            return GITHUB_TOKEN;
        }

        function formatSize(bytes) {
            if (bytes < 1024 * 1024) {
                return (bytes / 1024).toFixed(2) + ' KB';
            } else if (bytes < 1024 * 1024 * 1024) {
                return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
            } else {
                return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
            }
        }

        async function calculateFolderSize(apiUrl, headers, depth = 0) {
            const MAX_DEPTH = 5;
            if (depth > MAX_DEPTH) {
                console.warn('Max folder depth reached:', apiUrl);
                return { size: 0, fileCount: 0 };
            }
            try {
                const response = await fetch(apiUrl, { headers });
                if (!response.ok) {
                    if (response.status === 404) {
                        return { size: 0, fileCount: 0 };
                    }
                    console.error('Folder API error:', response.status, response.statusText);
                    return { size: 0, fileCount: 0 };
                }
                const data = await response.json();
                if (!Array.isArray(data)) {
                    return { size: 0, fileCount: 0 };
                }
                let totalSize = 0;
                let fileCount = 0;
                const results = await Promise.all(data.map(async (item) => {
                    if (!item || !item.type) return { size: 0, fileCount: 0 };
                    if (item.type === 'file' && typeof item.size === 'number') {
                        return { size: item.size, fileCount: 1 };
                    } else if (item.type === 'dir' && item.url) {
                        return calculateFolderSize(item.url, headers, depth + 1);
                    }
                    return { size: 0, fileCount: 0 };
                }));
                totalSize = results.reduce((sum, result) => sum + result.size, 0);
                fileCount = results.reduce((sum, result) => sum + result.fileCount, 0);
                return { size: totalSize, fileCount };
            } catch (error) {
                console.error('Error calculating folder size:', error.message || error);
                return { size: 0, fileCount: 0 };
            }
        }

        async function fetchFileSize(apiUrl) {
            checkToken(); // Ensure we have token before first fetch
            const token = GITHUB_TOKEN;
            let headers = { 'Accept': 'application/vnd.github.v3+json' };
            if (token) {
                headers['Authorization'] = 'token ' + token;
            }
            try {
                const response = await fetch(apiUrl, { headers });
                if (!response.ok) {
                    console.error('GitHub API responded with error:', response.status, response.statusText);
                    return 'N/A';
                }
                const data = await response.json();
                if (data && data.message) {
                    console.error('GitHub API error message:', data.message);
                    return 'N/A';
                }
                if (data && !Array.isArray(data) && data.type === 'file') {
                    if (typeof data.size === 'number') {
                        return `${formatSize(data.size)} (1 file)`;
                    } else {
                        return 'N/A';
                    }
                } else if (Array.isArray(data)) {
                    const { size, fileCount } = await calculateFolderSize(apiUrl, headers);
                    return size > 0 ? `${formatSize(size)} (${fileCount} ${fileCount === 1 ? 'file' : 'files'})` : `Folder (${fileCount} ${fileCount === 1 ? 'file' : 'files'})`;
                } else {
                    return 'N/A';
                }
            } catch (error) {
                console.error('Error fetching file size:', error);
                return 'N/A';
            }
        }

        function insertSizeAfterLink(link, infoText) {
            if (link.nextSibling && link.nextSibling.classList && link.nextSibling.classList.contains('gh-size-viewer')) return;
            const infoSpan = document.createElement('span');
            infoSpan.className = 'gh-size-viewer';
            infoSpan.style.marginLeft = '10px';
            infoSpan.style.fontSize = 'smaller';
            infoSpan.style.color = '#6a737d';
            infoSpan.textContent = `(${infoText})`;
            link.insertAdjacentElement('afterend', infoSpan);
        }

        async function displayFileSizes() {
            try {
                const tableBody = document.querySelector('table tbody');
                if (!tableBody) return;
                const links = tableBody.querySelectorAll('a[href*="/blob/"], a[href*="/tree/"]');
                if (!links.length) return;
                const unprocessedLinks = Array.from(links).filter(link => {
                    const next = link.nextSibling;
                    return !(next?.classList?.contains('gh-size-viewer'));
                });
                if (unprocessedLinks.length === 0) return;
                console.log('[GH-Tweaks] Processing', unprocessedLinks.length, 'file/folder links');
                const promises = unprocessedLinks.map(async (link) => {
                    try {
                        if (!link.href) return;
                        const urlParts = link.href.split('/');
                        if (urlParts.length < 7) return;
                        const user = urlParts[3];
                        const repo = urlParts[4];
                        if (!user || !repo) return;
                        const typeSegment = link.href.includes('/blob/') ? 'blob' : 'tree';
                        const branchIndex = urlParts.indexOf(typeSegment);
                        if (branchIndex === -1 || branchIndex + 1 >= urlParts.length) return;
                        const branch = urlParts[branchIndex + 1];
                        const filePath = urlParts.slice(branchIndex + 2).join('/');
                        if (!branch) return;
                        const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`;
                        const infoText = await fetchFileSize(apiUrl);
                        if (infoText && infoText !== 'N/A') {
                            insertSizeAfterLink(link, infoText);
                        }
                    } catch (e) {
                        console.error('[GH-Tweaks] Error parsing link:', link.href, e.message || e);
                    }
                });
                await Promise.all(promises);
            } catch (e) {
                console.error('[GH-Tweaks] Error in displayFileSizes:', e.message || e);
            }
        }
        // Run on load
        setTimeout(displayFileSizes, 2000);
        // Observer for SPA navigation
        function observeUrlChanges(callback, delay = 1000) {
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
            observer.observe(document, { subtree: true, childList: true });
            return observer;
        }
        observeUrlChanges(displayFileSizes, 2000);
    }
    // =========================================================================================
    // MAIN EXECUTION
    // =========================================================================================
    // 1. Run Editor Settings logic (Handles its own waiting)
    initEditorSettings();
    // 2. Run File Size Viewer logic (Handles its own observers)
    // Run after a short delay to ensure DOM is ready
    window.addEventListener('load', () => {
        initFileSizeViewer();
    });

})();
