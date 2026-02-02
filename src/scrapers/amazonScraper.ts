import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { AmazonPage } from '../pages/AmazonPage';
import { ScrapedProduct, logError } from '../utils/utils';

chromium.use(StealthPlugin());

export async function scrapeAmazon(sku: string): Promise<ScrapedProduct | null> {
    console.log(`\n[INFO] Scraping Amazon for SKU: ${sku}`);

    const browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled']
    });

    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        const page = await context.newPage();
        const amazonPage = new AmazonPage(page, context);

        console.log('  Step 1: Navigating to Amazon...');
        await amazonPage.goToHome();

        console.log(`  Step 2: Searching for '${sku}'...`);
        await amazonPage.search(sku);

        console.log('  Step 3: Extracting product data...');
        const product = await amazonPage.scrapeProduct(sku);

        if (!product) {
            logError(sku, 'Amazon', 'Product not found in search results');
            await browser.close();
            return null;
        }

        console.log(`  [INFO] Found product: ${product.title.substring(0, 50)}...`);
        await browser.close();
        return product;

    } catch (error: any) {
        logError(sku, 'Amazon', error.message);
        await browser.close();
        return null;
    }
}
