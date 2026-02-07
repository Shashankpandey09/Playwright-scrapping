
export const IDENTITY_POOL = [

    {
        name: "windows",
        ua: "AppleTV11,1/11.1",
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false

    },
    {
        name: 'Pixel 9 Pro WebView',
        ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro Build/AD1A.240418.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.54 Mobile Safari/537.36',
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true
    },
    //mimic windows
    {
        name: 'windows',
        ua: 'Mozilla/4.0 (PSP (PlayStation Portable); 2.00)',
        viewport: { width: 480, height: 272 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false
    },




] as const;
