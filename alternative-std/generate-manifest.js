#!/usr/bin/env node
// Run this after adding images to the cutouts/ folder:
//   node generate-manifest.js
//
// It scans alternative-std/cutouts/ for image files and writes manifest.json

const fs = require('fs');
const path = require('path');

const cutoutsDir = path.join(__dirname, 'cutouts');
const exts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

const files = fs.readdirSync(cutoutsDir)
  .filter(f => exts.has(path.extname(f).toLowerCase()) && !f.startsWith('.'));

files.sort();

fs.writeFileSync(
  path.join(cutoutsDir, 'manifest.json'),
  JSON.stringify(files, null, 2) + '\n'
);

console.log(`Wrote manifest.json with ${files.length} image(s): ${files.join(', ')}`);
