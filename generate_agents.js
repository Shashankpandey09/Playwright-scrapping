"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// @ts-ignore
const user_agents_1 = __importDefault(require("user-agents"));
const outputPath = path.join(process.cwd(), 'agents.json');
// 1. Generate real browser agents (Desktop & Mobile)
console.log('Generating real browser agents...');
const realAgents = new Set();
// Generate 500 Desktop Windows
const windows = new user_agents_1.default({ deviceCategory: 'desktop', platform: 'Win32' });
for (let i = 0; i < 500; i++)
    realAgents.add(windows.random().toString());
// Generate 200 Desktop Mac
const mac = new user_agents_1.default({ deviceCategory: 'desktop', platform: 'MacIntel' });
for (let i = 0; i < 200; i++)
    realAgents.add(mac.random().toString());
// Generate 100 Mobile (iOS/Android) for variety in backup strategies
const mobile = new user_agents_1.default({ deviceCategory: 'mobile' });
for (let i = 0; i < 100; i++)
    realAgents.add(mobile.random().toString());
// 2. Add Major Bots (from the user's list)
// Using known strings for these to ensure accuracy
const botAgents = [
    // Google
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Safari/537.36",
    // Bing
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    // DuckDuckGo
    "DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)",
    // Baidu
    "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)",
    // Apple
    "(Applebot/0.1; +http://www.apple.com/go/applebot)",
    // Facebook
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    // Discord
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    // Twitter/X
    "Twitterbot/1.0",
    // LinkedIn
    "LinkedInBot/1.0 (compatible; Mozilla/5.0; Jakarta Commons-HttpClient/3.1 +http://www.linkedin.com)",
    // Pinterest
    "Pinterestbot/1.0 (+http://www.pinterest.com/bot.html)",
    // Slack
    "Slackbot 1.0 (+https://api.slack.com/robots)",
    // Ahrefs
    "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
    // SEMrush
    "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)",
];
botAgents.forEach(agent => realAgents.add(agent));
// 3. Write to file
const finalAgents = Array.from(realAgents);
fs.writeFileSync(outputPath, JSON.stringify(finalAgents, null, 2));
console.log(`Successfully created agents.json with ${finalAgents.length} total user agents.`);
console.log(`- Real Browsers: ${finalAgents.length - botAgents.length}`);
console.log(`- Bots/Crawlers: ${botAgents.length}`);
