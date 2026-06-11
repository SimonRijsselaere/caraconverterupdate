# CaraConverter

Convert your money into Cara. Type in how many euros you have and find out
how many cans (and liters) of Belgium's finest budget beer you can afford —
classic Pils (€0.39), Blond (8.5%), Rouge or 0.0. Toggle **Nightshop Mode**
for late-night prices, see your haul in crates of 24, and share the result.

## Updating prices without a release

Prices are bundled as defaults in `src/app/services/price.service.ts`. To
update them remotely: host a copy of `prices.example.json` somewhere public
(e.g. a GitHub repo, fetched via its raw URL), then set `REMOTE_PRICES_URL`
in `price.service.ts`. The app fetches it on launch and silently falls back
to the bundled prices when offline.

## Tip jar

The "Buy me a Cara" button links to `TIP_JAR_URL` in
`src/app/home/home.page.ts` — point it at your Ko-fi or PayPal page.

## Stack

- Angular 20 (standalone components + signals)
- Ionic 8
- Capacitor 7 (Android)

## Development

```bash
npm install
npm start          # dev server on http://localhost:4200
```

## Android release

```bash
npm run sync       # ng build + cap sync
npx cap open android
```

Then in Android Studio: **Build > Generate Signed App Bundle** with your
keystore. Bump `versionCode`/`versionName` in `android/app/build.gradle`
for each release.
