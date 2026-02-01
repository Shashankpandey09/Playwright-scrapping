import { BrowserContext } from 'playwright';
import { ScrapedProduct } from '../types';
import { randomDelay } from '../helpers';
import { WalmartPage } from '../pages/WalmartPage';

export async function scrapeWalmartWithContext(
    sku: string,
    ctx: BrowserContext
): Promise<ScrapedProduct | null> {
    console.log(`Processing ${sku}`);
    await randomDelay(2000, 5000);

    try {
        const page = ctx.pages().length > 0 ? ctx.pages()[0] : await ctx.newPage();

        const walmartPage = new WalmartPage(page, ctx);
        await walmartPage.goToProduct(sku);

        if (await walmartPage.hasCaptcha()) {
            console.log('Captcha detected');
            const solved = await walmartPage.solveCaptcha();
            if (!solved) return null;
        }

        const product = await walmartPage.extractFromDOM(sku);

        if (product) {
            console.log(`  Found: ${product.title.substring(0, 50)}...`);
            return product;
        }

    } catch (err: any) {
        console.log(`  Scrape error: ${err.message}`);
    }

    return null;
}


