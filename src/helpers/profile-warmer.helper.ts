import { BrowserContext, Page } from 'playwright';
import { randomDelay } from './delay.helper';

interface WarmingConfig {
    workerIndex: number;
    skipIfWarmed?: boolean;
}


export async function warmProfile(ctx: BrowserContext, config: WarmingConfig): Promise<void> {
    const { workerIndex, skipIfWarmed = true } = config;


    if (skipIfWarmed) {
        const cookies = await ctx.cookies();
        if (cookies.length > 5) {
            console.log(`[Worker ${workerIndex}] Profile already warmed (${cookies.length} cookies found)`);
            return;
        }
    }

    console.log(`[Worker ${workerIndex}] Warming profile...`);
    const page = ctx.pages()[0] || await ctx.newPage();

    try {

        await visitSite(page, 'https://www.google.com', {
            name: 'Google',
            scrolls: 0,
            clickAccept: true
        });
        await randomDelay(1000, 2000);

        await visitSite(page, 'https://www.youtube.com', {
            name: 'YouTube',
            scrolls: 1,
            clickAccept: true
        });
        await randomDelay(1000, 2000);


        await visitSite(page, 'https://www.walmart.com', {
            name: 'Walmart',
            scrolls: 2,
            clickAccept: true,
            browseAround: true
        });
        await randomDelay(2000, 3000);

        console.log(`[Worker ${workerIndex}] Profile warming complete`);
    } catch (err: any) {
        console.warn(`[Worker ${workerIndex}] Profile warming failed: ${err.message}`);

    }
}

interface VisitOptions {
    name: string;
    scrolls?: number;
    clickAccept?: boolean;
    browseAround?: boolean;
}

async function visitSite(page: Page, url: string, options: VisitOptions): Promise<void> {
    const { name, scrolls = 0, clickAccept = false, browseAround = false } = options;

    try {
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });
        await randomDelay(1500, 2500);

        if (clickAccept) {
            try {
                const acceptSelectors = [
                    'button:has-text("Accept")',
                    'button:has-text("I accept")',
                    'button:has-text("Accept all")',
                    'button:has-text("Allow all")',
                    '[aria-label*="Accept"]',
                    '#onetrust-accept-btn-handler'
                ];

                for (const selector of acceptSelectors) {
                    const button = await page.$(selector);
                    if (button) {
                        await button.click();
                        await randomDelay(500, 1000);
                        break;
                    }
                }
            } catch {

            }
        }


        for (let i = 0; i < scrolls; i++) {
            await page.evaluate(() => window.scrollBy(0, 300 + Math.random() * 200));
            await randomDelay(800, 1500);
        }


        if (browseAround) {
            try {

                const links = await page.$$('a[href*="/browse/"]');
                if (links.length > 0) {
                    const randomLink = links[Math.floor(Math.random() * Math.min(3, links.length))];
                    await randomLink.hover();
                    await randomDelay(500, 1000);
                }
            } catch {

            }
        }

        console.log(`  Visited ${name}`);
    } catch (err: any) {
        console.warn(`  Failed to visit ${name}: ${err.message}`);
    }
}
