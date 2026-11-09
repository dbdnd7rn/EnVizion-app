import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const htmlPath = path.join(dist, "index.html");
const iconPath = path.join(root, "assets", "envizion-app-icon.png");
const outputIconPath = path.join(dist, "icons", "envizion-app-icon.png");
const manifestPath = path.join(dist, "manifest.webmanifest");

if (!fs.existsSync(htmlPath)) {
  throw new Error("Expo web export is missing dist/index.html");
}

const icon = fs.readFileSync(iconPath);
if (icon.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
  throw new Error("The EnVizion app icon must be a PNG");
}
const width = icon.readUInt32BE(16);
const height = icon.readUInt32BE(20);
if (width !== height || width < 512) {
  throw new Error("The EnVizion app icon must be square and at least 512px");
}

fs.mkdirSync(path.dirname(outputIconPath), { recursive: true });
fs.copyFileSync(iconPath, outputIconPath);

const manifest = {
  id: "/",
  name: "EnVizion Life",
  short_name: "EnVizion Life",
  description: "Your connected caregiving workspace.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#FCF9F6",
  theme_color: "#70338F",
  orientation: "portrait",
  icons: [
    {
      src: "/icons/envizion-app-icon.png",
      sizes: `${width}x${height}`,
      type: "image/png",
      purpose: "any"
    }
  ]
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

const webAppHead = [
  '<!-- EnVizion Life iPhone Home Screen web app -->',
  '<link rel="manifest" href="/manifest.webmanifest" />',
  '<link rel="apple-touch-icon" href="/icons/envizion-app-icon.png" />',
  '<link rel="icon" type="image/png" href="/icons/envizion-app-icon.png" />',
  '<meta name="application-name" content="EnVizion Life" />',
  '<meta name="theme-color" content="#70338F" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="EnVizion Life" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />'
].join("\n");

const html = fs.readFileSync(htmlPath, "utf8");
if (!/<\/head\s*>/i.test(html)) {
  throw new Error("Expo web index.html has no </head> for PWA metadata");
}
if (html.includes("<!-- EnVizion Life iPhone Home Screen web app -->")) {
  throw new Error("PWA metadata already injected; run Expo export before preparing PWA");
}
fs.writeFileSync(htmlPath, html.replace(/<\/head\s*>/i, `${webAppHead}\n</head>`));

console.log(
  `EnVizion Life iPhone PWA prepared with official ${width}x${height} app icon.`
);

// Deliberately do not register an offline-caching service worker. This app contains
// personal caregiving information; testers must use a network connection, and
// authenticated API responses must not be stored by a PWA precache.
