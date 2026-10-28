# Chiti Mitra

Chiti Mitra (ಚಿಟಿ ಮಿತ್ರ) is a mobile-first chit fund management app prototype for Kannada-English and English users. The project demonstrates a production-oriented app structure for group creation, finance tracking, member management, auction flows, and thematic design.

## Features

- Group dashboard and home summary
- Group creation with a chosen total member count and required member names; email or phone is optional
- Per-round chit auction records with winner, payout, payment tracking, and JPG downloads for a round or full group history
- Immediate chit start without member acceptance; the admin can enter full or partial collection amounts at each round
- Configurable auction, fixed-discount, and lucky-draw methods; agent-managed chits have a separate foreman commission setting
- Optional admin fee per member per month or one-time per member; it is recorded separately from chit contributions
- Per-round choice to distribute the post-agent-fee auction discount as dividends, carry it into the next auction pot, or retain it in a group reserve
- Bid increments of ₹100, ₹200, or ₹500 and a group-specific minimum auction discount
- Payment verification and collection updates
- Activity feed and profile settings
- Temporary name-only local profile entry; Supabase email/password and Google auth code is retained but currently disabled
- Theme and language preferences
- Financial calculation utilities for monthly collections, payouts, and auction prizes
- Vitest coverage for finance formula validation

## Tech stack

- Expo + React Native + TypeScript
- Expo Router
- Supabase Auth for email/password accounts and recovery
- AsyncStorage for local app state persistence
- Vitest for unit tests

## Local setup

```bash
npm install
cp .env.example .env.local
npm run start
```

The app currently asks for a name and stores the profile and app data on the device; no Supabase credentials are needed. Supabase sign-in code remains available for future use and can be re-enabled by setting `AUTHENTICATION_ENABLED` in `src/context/AppContext.tsx` to `true`. The anon/publishable key is intended for client apps; never put a service-role key in the app.

### Supabase authentication setup

1. Create a Supabase project and copy its project URL and anon/publishable key into `.env.local`.
2. In **Authentication → URL Configuration**, add the app callback URLs to the allowed redirect URLs:
   - `http://localhost:8081/**` for local web testing
   - `https://kpg-18.github.io/chitimitra/**` for GitHub Pages
   - `chitimitra://auth` for installed iOS and Android apps
3. Configure email confirmation and password recovery email templates in the Supabase dashboard.
4. To enable **Google sign-in**, configure the Google provider under Supabase **Authentication → Sign In / Providers → Google**. Create a Google OAuth web client in Google Cloud, add its client ID and secret to Supabase, and set the Google OAuth redirect URI to `https://<your-project-ref>.supabase.co/auth/v1/callback`. Add your local and deployed app URLs as Google authorized JavaScript origins, and allow `http://localhost:8081/**`, `https://kpg-18.github.io/chitimitra/**`, and `chitimitra://auth` in Supabase redirect URLs.
5. For GitHub Pages, add repository secrets named `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. For EAS builds, add the same environment variables to the build environment before starting a new build.

The app stores group and payment data locally, separately for each signed-in account on each device. Supabase currently handles authentication only; groups do not sync across devices and client-side visibility is not server-side access control.

Auction reports export as JPG images in the browser. On Android and iOS, the report opens the system share sheet so the image can be saved or sent to another app. Capturing JPGs on the native apps uses `react-native-view-shot`, so a new Android/iOS development or release build is required after installing the module.
Google account sign-in is handled by Supabase Auth. It will remain unavailable until the Google provider and OAuth client credentials are configured in the Supabase and Google Cloud dashboards.

### Chit calculation and operating notes

- Group setup asks for each member’s base subscription before auction dividends, the member count, and the number of monthly rounds. For the standard one-prize-per-member chit cycle, the number of rounds must equal the number of members.
- Base monthly installment per member = base subscription per member ÷ number of rounds. The amount must divide evenly into whole rupees.
- Gross monthly pot = member count × base monthly installment. Gross scheduled contributions before dividends = gross monthly pot × number of rounds. Auction dividends reduce members’ actual dues.
- Example: ₹1,00,000 base subscription per member, 10 members, and 10 rounds means ₹10,000 base per member each month, a ₹1,00,000 gross monthly pot, and ₹10,00,000 scheduled before dividends.
- Auction discount is the amount bid off the gross pot; the highest valid bid wins. The app calculates the winner payout as gross pot − winning discount.
- Agent/foreman commission is deducted from the discount first. The remaining dividend is split evenly (rounded down to whole rupees); each member’s effective contribution is monthly contribution − per-member dividend.
- An optional admin fee is an extra amount collected separately from the chit pot. Monthly fees are due each round; one-time per-member fees are due in round 1. The setting is stored as a group agreement assumption and is not a statement of legal authorization.
- After the agent fee, the admin chooses how the discount remainder is applied for that round: distribute it as a dividend, add it to the next round’s gross auction pot, or hold it as a separate group reserve. Carry-forward is unavailable in the final round. Whole-rupee dividend rounding is retained in the group reserve.
- Fixed-discount rounds use the configured discount. Lucky draws select a member who has not won an earlier recorded round.
- The app currently prevents discounts above 30% of the gross pot and limits configured agent commission to 7%. These are app guardrails, not a determination that a chit is legally compliant; applicable requirements, registrations, agreements and limits depend on current central and state law. Verify with the State Chit Funds Registrar and a qualified professional before operating a real chit.
- “Agent-managed” describes who manages the records in this app; it is not a separate statutory chit category. Common selection mechanisms are bid/auction, fixed discount, or draw/lot as permitted by the chit agreement.
- Group setup makes entered members active immediately for local record-keeping. It does not notify them or create real online membership, payments, legal agreements, or multi-device synchronization.

Background: [PRS Legislative Research’s summary of the Chit Funds (Amendment) Bill, 2019](https://prsindia.org/billtrack/the-chit-funds-amendment-bill-2019) describes gross chit amount, net prize amount/discount dividend, the foreman’s management role, and the proposed commission change. This product’s calculations are bookkeeping estimates, not legal or financial advice.

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

The GitHub Actions workflow builds the static Expo Router site and deploys it to GitHub Pages on pushes to `main` and the `feature/admin-fee-auction-remainder` release branch.

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

This app uses Supabase for authentication when project credentials are configured. Group, member, payment, and activity data are still persisted locally on the device.

The current app is a prototype. GitHub Pages serves a public static website; it cannot protect private group data or provide shared, multi-user persistence. The visibility checks in the client are for display only, not authorization. Do not enter real member or financial data or use this as a production service until group data is moved to a secure backend with server-side authorization (including database policies), auditability, privacy controls, and applicable legal/compliance reviews.
