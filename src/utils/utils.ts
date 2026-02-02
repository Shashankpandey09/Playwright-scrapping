import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';

// Types
export interface ProductData {
    SKU: string;
    Source: string;
    Title: string;
    Description: string;
    Price: string;
    'Number of Reviews and rating': string;
}

export interface ScrapedProduct {
    sku: string;
    title: string;
    price: string;
    rating: string;
    reviews: string;
    description: string;
}

// Random delay helper
export async function randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
}

// Error logger
export function logError(sku: string, source: string, error: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] SKU: ${sku} | Source: ${source} | Error: ${error}\n`;

    const logPath = path.join(process.cwd(), 'errors.log');
    fs.appendFileSync(logPath, logMessage);
    console.error(`❌ Error logged for ${sku} (${source}): ${error}`);
}

// CSV Writer
export async function writeToCSV(products: ProductData[]): Promise<void> {
    const csvPath = path.join(process.cwd(), 'product_data.csv');

    const csvWriter = createObjectCsvWriter({
        path: csvPath,
        header: [
            { id: 'SKU', title: 'SKU' },
            { id: 'Source', title: 'Source' },
            { id: 'Title', title: 'Title' },
            { id: 'Description', title: 'Description' },
            { id: 'Price', title: 'Price' },
            { id: 'Number of Reviews and rating', title: 'Number of Reviews and rating' }
        ],
        append: fs.existsSync(csvPath)
    });

    await csvWriter.writeRecords(products);
    console.log(`✅ Saved ${products.length} product(s) to product_data.csv`);
}

// Transform scraped data to CSV format
export function transformToCSV(
    sku: string,
    source: string,
    data: ScrapedProduct
): ProductData {
    return {
        SKU: sku,
        Source: source,
        Title: data.title,
        Description: data.description,
        Price: cleanPrice(data.price),
        'Number of Reviews and rating': formatReviewsAndRating(data.rating, data.reviews)
    };
}

// Clean price formatting
function cleanPrice(price: string): string {
    if (!price) return 'N/A';

    // Remove extra text
    price = price.replace(/current price/i, '').trim();
    price = price.replace(/now/i, '').trim();
    price = price.replace(/was.*$/i, '').trim();

    // Extract first price match (supports symbols and currency codes like INR)
    const priceMatch = price.match(/(?:[$₹€£¥]|INR|USD|EUR)\s*[\d,]+\.?\d*/i);
    if (priceMatch) {
        return priceMatch[0].replace(/INR\s*/i, '₹'); // Normalize INR to symbol if desired, or just keep it clean
    }

    // Fallback simple numeric match if no currency symbol found but looks like price
    const numericMatch = price.match(/[\d,]+\.?\d*/);
    return numericMatch ? numericMatch[0] : price;
}

// Format reviews and rating
function formatReviewsAndRating(rating: string, reviews: string): string {
    const cleanRating = extractRating(rating);
    const cleanReviews = extractReviewCount(reviews);

    if (cleanRating && cleanReviews) {
        return `Rating: ${cleanRating}, Reviews: ${cleanReviews}`;
    } else if (cleanRating) {
        return `Rating: ${cleanRating}`;
    } else if (cleanReviews) {
        return `Reviews: ${cleanReviews}`;
    }
    return 'N/A';
}

// Extract numeric rating
function extractRating(rating: string): string {
    if (!rating) return '';

    // Match patterns like "4.3", "4.3 out of 5", "4.3 stars"
    const match = rating.match(/\b(\d\.?\d?)\b/);
    return match ? match[1] : '';
}

// Extract review count
function extractReviewCount(reviews: string): string {
    if (!reviews) return '';

    // Match patterns like "22.1K", "2,903", "(2.9K)"
    const match = reviews.match(/([\d,.]+[KMB]?)/);
    return match ? match[1].replace(/[()]/g, '') : '';
}

// Retry wrapper with exponential backoff
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    sku: string = '',
    source: string = ''
): Promise<T> {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            const isLastAttempt = i === retries - 1;

            if (isLastAttempt) {
                logError(sku, source, `Failed after ${retries} attempts: ${error.message}`);
                throw error;
            }

            const backoffTime = 1000 * Math.pow(2, i);
            console.log(`⚠️  Retry ${i + 1}/${retries} for ${sku} after ${backoffTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
    }

    throw new Error('Retry failed');
}
