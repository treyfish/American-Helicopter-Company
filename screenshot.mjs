import puppeteer from 'puppeteer';
import { readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] || '';
const width = parseInt(process.argv[4] || '1440', 10);
const height = parseInt(process.argv[5] || '900', 10);

const dir = join(fileURLToPath(new URL('.', import.meta.url)), 'temporary screenshots');
mkdirSync(dir, { recursive: true });

const nums = readdirSync(dir)
  .map(f => /^screenshot-(\d+)/.exec(f))
  .filter(Boolean)
  .map(m => parseInt(m[1], 10));
const n = (nums.length ? Math.max(...nums) : 0) + 1;
const name = label ? `screenshot-${n}-${label}.png` : `screenshot-${n}.png`;
const out = join(dir, name);

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 1500));
// Scroll through the page so lazy/scroll-triggered content initializes,
// wait (at the bottom) for all images to finish, then return to top
await page.evaluate(async () => {
  const step = window.innerHeight;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 150));
  }
  const pending = [...document.images].filter(img => !img.complete).map(img =>
    new Promise(resolve => { img.onload = img.onerror = resolve; })
  );
  await Promise.race([
    Promise.all(pending),
    new Promise(r => setTimeout(r, 10000)),
  ]);
  window.scrollTo({ top: 0, behavior: 'instant' });
});
await new Promise(r => setTimeout(r, 1200));
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(out);
