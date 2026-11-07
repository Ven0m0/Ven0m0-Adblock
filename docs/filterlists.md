# Filter lists

One-click subscribe links for the lists in `lists/adblock/` and `lists/hostlist/`, plus recommended third-party lists.

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

## Recommended third-party lists

Third-party lists to use alongside this repo's list. They are linked, never copied into this repo.

<!-- markdownlint-disable MD013 -->

### URL Tracking Parameters

Add the functionality of [ClearURLs](https://github.com/ClearURLs/Addon#-clearurls-) to uBO. These filter lists automatically remove tracking elements from URLs to protect your privacy when browsing the Internet.

1. :star: **[Actually Legitimate URL Shortener Tool](https://github.com/DandelionSprout/adfilt/blob/master/LegitimateURLShortener.txt)** (2.8k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/DandelionSprout/adfilt/master/LegitimateURLShortener.txt&title=Actually%20Legitimate%20URL%20Shortener%20Tool)
   <br> This list also [includes](https://github.com/DandelionSprout/adfilt/discussions/163?sort=old#discussioncomment-3956776) all entries from `AdGuard's URL Tracking Protection` as of October 2022, but you can use both lists.

2. **[ClearURLs for uBO](https://github.com/DandelionSprout/adfilt/tree/master/ClearURLs%20for%20uBo)** (700 rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/DandelionSprout/adfilt/master/ClearURLs%20for%20uBo/clear_urls_uboified.txt&title=ClearURLS%20for%20URLs)
   <br> This list is just the rules from the ClearURLs extension converted into a filterlist.

> [!TIP]
> If you find websites with tracking parameters or experience site issues, you can submit those [here](https://github.com/DandelionSprout/adfilt/discussions/163?sort=new).

### Fonts

1. [**Block third-party fonts**](https://github.com/yokoffing/filterlists/blob/main/block_third_party_fonts.txt) (89 rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/yokoffing/filterlists/main/block_third_party_fonts.txt&title=Block%20third-party%20fonts)
   <br> This filter blocks fonts from third-party domains, which improves page load speed and protects your privacy. There are built-in exceptions to minimize site issues, such as allowing for font icons. Overall, it's more flexible than blocking all third-party fonts outright (e.g., `$font,3p`).

2. **[Fanboy's Anti-thirdparty Fonts (Optimized)](https://filters.adtidy.org/android/filters/239_optimized.txt)** (58 rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/android/filters/239_optimized.txt&title=Fanboy's%20Anti-thirdparty%20Fonts%20(Optimized))
   <br> Blocks third-party fonts. Smaller alternative or complement to the list above.

> [!NOTE]
> Blocking web fonts will affect the "look and feel" of some sites.

### Annoyances

1. **[Browse websites without logging in](https://github.com/DandelionSprout/adfilt/blob/master/BrowseWebsitesWithoutLoggingIn.txt)** (370 rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/DandelionSprout/adfilt/master/BrowseWebsitesWithoutLoggingIn.txt&title=Browse%20websites%20without%20logging%20in)
   <br> This list attempts to bypass forced logins on sites.

#### Paywalls

To most effectively bypass paywalls, use the **Bypass Paywalls Clean** [extension](https://gitflic.ru/user/magnolia1234). The blocklists are limited in what they can do and are therefore **optional**.

1. **[Bypass Paywalls Clean filter](https://gitflic.ru/project/magnolia1234/bypass-paywalls-clean-filters/blob/?file=bpc-paywall-filter.txt&branch=main)** (960 rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://gitflic.ru/project/magnolia1234/bypass-paywalls-clean-filters/blob/raw?file=bpc-paywall-filter.txt&title=Bypass%20Paywalls%20Clean%20filter)
   <br> You do not need this filterlist if you use the extension.

2. **[Anti-paywall filters](https://github.com/liamengland1/miscfilters/blob/master/antipaywall.txt)** (2k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/liamengland1/miscfilters/master/antipaywall.txt&title=Anti-paywall%20filters)
   <br> This list blocks additional third-party requests and annoyances that are not covered in the `Bypass Paywalls Clean` filterlist.

### Optimized lists

> [!IMPORTANT]
> These lists sacrifice blocking comprehensiveness for efficiency, so expect occasional gaps in coverage when compared to their regular versions. Remember this if you run into less blocking than anticipated or when troubleshooting a website.

Another way to improve performance is to use alternative filter lists with fewer rules. **These filters are intended predominately for mobile devices.** So although uBO can handle over 500k+ rules, you don't need that many to block unwanted content effectively.

[AdGuard](https://github.com/AdguardTeam) offers filters that remove [rarely used](https://adguard.com/kb/general/ad-filtering/create-own-filters/#not_optimized-hint) rules. These optimized lists load faster and use less memory while still blocking content effectively. AdGuard creates the lists using [statistics](https://adguard.com/kb/general/ad-filtering/tracking-filter-statistics) that indicate how often each rule is applied.

> [!NOTE]
> AdGuard for [iOS](https://adguard.com/en/adguard-ios/overview.html) automatically uses optimized filters, so you don't need to manually add the iOS-specific links provided below. The guide includes these links mainly for reference, as AdGuard doesn't explicitly label the built-in filters as "optimized" even though they are.

The rule counts below compare each optimized list to its original version in uBO. The numbers are a snapshot of the rule counts at the time of writing.

#### Ads

1. **[Easylist (Optimized)](https://filters.adtidy.org/extension/ublock/filters/101_optimized.txt)** (45k optimized vs. 82k rules) | [iOS version](https://filters.adtidy.org/ios/filters/101_optimized.txt) (28k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/101_optimized.txt&title=Easylist%20(Optimized))
   <br> EasyList is the primary filter list that removes most adverts from web pages, including unwanted frames, images, and objects. This filter is the most popular list used by many ad blockers.

2. **[EasyList + AdGuard Base filter (Optimized)](https://filters.adtidy.org/extension/ublock/filters/2_optimized.txt)** (73k optimized vs. 153k rules combined) | [iOS version](https://filters.adtidy.org/ios/filters/2_optimized.txt) (34k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/2_optimized.txt&title=AdGuard%20Base%20filter%20%2B%20EasyList%20(Optimized))
   <br> If Easylist (Optimized) is missing too many ads, then use this list, or stick with the built-in Easylist filter.

3. **[AdGuard Mobile Ads filter](https://filters.adtidy.org/extension/ublock/filters/11.txt)** (9k rules optimized) | [iOS version](https://filters.adtidy.org/ios/filters/11_optimized.txt) (6k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/11.txt&title=AdGuard%20Mobile%20Ads%20filter)
   <br> (**optional:** This filter is enabled by default when using uBO on Firefox for Android. It's an option in uBO under the category of **Ads**.)

#### Privacy

1. **[AdGuard Tracking Protection (Optimized)](https://filters.adtidy.org/extension/ublock/filters/3_optimized.txt)** (both use 100k rules; optimized removes comment lines `!`) | [iOS version](https://filters.adtidy.org/ios/filters/3_optimized.txt) (44k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/3_optimized.txt&title=AdGuard%20Tracking%20Protection%20(Optimized)%20)
   <br> A comprehensive list of various online counters and web analytics tools.

2. **[EasyPrivacy (Optimized)](https://filters.adtidy.org/extension/ublock/filters/118_optimized.txt)** (14k optimized vs. 50k rules) | [iOS version](https://filters.adtidy.org/ios/filters/118_optimized.txt) (14k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/118_optimized.txt&title=EasyPrivacy%20(Optimized))
   <br> EasyPrivacy is a filter list to comprehensively block tracking on web pages, including tracking scripts and information collectors. EasyPrivacy protects personal data by stopping these trackers. This filter is the second most popular list used by many ad blockers.

3. **[AdGuard URL Tracking filter (Optimized)](https://filters.adtidy.org/extension/ublock/filters/17_optimized.txt)** (2.6k rules; no separate unoptimized version) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/17_optimized.txt&title=AdGuard%20URL%20Tracking%20filter%20(Optimized))
   <br> Removes tracking parameters from URLs. Already merged into `Actually Legitimate URL Shortener Tool` above, but useful standalone if you don't want that list's other rules.

4. **[Legitimate URL Shortener (Optimized)](https://filters.adtidy.org/extension/ublock/filters/251_optimized.txt)** (3k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/251_optimized.txt&title=Legitimate%20URL%20Shortener%20(Optimized))
   <br> AdGuard-hosted build of `Actually Legitimate URL Shortener Tool`. Removes unnecessary `$` and `&` values from URLs. Use instead of the raw version above, not alongside it.

#### Annoyances (optimized)

1. **[Fanboy Annoyances (Optimized)](https://filters.adtidy.org/extension/ublock/filters/122_optimized.txt)** (56k optimized vs. 81k rules) | [iOS version](https://filters.adtidy.org/ios/filters/122_optimized.txt) (11k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/122_optimized.txt&title=Fanboy%20Annoyances%20(Optimized))
   <br> Hides website notifications, social media widgets, cookie notices, chat widgets, and some newsletters, thereby substantially decreasing web page loading times and uncluttering them. Includes `EasyList - Cookie Notices` and `EasyList - Social Widgets`.

2. **[AdGuard Annoyances (Optimized)](https://filters.adtidy.org/extension/ublock/filters/14_optimized.txt)** (44k optimized vs. 61k rules) | [iOS version](https://filters.adtidy.org/ios/filters/14_optimized.txt) (24k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/14_optimized.txt&title=AdGuard%20Annoyances%20(Optimized))
   <br> Contains the following AdGuard filters: Cookie Notices, Popups, Mobile App Banners, Other Annoyances and Widgets. (To block social media buttons, use `AdGuard Social Media filter` as well.)

3. **[AdGuard Social Media filter (Optimized)](https://filters.adtidy.org/extension/ublock/filters/4_optimized.txt)** (16k optimized vs. 21k rules) | [iOS version](https://filters.adtidy.org/ios/filters/4_optimized.txt) (7k rules)
   | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/4_optimized.txt&title=AdGuard%20Social%20Media%20filter%20(Optimized))
   <br> If you do not like numerous `Like` and `Tweet` buttons on all the popular websites on the Internet, then subscribe to this filter and you will not see them anymore.

4. **[Web Annoyances Ultralist (Optimized)](https://filters.adtidy.org/extension/ublock/filters/201_optimized.txt)** (2.4k optimized vs. 17k rules) | [iOS version](https://filters.adtidy.org/ios/filters/201_optimized.txt) (2.4k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/201_optimized.txt&title=Web%20Annoyances%20Ultralist%20(Optimized))
   <br> Blocks annoying web elements and reclaims lost screen real estate.

5. **[Adblock Warning Removal List (Optimized)](https://filters.adtidy.org/extension/ublock/filters/207_optimized.txt)** (2.9k rules; no separate unoptimized version) | [iOS version](https://filters.adtidy.org/ios/filters/207_optimized.txt) (2.9k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/207_optimized.txt&title=Adblock%20Warning%20Removal%20List%20(Optimized))
   <br> Removes anti-adblock warnings and other obtrusive messages that some sites show when they detect an ad blocker.

6. **[AdGuard Cookie Notices filter (Optimized)](https://filters.adtidy.org/android/filters/18_optimized.txt)** (11.6k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/android/filters/18_optimized.txt&title=AdGuard%20Cookie%20Notices%20filter%20(Optimized))
   <br> Blocks cookie notices on web pages. Already included in `AdGuard Annoyances`; use standalone if you only want cookie banners gone.

#### Regional

1. **[AdGuard German filter (Optimized)](https://filters.adtidy.org/android/filters/6_optimized.txt)** (5k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/android/filters/6_optimized.txt&title=AdGuard%20German%20filter%20(Optimized))
   <br> EasyList Germany + AdGuard German filter. Removes ads on German-language websites.

#### Security

1. **[uBlock Origin – Badware risks (Optimized)](https://filters.adtidy.org/android/filters/257_optimized.txt)** (4.2k rules) | [iOS version](https://filters.adtidy.org/ios/filters/257_optimized.txt) (4.2k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/android/filters/257_optimized.txt&title=uBlock%20Origin%20%E2%80%93%20Badware%20risks%20(Optimized))
   <br> Filter for risky sites, warning users of potential threats.

<!-- markdownlint-enable MD013 -->

## Advanced settings

Toggle on [advanced settings](https://github.com/gorhill/uBlock/wiki/Advanced-user-features).

> [!WARNING]
> Do not change these values blindly. Read the
> [description](https://github.com/gorhill/uBlock/wiki/Advanced-settings) for each preference.

| **Setting**                     | **Value** | **Description**                                                                                   |
| ------------------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `autoUpdateDelayAfterLaunch`    | `10`      | update out-of-date filter lists `x` seconds after browser startup                                 |
| `filterAuthorMode`              | `true`    | enable [Dynamic Filtering](https://github.com/gorhill/uBlock/wiki/Dynamic-filtering:-quick-guide) |
| `updateAssetBypassBrowserCache` | `true`    | bypass cache when manually fetching a filter list more than once an hour                          |

### Trusted list prefix

```text
trustedListPrefixes ublock- https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/
```

> [!IMPORTANT]
> `trustedListPrefixes` is required for Ven0m0's lists. Without it, uBlock Origin rejects every `trusted-*` scriptlet
> (most of the YouTube rules) with `Filter requires trusted source`. Keep the default `ublock-` prefix, separate
> prefixes with a space, then purge the list cache and update. Only add prefixes for lists you trust: trusted
> filters can rewrite page scripts and network responses.

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
