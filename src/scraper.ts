import * as fs from 'fs';
import * as path from 'path';
import pLimit from 'p-limit';
import { scrapeAmazon } from './scrapers/amazonScraper';
import { scrapeWalmartWithContext } from './scrapers/walmartScraper';
import { ProductData, SKUItem, SKUList } from './types';
import { writeProductsToCSV, transformToCSV, retryWithBackoff, logError, clearErrorLog, randomDelay } from './helpers';
import { launchWorker, verifyWorkerIP, deleteWorkerProfile } from './helpers/worker.helper';
import { PROXY_CONFIG } from './proxy.config';
import { BrowserContext } from 'playwright';

const MAX_CONCURRENCY = 1;
const MAX_RETRIES = 2;
const VERIFY_IP = false;

async function main() {
    clearErrorLog();
    const csvPath = path.join(process.cwd(), 'product_data.csv');
    if (fs.existsSync(csvPath)) {
        fs.unlinkSync(csvPath);
    }

    const skusPath = path.join(process.cwd(), 'skus.json');
    if (!fs.existsSync(skusPath)) {
        console.error('Error: skus.json not found!');
        process.exit(1);
    }

    const skuData: SKUList = JSON.parse(fs.readFileSync(skusPath, 'utf-8'));
    console.log(`Loaded ${skuData.skus.length} SKUs`);

    const results: ProductData[] = [];
    const limit = pLimit(MAX_CONCURRENCY);
    const tasks = skuData.skus.map((item, index) =>
        limit(() => processItemWithWorker(item, index % MAX_CONCURRENCY, results))
    );

    console.log(`Starting ${MAX_CONCURRENCY} workers...`);
    await Promise.all(tasks);

    if (results.length > 0) {
        await writeProductsToCSV(results);
    }

    console.log(`Done. Scraped: ${results.length}/${skuData.skus.length}`);
}

async function processItemWithWorker(
    item: SKUItem,
    workerIndex: number,
    results: ProductData[]
): Promise<void> {
    let ctx: BrowserContext | null = null;
    let shouldResetProfile = false;

    try {
        ctx = await launchWorker({ workerIndex, headless: true });

        if (VERIFY_IP) await verifyWorkerIP(ctx);

        let scrapedData = null;

        if (item.Type === 'Amazon') {
            scrapedData = await retryWithBackoff(
                async () => {
                    const result = await scrapeAmazon(item.SKU);
                    if (!result) throw new Error('Scrape returned null');
                    return result;
                },
                MAX_RETRIES,
                item.SKU,
                'Amazon'
            );
        } else if (item.Type === 'Walmart') {
            scrapedData = await retryWithBackoff(
                async () => {
                    if (!ctx) throw new Error('Context not initialized');
                    const result = await scrapeWalmartWithContext(item.SKU, ctx);
                    if (!result) throw new Error('Scrape returned null');
                    return result;
                },
                MAX_RETRIES,
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
        }

    } catch (err: any) {
        logError(item.SKU, item.Type, `Worker ${workerIndex} failed: ${err.message}`);
        if (item.Type === 'Walmart') {
            shouldResetProfile = true;
        }
    } finally {

        if (ctx) {
            await ctx.close();
        }

        if (shouldResetProfile) {
            await deleteWorkerProfile(workerIndex);
        }
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});