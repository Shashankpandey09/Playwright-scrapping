import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ScrapedProduct, logError, randomDelay } from '../utils/utils';
import { UserAgentRotator } from '../utils/UserAgentRotator';
import { WalmartPage } from '../pages/WalmartPage';
import * as path from 'path';

chromium.use(StealthPlugin());

export async function scrapeWalmart(sku: string): Promise<ScrapedProduct | null> {
    console.log(`[INFO] Scraping Walmart for SKU: ${sku}`);

    // Strategy 0: Direct Scrape (Stealth Headless)
    const directProduct = await scrapeDirect(sku);
    if (directProduct) return directProduct;

    // // Strategy 1: Google Web Search(Rich Snippets)
    // const googleProduct = await scrapeViaGoogleSearch(sku);
    // if (googleProduct) return googleProduct;

    // Strategy 1.5: Brave Search (Human-like)
    // const braveProduct = await scrapeViaBraveSearch(sku);
    // if (braveProduct) return braveProduct;

    // Strategy 2: DuckDuckGo (Less strict anti-bot)
    // const ddgProduct = await scrapeViaDuckDuckGo(sku);
    // if (ddgProduct) return ddgProduct;

    console.log('[WARN] All strategies failed for this SKU');
    return null;
}

// Strategy 1.5: Brave Search (Human-like)
async function scrapeViaBraveSearch(sku: string): Promise<ScrapedProduct | null> {
    console.log('[INFO] Strategy 1.5: Brave -> Walmart Product Link...');

    let browser;
    try {
        browser = await chromium.launch({
            headless: false,
            args: ['--disable-blink-features=AutomationControlled']
        });

        const browserProfile = UserAgentRotator.getBrowserProfile();
        console.log(`[Brave] Rotating User-Agent: ${browserProfile.userAgent.substring(0, 50)}...`);

        const context = await browser.newContext({
            userAgent: browserProfile.userAgent,
            viewport: browserProfile.viewport,
            extraHTTPHeaders: {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1"
            }
        });

        const page = await context.newPage();

        // 1. Go to Brave
        await page.goto('https://search.brave.com/', { waitUntil: 'domcontentloaded' });
        await randomDelay(1500, 3000);

        // 2. Human Hover Pattern (Up-Left-Right)
        console.log('[INFO] Executing human hover pattern...');
        const viewport = page.viewportSize();
        if (viewport) {
            const centerX = viewport.width / 2;
            const centerY = viewport.height / 2;
            try {
                // Random movements
                await page.mouse.move(centerX, centerY);
                await randomDelay(200, 500);
                await page.mouse.move(centerX - 200, centerY - 200, { steps: 10 }); // Up-Left
                await randomDelay(200, 500);
                await page.mouse.move(centerX + 200, centerY - 100, { steps: 20 }); // Right
                await randomDelay(200, 500);
                await page.mouse.move(centerX, centerY, { steps: 10 }); // Back to center
            } catch (e) { }
        }

        // 3. Search for SKU directly
        try {
            console.log(`[INFO] Searching for SKU "${sku}" on Brave...`);

            // robust selector strategy for Brave
            const searchBox = page.locator('#searchbox, input[name="q"], input[type="search"]').first();
            await searchBox.waitFor({ state: 'visible', timeout: 10000 });
            await searchBox.click();
            await randomDelay(500, 1000);

            // Type "Walmart [SKU]" for better targeting
            const query = ` ${sku}`;
            await page.keyboard.type(query, { delay: Math.floor(Math.random() * 100) + 50 });
            await randomDelay(500, 1000);
            await page.keyboard.press('Enter');
            await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
            await randomDelay(2000, 4000);

        } catch (e: any) {
            console.log(`[WARN] Failed to search on Brave input. Error: ${e.message}`);
        }

        // 4. Click specific Walmart Product Link
        console.log('[INFO] Looking for Walmart Product link on Brave...');
        // Look for links containing "walmart.com/ip" which indicates a product page
        const productLink = page.locator('a[href*="walmart.com/ip"]').first();

        // Also fallback to just walmart.com if strictly IP not found, but prioritize IP
        const anyWalmartLink = page.locator('a[href*="walmart.com"]').first();

        let onWalmartSite = false;
        let isProductPage = false;

        if (await productLink.isVisible()) {
            try {
                console.log('[INFO] Found direct product link. Clicking...');
                await productLink.click();
                await page.waitForLoadState('domcontentloaded');
                await randomDelay(3000, 5000);
                onWalmartSite = true;
                isProductPage = true;
            } catch (e) {
                console.log('[WARN] Failed to click Brave product link.');
            }
        } else if (await anyWalmartLink.isVisible()) {
            try {
                console.log('[INFO] Found general Walmart link. Clicking...');
                await anyWalmartLink.click();
                await page.waitForLoadState('domcontentloaded');
                await randomDelay(3000, 5000);
                onWalmartSite = true;
            } catch (e) { }
        }

        if (!onWalmartSite) {
            console.log('[WARN] Could not find any Walmart link on Brave. Falling back to direct homepage navigation.');
            await page.goto('https://www.walmart.com', { waitUntil: 'domcontentloaded' });
            await randomDelay(2000, 4000);
            onWalmartSite = true;
        }

        // 5. Scrape or Search depending on where we landed
        const walmartPage = new WalmartPage(page, context);
        if (await walmartPage.hasCaptcha()) await walmartPage.solveCaptcha();

        if (!isProductPage) {
            // If we didn't land on product page, use internal search
            console.log('[INFO] Not on product page yet. Using internal search...');
            await walmartPage.searchForItem(sku);
            if (await walmartPage.hasCaptcha()) await walmartPage.solveCaptcha();
        }

        console.log('[INFO] Extracting product data...');
        let product = await walmartPage.extractFromDOM(sku);

        if (!product && !isProductPage) {
            // Check for list view click if we failed extract and were searching
            const firstItem = page.locator('[data-automation-id="search-result-gridview-items"] a, [data-testid="list-view"] a').first();
            if (await firstItem.isVisible()) {
                await firstItem.click();
                await page.waitForLoadState('domcontentloaded');
                await randomDelay(3000, 5000);
                product = await walmartPage.extractFromDOM(sku);
            }
        }

        await browser.close();
        if (product) {
            console.log(`[INFO] Successfully scraped via Brave path: ${product.title.substring(0, 50)}...`);
            return product;
        }

    } catch (error: any) {
        console.log(`[WARN] Brave Path error: ${error.message}`);
        if (browser) await browser.close();
    }
    return null;
}

