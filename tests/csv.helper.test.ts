import { transformToCSV } from '../src/helpers/csv.helper';
import { ScrapedProduct } from '../src/types';

describe('CSV Helper', () => {

    describe('transformToCSV', () => {
        it('should transform scraped product to CSV format', () => {
            const input: ScrapedProduct = {
                sku: 'TEST123',
                title: 'Test Product',
                price: '$29.99',
                rating: '4.5',
                reviews: '100 reviews',
                description: 'A test product'
            };

            const result = transformToCSV('TEST123', 'Amazon', input);

            expect(result.SKU).toBe('TEST123');
            expect(result.Source).toBe('Amazon');
            expect(result.Title).toBe('Test Product');
            expect(result.Price).toBe('$29.99');
        });

        it('should handle missing price', () => {
            const input: ScrapedProduct = {
                sku: 'TEST123',
                title: 'Test Product',
                price: '',
                rating: '4.5',
                reviews: '100',
                description: 'Desc'
            };

            const result = transformToCSV('TEST123', 'Walmart', input);

            expect(result.Price).toBe('N/A');
        });

        it('should clean price with currency symbols', () => {
            const input: ScrapedProduct = {
                sku: 'TEST123',
                title: 'Test',
                price: 'Current Price $49.99 Was $59.99',
                rating: '4',
                reviews: '50',
                description: 'Desc'
            };

            const result = transformToCSV('TEST123', 'Walmart', input);

            expect(result.Price).toBe('$49.99');
        });

        it('should format reviews and rating', () => {
            const input: ScrapedProduct = {
                sku: 'TEST',
                title: 'Product',
                price: '$10',
                rating: '4.2 out of 5',
                reviews: '2,500 reviews',
                description: 'Desc'
            };

            const result = transformToCSV('TEST', 'Amazon', input);

            expect(result['Number of Reviews and rating']).toContain('Rating:');
            expect(result['Number of Reviews and rating']).toContain('Reviews:');
        });
    });
});
