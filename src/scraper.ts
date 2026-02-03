import * as fs from 'fs';
import * as path from 'path';
import pLimit from 'p-limit';
import { scrapeAmazon } from './scrapers/amazonScraper';
import { scrapeWalmart } from './scrapers/walmartScraper';
import { ProductData, SKUItem, SKUList } from './types';
import { writeProductsToCSV, transformToCSV, retryWithBackoff, logError, clearErrorLog } from './helpers';

// Configuration
const MAX_CONCURRENCY = 1; // Keep low to avoid detection
const MAX_RETRIES = 2;

async function main() {
    console.log("Starting product scraper...\n");

    // Clear old logs
    clearErrorLog();
    const csvPath = path.join(process.cwd(), 'product_data.csv');
    if (fs.existsSync(csvPath)) {
        fs.unlinkSync(csvPath);
    }

    // Load SKUs
    const skusPath = path.join(process.cwd(), 'skus.json');
    if (!fs.existsSync(skusPath)) {
        console.error('Error: skus.json not found!');
        process.exit(1);
    }

    const skuData: SKUList = JSON.parse(fs.readFileSync(skusPath, 'utf-8'));
    console.log(`Loaded ${skuData.skus.length} SKUs from skus.json\n`);

    const results: ProductData[] = [];

    // Setup concurrency limiter  
    const limit = pLimit(MAX_CONCURRENCY);

    // Create tasks
    const tasks = skuData.skus.map(item =>
        limit(() => processItem(item, results))
    );

    console.log(`Starting scrape with ${MAX_CONCURRENCY} concurrent workers...\n`);

    // Execute all tasks
    await Promise.all(tasks);

    // Write results
    if (results.length > 0) {
        await writeProductsToCSV(results);
    } else {
        console.log('\nNo products were successfully scraped.');
    }

    // Summary
    console.log('\n--- SCRAPING COMPLETE ---');
    console.log(`Successfully scraped: ${results.length}/${skuData.skus.length}`);
    console.log('Output: product_data.csv');
    console.log('Errors: errors.log');
}

async function processItem(item: SKUItem, results: ProductData[]): Promise<void> {
    try {
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
                    const result = await scrapeWalmart(item.SKU);
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
        } else {
            logError(item.SKU, item.Type, 'Scraping returned null');
        }

    } catch (err: any) {
        logError(item.SKU, item.Type, `Scraping failed: ${err.message}`);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});