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

        // Reddit Warmup
        try {
            console.log(`  Visiting Reddit for extended warmup...`);
            await page.goto('https://www.reddit.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
            await randomDelay(2000, 4000);

            // Scroll a bit to load feed
            await page.mouse.wheel(0, 500);
            await randomDelay(1500, 2500);

            // Try to open a post
            const postSelector = 'a[href*="/r/"][href*="/comments/"]';
            const posts = await page.$$(postSelector);

            if (posts.length > 0) {
                const randomPost = posts[Math.floor(Math.random() * Math.min(5, posts.length))];
                // Scroll to view
                await randomPost.scrollIntoViewIfNeeded();
                await randomDelay(500, 1000);

                await randomPost.click();
                console.log(`  Opened a Reddit post, reading...`);

                // Simulate reading: 5-10 seconds
                const readTime = 5000 + Math.random() * 5000;
                const startTime = Date.now();

                while (Date.now() - startTime < readTime) {
                    // Slow scroll down
                    await page.mouse.wheel(0, 100 + Math.random() * 50);
                    await randomDelay(1000, 2000);
                }

                console.log(`  Finished reading post`);
                await page.goBack();
                await randomDelay(1000, 2000);
            }
        } catch (e) {
            console.log(`  Reddit warmup skipped: ${e}`);
        }

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
