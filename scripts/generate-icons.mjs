import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

// Sleek high-tech wave + pulse icon SVG
const svgBuffer = Buffer.from(`
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090d16" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4" />
      <stop offset="50%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#8b5cf6" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  
  <rect width="512" height="512" rx="112" fill="url(#bg)" />
  <circle cx="256" cy="256" r="180" stroke="#1e293b" stroke-width="6" stroke-dasharray="8 12" />
  <circle cx="256" cy="256" r="140" stroke="#0e7490" stroke-width="4" opacity="0.3" />

  <!-- Equalizer / Pulse waves -->
  <g filter="url(#glow)">
    <rect x="128" y="216" width="24" height="80" rx="12" fill="url(#cyanGrad)" />
    <rect x="176" y="160" width="24" height="192" rx="12" fill="url(#cyanGrad)" />
    <rect x="224" y="112" width="24" height="288" rx="12" fill="url(#cyanGrad)" />
    <rect x="272" y="144" width="24" height="224" rx="12" fill="url(#cyanGrad)" />
    <rect x="320" y="192" width="24" height="128" rx="12" fill="url(#cyanGrad)" />
    <rect x="368" y="232" width="24" height="48" rx="12" fill="url(#cyanGrad)" />
  </g>

  <!-- Sync Center Pulse Dot -->
  <circle cx="256" cy="256" r="8" fill="#ffffff" />
</svg>
`);

async function generate() {
  await sharp(svgBuffer).resize(192, 192).png().toFile(join(OUT, "icon-192.png"));
  await sharp(svgBuffer).resize(512, 512).png().toFile(join(OUT, "icon-512.png"));
  await sharp(svgBuffer).resize(512, 512).png().toFile(join(OUT, "icon-512-maskable.png"));
  await sharp(svgBuffer).resize(180, 180).png().toFile(join(OUT, "apple-touch-icon.png"));
  console.log("PWA Icons generated successfully in public/icons/");
}

generate().catch(console.error);
