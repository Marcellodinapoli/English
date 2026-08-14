# Alinea — Store distribution (iOS & Android)

Alinea is a **native store app** built with Capacitor around the Next.js product.

- **Google Play** → project in `/android`
- **App Store** → project in `/ios` (build on macOS + Xcode)
- App ID: `com.alinea.english`
- App name: **Alinea**

## Architecture

```
┌─────────────────────────────┐
│  App Store / Google Play    │
│  Capacitor native shell     │
│  (WebView + native plugins) │
└──────────────┬──────────────┘
               │ HTTPS
┌──────────────▼──────────────┐
│  Next.js backend + UI       │
│  Auth, lessons, AI, DB      │
└─────────────────────────────┘
```

The store binary is the shell. Learning logic stays on the server so iOS and Android share one product.

## Prerequisites

### Android (Windows / Mac / Linux)
- Android Studio (Hedgehog+)
- JDK 21
- Android SDK + emulator or USB device

### iOS (Mac only)
- Xcode 15+
- CocoaPods / Swift Package Manager
- Apple Developer account

### Backend
- Deployed Next.js URL for production builds
- For local device testing: `npm run dev` reachable on your LAN IP

## Configure the server URL

In `.env`:

```env
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
CAPACITOR_SERVER_URL=https://your-production-domain.com
```

Local device (replace with your PC LAN IP):

```env
CAPACITOR_SERVER_URL=http://192.168.1.20:3000
NEXT_PUBLIC_APP_URL=http://192.168.1.20:3000
```

Then:

```bash
npm run mobile:sync
```

## Run / open native IDEs

```bash
npm run mobile:android   # opens Android Studio
npm run mobile:ios       # opens Xcode (macOS)
```

## Release checklist

### Google Play
1. Set production `CAPACITOR_SERVER_URL`
2. `npm run mobile:sync`
3. Open Android Studio → Build → Generate Signed Bundle / APK (AAB)
4. Upload AAB to Play Console
5. Complete store listing, privacy policy, content rating

### App Store
1. Set production `CAPACITOR_SERVER_URL`
2. `npm run mobile:sync`
3. Open Xcode on Mac → Archive → Distribute App
4. Upload via App Store Connect
5. Complete privacy nutrition labels + review notes

## Permissions already declared

- Internet / network
- Microphone (for Phase 3 Speaking)

## Important

- Do **not** ship store builds pointed at `localhost`
- Use HTTPS in production
- Keep API keys only on the server (never in the Capacitor bundle)
