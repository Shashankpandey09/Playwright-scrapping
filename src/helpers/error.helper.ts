
import * as fs from 'fs';
import * as path from 'path';

const LOG_PATH = path.join(process.cwd(), 'errors.log');

export function logError(sku: string, source: string, errorMsg: string): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] SKU: ${sku} | Source: ${source} | Error: ${errorMsg}\n`;

    fs.appendFileSync(LOG_PATH, logLine);
    console.error(`Error logged for ${sku} (${source}): ${errorMsg}`);
}

export function clearErrorLog(): void {
    if (fs.existsSync(LOG_PATH)) {
        fs.unlinkSync(LOG_PATH);
    }
}
