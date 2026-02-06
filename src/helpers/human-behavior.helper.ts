import { Page } from 'playwright';


export async function humanMouseMove(
    page: Page,
    targetX: number,
    targetY: number,
    options: { steps?: number; jitter?: boolean } = {}
): Promise<void> {
    const { steps = 25, jitter = true } = options;


    const startX = Math.random() * 400 + 100;
    const startY = Math.random() * 300 + 100;


    const cp1x = startX + (targetX - startX) * 0.3 + (Math.random() - 0.5) * 100;
    const cp1y = startY + (targetY - startY) * 0.1 + (Math.random() - 0.5) * 100;
    const cp2x = startX + (targetX - startX) * 0.7 + (Math.random() - 0.5) * 100;
    const cp2y = startY + (targetY - startY) * 0.9 + (Math.random() - 0.5) * 100;

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;


        const x = Math.pow(1 - t, 3) * startX +
            3 * Math.pow(1 - t, 2) * t * cp1x +
            3 * (1 - t) * Math.pow(t, 2) * cp2x +
            Math.pow(t, 3) * targetX;
        const y = Math.pow(1 - t, 3) * startY +
            3 * Math.pow(1 - t, 2) * t * cp1y +
            3 * (1 - t) * Math.pow(t, 2) * cp2y +
            Math.pow(t, 3) * targetY;


        const jitterX = jitter ? (Math.random() - 0.5) * 2 : 0;
        const jitterY = jitter ? (Math.random() - 0.5) * 2 : 0;

        await page.mouse.move(x + jitterX, y + jitterY);


        const delay = 5 + Math.sin(t * Math.PI) * 15;
        await new Promise(r => setTimeout(r, delay));
    }
}


export async function humanScroll(
    page: Page,
    distance: number = 500,
    options: { smooth?: boolean } = {}
): Promise<void> {
    const { smooth = true } = options;

    if (smooth) {
        const scrollSteps = 10 + Math.floor(Math.random() * 10);
        const stepDistance = distance / scrollSteps;

        for (let i = 0; i < scrollSteps; i++) {

            const variance = stepDistance * (0.8 + Math.random() * 0.4);
            await page.evaluate((d) => window.scrollBy(0, d), variance);


            await new Promise(r => setTimeout(r, 30 + Math.random() * 70));
        }
    } else {
        await page.evaluate((d) => window.scrollBy(0, d), distance);
    }
}





