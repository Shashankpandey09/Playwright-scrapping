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
                await humanMouseMove(this.page,
                    searchBounds.x + searchBounds.width / 2,
                    searchBounds.y + searchBounds.height / 2
                );
            }

            await searchBox.click();
            await this.delay(300, 600);

            for (const char of sku) {
                await this.page.keyboard.type(char, { delay: 50 + Math.random() * 130 });
                if (Math.random() < 0.15) {
                    await this.delay(200, 400);
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
        console.log('got captcha, trying to solve...');

        try {
            if (this.page.isClosed()) {
                console.log('page died, cant solve');
                return false;
            }

            const captchaButton = this.page.locator('#px-captcha');
            const isVisible = await captchaButton.isVisible().catch(() => false);

            if (!isVisible) {
                return false;
            }

            const loc = await captchaButton.boundingBox();
            if (!loc) return false;

            const x_loc = loc.x + loc.width / 2;
            const y_loc = loc.y + loc.height / 2;

            await this.page.mouse.move(x_loc, y_loc, { steps: 25 });

            await this.delay(300, 800);
            await this.page.mouse.down();
            console.log('holding...');

            const t_hold = 12000 + Math.random() * 2000;
            await this.delay(t_hold, t_hold + 500);

            if (this.page.isClosed()) {
                console.log('page crashed mid-hold');
                return false;
            }

            await this.page.mouse.up();
            console.log('released, waiting...');

            await this.delay(4000, 7000);

            if (this.page.isClosed()) {
                console.log('page died after release');
                return false;
            }

            const stillHasCaptcha = await this.hasCaptcha();
            return !stillHasCaptcha;

        } catch (error: any) {
            if (error.message?.includes('closed') || error.message?.includes('Target')) {
                console.log('browser crashed during captcha');
            } else {
                console.log('captcha failed');
            }
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
