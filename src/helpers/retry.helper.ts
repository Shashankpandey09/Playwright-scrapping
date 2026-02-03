// Retry logic with exponential backoff

import * as fs from 'fs';
import * as path from 'path';

const LOG_PATH = path.join(process.cwd(), 'errors.log');

export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    sku: string = '',
    source: string = ''
): Promise<T> {
    let lastErr: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            lastErr = err;
            const isLast = attempt === maxRetries - 1;

            if (isLast) {
                logRetryError(sku, source, `Failed after ${maxRetries} attempts: ${err.message}`);
                throw err;
            }

            // exponential backoff: 1s, 2s, 4s...
            const waitTime = 1000 * Math.pow(2, attempt);
            console.log(`Retry ${attempt + 1}/${maxRetries} for ${sku} after ${waitTime}ms...`);
            await sleep(waitTime);
        }
    }

    throw lastErr || new Error('Retry failed');
}

function logRetryError(sku: string, source: string, msg: string): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] SKU: ${sku} | Source: ${source} | Error: ${msg}\n`;
    fs.appendFileSync(LOG_PATH, logLine);
    console.error(`Error logged for ${sku} (${source}): ${msg}`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
