/**
 * Generate PWA + Android mobile-app icons from inline SVG.
 *
 * Renders the FamilyBoard bullseye glyph (dark/light ring + coral dot) on a
 * rounded-square background. Two variants — light (cream bg + dark ring) and
 * dark (dark bg + cream ring).
 *
 * Output:
 *   branding/icon-source-light-1024.png   (master, light)
 *   branding/icon-source-dark-1024.png    (master, dark)
 *   branding/icon-foreground-1024.png     (bullseye on transparent — Android adaptive foreground)
 *
 *   public/icon-192.png                   (PWA, light)
 *   public/icon-512.png                   (PWA, light)
 *   public/icon-192-dark.png              (PWA, dark)
 *   public/icon-512-dark.png              (PWA, dark)
 *   public/favicon.png                    (32px, light — browser tab)
 *
 *   mobile/android/app/src/main/res/mipmap-{mdpi..xxxhdpi}/ic_launcher.png
 *   mobile/android/app/src/main/res/drawable-{mdpi..xxxhdpi}/ic_launcher_foreground.png
 *
 * iOS is intentionally skipped — `mobile/ios/Runner/Assets.xcassets/`
 * doesn't exist in this checkout (a full `flutter create` was never
 * completed on iOS). Once it does, add an `ios` section to this script
 * pointing at the AppIcon.appiconset sizes.
 *
 * Run with `node scripts/generate-app-icons.mjs` from the repo root.
 */

