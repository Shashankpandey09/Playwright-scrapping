import { chromium, BrowserContext, Page } from 'playwright';

async function scrapeGoogle() {
  const browser = await chromium.launch({ headless: false });
  
  const context: BrowserContext = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });

  const page: Page = await context.newPage();

  // Stealth Layer
  await page.addInitScript(() => {
    // @ts-ignore
    delete Object.getPrototypeOf(navigator).webdriver;
    // @ts-ignore
    window.chrome = { runtime: {} };
  });

  try {
    console.log("Navigating to Google...");
    await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });

    // Handle Search
    const searchBox = page.locator('textarea[name="q"], input[name="q"]');
    await searchBox.click();
    await page.keyboard.type('porn', { delay: 100 }); 
    await page.keyboard.press('Enter');

    let allResults: any[] = [];
    let pagesToScrape = 50; // Let's start with 3 pages to avoid immediate rate limiting

    for (let i = 1; i <= pagesToScrape; i++) {
      console.log(`--- Scraping Page ${i} ---`);
      
      // 1. Wait for results to appear
      await page.waitForSelector('#search',{ timeout: 5000 });

      // 2. Extract Data
      const pageResults = await page.evaluate(() => {
        // We target the specific result containers '.g' instead of every 'div'
        const items = Array.from(document.querySelectorAll('div span'));
        
        return items.map(el => {
          const titleEl = el.querySelector('h3');
          const linkEl = el.querySelector('a');
    

          return {
            title: titleEl?.textContent || null,
            link: linkEl?.href || null,
            
          };
        }).filter(item => item.title !== null); 
      });

      allResults = [...allResults, ...pageResults];

      // 3. Navigation to Next Page
      if (i < pagesToScrape) {
        const nextButton = page.getByRole('link', { name: 'Next' });
        
        if (await nextButton.isVisible()) {
          await nextButton.click();
          // Wait for the URL or content to change
          await page.waitForLoadState('networkidle');
        } else {
          console.log("No more pages found.");
          break;
        }
      }
    }

    console.log(`Successfully scraped ${allResults.length} total results.`);
    console.table(allResults); // Displaying first 10 for clarity

  } catch (error) {
    console.error("Scraping Error:", error);
  } finally {
    await browser.close();
  }
}

scrapeGoogle();