async function scrapeDirect(sku: string): Promise<ScrapedProduct | null> {
    console.log('[INFO] Strategy 0: Direct Scraping with Persistent Context (Stealth Headless)...');

    // Add delay between requests
    console.log('[INFO] Waiting for 2-5 seconds before direct request...');
    await randomDelay(2000, 5000);

    let context;
    try {
        // Use a persistent user data directory to maintain cookies/storage (simulating a real user profile)
        const userDataDir = path.join(process.cwd(), 'chrome_profile');

        // Get a fresh browser profile for this scrape
        const browserProfile = UserAgentRotator.getBrowserProfile();
        console.log(`[Direct] Rotating User-Agent: ${browserProfile.userAgent.substring(0, 50)}...`);

        // Advanced anti-detection launch args for headless mode
        const stealthArgs = [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process', // Reduces fingerprinting
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu', // Consistent rendering
            '--no-first-run',
            '--no-zygote',
            '--disable-setuid-sandbox',
            '--no-sandbox',
            '--ignore-certificate-errors',
            '--window-size=1920,1080', // Realistic window size
            // WebGL Spoofing
            '--use-gl=swiftshader', // Software WebGL renderer (harder to fingerprint)
            '--enable-webgl',
            // Permissions override
            '--disable-notifications',
            '--disable-popup-blocking',
        ];

        context = await chromium.launchPersistentContext(userDataDir, {
            // Use boolean true, but pass --headless=new via args for new headless mode
            headless: true,
            channel: 'chrome', // Use real Chrome instead of bundled Chromium
            args: [...stealthArgs, '--headless=new'], // New headless mode via args
            userAgent: "AppleTV11,1/11.1",
            viewport: { width: 1920, height: 1080 }, // Desktop viewport for better trust
            deviceScaleFactor: 1,
            hasTouch: false,
            isMobile: false,
            extraHTTPHeaders: {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"'
            },
            permissions: ['geolocation'], // Grant permissions like a real user
        });

        // Persistent context usually opens a page by default
        const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

        // Inject stealth scripts BEFORE any navigation to hide headless indicators
        await page.addInitScript(() => {
            // Override navigator.webdriver
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

            // Fix chrome object
            (window as any).chrome = { runtime: {} };

            // Override permissions query
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters: any) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: 'denied' } as PermissionStatus) :
                    originalQuery(parameters)
            );

            // Override plugins (headless has empty plugins)
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5], // Non-empty array
            });

            // Override languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });

            // Override platform
            Object.defineProperty(navigator, 'platform', {
                get: () => 'Win32',
            });

            // Fix WebGL renderer (common headless detection vector)
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (parameter) {
                if (parameter === 37445) return 'Intel Inc.'; // UNMASKED_VENDOR_WEBGL
                if (parameter === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
                return getParameter.apply(this, [parameter]);
            };
        });

        const walmartPage = new WalmartPage(page, context);

        await walmartPage.goToProduct(sku);

        if (await walmartPage.hasCaptcha()) {
            console.log('[INFO] [Direct] Captcha detected. Attempting to solve like a human...');
            const solved = await walmartPage.solveCaptcha();

            if (!solved) {
                console.log('[WARN] [Direct] Captcha solve failed. Falling back to next strategy.');
                await context.close();
                return null;
            }
            console.log('[INFO] [Direct] Captcha potentially solved. Retrying extraction...');
        }

        const product = await walmartPage.extractFromDOM(sku);

        await context.close();

        if (product) {
            console.log(`[INFO] Successfully scraped directly: ${product.title.substring(0, 50)}...`);
            return product;
        }
    } catch (error: any) {
        console.log(`[WARN] Direct scrape error: ${error.message}`);
        if (context) await context.close();
    }
    return null;
}

