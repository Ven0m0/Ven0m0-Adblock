// ==UserScript==
// @name        AUR helper
// @description One-click install aur package.
// @namespace   com.github.brucezhang1993
// @include     https://aur.archlinux.org/packages/*
// @version     1.0.1
// @grant       none
// @run-at      document-start
// @downloadURL https://update.greasyfork.org/scripts/386075/AUR%20helper.user.js
// @updateURL https://update.greasyfork.org/scripts/386075/AUR%20helper.meta.js
// ==/UserScript==

addEventListener(
  "DOMContentLoaded",
  function () {
    let ul = document.getElementById("actionlist").getElementsByTagName("ul");
    if (ul.length === 0) return;

    ul = ul[0];

    const firstLink = ul.getElementsByTagName("a")[0];
    if (!firstLink) return;

    const match = firstLink.href.match(/\/cgit\/aur\.git\/tree\/PKGBUILD\?h=([-_\w\d\.]+)/);
    if (!match || !match[1]) return;

    const pkgName = match[1];
    const li = document.createElement("li");
    const link = document.createElement("a");
    li.appendChild(link);
    ul.insertBefore(li, ul.firstChild);

    link.textContent = "安装软件包 (yay -S " + pkgName + ")";
    link.href = "yay://" + pkgName;
  },
  false
);
