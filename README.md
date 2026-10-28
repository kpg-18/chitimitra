# Chiti Mitra

Chiti Mitra (ಚಿಟಿ ಮಿತ್ರ) is a mobile-first chit fund management app prototype for Kannada-English and English users. The project demonstrates a production-oriented app structure for group creation, finance tracking, member management, auction flows, and thematic design.

## Features

- Group dashboard and home summary
- Group creation flow and member addition
- Payment verification and collection updates
- Activity feed and profile settings
- Theme and language preferences
- Financial calculation utilities for monthly collections, payouts, and auction prizes
- Vitest coverage for finance formula validation

## Tech stack

- Expo + React Native + TypeScript
- Expo Router
- AsyncStorage for local app state persistence
- Vitest for unit tests

## Local setup

```bash
npm install
npm run start
```

Then run one of:

```bash
npm run ios
npm run android
npm run web
```

## Testing

```bash
npm test
```

## Host the web app with GitHub Pages

The GitHub Actions workflow builds the static Expo Router site and deploys it to GitHub Pages on pushes to `main`.

1. Create a GitHub repository and push this project to its `main` branch.
2. In the repository, open **Settings → Pages** and set the source to **GitHub Actions**.
3. Push to `main` or run **Actions → Deploy Expo web app to GitHub Pages → Run workflow**.
4. Open the Pages URL shown in the deployment job.

The build detects the repository name and configures Expo's base path for project Pages URLs.

```bash
npm run web:export
```

This exports a static site to `dist/` for local verification.

## EAS builds

These builds use Expo Application Services. Sign in to your Expo account first:

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

For an installable Android APK to share with testers:

```bash
npm run build:android:apk
```

For a Google Play Store Android App Bundle (AAB):

```bash
npm run build:android:play
```

For an iOS device archive (IPA), EAS will guide you through Apple signing credentials:

```bash
npm run build:ios
```

For an iOS Simulator build:

```bash
npm run build:ios:simulator
```

EAS Build prompts to create or use signing credentials on the first signed build. You can let Expo manage credentials or provide your own. iOS device builds require an Apple Developer account and provisioning; simulator builds do not need device distribution provisioning. Build downloads are provided by the EAS build page when the jobs finish.

## Notes

This app uses local persisted state rather than a live Supabase backend to keep the project runnable without external credentials. The finance and access patterns are structured so production backend integration can be added without reworking the app shell.

The current app is a prototype and stores data on the device. GitHub Pages serves a public static website; it cannot protect private group data or provide shared, multi-user persistence. The visibility checks in the client are for display only, not authorization. Do not enter real member or financial data or use this as a production service until authentication, a secure backend, server-side authorization (including database policies), auditability, privacy controls, and applicable legal/compliance reviews are complete.
