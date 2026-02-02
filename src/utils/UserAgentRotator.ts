import * as fs from 'fs';
import * as path from 'path';

export class UserAgentRotator {
    private static agentsFile = path.join(process.cwd(), 'agents.json');
    private static agents: string[] = [];

    /**
     * Loads agents from agents.json file
     */
    private static loadAgents(): void {
        try {
            if (!fs.existsSync(this.agentsFile)) {
                console.warn(`[WARN] agents.json not found at ${this.agentsFile}. Using default.`);
                this.agents = [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                ];
                return;
            }

            const data = fs.readFileSync(this.agentsFile, 'utf-8');
            this.agents = JSON.parse(data);

            if (!Array.isArray(this.agents) || this.agents.length === 0) {
                console.warn('[WARN] agents.json is empty or invalid. Using default.');
                this.agents = [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                ];
            }

        } catch (error: any) {
            console.error(`[ERROR] Failed to load agents.json: ${error.message}`);
            this.agents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ];
        }
    }

    /**
     * Returns a random user agent from the loaded list
     */
    public static getRandomAgent(): string {
        if (this.agents.length === 0) {
            this.loadAgents();
        }

        const randomIndex = Math.floor(Math.random() * this.agents.length);
        const agent = this.agents[randomIndex];
        // console.log(`[UA Rotator] Selected Agent: ${agent.substring(0, 50)}...`); 
        return agent;
    }

    /**
     * Helper to get a full browser profile object structure
     * (Mimics the previous getDesktopProfile structure for compatibility)
     */
    public static getBrowserProfile() {
        const userAgent = this.getRandomAgent();

        return {
            userAgent: userAgent,
            viewport: { width: 1920, height: 1080 }, // Default viewport
            locale: 'en-US',
            timezoneId: 'America/New_York'
        };
    }
}

// Simple test block to verify functionality
if (require.main === module) {
    console.log("Testing UserAgentRotator...");
    const agent = UserAgentRotator.getRandomAgent();
    console.log(`Random Agent: ${agent}`);
}
