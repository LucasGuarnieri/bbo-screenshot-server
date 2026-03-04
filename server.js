const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

let browser = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--font-render-hinting=none'
      ]
    });
  }
  return browser;
}

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'bbo-screenshot' });
});

/**
 * POST /screenshot
 * Body: {
 *   url: string,           // URL to capture
 *   viewports: [320, 768], // widths to capture
 *   fullPage: boolean,     // capture full scrollable page (default true)
 *   waitFor: number,       // ms to wait after load (default 3000)
 *   sections: boolean      // if true, split full page into ~800px tall chunks
 * }
 * 
 * Returns: {
 *   screenshots: [
 *     { viewport: 320, images: ["data:image/png;base64,...", ...] },
 *     { viewport: 768, images: ["data:image/png;base64,...", ...] }
 *   ]
 * }
 */
app.post('/screenshot', async (req, res) => {
  const { url, viewports = [320], fullPage = true, waitFor = 3000, sections = true } = req.body;

  if (!url) return res.status(400).json({ error: 'url is required' });

  const startTime = Date.now();
  console.log(`📸 Screenshot request: ${url} @ ${viewports.join(',')}px`);

  let page = null;
  try {
    const b = await getBrowser();
    page = await b.newPage();

    // Block heavy resources to speed up loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      // Block videos, large media — keep images, styles, fonts, scripts
      if (type === 'media') {
        req.abort();
      } else {
        req.continue();
      }
    });

    const results = [];

    for (const vw of viewports) {
      // Set viewport
      await page.setViewport({ width: vw, height: 900, deviceScaleFactor: 2 });

      // Navigate
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for Bubble to finish rendering
      await page.waitForTimeout(waitFor);

      // Scroll down slowly to trigger lazy-loaded elements
      await autoScroll(page);
      await page.waitForTimeout(1000);

      // Scroll back to top
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);

      if (sections) {
        // Split into sections (~800px tall chunks for better Vision analysis)
        const totalHeight = await page.evaluate(() => document.body.scrollHeight);
        const chunkHeight = 800;
        const images = [];

        for (let y = 0; y < totalHeight; y += chunkHeight) {
          const height = Math.min(chunkHeight, totalHeight - y);
          const screenshot = await page.screenshot({
            type: 'png',
            clip: { x: 0, y, width: vw, height },
            encoding: 'base64'
          });
          images.push(`data:image/png;base64,${screenshot}`);
        }

        results.push({ viewport: vw, images, totalHeight, chunks: images.length });
        console.log(`  ✅ ${vw}px: ${images.length} sections (${totalHeight}px tall)`);
      } else {
        // Single full-page screenshot
        const screenshot = await page.screenshot({
          type: 'png',
          fullPage,
          encoding: 'base64'
        });
        results.push({ viewport: vw, images: [`data:image/png;base64,${screenshot}`] });
        console.log(`  ✅ ${vw}px: full page`);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`  ⏱️ Total: ${elapsed}ms`);

    res.json({ screenshots: results, elapsed });

  } catch (err) {
    console.error('❌ Screenshot error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

/**
 * POST /screenshot-with-changes
 * Same as /screenshot but injects CSS overrides to simulate responsive changes
 * Body: {
 *   url: string,
 *   viewport: number,
 *   changes: { elementId: { prop: value } }  // flat props to inject as CSS
 * }
 * 
 * This allows us to see "before" (no changes) and "after" (with changes)
 */
app.post('/screenshot-compare', async (req, res) => {
  const { url, viewport = 320, waitFor = 3000 } = req.body;

  if (!url) return res.status(400).json({ error: 'url is required' });

  let page = null;
  try {
    const b = await getBrowser();
    page = await b.newPage();

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.resourceType() === 'media') req.abort();
      else req.continue();
    });

    await page.setViewport({ width: viewport, height: 900, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(waitFor);
    await autoScroll(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Capture current state (this is how it looks NOW — before BBO changes)
    const totalHeight = await page.evaluate(() => document.body.scrollHeight);
    const chunkHeight = 800;
    const images = [];

    for (let y = 0; y < totalHeight; y += chunkHeight) {
      const height = Math.min(chunkHeight, totalHeight - y);
      const screenshot = await page.screenshot({
        type: 'png',
        clip: { x: 0, y, width: viewport, height },
        encoding: 'base64'
      });
      images.push(`data:image/png;base64,${screenshot}`);
    }

    console.log(`📸 Compare: ${viewport}px, ${images.length} sections`);
    res.json({ viewport, images, totalHeight, chunks: images.length });

  } catch (err) {
    console.error('❌ Compare error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

// Helper: scroll page to trigger lazy loading
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

const PORT = process.env.PORT || 3456;
app.listen(PORT, () => {
  console.log(`🚀 BBO Screenshot Server running on port ${PORT}`);
  console.log(`   POST /screenshot — capture page at specified viewports`);
  console.log(`   POST /screenshot-compare — capture for before/after comparison`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (browser) await browser.close();
  process.exit(0);
});
