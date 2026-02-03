import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ScrapedProduct } from '../types';
import { randomDelay } from '../helpers';

import { WalmartPage } from '../pages/WalmartPage';
import * as path from 'path';

chromium.use(StealthPlugin());

// Chrome profile directory for persistent sessions
const PROFILE_DIR = path.join(process.cwd(), 'chrome_profile');

// Essential args for headless stealth (Windows compatible)
const STEALTH_ARGS = [
    '--disable-blink-features=AutomationControlled', // Hide automation flag
    '--disable-dev-shm-usage',                       // Prevents crashes in Docker/low memory
    '--no-first-run',                                // Skip first run wizard
    '--disable-notifications',                       // Block notification popups
    '--use-gl=swiftshader',                         // Software WebGL (consistent fingerprint)
    // Match viewport declaration
];

export async function scrapeWalmart(sku: string): Promise<ScrapedProduct | null> {
    console.log(`Scraping Walmart for SKU: ${sku}`);

    // Try direct product page first
    const product = await scrapeDirect(sku);
    if (product) return product;

    // Fallback strategies could be added here
    // e.g. search engine approach, but prone to captchas

    console.log('All strategies failed for this SKU');
    return null;
}

async function scrapeDirect(sku: string): Promise<ScrapedProduct | null> {
    console.log('  Strategy: Direct product page with stealth...');

    // Throttle requests
    await randomDelay(2000, 5000);

    let ctx = null;
    try {


        ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
            headless: true,
            channel: 'chrome',
            args: [...STEALTH_ARGS, '--headless=new'],
            // userAgent: "Mozilla/4.0 (PSP (PlayStation Portable); 2.00)",
            userAgent: "AppleTV11,1/11.1",
            viewport: { width: 1920, height: 1080 },
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
            permissions: ['geolocation'],
        });

        // Get page from context
        const page = ctx.pages().length > 0 ? ctx.pages()[0] : await ctx.newPage();

        // Inject anti-detection overrides before navigation
        await page.addInitScript(() => {
            // Hide webdriver flag  
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

            // Fake chrome runtime object
            (window as any).chrome = { runtime: {} };

            // Fake plugins array (headless shows empty)
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });

            // Set languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });

            // Spoof WebGL renderer strings
            const origGetParam = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (param) {
                if (param === 37445) return 'Intel Inc.';
                if (param === 37446) return 'Intel Iris OpenGL Engine';
                return origGetParam.call(this, param);
            };
        });

        const walmartPage = new WalmartPage(page, ctx);
        await walmartPage.goToProduct(sku);

        // Check for captcha
        if (await walmartPage.hasCaptcha()) {
            console.log('  Captcha detected, attempting solve...');
            const solved = await walmartPage.solveCaptcha();
            if (!solved) {
                console.log('  Captcha solve failed');
                await ctx.close();
                return null;
            }
        }

        const product = await walmartPage.extractFromDOM(sku);
        await ctx.close();

        if (product) {
            console.log(`  Found: ${product.title.substring(0, 50)}...`);
            return product;
        }

    } catch (err: any) {
        console.log(`  Direct scrape error: ${err.message}`);
        if (ctx) await ctx.close();
    }

    return null;
}
