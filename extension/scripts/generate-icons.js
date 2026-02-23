#!/usr/bin/env node
/**
 * Generate PNG icons from SVG sources for Chrome extension.
 * Chrome extensions do not support SVG icons in manifest.json.
 * Usage: node scripts/generate-icons.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
const SIZES = [16, 48, 128];

async function generateIcons() {
  for (const size of SIZES) {
    const svgPath = path.join(ICONS_DIR, `icon${size}.svg`);
    const pngPath = path.join(ICONS_DIR, `icon${size}.png`);

    if (!fs.existsSync(svgPath)) {
      console.warn(`SVG not found: ${svgPath}, generating placeholder`);
      // Generate a simple green shield placeholder
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <rect width="${size}" height="${size}" rx="${Math.round(size * 0.15)}" fill="#42A55A"/>
        <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="${Math.round(size * 0.4)}" font-weight="bold" font-family="Arial">FG</text>
      </svg>`;
      await sharp(Buffer.from(svg)).resize(size, size).png().toFile(pngPath);
    } else {
      await sharp(svgPath).resize(size, size).png().toFile(pngPath);
    }
    console.log(`Generated: icon${size}.png`);
  }
  console.log('All icons generated successfully.');
}

generateIcons().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
