import { randomDelay, sleep } from '../src/helpers/delay.helper';

describe('delay helpers', () => {

    describe('sleep', () => {
        it('should wait for specified time', async () => {
            const start = Date.now();
            await sleep(100);
            const elapsed = Date.now() - start;


            expect(elapsed).toBeGreaterThanOrEqual(90);
            expect(elapsed).toBeLessThan(150);
        });
    });

    describe('randomDelay', () => {
        it('should delay within min max range', async () => {
            const start = Date.now();
            await randomDelay(50, 100);
            const elapsed = Date.now() - start;

            expect(elapsed).toBeGreaterThanOrEqual(45);
            expect(elapsed).toBeLessThan(150);
        });

        it('should handle same min and max', async () => {
            const start = Date.now();
            await randomDelay(50, 50);
            const elapsed = Date.now() - start;

            expect(elapsed).toBeGreaterThanOrEqual(45);
        });
    });
});
