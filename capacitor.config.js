/**
 * Store distribution (Google Play / App Store):
 * Native shells load the hosted Next.js app in a secure WebView.
 *
 * Dev on device (same Wi‑Fi as PC):
 *   set CAPACITOR_SERVER_URL=http://YOUR_LAN_IP:3000
 *   npm run mobile:sync
 *   npm run mobile:android
 *
 * Production:
 *   set CAPACITOR_SERVER_URL=https://your-domain.com
 *   npm run mobile:sync
 */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "";

/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: "com.alinea.english",
  appName: "Alinea",
  webDir: "native-shell",
  backgroundColor: "#132033",
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: serverUrl.startsWith("http://"),
        allowNavigation: [
          "localhost",
          "127.0.0.1",
          "*.alinea.app",
          "*.vercel.app",
        ],
      }
    : undefined,
  android: {
    allowMixedContent: true,
    backgroundColor: "#132033",
  },
  ios: {
    backgroundColor: "#132033",
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "Alinea",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#132033",
      showSpinner: false,
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#132033",
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
};

module.exports = config;
