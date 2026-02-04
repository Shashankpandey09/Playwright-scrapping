

# Web Scraper Assessment: SKU Data Extraction


## Installation & Setup

### Option 1: Docker (Recommended)

Using Docker ensures a consistent environment with all necessary Linux dependencies for Playwright pre-installed.

1. **Clone the repository:**
```bash
git clone  https://github.com/Shashankpandey09/Playwright-scrapping.git
cd product-scraper

```


2. **Launch the scraper:**
```bash
docker-compose up --build

```


*The scraper will process `skus.json` and output results to `product_data.csv` in the root folder.*

### Option 2: Local Setup (npm)

Use this option for development or if you wish to run the scraper in a headful (visible) browser mode.

1. **Install dependencies:**
```bash
npm install

```


2. **Install Chromium binaries:**
```bash
npx playwright install chromium

```


3. **Run the application:**
```bash
npm run start

```


4. **Assumptions**

- Regional Targets: Designed for Amazon.in and Walmart.com. If run on other regions, the page layout may change, requiring minor selector updates.

- Selector Stability: Used the most stable IDs available (like #productTitle) and isolated them in a modular folder so they can be updated without touching the core scraper engine.

- Browser Choice: Used the Google Chrome channel in headless mode. Standard Chromium is flagged almost instantly by Walmart's PerimeterX; using the actual Chrome binary is essential for stealth.

- User-Agent Spoofing: Used a legacy PlayStation Portable (PSP) User-Agent. Modern desktop strings are heavily monitored, while legacy signatures often face less aggressive filtering.

Session Persistence: Used a persistent browser context to look like a single consistent user. Walmart tends to block multiple "fresh" contexts coming from the same IP address.

Profile Management: I assumed that if a session is eventually flagged, the local Chrome profile directory must be deleted to clear the "fingerprint" before restarting. This reset is necessary because once a profile is tarnished, even human intervention often cannot bypass the resulting "Hard Block."

5. **Limitations & Solutions**

- Handling Walmart’s "Anti-Newbie" Filter (PerimeterX)
The Problem: Walmart flags fresh browser sessions (New Contexts) coming from the same IP as bot-like behavior.

 **Solution**: Persistent Session Strategy. I implemented a Persistent Profile that stores cookies and history. This makes the scraper look like a "returning loyal customer" to PerimeterX rather than a new bot instance.

- Solving the "Slowest-Link" Bottleneck
The Problem: Amazon is lenient, but because it’s in the same loop as Walmart, it’s being forced to run at a "Slow/High-Stealth" speed.

 **Solution**: Split-Lane Architecture. I’ve architected the roadmap to separate these into two worker types:

Amazon Lane: "Turbo Mode" using stateless, high-speed concurrent windows.

Walmart Lane: "Stealth Mode" using persistent, single-threaded profiles.

- Eliminating the Local IP Footprint
The Problem: Scraping 900+ products from a single local IP is a major risk for long-term production.

 **Solution**: 1-to-1 Identity Mapping. The system is designed to integrate with Residential Proxies. This allows us to map 1 Profile to 1 IP Address, creating a "Digital Twin" of a real user that is almost impossible for security systems to distinguish from a human.

- Bypassing Headless Signature Detection
The Problem: Security sensors easily detect standard Chromium "headless" fingerprints.

 **Solution**: Advanced Human-Mimicry. * Switched from standard Chromium to the Google Chrome binary channel.

Implemented randomized, human-like delays between actions.

Used niche User-Agents (Apple TV / PSP) which have lower "risk scores" than common desktop strings.


6.**To move from this 900-item test to a system that handles 100,000+ products, I would implement the following plan:**

**A. A Team of Workers (Distributed System)**
Right now, one script does everything. At scale, I would use a Central Queue (like Redis) to hand out tasks to a "team" of workers running in Docker. Each worker would grab a few SKUs, finish them, and reset. This prevents the system from getting slow or "leaking" memory over time.

**B. Matching IPs to Personalities (Smart Proxies)**
To stay hidden on Walmart, I would use Residential Proxies (IPs that look like home internet). The key is 1-to-1 Mapping: I would assign one specific IP to one specific Browser Profile. This makes the website think the same person is coming back from the same house every time, which builds massive trust and avoids blocks.

**C. Smart Data Updates**
Instead of saving to a CSV, I’d move the data to a real Database (Postgres). I would also add "Smart Scraping"—instead of re-scraping every product every day, the system would only focus on items where the price or stock status is likely to change. This saves time and reduces the risk of being banned.

**D. Automatic Self-Healing**
If a worker hits a "Press & Hold" block or a CAPTCHA, it shouldn't just keep trying and get the IP banned. I would add logic so the worker automatically stops, clears its temporary memory (cache), and restarts with a brand-new IP and identity. This keeps the data flowing 24/7 without manual fixing.
