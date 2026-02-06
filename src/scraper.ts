import * as fs from 'fs';
import * as path from 'path';
import pLimit from 'p-limit';
import { scrapeAmazon } from './scrapers/amazonScraper';
import { scrapeWalmartWithContext } from './scrapers/walmartScraper';
import { ProductData, SKUItem, SKUList } from './types';
import { writeProductsToCSV, transformToCSV, retryWithBackoff, logError, clearErrorLog, randomDelay, warmProfile } from './helpers';
import { launchWorker, verifyWorkerIP, deleteWorkerProfile } from './helpers/worker.helper';
import { BrowserContext } from 'playwright';

const MAX_CONCURRENCY = 2;
const MAX_RETRIES = 2;
const VERIFY_IP = false;
const PRODUCTS_PER_SESSION = 10;
const DELAY_BETWEEN_PRODUCTS_MS = [5000, 8000];
const AMAZONConc = 2;
const walmartConc = 1;
const REWARM_AFTER_PRODUCTS = 10;

async function main() {
    clearErrorLog();
    const csvPath = path.join(process.cwd(), 'product_data.csv');
    if (fs.existsSync(csvPath)) {
        fs.unlinkSync(csvPath);
    }

    const skusPath = path.join(process.cwd(), 'skus.json');
    if (!fs.existsSync(skusPath)) {
        console.error('Error: skus.json not found');
        process.exit(1);
    }

    const skuData: SKUList = JSON.parse(fs.readFileSync(skusPath, 'utf-8'));
    console.log(`Loaded ${skuData.skus.length} SKUs`);

    const amazonSkus = skuData.skus.filter(item => item.Type === 'Amazon');
    const walmartSkus = skuData.skus.filter(item => item.Type === 'Walmart');

    const results: ProductData[] = [];

    const amazonTasks: Promise<void>[] = [];
    const walmartTasks: Promise<void>[] = [];

    if (amazonSkus.length > 0) {
        const amazonLimit = pLimit(AMAZONConc);
        console.log(`Queueing ${amazonSkus.length} Amazon products (concurrency: 3)`);
        amazonSkus.forEach(item => {
            amazonTasks.push(amazonLimit(() => processAmazonItem(item, results)));
        });
    }

    if (walmartSkus.length > 0) {
        const walmartLimit = pLimit(walmartConc);
        const batches = chunkArray(walmartSkus, PRODUCTS_PER_SESSION);
        console.log(`Queueing ${batches.length} Walmart batches (concurrency: 1)`);
        batches.forEach((batch, index) => {
            walmartTasks.push(walmartLimit(() => processWalmartBatch(batch, index, results)));
        });
    }

    console.log(`Starting processing...`);
    await Promise.all([...amazonTasks, ...walmartTasks]);

    if (results.length > 0) {
        await writeProductsToCSV(results);
    }

    console.log(`Done. Scraped: ${results.length}/${skuData.skus.length}`);
}

async function processAmazonItem(item: SKUItem, results: ProductData[]): Promise<void> {
    try {
        const scrapedData = await retryWithBackoff(
            async () => {
                const result = await scrapeAmazon(item.SKU);
                if (!result) throw new Error('Scrape returned null');
                return result;
            },
            MAX_RETRIES,
            item.SKU,
            'Amazon'
        );

        if (scrapedData) {
            const productData = transformToCSV(item.SKU, item.Type, scrapedData);
            results.push(productData);
        }
    } catch (err: any) {
        logError(item.SKU, item.Type, `Amazon scrape failed: ${err.message}`);
    }
}

async function processWalmartBatch(batch: SKUItem[], workerIndex: number, results: ProductData[]): Promise<void> {
    console.log(`Starting Walmart batch ${workerIndex + 1} with ${batch.length} items`);
    let ctx: BrowserContext | null = null;
    let sessionFailed = false;

    try {
        ctx = await launchWorker({ workerIndex, headless: false });

        if (VERIFY_IP) await verifyWorkerIP(ctx);

        await warmProfile(ctx, { workerIndex });

        for (let i = 0; i < batch.length; i++) {
            const item = batch[i];

            if (i > 0) {
                const delay = DELAY_BETWEEN_PRODUCTS_MS[0] +
                    Math.random() * (DELAY_BETWEEN_PRODUCTS_MS[1] - DELAY_BETWEEN_PRODUCTS_MS[0]);
                await new Promise(r => setTimeout(r, delay));
            }

            console.log(`Processing ${item.SKU}`);

            try {
                const scrapedData = await retryWithBackoff(
                    async () => {
                        if (!ctx) throw new Error('Browser context is null');
                        const result = await scrapeWalmartWithContext(item.SKU, ctx);
                        if (!result) throw new Error('Scrape returned null');
                        return result;
                    },
                    MAX_RETRIES,
                    item.SKU,
                    'Walmart'
                );

                if (scrapedData) {
                    const productData = transformToCSV(item.SKU, item.Type, scrapedData);
                    results.push(productData);
                    console.log(`Success ${item.SKU}`);
                }
            } catch (err: any) {
                logError(item.SKU, item.Type, `Scrape error: ${err.message}`);
                console.log(`Error ${item.SKU}: ${err.message}`);

                if (err.message.includes('captcha') || err.message.includes('crash')) {
                    sessionFailed = true;
                    break;
                }
            }
        }

    } catch (err: any) {
        console.error(`Batch ${workerIndex + 1} failed to launch: ${err.message}`);
        sessionFailed = true;
    } finally {
        if (ctx) {
            await ctx.close();
        }

        if (sessionFailed) {
            await deleteWorkerProfile(workerIndex);
            console.log(`Profile reset for worker ${workerIndex} (session failed - CAPTCHA or crash)`);
        }
    }
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