import sharp from "sharp";
import { access, mkdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

// Brand tokens — keep in sync with src/app/globals.css and
// mobile/lib/widgets/familyboard_logo.dart.
const CREAM = "#FAF7F2";
const INK = "#1B1F3B";
const CORAL = "#E6745A";

const ICON_SIZE = 1024;
const RADIUS = 224; // ~22% of side — matches iOS large icon corner

// Bullseye geometry, expressed as fractions of the canvas size.
const RING_R = 0.21; // outer-ring radius
const RING_STROKE = 0.075;
const DOT_R = 0.075;

function bullseye({ ring }) {
  const cx = ICON_SIZE / 2;
  const cy = ICON_SIZE / 2;
  return `
  <circle cx="${cx}" cy="${cy}" r="${ICON_SIZE * RING_R}" fill="none" stroke="${ring}" stroke-width="${ICON_SIZE * RING_STROKE}"/>
  <circle cx="${cx}" cy="${cy}" r="${ICON_SIZE * DOT_R}" fill="${CORAL}"/>`;
}

function withBg({ bg, ring }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">
  <rect width="${ICON_SIZE}" height="${ICON_SIZE}" rx="${RADIUS}" ry="${RADIUS}" fill="${bg}"/>
${bullseye({ ring })}
</svg>`;
}

function transparent({ ring }) {
  // Same geometry, no background rect — for Android adaptive foreground.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">
${bullseye({ ring })}
</svg>`;
}

function squareWithBg({ bg, ring }) {
  // iOS icons MUST be solid squares (no rounded corners, no alpha). The system
  // applies the corner mask itself. Same bullseye geometry as the rounded
  // variant, just on a flat rect.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">
  <rect width="${ICON_SIZE}" height="${ICON_SIZE}" fill="${bg}"/>
${bullseye({ ring })}
</svg>`;
}

const SVG = {
  light: withBg({ bg: CREAM, ring: INK }),
  dark: withBg({ bg: INK, ring: CREAM }),
  fg: transparent({ ring: INK }),
  iosLight: squareWithBg({ bg: CREAM, ring: INK }),
};

async function writePng(svg, outPath, size) {
  await mkdir(dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
  console.log(`  ✓ ${outPath.replace(ROOT + "/", "")} (${size}×${size})`);
}

async function writeIosPng(svg, outPath, size) {
  // iOS icons reject any alpha channel. Flatten against cream so the cream
  // background fills the full square edge-to-edge (no transparency leaks).
  await mkdir(dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .flatten({ background: CREAM })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`  ✓ ${outPath.replace(ROOT + "/", "")} (${size}×${size})`);
}

// Android adaptive-icon convention. mipmap = full icon (legacy), drawable =
// adaptive foreground (bullseye on transparent, centered in 108dp canvas).
const ANDROID_MIPMAP = [
  { density: "mdpi", size: 48 },
  { density: "hdpi", size: 72 },
  { density: "xhdpi", size: 96 },
  { density: "xxhdpi", size: 144 },
  { density: "xxxhdpi", size: 192 },
];

const ANDROID_FOREGROUND = [
  // 108dp at each density bucket
  { density: "mdpi", size: 108 },
  { density: "hdpi", size: 162 },
  { density: "xhdpi", size: 216 },
  { density: "xxhdpi", size: 324 },
  { density: "xxxhdpi", size: 432 },
];

// iOS AppIcon.appiconset — 15 sizes covering iPhone + iPad + App Store
// marketing. Filenames match the default Flutter `flutter create` output
// and are referenced from Contents.json. Don't rename without also
// editing that file.
const IOS_APPICON = [
  { name: "Icon-App-20x20@1x.png", size: 20 },
  { name: "Icon-App-20x20@2x.png", size: 40 },
  { name: "Icon-App-20x20@3x.png", size: 60 },
  { name: "Icon-App-29x29@1x.png", size: 29 },
  { name: "Icon-App-29x29@2x.png", size: 58 },
  { name: "Icon-App-29x29@3x.png", size: 87 },
  { name: "Icon-App-40x40@1x.png", size: 40 },
  { name: "Icon-App-40x40@2x.png", size: 80 },
  { name: "Icon-App-40x40@3x.png", size: 120 },
  { name: "Icon-App-60x60@2x.png", size: 120 },
  { name: "Icon-App-60x60@3x.png", size: 180 },
  { name: "Icon-App-76x76@1x.png", size: 76 },
  { name: "Icon-App-76x76@2x.png", size: 152 },
  { name: "Icon-App-83.5x83.5@2x.png", size: 167 },
  { name: "Icon-App-1024x1024@1x.png", size: 1024 },
];

async function main() {
  // Masters
  await writePng(SVG.light, resolve(ROOT, "branding/icon-source-light-1024.png"), 1024);
  await writePng(SVG.dark, resolve(ROOT, "branding/icon-source-dark-1024.png"), 1024);
  await writePng(SVG.fg, resolve(ROOT, "branding/icon-foreground-1024.png"), 1024);

  // PWA
  await writePng(SVG.light, resolve(ROOT, "public/icon-192.png"), 192);
  await writePng(SVG.light, resolve(ROOT, "public/icon-512.png"), 512);
  await writePng(SVG.dark, resolve(ROOT, "public/icon-192-dark.png"), 192);
  await writePng(SVG.dark, resolve(ROOT, "public/icon-512-dark.png"), 512);
  await writePng(SVG.light, resolve(ROOT, "public/favicon.png"), 32);

  // Android — legacy launcher icon (full bg + bullseye)
  for (const { density, size } of ANDROID_MIPMAP) {
    await writePng(
      SVG.light,
      resolve(ROOT, `mobile/android/app/src/main/res/mipmap-${density}/ic_launcher.png`),
      size,
    );
  }

  // Android — adaptive foreground (bullseye on transparent)
  for (const { density, size } of ANDROID_FOREGROUND) {
    await writePng(
      SVG.fg,
      resolve(ROOT, `mobile/android/app/src/main/res/drawable-${density}/ic_launcher_foreground.png`),
      size,
    );
  }

  // iOS — AppIcon.appiconset (15 sizes, all light variant, no alpha).
  // Skip silently if the asset catalog doesn't exist yet — keeps the script
  // safe to run on checkouts where `flutter create -t app .` hasn't been run.
  const iosDir = resolve(
    ROOT,
    "mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset",
  );
  try {
    await access(iosDir, fsConstants.F_OK);
    for (const { name, size } of IOS_APPICON) {
      await writeIosPng(SVG.iosLight, resolve(iosDir, name), size);
    }
  } catch {
    console.log("");
    console.log("⚠  iOS AppIcon.appiconset not found — skipping iOS icons.");
    console.log("   Run `cd mobile && flutter create -t app --platforms=ios .`");
    console.log("   to scaffold it, then re-run this script.");
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
