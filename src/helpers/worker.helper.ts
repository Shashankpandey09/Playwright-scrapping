
import { chromium } from 'playwright-extra';
import { BrowserContext } from 'playwright';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as path from 'path';
import * as fs from 'fs';
import { PROXY_CONFIG, GetProxyUsername } from '../proxy.config';
import { IDENTITY_POOL } from '../utils/identity';


chromium.use(StealthPlugin());
let profileVersion = 0;
export interface WorkerConfig {
    workerIndex: number;
    headless?: boolean;
}

const STEALTH_ARGS = [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--disable-notifications',
    '--use-gl=swiftshader',
    '--window-size=1920,1080',
];

export async function launchWorker(config: WorkerConfig): Promise<BrowserContext> {
    const { workerIndex, headless = true } = config;

    const timestamp = Date.now();
    const profileDir = path.join(process.cwd(), 'profiles', `worker_${workerIndex}_${profileVersion}`);
    const workerIdentity = IDENTITY_POOL[Math.floor(Math.random() * IDENTITY_POOL.length)];
    const contextOptions: any = {
        channel: 'chrome',
        headless,
        args: [...STEALTH_ARGS, '--headless=new'],

        userAgent: workerIdentity.ua,
        viewport: workerIdentity.viewport,
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
        extraHTTPHeaders: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"'
        },
        permissions: ['geolocation'],
    };

    if (PROXY_CONFIG.enabled) {
        const proxyUsername = GetProxyUsername(workerIndex);
        contextOptions.proxy = {
            server: PROXY_CONFIG.server,
            username: proxyUsername,
            password: PROXY_CONFIG.password
        };
    }

    const lockFiles = [
        'SingletonLock',
        'SingletonSocket',
        'SingletonCookie',
        'lockfile',
        'CrashpadMetrics-active.pma',
        'BrowserMetrics-spare.pma'
    ];

    console.log(`[Worker ${workerIndex}] Checking for stale locks in ${profileDir}`);

    let hasLock = false;
    let foundLocks: string[] = [];
    if (fs.existsSync(profileDir)) {
        for (const lockFile of lockFiles) {
            const lockPath = path.join(profileDir, lockFile);
            if (fs.existsSync(lockPath)) {
                hasLock = true;
                foundLocks.push(lockFile);
            }
        }
    }

    if (hasLock) {
        console.log(`[Worker ${workerIndex}] Found stale locks: ${foundLocks.join(', ')}`);
        console.log(`[Worker ${workerIndex}] Deleting entire profile directory`);
        try {
            fs.rmSync(profileDir, { recursive: true, force: true });
            console.log(`[Worker ${workerIndex}] Profile deleted successfully`);
        } catch (err) {
            console.warn(`[Worker ${workerIndex}] Could not delete profile: ${err}`);
        }
    } else {
        console.log(`[Worker ${workerIndex}] No stale locks found, using existing profile`);
    }



    let launchAttempts = 0;
    const maxLaunchRetries = 3;

    while (launchAttempts < maxLaunchRetries) {
        try {
            const ctx = await chromium.launchPersistentContext(profileDir, contextOptions);
            const page = ctx.pages().length > 0 ? ctx.pages()[0] : await ctx.newPage();


            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                (window as any).chrome = { runtime: {} };
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                const origGetParam = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function (param) {
                    if (param === 37445) return 'Intel Inc.';
                    if (param === 37446) return 'Intel Iris OpenGL Engine';
                    return origGetParam.call(this, param);
                };
            });

            return ctx;
        } catch (err: any) {
            launchAttempts++;
            console.error(`[Worker ${workerIndex}] Launch attempt ${launchAttempts} failed: ${err.message}`);
            if (launchAttempts >= maxLaunchRetries) throw err;
            await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
        }
    }

    throw new Error(`Worker ${workerIndex} failed to launch after ${maxLaunchRetries} attempts`);
}

export async function deleteWorkerProfile(workerIndex: number): Promise<void> {
    profileVersion++;
    console.log(`[Worker ${workerIndex}] Profile cleanup skipped (using disposable profiles)`);
}

export async function verifyWorkerIP(ctx: BrowserContext): Promise<void> {
    const page = await ctx.newPage();
    try {
        const response = await page.goto("https://ipinfo.io/json", {
            waitUntil: 'domcontentloaded',
            timeout: 10000
        });
        const ipData = await response?.json();
        console.log("  IP Check:", ipData);
    } catch (err) {
        console.log(" IP check failed");
    } finally {
        await page.close();
    }
}
