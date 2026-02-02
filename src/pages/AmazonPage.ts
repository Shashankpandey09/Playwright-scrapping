import { Page, BrowserContext } from 'playwright';
import { BasePage } from './BasePage';
import { ScrapedProduct } from '../utils/utils';

export class AmazonPage extends BasePage {
    private selectors = {
        searchBox: 'input#twotabsearchtextbox',
        // More robust container selector
        searchResults: '[data-component-type="s-search-result"], .s-result-item[data-asin]',
        // Title: multiple variants including modern grid/list specific classes
        title: [
            'h2 a.a-link-normal span',
            '[data-cy="title-recipe"] h2 span',
            '.a-size-medium.a-color-base.a-text-normal',
            '.a-size-base-plus.a-color-base.a-text-normal'
        ].join(','),
        // Price: handle whole/fraction parts and ranges
        price: [
            // 1. Current price (exclude strikethrough/text-price which are List Prices)
            '.a-price:not([data-a-strike="true"]):not(.a-text-price) .a-offscreen',

            // 2. Whole price part (visual fallback)
            '.a-price:not([data-a-strike="true"]) .a-price-whole',

            // 3. Simple color price (older layouts)
            'span.a-color-price',

            // 4. Secondary offers (e.g. "No featured offers available")
            '[data-cy="secondary-offer-recipe"] .a-color-base',

            // 5. Fallback generic price recipe
            '[data-cy="price-recipe"] .a-price .a-offscreen'
        ].join(','),
        rating: [
            '.a-icon-star-small span',
            'i[aria-label*="out of 5 stars"]',
            '.a-icon-alt'
        ].join(','),
        reviews: [
            'span[aria-label*="stars"] + span',
            '.a-size-base.s-underline-text'
        ].join(',')
    };

    constructor(page: Page, context: BrowserContext) {
        super(page, context);
    }

    async goToHome(): Promise<void> {
        await this.navigate('https://www.amazon.in');
        await this.delay(1000, 2000);
    }

    async hasCaptcha(): Promise<boolean> {
        const text = await this.getPageContent();
        return text.includes('Enter the characters you see below') || text.includes('Type the characters you see in this image');
    }

    async search(query: string): Promise<void> {
        await this.typeText(this.selectors.searchBox, query);
        await this.pressKey('Enter');
        await this.page.waitForLoadState('domcontentloaded');
        await this.delay(2000, 3000);

        if (await this.hasCaptcha()) {
            console.log('Amazon Captcha detected!');
        }
    }

    async extractProducts(): Promise<any[]> {
        const products = await this.page.evaluate((selectors) => {
            // Find all valid product containers with an ASIN
            const items = Array.from(document.querySelectorAll(selectors.searchResults))
                .filter(el => el.getAttribute('data-asin') && el.getAttribute('data-asin') !== '');

            const results: any[] = [];

            items.forEach((el) => {
                const asin = el.getAttribute('data-asin');
                if (!asin) return;

                // Helper to find text from multiple selectors
                const getText = (selectorStr: string) => {
                    const sels = selectorStr.split(',');
                    for (const s of sels) {
                        const elem = el.querySelector(s.trim());
                        if (elem && elem.textContent && elem.textContent.trim().length > 0) {
                            return elem.textContent.trim();
                        }
                    }
                    return '';
                };

                const title = getText(selectors.title);
                const price = getText(selectors.price);
                const rating = getText(selectors.rating);
                const reviews = getText(selectors.reviews);

                if (title) {
                    results.push({ asin, title, price, rating, reviews });
                }
            });

            return results;
        }, this.selectors);

        return products;
    }

    async scrapeProduct(sku: string): Promise<ScrapedProduct | null> {
        const products = await this.extractProducts();

        // Strategy 1: Exact Match of ASIN
        let match = products.find(p => p.asin === sku);

        // Strategy 2: Fallback to first result (if valid)
        // This is often needed when Amazon returns the product but the ASIN in the list data-attribute
        // logic might be slightly different than input (e.g. variation parent vs child)
        if (!match && products.length > 0) {
            console.log(`    ⚠️ Exact ASIN match not found, picking top result: ${products[0].asin}`);
            match = products[0];
        }

        if (!match) {
            // Debugging aid
            console.log(`    ❌ Extracted ${products.length} products but none matched.`);
            return null;
        }

        return {
            sku: match.asin,
            title: match.title,
            price: match.price,
            rating: match.rating,
            reviews: match.reviews,
            description: 'Amazon Product'
        };
    }
}
