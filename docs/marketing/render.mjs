// Renders the marketing images from hero.html with a headless Chromium.
//
//   npm run marketing
//
// Needs the `playwright` dev dependency and its Chromium
// (`npx playwright install chromium` once). Inputs are the UI screenshots in
// ../screenshots; outputs land next to this file as JPEG, which keeps the
// gradients small without visible loss at these sizes.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const template = `file://${path.join(here, "hero.html")}`;

/** Output formats: README/portfolio hero (16:9) and link preview (1.9:1). */
const SIZES = [
  { name: "hero", size: "wide", width: 2400, height: 1350 },
  { name: "social", size: "social", width: 1200, height: 630 },
];
const LANGS = ["de", "en"];

const browser = await chromium.launch();
try {
  for (const lang of LANGS) {
    for (const { name, size, width, height } of SIZES) {
      const page = await browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: 1,
      });
      await page.goto(`${template}?lang=${lang}&size=${size}`);
      // Fonts and the embedded screenshot must be in before the capture.
      await page.evaluate(() =>
        Promise.all([
          document.fonts.ready,
          ...Array.from(document.images).map((img) => img.decode()),
        ]),
      );
      const out = path.join(here, `${name}-${lang}.jpg`);
      await page.screenshot({ path: out, type: "jpeg", quality: 92 });
      console.log("wrote", path.relative(process.cwd(), out));
      await page.close();
    }
  }
} finally {
  await browser.close();
}
