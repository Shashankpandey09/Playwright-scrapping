import { Page, BrowserContext, Locator } from 'playwright';
import { BasePage } from './BasePage';
import { ScrapedProduct } from '../types';
import { humanMouseMove, humanScroll } from '../helpers/human-behavior.helper';

export class WalmartPage extends BasePage {
    private selectors = {
        searchBox: 'input[type="search"]',
        productTitle: '[data-automation-id="product-title"], h1[itemprop="name"], .prod-ProductTitle',
        productPrice: '[data-automation-id="product-price"], [itemprop="price"], .prod-PriceSection',
        productRating: '[data-testid="product-ratings"], .stars-container',
        productReviews: '[data-testid="product-reviews"], .reviews-count',
        captchaButton: '#px-captcha'
    };

    constructor(page: Page, context: BrowserContext) {
        super(page, context);
    }

    async goToHome(): Promise<void> {
        await this.navigate('https://www.walmart.com');
        await this.delay(2000, 4000);
    }

    async goToProduct(sku: string): Promise<void> {
        const foundViaSearch = await this.goToProductViaSearch(sku);

        if (!foundViaSearch) {
            console.log('  Search failed, using direct URL...');
            await this.navigate(`https://www.walmart.com/ip/${sku}`);
            await this.delay(2000, 3000);
        }
    }

    async goToProductViaSearch(sku: string): Promise<boolean> {
        try {
            const currentUrl = this.page.url();
            if (!currentUrl.includes('walmart.com')) {
                await this.navigate('https://www.walmart.com');
                await this.delay(1500, 2500);
            }

            const searchBox = this.page.locator(this.selectors.searchBox).first();
            await searchBox.waitFor({ timeout: 10000 });

            const searchBounds = await searchBox.boundingBox();
            if (searchBounds) {

                const targetX = searchBounds.x + searchBounds.width * (0.2 + Math.random() * 0.6);
                const targetY = searchBounds.y + searchBounds.height * (0.2 + Math.random() * 0.6);

                await humanMouseMove(this.page, targetX, targetY);
            }

            await searchBox.click();
            await this.delay(300, 600);

            for (const char of sku) {
                await this.page.keyboard.type(char, { delay: 500 + Math.random() * 200 }); // Faster, more natural typing
                if (Math.random() < 0.1) {
                    await this.delay(100, 300);
                }
            }
            await this.delay(500, 1000);

            await this.page.keyboard.press('Enter');
            await this.page.waitForLoadState('domcontentloaded');
            await this.delay(2000, 3000);

            const productLink = this.page.locator(`a[href*="/ip/${sku}"]`).first();
            const exists = await productLink.count() > 0;

            if (exists) {
                const linkBounds = await productLink.boundingBox();
                if (linkBounds) {
                    if (linkBounds.y > 600) {
                        await humanScroll(this.page, linkBounds.y - 300);
                        await this.delay(500, 1000);
                    }

                    await humanMouseMove(this.page,
                        linkBounds.x + linkBounds.width / 2,
                        linkBounds.y + linkBounds.height / 2
                    );
                }

                await productLink.click();
                await this.page.waitForLoadState('domcontentloaded');
                await this.delay(2000, 3000);

                console.log(`  Navigated via search`);
                return true;
            }

            return false;
        } catch (err: any) {
            console.log(`  Search navigation failed: ${err.message}`);
            return false;
        }
    }

    async searchForItem(item: string): Promise<void> {
        console.log(`searching walmart for: ${item}`);

        try {
            await this.page.waitForSelector(this.selectors.searchBox, { timeout: 10000 });
            const searchBox = this.page.locator(this.selectors.searchBox).first();

            await searchBox.click();
            await this.delay(500, 1000);

            await this.page.keyboard.type(item, { delay: 100 });
            await this.delay(500, 1000);

            await this.page.keyboard.press('Enter');
            await this.page.waitForLoadState('domcontentloaded');
            await this.delay(3000, 5000);

        } catch (error: any) {
            console.log(`search failed: ${error.message}`);
        }
    }

    async hasCaptcha(): Promise<boolean> {
        const html = await this.getPageContent();
        return html.includes('px-captcha') || html.includes('Press & Hold') || html.includes('PRESS & HOLD');
    }

