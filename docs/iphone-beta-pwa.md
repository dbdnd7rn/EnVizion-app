# EnVizion Life — iPhone Beta without App Store

## What testers install

The EnVizion Life beta is a **Home Screen web app (PWA)** using the existing
secure Render-hosted Expo web build. It has its own icon and launches in an
app-style window without Safari browser chrome.

This is **not** an iOS .ipa build or a TestFlight release. A paid Apple
Developer Program account is **not required** for this web-app beta.

## iPhone tester instructions

1. On the iPhone, open **Safari** and visit
   https://envizion-life-caregiver.onrender.com/
2. Tap the **Share** control (or Page Menu → Share on newer iOS versions).
3. Choose **Add to Home Screen**. If it is missing, scroll down and use
   **Edit Actions** to enable it.
4. Keep **Open as Web App** enabled, when the option is shown.
5. Leave the name as **EnVizion Life** and tap **Add**.
6. Open **EnVizion Life** from the iPhone Home Screen, sign in using an
   authorized pilot account, and complete the applicable approved pilot flow.

## Limitations and safety

- **Internet access is required.** No offline care-data caching service
  worker is installed by this build process.
- Features implemented only through native iOS APIs (including some push,
  background, biometric, audio, file, or calendar integrations) must be
  tested separately in native builds before launch.
- This installs a web app, not a native iOS binary; beta results must be
  identified as **iPhone Safari/PWA**, not **native iOS**.
- Share beta accounts only with authorized participants. Do not use fake
  patients or real patient information without approved consent and access.
- Emergency or clinical safety functionality requires separate testing
  and review before relying on it.
- EnVizion app updates go live through the existing web deployment;
  testers may need to fully close and reopen the installed app to load
  a new version.

## Development

The `build:web` script exports Expo web assets, then runs
`scripts/prepare-iphone-pwa.mjs` to copy the official app icon, generate
`dist/manifest.webmanifest`, and add iOS installation metadata to
`dist/index.html`.

`npm run smoke:dist` checks for these production artifacts. The existing
branded opening screen handles the app's launch animation after JavaScript
initializes. No extra PWA service worker or offline cache is registered.

## Production verification checklist

- Confirm deployment returns 200 for `/`, `/manifest.webmanifest`, and
  `/icons/envizion-app-icon.png`.
- Confirm the site runs over HTTPS with correct MIME types for the manifest
  and PNG icon.
- Add to Home Screen on a real iPhone; confirm official EnVizion icon,
  standalone startup, sign-in, navigation, and reconnect behavior.
- Record device/iOS version and beta feedback in the pilot process.
