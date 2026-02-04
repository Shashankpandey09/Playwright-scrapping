import { Page, BrowserContext } from 'playwright';

export abstract class BasePage {
    protected page: Page;
    protected context: BrowserContext;

    constructor(page: Page, context: BrowserContext) {
        this.page = page;
        this.context = context;
    }

    async navigate(url: string): Promise<void> {
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    }

    async waitForElement(selector: string, timeout: number = 10000): Promise<boolean> {
        try {
            await this.page.waitForSelector(selector, { timeout });
            return true;
        } catch {
            return false;
        }
    }

    async getText(selector: string): Promise<string> {
        const element = this.page.locator(selector).first();
        const text = await element.textContent();
        return text?.trim() || '';
    }

    async getAttribute(selector: string, attr: string): Promise<string> {
        const element = this.page.locator(selector).first();
        const value = await element.getAttribute(attr);
        return value || '';
    }

    async typeText(selector: string, text: string): Promise<void> {
        await this.page.fill(selector, text);
    }

    async pressKey(key: string): Promise<void> {
        await this.page.keyboard.press(key);
    }

    async delay(min: number, max: number): Promise<void> {
        const ms = Math.floor(Math.random() * (max - min + 1)) + min;
        await this.page.waitForTimeout(ms);
    }

    async getPageContent(): Promise<string> {
        return await this.page.content();
    }
}
