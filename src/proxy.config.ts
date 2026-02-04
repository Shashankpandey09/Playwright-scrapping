

export const PROXY_CONFIG = {
    enabled: false,
    server: "xasxsx",
    username: "xasxsx",
    password: "xasxsx",
    countryCode: "us"
} as const;

export function GetProxyUsername(workerIndex: number): string {
    const sessionId = `worker${workerIndex}`;
    let username = `${PROXY_CONFIG.username}-session-${sessionId}`;

    if (PROXY_CONFIG.countryCode) {
        username += `-country-${PROXY_CONFIG.countryCode}`;
    }

    return username;
}
