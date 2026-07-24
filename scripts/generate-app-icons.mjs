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
 *   mobile/android/app/src/main/res/drawable-{mdpi..xxxhdpi}/launch_image.png       (light launch bullseye, transparent)
 *   mobile/android/app/src/main/res/drawable-night-{mdpi..xxxhdpi}/launch_image.png (dark launch bullseye, transparent)
 *
 *   mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage[@2x/@3x].png       (light)
 *   mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage-dark[@2x/@3x].png  (dark)
 *   mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset/Contents.json
 *
 * The AppIcon.appiconset sections (iOS icons) and the LaunchImage.imageset
 * section (iOS launch screen) are both gated on their asset-catalog
 * directory existing — safe to run on checkouts where `flutter create` for
 * iOS hasn't been completed yet.
 *
 * Run with `node scripts/generate-app-icons.mjs` from the repo root.
 */

import sharp from "sharp";
import { access, mkdir, writeFile } from "node:fs/promises";
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
  // Ring-only-on-transparent, light ring for dark backgrounds — used by the
  // launch screen where the background flips CREAM (day) / near-black (night)
  // and an INK ring would nearly vanish on the dark bg (both are near-black).
  fgDark: transparent({ ring: CREAM }),
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

// Android launch-screen bullseye — centered over the launch_background
// layer-list, at each density bucket. Logical size 168dp (mdpi baseline),
// matching the iOS launch image's 168pt logical size.
const ANDROID_LAUNCH = [
  { density: "mdpi", size: 168 },
  { density: "hdpi", size: 252 },
  { density: "xhdpi", size: 336 },
  { density: "xxhdpi", size: 504 },
  { density: "xxxhdpi", size: 672 },
];

// iOS LaunchImage.imageset — logical size 168pt (matches the storyboard's
// declared image size). Light + dark variants, selected automatically by
// the asset catalog based on the system appearance.
const IOS_LAUNCH = [
  { suffix: "", scale: 1 },
  { suffix: "@2x", scale: 2 },
  { suffix: "@3x", scale: 3 },
];
const IOS_LAUNCH_POINT_SIZE = 168;

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

  // Android — launch screen bullseye (bullseye on transparent). Light in
  // drawable-<density>, dark in drawable-night-<density> — Android's
  // resource resolution swaps the file at runtime based on system theme,
  // both referenced from the same `@drawable/launch_image` in
  // launch_background.xml.
  for (const { density, size } of ANDROID_LAUNCH) {
    await writePng(
      SVG.fg,
      resolve(ROOT, `mobile/android/app/src/main/res/drawable-${density}/launch_image.png`),
      size,
    );
    await writePng(
      SVG.fgDark,
      resolve(ROOT, `mobile/android/app/src/main/res/drawable-night-${density}/launch_image.png`),
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

  // iOS — LaunchImage.imageset (light + dark, transparent, gated the same
  // way as AppIcon above).
  const iosLaunchDir = resolve(
    ROOT,
    "mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset",
  );
  try {
    await access(iosLaunchDir, fsConstants.F_OK);
    const images = [];
    for (const { suffix, scale } of IOS_LAUNCH) {
      const size = IOS_LAUNCH_POINT_SIZE * scale;
      const lightName = `LaunchImage${suffix}.png`;
      const darkName = `LaunchImage-dark${suffix}.png`;
      await writePng(SVG.fg, resolve(iosLaunchDir, lightName), size);
      await writePng(SVG.fgDark, resolve(iosLaunchDir, darkName), size);
      images.push({
        idiom: "universal",
        filename: lightName,
        scale: `${scale}x`,
      });
      images.push({
        idiom: "universal",
        filename: darkName,
        scale: `${scale}x`,
        appearances: [{ appearance: "luminosity", value: "dark" }],
      });
    }
    const contents = {
      images,
      info: { version: 1, author: "xcode" },
    };
    await writeFile(
      resolve(iosLaunchDir, "Contents.json"),
      `${JSON.stringify(contents, null, 2)}\n`,
    );
    console.log(`  ✓ ios/.../LaunchImage.imageset/Contents.json`);
  } catch {
    console.log("");
    console.log("⚠  iOS LaunchImage.imageset not found — skipping iOS launch images.");
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
