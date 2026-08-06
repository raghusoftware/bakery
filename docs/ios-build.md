# Fast Bill on iOS

Fast Bill is a Capacitor app, so the **same web app** already runs on iOS — the
only work is packaging + Apple's rules. Unlike Android (free sideload of an APK),
Apple requires a Mac toolchain and, for real devices, a paid developer account.

## What iOS needs (vs Android)
| | Android | iOS |
|---|---|---|
| Build machine | any (Linux CI) | **macOS + Xcode** (we use a GitHub macOS runner) |
| Install on your own phone | download APK, enable unknown sources | **Apple Developer account** + signing; via Xcode or TestFlight |
| Distribute to others | send the APK | **TestFlight** (up to 100 testers) or **App Store review** |
| Cost | free | **$99/yr** Apple Developer Program |

## Option A — Just check it compiles (free, no account)
Run the **"Build iOS (Fast Bill)"** workflow (Actions tab → Run workflow). It
builds an **unsigned iOS Simulator** app and uploads `FastBill-iOS-simulator.zip`.
That proves the app builds for iOS, but a simulator `.app` can't be installed on a
real iPhone.

## Option B — Install on your iPhone (needs a Mac)
1. On a Mac: `cd app && npm install && npx cap add ios && npx cap open ios`
2. In Xcode: select your device, set your **Team** (free Apple ID works for a
   7-day personal build; paid account for longer), then **Run** (▶).
   The app installs directly on your iPhone.

## Option C — Distribute (TestFlight / App Store)
1. Enroll in the **Apple Developer Program** ($99/yr).
2. In Xcode: set the Team + a bundle id (e.g. `com.fastbill.pos`), **Archive**,
   then upload to **App Store Connect** → TestFlight (testers) or submit for review.
3. (Optional) Automate: add signing secrets to the `signed-ipa` step and use
   `xcodebuild -exportArchive` with an export options plist.

## Notes
- App name is set to **Fast Bill** (Info.plist `CFBundleDisplayName`).
- Set the iOS **bundle id** in Xcode (Signing & Capabilities). Suggested:
  `com.fastbill.pos`.
- The icon: add an iOS AppIcon set in `ios/App/App/Assets.xcassets` (Xcode can
  generate all sizes from one 1024×1024 PNG of the Fast Bill logo).
- Everything else (offline-first local cache, Supabase sync, POS, reports) is the
  same web code and works unchanged on iOS.