async function scrapeViaGoogleSearch(sku: string): Promise<ScrapedProduct | null> {
    console.log('[INFO] Strategy 1: Google -> Walmart Navigation...');

    let browser;
    try {
        browser = await chromium.launch({
            headless: false, // Headful for better trust
            args: ['--disable-blink-features=AutomationControlled']
        });

        // Rotate user agent
        const browserProfile = UserAgentRotator.getBrowserProfile();
        console.log(`[Google] Rotating User-Agent: ${browserProfile.userAgent.substring(0, 50)}...`);

        const context = await browser.newContext({
            userAgent: browserProfile.userAgent,
            viewport: browserProfile.viewport,
            extraHTTPHeaders: {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1"
            }
        });

        const page = await context.newPage();

        // 1. Go to Google
        await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
        await randomDelay(1000, 2000);

        // Accept cookies if present
        if (await page.locator('button:has-text("Accept all")').isVisible()) {
            await page.locator('button:has-text("Accept all")').click();
            await randomDelay(500, 1000);
        }

        // 2. Search for "Walmart"
        console.log('[INFO] Searching for "Walmart" on Google...');

        // Random mouse movement to simulate looking for the box
        try {
            await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200, { steps: 10 });
        } catch (e) { }

        // Explicitly found the textarea and focus it
        try {
            const searchInput = page.locator('textarea[name="q"]').first();
            await searchInput.waitFor({ state: 'visible', timeout: 5000 });
            await searchInput.click();
        } catch (e) {
            const searchInput = page.locator('input[name="q"]').first();
            await searchInput.waitFor({ state: 'visible', timeout: 5000 });
            await searchInput.click();
        }

        await randomDelay(500, 1000);
        await page.keyboard.type('Walmart', { delay: Math.floor(Math.random() * 150) + 50 }); // Variable typing speed
        await randomDelay(500, 1000);
        await page.keyboard.press('Enter');
        await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
        await randomDelay(2000, 3000);

        // 3. Click the official Walmart link OR Fallback
        console.log('[INFO] Clicking Walmart link...');
        const walmartLink = page.locator('a[href*="walmart.com"]').first();

        let onWalmartSite = false;

        if (await walmartLink.isVisible()) {
            try {
                // More mouse movement before clicking
                const box = await walmartLink.boundingBox();
                if (box) {
                    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
                }

                await walmartLink.click();
                await page.waitForLoadState('domcontentloaded');
                await randomDelay(3000, 5000);
                onWalmartSite = true;
            } catch (e) {
                console.log('[WARN] Failed to click Google link, falling back...');
            }
        }

        if (!onWalmartSite) {
            console.log('[WARN] Could not find/click Walmart link on Google. Falling back to direct homepage navigation.');
            await page.goto('https://www.walmart.com', { waitUntil: 'domcontentloaded' });
            await randomDelay(2000, 4000);
            onWalmartSite = true;
        }

        // 4. Now on Walmart, use internal search
        const walmartPage = new WalmartPage(page, context);

        // Handle Captcha if present on arrival
        if (await walmartPage.hasCaptcha()) {
            console.log('[INFO] Captcha detected on arrival. Attempting to solve...');
            await walmartPage.solveCaptcha();
        }

        // Search for the SKU
        await walmartPage.searchForItem(sku);

        // Handle Captcha if present after search
        if (await walmartPage.hasCaptcha()) {
            console.log('[INFO] Captcha detected after search. Attempting to solve...');
            await walmartPage.solveCaptcha();
        }

        // 5. Scrape the product
        console.log('[INFO] Extracting product data...');
        // Assuming search takes us to product page or list. 
        // If list, we might need to click the first item, but for SKU search it usually redirects to product.
        // Let's try to extract direct first.
        let product = await walmartPage.extractFromDOM(sku);

        if (!product) {
            // Check if we are on a search result page and click the first item
            const firstItem = page.locator('[data-automation-id="search-result-gridview-items"] a, [data-testid="list-view"] a').first();
            if (await firstItem.isVisible()) {
                console.log('[INFO] Found search results, clicking first item...');
                await firstItem.click();
                await page.waitForLoadState('domcontentloaded');
                await randomDelay(3000, 5000);
                product = await walmartPage.extractFromDOM(sku);
            }
        }

        await browser.close();
        if (product) {
            console.log(`[INFO] Successfully scraped via Google path: ${product.title.substring(0, 50)}...`);
            return product;
        }

    } catch (error: any) {
        console.log(`[WARN] Google Path error: ${error.message}`);
        if (browser) await browser.close();
    }
    return null;
}

