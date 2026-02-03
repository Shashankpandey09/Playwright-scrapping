// CSV writing utilities

import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import { ProductData, ScrapedProduct } from '../types';

const CSV_PATH = path.join(process.cwd(), 'product_data.csv');

const CSV_HEADERS = [
    { id: 'SKU', title: 'SKU' },
    { id: 'Source', title: 'Source' },
    { id: 'Title', title: 'Title' },
    { id: 'Description', title: 'Description' },
    { id: 'Price', title: 'Price' },
    { id: 'Number of Reviews and rating', title: 'Number of Reviews and rating' }
];

export async function writeProductsToCSV(products: ProductData[]): Promise<void> {
    const csvWriter = createObjectCsvWriter({
        path: CSV_PATH,
        header: CSV_HEADERS,
        append: fs.existsSync(CSV_PATH)
    });

    await csvWriter.writeRecords(products);
    console.log(`Saved ${products.length} products to product_data.csv`);
}

export function transformToCSV(sku: string, source: string, data: ScrapedProduct): ProductData {
    return {
        SKU: sku,
        Source: source,
        Title: data.title,
        Description: data.description,
        Price: cleanPrice(data.price),
        'Number of Reviews and rating': formatReviewsAndRating(data.rating, data.reviews)
    };
}

function cleanPrice(price: string): string {
    if (!price) return 'N/A';

    // strip common prefixes
    let cleaned = price.replace(/current price/i, '').trim();
    cleaned = cleaned.replace(/now/i, '').trim();
    cleaned = cleaned.replace(/was.*$/i, '').trim();

    // extract price with currency
    const priceMatch = cleaned.match(/(?:[$₹€£¥]|INR|USD|EUR)\s*[\d,]+\.?\d*/i);
    if (priceMatch) {
        return priceMatch[0].replace(/INR\s*/i, '₹');
    }

    // fallback to plain numeric
    const numMatch = cleaned.match(/[\d,]+\.?\d*/);
    return numMatch ? numMatch[0] : cleaned;
}

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

function extractRating(rating: string): string {
    if (!rating) return '';
    const match = rating.match(/\b(\d\.?\d?)\b/);
    return match ? match[1] : '';
}

function extractReviewCount(reviews: string): string {
    if (!reviews) return '';
    const match = reviews.match(/([\d,.]+[KMB]?)/);
    return match ? match[1].replace(/[()]/g, '') : '';
}
