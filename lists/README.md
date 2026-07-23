### URL Tracking Parameters

Add the functionality of [ClearURLs](https://github.com/ClearURLs/Addon#-clearurls-) to uBO. These filter lists automatically remove tracking elements from URLs to protect your privacy when browsing the Internet.

1) :star: **[Actually Legitimate URL Shortener Tool](https://github.com/DandelionSprout/adfilt/blob/master/LegitimateURLShortener.txt)** (2.8k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/DandelionSprout/adfilt/master/LegitimateURLShortener.txt&title=Actually%20Legitimate%20URL%20Shortener%20Tool)
<br> This list also [includes](https://github.com/DandelionSprout/adfilt/discussions/163?sort=old#discussioncomment-3956776) all entries from `AdGuard's URL Tracking Protection` as of October 2022, but you can use both lists.

2) **[ClearURLs for uBO](https://github.com/DandelionSprout/adfilt/tree/master/ClearURLs%20for%20uBo)** (700 rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/DandelionSprout/adfilt/master/ClearURLs%20for%20uBo/clear_urls_uboified.txt&title=ClearURLS%20for%20URLs)
<br> This list is just the rules from the ClearURLs extension converted into a filterlist.

> [!TIP]
> If you find websites with tracking parameters or experience site issues, you can submit those [here](https://github.com/DandelionSprout/adfilt/discussions/163?sort=new).

### Fonts

1) [**Block third-party fonts**](https://github.com/yokoffing/filterlists/blob/main/block_third_party_fonts.txt) (89 rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/yokoffing/filterlists/main/block_third_party_fonts.txt&title=Block%20third-party%20fonts)
<br> This filter blocks fonts from third-party domains, which improves page load speed and protects your privacy. There are built-in exceptions to minimize site issues, such as allowing for font icons. Overall, it's more flexible than blocking all third-party fonts outright (e.g., `$font,3p`).

> [!NOTE]
> Blocking web fonts will affect the "look and feel" of some sites.

## Annoyances

1) :star: [**yokoffing's Annoyance List**](https://github.com/yokoffing/filterlists/blob/main/annoyance_list.txt) (1k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/yokoffing/filterlists/main/annoyance_list.txt&title=yokoffing's%20Annoyance%20List)
<br> A curated list that captures nuisances missed by other maintainers. It also cleans up the clutter around many sites (e.g., related articles, "read more", etc.).

2) [**Fanboy's Agegate List**](https://secure.fanboy.co.nz/fanboy-agegate.txt) | [subscribe](https://subscribe.adblockplus.org/?location=https://secure.fanboy.co.nz/fanboy-agegate.txt&title=Fanboy's%20Agegate%20List)
<br> For age-gated content.

3) **[Browse websites without logging in](https://github.com/DandelionSprout/adfilt/blob/master/BrowseWebsitesWithoutLoggingIn.txt)** (370 rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/DandelionSprout/adfilt/master/BrowseWebsitesWithoutLoggingIn.txt&title=Browse%20websites%20without%20logging%20in)
<br> This list attempts to bypass forced logins on sites.

4) [**YouTube Clear View**](https://github.com/yokoffing/filterlists/blob/main/youtube_clear_view.txt) (17 rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/yokoffing/filterlists/main/youtube_clear_view.txt&title=YouTube%20Clear%20View)
<br> Cleans up some of the clutter on YouTube.

### Paywalls
To most effectively bypass paywalls, use the **Bypass Paywalls Clean** [extension](https://gitflic.ru/user/magnolia1234). The blocklists are limited in what they can do and are therefore **optional**.

1) **[Bypass Paywalls Clean filter](https://gitflic.ru/project/magnolia1234/bypass-paywalls-clean-filters/blob/?file=bpc-paywall-filter.txt&branch=main)** (960 rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://gitflic.ru/project/magnolia1234/bypass-paywalls-clean-filters/blob/raw?file=bpc-paywall-filter.txt&title=Bypass%20Paywalls%20Clean%20filter)
<br> You do not need this filterlist if you use the extension.
 
2) **[Anti-paywall filters](https://github.com/liamengland1/miscfilters/blob/master/antipaywall.txt)** (2k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/liamengland1/miscfilters/master/antipaywall.txt&title=Anti-paywall%20filters)
 <br> This list blocks additional third-party requests and annoyances that are not covered in the `Bypass Paywalls Clean` filterlist.

## Security

High-risk sites can expose your device to threats. These lists can prevent that by warning you before navigation or limiting what you can access.

1) :new: [**High-Entropy NRDs (7-day)**](https://github.com/hagezi/dns-blocklists?tab=readme-ov-file#new-newly-registered-domains-nrddga-) (509k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/adblock/dga7.txt&title=Hagezi%20High-Entropy%20NRDs%207-Day%20)
<br> Targets newly registered domains (NRDs) from the past 7 days that exhibit structural randomness. "High entropy" describes domains that look like computer-generated gibberish, such as `qj9z2x5m0l.com`. Attackers use Domain Generation Algorithms (DGAs) to produce addresses daily so that infected devices can secretly "phone home" to [command servers](https://medium.com/@laurent.mandine/c2-role-in-cyber-attack-dde4710f2037). Note that this blocklist will not catch sophisticated phishing attacks that use readable dictionary words to mimic legitimate brands, such as `verizon-wireless-login.com`. Domains are provided by [Stamus Labs]( https://www.stamus-networks.com/stamus-labs/subscribe-to-threat-intel-feed).

2) [**Most Abused TLDs**](https://github.com/hagezi/dns-blocklists/blob/main/adblock/spam-tlds-ublock.txt) (286 rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/spam-tlds-ublock.txt&title=Most%20Abused%20TLDs)
<br> Displays a warning before navigating to a site with an abused [TLD](https://en.wikipedia.org/wiki/Top-level_domain). Allows exceptions for legitimate sites. Merged from my own [Enhanced website protection](https://raw.githubusercontent.com/yokoffing/filterlists/main/enhanced_site_protection.txt) list, Dandelion Sprout's `Anti-Malware List`, LennyFox's `Block non-Latin TLDs` [list](https://github.com/LennyFox/Blocklists/blob/master/Block_non_latin_TLDs.txt), and [Spamhaus](https://www.spamhaus.org/reputation-statistics/cctlds/domains/) statistics.

3) **[Dandelion Sprout's Anti-Malware List](https://github.com/DandelionSprout/adfilt/blob/master/Dandelion%20Sprout's%20Anti-Malware%20List.txt)** (88k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/DandelionSprout/adfilt/master/Dandelion%20Sprout's%20Anti-Malware%20List.txt&title=Dandelion%20Sprout's%20Anti-Malware%20List)
<br> This list blocks domains with high abuse rates and their search results. It also blocks domains involved in malware redirects, domain parking, and Windows [PUP](https://en.wikipedia.org/wiki/Potentially_unwanted_program) ads. It has many other subcategories that distinguish it from similar lists.

4) **[The malicious website blocklist](https://github.com/iam-py-test/my_filters_001/blob/main/antimalware.txt)** (38k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/iam-py-test/my_filters_001/main/antimalware.txt&title=The%20malicious%20website%20blocklist)
<br> This version includes author comments, [vxvault.net's list](https://github.com/iam-py-test/vxvault_filter), the [anti-PUP list](https://github.com/iam-py-test/my_filters_001/blob/main/antipup.txt), and [additional rules](https://github.com/iam-py-test/my_filters_001/blob/main/special_lists/anti-malware-ubo-extension.txt) for uBO.

## All-Purpose

A combo list bundles multiple filter lists into one. They pull updates from all the source lists and combine them.

The trade-off is that you must rely on the combo list's maintainer. You are relying on them to refresh the list regularly. If they stop maintaining the list, your filtering becomes outdated.

Check that the combo list is still actively maintained before you add it.

1) [**uBlock combo list**](https://github.com/iam-py-test/uBlock-combo/blob/main/list.txt) (140k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/iam-py-test/uBlock-combo/main/list.txt&title=uBlock%20combo%20list)
<br> This list filters URL tracking [parameters](https://github.com/DandelionSprout/adfilt/discussions/163?sort=new) as well as malware, scams, and phishing. It combines the following lists: [Dandelion Sprout's Anti-Malware List](https://github.com/yokoffing/filterlists#security), [Actually Legitimate URL Shortener Tool](https://github.com/yokoffing/filterlists#url-tracking-parameters), [The malicious website blocklist](https://github.com/yokoffing/filterlists#security), and the [anti-typo list](https://github.com/iam-py-test/my_filters_001/blob/main/antitypo.txt).

2) [**Hagezi COMBO "ALT-SUGGESTED-MINI" AdBlock List (Top-N Version)**](https://github.com/cbuijs/hagezi/blob/main/combo/alt-suggested-mini/domains.top-n.adblock) (37k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/cbuijs/hagezi/refs/heads/main/combo/alt-suggested-mini/domains.top-n.adblock&title=hagezi%20combo%20alt%20suggested%20mini%20list)
<br> Combines Hagezi's [Ultimate mini](https://github.com/hagezi/dns-blocklists?tab=readme-ov-file#closed_book-multi-ultimate-mini-) and [TIF mini](https://github.com/hagezi/dns-blocklists?tab=readme-ov-file#tifmini) lists, and adds [Dynamic DNS](https://github.com/hagezi/dns-blocklists?tab=readme-ov-file#dyndns), [Badware Hoster](https://github.com/hagezi/dns-blocklists?tab=readme-ov-file#hoster), and [URL Shortener](https://github.com/hagezi/dns-blocklists?tab=readme-ov-file#urlshortener) filters. This list is [optimized](https://github.com/cbuijs/hagezi/issues/8#issuecomment-3367969858) by removing redundant sub-domains. If you don't mind doubling the rule count, you can use the [non-mini version](https://raw.githubusercontent.com/cbuijs/hagezi/refs/heads/main/combo/alt-suggested/domains.top-n.adblock) which uses the full Ultimate and TIF lists. The `Top-N Version` provided here contains only domains that have been found on the top 1-10 million most popular domains. (For adblockers, I recommend sticking with this `domains.top-n.adblock` version.) You can also explore the other combo [variants](https://github.com/cbuijs/hagezi/tree/main/combo).

***

## Optimized Lists

> [!IMPORTANT]
> These lists sacrifice blocking comprehensiveness for efficiency, so expect occasional gaps in coverage when compared to their regular versions. Remember this if you run into less blocking than anticipated or when troubleshooting a website.

Another way to improve performance is to use alternative filter lists with fewer rules. **These filters are intended predominately for mobile devices.** So although uBO can handle over 500k+ rules, you don't need that many to block unwanted content effectively.

[AdGuard](https://github.com/AdguardTeam) offers filters that remove [rarely used](https://adguard.com/kb/general/ad-filtering/create-own-filters/#not_optimized-hint) rules. These optimized lists load faster and use less memory while still blocking content effectively. AdGuard creates the lists using [statistics](https://adguard.com/kb/general/ad-filtering/tracking-filter-statistics) that indicate how often each rule is applied.

> [!NOTE]
> AdGuard for [iOS](https://adguard.com/en/adguard-ios/overview.html) automatically uses optimized filters, so you don't need to manually add the iOS-specific links provided below. The guide includes these links mainly for reference, as AdGuard doesn't explicitly label the built-in filters as "optimized" even though they are.

The rule counts below compare each optimized list to its original version in uBO. The numbers are a snapshot of the rule counts at the time of writing.

### Example 

When finished, your setup could look something like this:

![339063016-fa0916c2-4e81-4f86-baaa-7f2bfb975fa0](https://github.com/user-attachments/assets/4b1a5d76-3876-4a42-8a8d-19d2f0269faf)

Those who like to tinker may want to try this out, but you're better off just using the native lists. [YMMV](https://dictionary.cambridge.org/us/dictionary/english/ymmv)

### Ads

1) **[Easylist (Optimized)](https://filters.adtidy.org/extension/ublock/filters/101_optimized.txt)** (45k optimized vs. 82k rules) | [iOS version](https://filters.adtidy.org/ios/filters/101_optimized.txt) (28k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/101_optimized.txt&title=Easylist%20(Optimized))
<br> EasyList is the primary filter list that removes most adverts from web pages, including unwanted frames, images, and objects. This filter is the most popular list used by many ad blockers. 

2) **[EasyList + AdGuard Base filter (Optimized)](https://filters.adtidy.org/extension/ublock/filters/2_optimized.txt)** (73k optimized  vs. 153k rules combined) | [iOS version](https://filters.adtidy.org/ios/filters/2_optimized.txt) (34k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/2_optimized.txt&title=AdGuard%20Base%20filter%20%2B%20EasyList%20(Optimized))
<br> If Easylist (Optimized) is missing too many ads, then use this list, or stick with the built-in Easylist filter. 

3) **[AdGuard Mobile Ads filter](https://filters.adtidy.org/extension/ublock/filters/11.txt)** (9k rules optimized) | [iOS version](https://filters.adtidy.org/ios/filters/11_optimized.txt) (6k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/11.txt&title=AdGuard%20Mobile%20Ads%20filter)
<br> (**optional:** This filter is enabled by default when using uBO on Firefox for Android. It's an option in uBO under the category of **Ads**.) 

### Privacy

1. **[AdGuard Tracking Protection (Optimized)](https://filters.adtidy.org/extension/ublock/filters/3_optimized.txt)** (both use 100k rules; optimized removes comment lines `!`) | [iOS version](https://filters.adtidy.org/ios/filters/3_optimized.txt) (44k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/3_optimized.txt&title=AdGuard%20Tracking%20Protection%20(Optimized)%20)
<br> A comprehensive list of various online counters and web analytics tools. 

3. **[EasyPrivacy (Optimized)](https://filters.adtidy.org/extension/ublock/filters/118_optimized.txt)** (14k optimized vs. 50k rules) | [iOS version](https://filters.adtidy.org/ios/filters/118_optimized.txt) (14k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/118_optimized.txt&title=EasyPrivacy%20(Optimized))
<br> EasyPrivacy is a filter list to comprehensively block tracking on web pages, including tracking scripts and information collectors. EasyPrivacy protects personal data by stopping these trackers. This filter is the second most popular list used by many ad blockers. 

### Annoyances

1) **[Fanboy Annoyances (Optimized)](https://filters.adtidy.org/extension/ublock/filters/122_optimized.txt)** (56k optimized vs. 81k rules) |  [iOS version](https://filters.adtidy.org/ios/filters/122_optimized.txt) (11k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/122_optimized.txt&title=Fanboy%20Annoyances%20(Optimized))
<br> Hides website notifications, social media widgets, cookie notices, chat widgets, and some newsletters, thereby substantially decreasing web page loading times and uncluttering them. Includes `EasyList - Cookie Notices` and `EasyList - Social Widgets`.

2) **[AdGuard Annoyances (Optimized)](https://filters.adtidy.org/extension/ublock/filters/14_optimized.txt)** (44k optimized vs. 61k rules) | [iOS version](https://filters.adtidy.org/ios/filters/14_optimized.txt) (24k rules) | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/14_optimized.txt&title=AdGuard%20Annoyances%20(Optimized))
<br> Contains the following AdGuard filters: Cookie Notices, Popups, Mobile App Banners, Other Annoyances and Widgets. (To block social media buttons, use `AdGuard Social Media filter` as well.)

4) **[AdGuard Social Media filter (Optimized)](https://filters.adtidy.org/extension/ublock/filters/4_optimized.txt)** (16k optimized vs. 21k rules) | [iOS version](https://filters.adtidy.org/ios/filters/4_optimized.txt) (7k rules)
 | [subscribe](https://subscribe.adblockplus.org/?location=https://filters.adtidy.org/extension/ublock/filters/4_optimized.txt&title=AdGuard%20Social%20Media%20filter%20(Optimized))
<br> If you do not like numerous `Like` and `Tweet` buttons on all the popular websites on the Internet, then subscribe to this filter and you will not see them anymore.

***

# Advanced Settings

Toggle on [advanced settings](https://github.com/gorhill/uBlock/wiki/Advanced-user-features).

![advanced user](https://github.com/yokoffing/filterlists/assets/11689349/80c650dc-3f4f-4291-ab5f-53db3c42b7fc)

> [!WARNING]
 > Do not change these values blindly. Read the [description](https://github.com/gorhill/uBlock/wiki/Advanced-settings) for each preference.

| **Setting**                     | **Value**           | **Description**                                                                                      |
|---------------------------------|---------------------|------------------------------------------------------------------------------------------------------|
| `autoUpdateDelayAfterLaunch`    | `10`                | update out-of-date filter lists `x` seconds after browser startup                                    |
| `filterAuthorMode`              | `true`              | enable [Dynamic Filtering](https://github.com/gorhill/uBlock/wiki/Dynamic-filtering:-quick-guide)    |
| `updateAssetBypassBrowserCache` | `true`              | bypass cache when manually fetching a filter list more than once an hour                             |

***


https://github.com/yokoffing/filterlists/blob/main/block_third_party_fonts.txt
https://filters.adtidy.org/android/filters/239_optimized.txt