async function scrapeViaDuckDuckGo(sku: string): Promise<ScrapedProduct | null> {
    console.log('[INFO] Strategy 2: DuckDuckGo (Human Search Pattern)...');

    let browser;
    try {
        browser = await chromium.launch({
            headless: true, // Headless: true for DDG, but maybe false helps click-through? Staying true for now.
            args: ['--disable-blink-features=AutomationControlled']
        });

        // Fresh profile for DuckDuckGo human search pattern
        const browserProfile = UserAgentRotator.getBrowserProfile();
        console.log(`[DDG] Rotating User-Agent: ${browserProfile.userAgent.substring(0, 50)}...`);

        const context = await browser.newContext({
            userAgent: browserProfile.userAgent,
            viewport: browserProfile.viewport
        });

        const page = await context.newPage();

        // 1. Navigate to Homepage (Build Trust)
        await page.goto('https://duckduckgo.com/', { waitUntil: 'domcontentloaded' });
        await randomDelay(1000, 2000);

        // 2. Simulate Human Typing
        const searchBox = page.locator('#searchbox_input');
        await searchBox.click();

        const query = `${sku}`;
        // Type slowly with variation to mimic human behavior
        await page.keyboard.type(query, { delay: 100 });
        await randomDelay(500, 1000);

        // 3. Click Search
        await page.keyboard.press('Enter');
        await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
        await randomDelay(2000, 4000);

        // 4. Capture Backup Data (Snippet)
        const backupProduct = await page.evaluate((currentSku) => {
            const results = document.querySelectorAll('.react-results--main li, article');
            for (const res of results) {
                const link = res.querySelector('a[data-testid="result-title-a"], h2 a')?.getAttribute('href');
                if (!link || !link.includes('walmart.com/ip')) continue;

                const title = res.querySelector('h2, [data-testid="result-title-a"]')?.textContent?.trim();
                const snippet = res.textContent || '';

                let price = 'N/A';
                const priceMatch = snippet.match(/(?:\$|USD)\s*[\d,]+(?:\.\d{2})?/i);
                if (priceMatch) price = priceMatch[0];

                let rating = 'N/R';
                const ratingMatch = snippet.match(/(?:Rating:|Stars?|Score)?\s*(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*5|(\d+(?:\.\d+)?)\s*stars/i);
                if (ratingMatch) rating = ratingMatch[1] || ratingMatch[2];

                let reviews = '0 reviews';
                const reviewsMatch = snippet.match(/([\d,]+)\s*(?:reviews|ratings)/i);
                if (reviewsMatch) reviews = `${reviewsMatch[1]} reviews`;

                if (title) {
                    return {
                        sku: currentSku,
                        title: title.replace(' - Walmart.com', '').trim().substring(0, 200),
                        price,
                        rating,
                        reviews,
                        description: 'Walmart Product (via DuckDuckGo Snippet)'
                    };
                }
            }
            return null;
        }, sku);

        if (!backupProduct) {
            console.log('[WARN] No results found on DuckDuckGo.');
            await browser.close();
            return null;
        }

        console.log(`[INFO] Found backup via DDG: ${backupProduct.title.substring(0, 50)}...`);

        // 5. Click-Through removed (User Request to avoid Captcha loops)
        // Relying on snippet data only.


        // 6. Fallback to Backup
        await browser.close();
        return backupProduct;

    } catch (error: any) {
        console.log(`[WARN] DuckDuckGo error: ${error.message}`);
        if (browser) await browser.close();
        return null;
    }

}
