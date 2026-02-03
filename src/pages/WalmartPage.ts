import { Page, BrowserContext, Locator } from 'playwright';
import { BasePage } from './BasePage';
import { ScrapedProduct } from '../types';
import { generateBezierPath } from '../utils/bezier';

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
        await this.navigate(`https://www.walmart.com/ip/${sku}`);
        await this.delay(2000, 3000);
    }

    async searchForItem(item: string): Promise<void> {
        console.log(`    [INFO] Searching for item in Walmart search bar: ${item}`);

        try {
            await this.page.waitForSelector(this.selectors.searchBox, { timeout: 10000 });
            const searchBox = this.page.locator(this.selectors.searchBox).first();

            await searchBox.click();
            await this.delay(500, 1000);

            // Human-like typing
            await this.page.keyboard.type(item, { delay: 100 });
            await this.delay(500, 1000);

            await this.page.keyboard.press('Enter');
            // Wait for navigation to product page or search results
            await this.page.waitForLoadState('domcontentloaded');
            await this.delay(3000, 5000); // Wait for results to populate

        } catch (error: any) {
            console.log(`    [WARN] Failed to search for item: ${error.message}`);
        }
    }

    async hasCaptcha(): Promise<boolean> {
        const html = await this.getPageContent();
        return html.includes('px-captcha') || html.includes('Press & Hold') || html.includes('PRESS & HOLD');
    }

    async solveCaptcha(): Promise<boolean> {
        console.log('    [INFO] Attempting to solve Press & Hold captcha...');

        const captchaButton = this.page.locator('#px-captcha');
        const isVisible = await captchaButton.isVisible().catch(() => false);

        if (!isVisible) {
            return false;
        }

        try {
            const box = await captchaButton.boundingBox();
            if (!box) return false;

            const centerX = box.x + box.width / 2;
            const centerY = box.y + box.height / 2;

            // Human-like approach: Ghost Cursor (Bezier Curve)
            const startPoint = { x: 100, y: 100 };
            const endPoint = { x: centerX, y: centerY };

            const path = generateBezierPath(startPoint, endPoint, 50);

            for (const point of path) {
                // Variable speed (Fitts's Law simulation via simple deviation)
                await this.page.mouse.move(point.x, point.y, { steps: 1 });
                // Random delays to simulate thought/reaction
                if (Math.random() > 0.7) await this.delay(Math.random() * 30, Math.random() * 60);
            }

            await this.delay(300, 800); // Hover before click
            await this.page.mouse.down();
            console.log('    [INFO] Holding button (simulating human jitter via Ghost Cursor)...');

            // PerimeterX "Press & Hold" usually requires 5-10 seconds.
            const holdTime = 7000 + Math.random() * 4000;
            const startTime = Date.now();

            while (Date.now() - startTime < holdTime) {
                // Micro-movements while holding (jitter)
                if (Math.random() > 0.3) {
                    const driftX = (Math.random() - 0.5) * 3;
                    const driftY = (Math.random() - 0.5) * 3;
                    await this.page.mouse.move(centerX + driftX, centerY + driftY);
                }
                await this.delay(100, 300);
            }

            await this.page.mouse.up();
            console.log('    [INFO] Released button. Waiting for unlock...');

            // Wait for the redirect/reload which solves the captcha
            await this.delay(4000, 7000);

            const stillHasCaptcha = await this.hasCaptcha();
            return !stillHasCaptcha;

        } catch (error) {
            console.log('    [WARN] Captcha solve failed');
            return false;
        }
    }



    async extractFromDOM(sku: string): Promise<ScrapedProduct | null> {
        // Use user-provided robust selectors based on screenshots
        const selectors = {
            title: '[data-automation-id="product-title"], h1[itemprop="name"], .prod-ProductTitle',
            price: '[data-seo-id="hero-price"], [itemprop="price"], .span[aria-hidden="false"]',
            rating: '.f7.ph1, [itemprop="ratingValue"], .rating-number',
            reviews: '[data-testid="item-review-section-link"], [itemprop="ratingCount"], h3.w_kV33'
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

        // Clean up rating (remove parentheses e.g. "(4.5)")
        let cleanRating = product.rating;
        const ratingMatch = product.rating.match(/\(?([\d.]+)\)?/);
        if (ratingMatch) {
            cleanRating = ratingMatch[1];
        }

        // Clean up review count (extract number from "6,195 ratings" or "Showing 1-3 of 2,397 reviews")
        let cleanReviews = product.reviews;
        const reviewMatch = product.reviews.match(/([\d,]+)\s*(?:ratings|reviews)/i) || product.reviews.match(/of\s+([\d,]+)\s+reviews/i);
        if (reviewMatch) {
            cleanReviews = `${reviewMatch[1]} reviews`; // Standardize format
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
