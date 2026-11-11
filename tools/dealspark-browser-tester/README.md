# DealSpark Browser Tester

A visible desktop browser program for checking whether DealSpark appears in Google and Bing results and whether store/product pages load.

## Start on Windows
1. Install Python 3.10+ from https://www.python.org/downloads/ (enable "Add Python to PATH").
2. Download this folder from GitHub.
3. Double-click `START-WINDOWS.bat`.
4. Choose Google/Bing, enter search phrases and product URLs, choose repeat cycles, then press **Start browser test**.

## Features
- Opens a visible Chromium browser.
- Searches Google and Bing for each entered phrase.
- Checks visible search links for the DealSpark Shopify domain and records the first detected result-link position.
- Performs at most one result click-through per engine/keyword per run to verify that the result opens.
- Repeat cycles re-check result visibility; supplied store/product URLs are directly opened each cycle for page-load testing.
- Stop button and CSV report in the `results` folder.

## Notes
Search result layouts and rankings vary by country, language, device, personalization, and time. This is a browser QA aid, not a certified rank tracker. Search engines may show consent pages, CAPTCHAs, or rate limits. Do not bypass them. The program does not create fake clicks, purchases, or traffic.
