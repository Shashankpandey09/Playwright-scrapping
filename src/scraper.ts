import * as fs from 'fs';
import * as path from 'path';
import { scrapeAmazon } from './scrapers/amazonScraper';
import { scrapeWalmart } from './scrapers/walmartScraper';
import { ProductData, transformToCSV, writeToCSV, retryWithBackoff, logError } from './utils/utils';

interface SKUItem {
    Type: 'Amazon' | 'Walmart';
    SKU: string;
}

interface SKUList {
    skus: SKUItem[];
}

async function main() {
    console.log("Starting to scrap for products")

    const errorsLogPath = path.join(process.cwd(), 'errors.log');
    if (fs.existsSync(errorsLogPath)) {
        fs.unlinkSync(errorsLogPath);
    }

    const csvPath = path.join(process.cwd(), 'product_data.csv');
    if (fs.existsSync(csvPath)) {
        fs.unlinkSync(csvPath);
    }

    const skusPath = path.join(process.cwd(), 'skus.json');

    if (!fs.existsSync(skusPath)) {
        console.error('❌ Error: skus.json not found!');
        process.exit(1);
    }

    const skuData: SKUList = JSON.parse(fs.readFileSync(skusPath, 'utf-8'));
    console.log(`[INFO] Loaded ${skuData.skus.length} SKUs from skus.json\n`);

    const results: ProductData[] = [];
    const MAX_CONCURRENCY = 1;

    // Concurrency helper
    const processItem = async (item: SKUItem) => {
        try {
            let scrapedData = null;

            if (item.Type === 'Amazon') {
                scrapedData = await retryWithBackoff(
                    () => scrapeAmazon(item.SKU),
                    2,
                    item.SKU,
                    'Amazon'
                );
            } else if (item.Type === 'Walmart') {
                scrapedData = await retryWithBackoff(
                    () => scrapeWalmart(item.SKU),
                    2,
                    item.SKU,
                    'Walmart'
                );
            } else {
                logError(item.SKU, item.Type, 'Unknown source type');
                return;
            }

            if (scrapedData) {
                const productData = transformToCSV(item.SKU, item.Type, scrapedData);
                results.push(productData);
            } else {
                logError(item.SKU, item.Type, 'Scraping returned null');
            }

        } catch (error: any) {
            logError(item.SKU, item.Type, `Scraping failed: ${error.message}`);
        }
    };

    console.log(`[INFO] Starting scraping with ${MAX_CONCURRENCY} concurrent workers...`);

    // Simple concurrency implementation
    const queue = [...skuData.skus];
    const workers = Array(Math.min(MAX_CONCURRENCY, queue.length)).fill(null).map(async () => {
        while (queue.length > 0) {
            const item = queue.shift();
            if (item) {
                await processItem(item);
            }
        }
    });

    await Promise.all(workers);

    if (results.length > 0) {
        await writeToCSV(results);
        console.log(`[INFO] Saved ${results.length} product(s) to product_data.csv`);
    } else {
        console.log('\n[WARN] No products were successfully scraped.');
    }


    console.log('[INFO] SCRAPING COMPLETE');

    console.log(`[INFO] Successfully scraped: ${results.length}/${skuData.skus.length}`);
    console.log(`[INFO] Output: product_data.csv`);
    console.log(`[INFO] Errors: errors.log`);

}

main().catch(error => {
    console.error('[FATAL] Error:', error);
    process.exit(1);
});