import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { AmazonPage } from '../pages/AmazonPage';
import { ScrapedProduct } from '../types';
import { logError } from '../helpers';

chromium.use(StealthPlugin());

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';

export async function scrapeAmazon(sku: string): Promise<ScrapedProduct | null> {
    console.log(`Processing ${sku}`);

    const browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled'],
        channel: 'chrome'
    });

    try {
        const context = await browser.newContext({
            userAgent: DEFAULT_UA,
            viewport: { width: 1920, height: 1080 }
        });

        const page = await context.newPage();
        const amazonPage = new AmazonPage(page, context);



        await amazonPage.goToHome();
        await amazonPage.search(sku);
        const product = await amazonPage.scrapeProduct(sku);

        if (!product) {
            logError(sku, 'Amazon', 'Product not found in search results');
            await browser.close();
            return null;
        }

        console.log(`  Found: ${product.title.substring(0, 50)}...`);
        await browser.close();
        return product;

    } catch (err: any) {
        logError(sku, 'Amazon', err.message);
        await browser.close();
        return null;
    }
}