    async solveCaptcha(): Promise<boolean> {
        console.log('captcha detected — executing observed human pattern (fumble + long shaky hold)');

        try {
            if (this.page.isClosed()) return false;

            const captchaBtn = this.page.locator('#px-captcha');
            if (!(await captchaBtn.isVisible().catch(() => false))) return false;

            const box = await captchaBtn.boundingBox();
            if (!box) return false;

            // Target a random point within the central 60% of the button, not dead center
            const targetX = box.x + box.width / 2 + (Math.random() - 0.5) * (box.width * 0.6);
            const targetY = box.y + box.height / 2 + (Math.random() - 0.5) * (box.height * 0.6);

            // 1. Move to button with human behavior
            await humanMouseMove(this.page, targetX, targetY, { steps: 50, jitter: true });

            // 2. Perform 2-3 short "fumble" clicks/releases
            const fumbles = 2 + Math.floor(Math.random() * 2); // 2 or 3
            console.log(`performing ${fumbles} short fumble presses...`);

            for (let i = 0; i < fumbles; i++) {

                await this.page.mouse.down();
                // Short hold (0.5 - 1.5s)
                await this.delay(500 + Math.random() * 1000, 1500);
                // Release
                await this.page.mouse.up();
                // Wait between fumbles
                await this.delay(300 + Math.random() * 500, 800);

                // Slight adjustment of position between fumbles
                if (i < fumbles - 1) {
                    const adjustX = targetX + (Math.random() - 0.5) * 5;
                    const adjustY = targetY + (Math.random() - 0.5) * 5;
                    await this.page.mouse.move(adjustX, adjustY);
                }
            }

            // 3. Final Long Hold with Shakiness/Pressure simulation
            console.log('performing final long hold with pressure simulation...');
            await this.page.mouse.move(targetX, targetY); // Ensure we are still roughly there
            await this.page.mouse.down();

            const longHoldDuration = 10000 + Math.random() * 3000; // 10-13 seconds
            const startTime = Date.now();

            while (Date.now() - startTime < longHoldDuration) {
                if (this.page.isClosed()) return false;

                // Simulate "shakiness" or "extra pressure" by micro-movements
                // Very small movements: +/- 1 or 2 pixels
                const jitterX = targetX + (Math.random() - 0.5) * 3;
                const jitterY = targetY + (Math.random() - 0.5) * 3;

                await this.page.mouse.move(jitterX, jitterY);

                // Wait a small bit between jitters
                await this.delay(100, 300);
            }

            console.log('releasing final hold...');
            await this.page.mouse.up();

            // 4. Wait for result
            await this.delay(3000, 6000);

            const stillThere = await this.hasCaptcha();
            return !stillThere;

        } catch (error: any) {
            console.warn(`captcha solve failed: ${error.message}`);
            return false;
        }
    }


    async extractFromDOM(sku: string): Promise<ScrapedProduct | null> {
        const selectors = {
            title: '[data-automation-id="product-title"]',
            price: '[data-seo-id="hero-price"]',
            rating: '.f7.ph1',
            reviews: '[data-testid="item-review-section-link"]'
        };

        try {
            await this.page.waitForSelector(selectors.title, { timeout: 10000 });
        } catch {
            return null;
        }

        const product = await this.page.evaluate((sels) => {
            const getText = (selectorStr: string) => {
                for (const sel of selectorStr.split(',')) {
                    const el = document.querySelector(sel.trim());
                    if (el && el.textContent && el.textContent.trim()) return el.textContent.trim();
                }
                return '';
            };

            const title = getText(sels.title);
            if (!title) return null;

            return {
                title,
                price: getText(sels.price),
                rating: getText(sels.rating),
                reviews: getText(sels.reviews)
            };
        }, selectors);

        if (!product || !product.title) return null;

        let cleanRating = product.rating;
        const ratingMatch = product.rating.match(/\(?([\d.]+)\)?/);
        if (ratingMatch) {
            cleanRating = ratingMatch[1];
        }

        let cleanReviews = product.reviews;
        const reviewMatch = product.reviews.match(/([\d,]+)\s*(?:ratings|reviews)/i) || product.reviews.match(/of\s+([\d,]+)\s+reviews/i);
        if (reviewMatch) {
            cleanReviews = `${reviewMatch[1]} reviews`;
        }

        return {
            sku,
            title: product.title.substring(0, 200),
            price: product.price || 'N/A',
            rating: cleanRating || 'N/R',
            reviews: cleanReviews || '0 reviews',
            description: 'Walmart Product'
        };
    }
}
