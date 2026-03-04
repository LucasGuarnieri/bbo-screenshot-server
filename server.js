const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

let browser = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-web-security', '--font-render-hinting=none']
    });
  }
  return browser;
}

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'bbo-screenshot', version: '2.0' });
});

/**
 * POST /screenshot
 * Body: {
 *   url: string,
 *   viewports: [320, 768],
 *   waitFor: number (default 3000),
 *   sections: boolean (default true),
 *   elementMap: [{ id: "bTiYZ", name: "Hero Title", type: "Text" }, ...]
 * }
 * 
 * If elementMap provided, injects visible labels on each Bubble element before capture.
 * This lets Claude Vision know which element is which.
 */
app.post('/screenshot', async (req, res) => {
  const { url, viewports = [320], waitFor = 3000, sections = true, elementMap = null } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const startTime = Date.now();
  console.log(`📸 ${url} @ ${viewports.join(',')}px ${elementMap ? '(' + elementMap.length + ' labels)' : ''}`);

  let page = null;
  try {
    const b = await getBrowser();
    page = await b.newPage();

    await page.setRequestInterception(true);
    page.on('request', (r) => {
      if (r.resourceType() === 'media') r.abort();
      else r.continue();
    });

    const results = [];

    for (const vw of viewports) {
      await page.setViewport({ width: vw, height: 900, deviceScaleFactor: 2 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForTimeout(waitFor);
      await autoScroll(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);

      // Inject labels if elementMap provided
      if (elementMap && elementMap.length > 0) {
        const labeled = await page.evaluate((elements) => {
          let count = 0;
          for (const el of elements) {
            let dom = null;
            // Bubble uses the element ID as a CSS class in preview mode
            try { dom = document.querySelector('.' + el.id); } catch(e) {}

            if (dom && dom.offsetWidth > 0 && dom.offsetHeight > 0) {
              const label = document.createElement('div');
              const shortId = el.id.slice(0, 5);
              const name = el.name || el.type || '';
              label.style.cssText = 'position:absolute;top:0;left:0;background:rgba(255,30,30,0.9);color:white;font-size:8px;font-family:monospace;padding:1px 3px;border-radius:0 0 3px 0;z-index:999999;pointer-events:none;line-height:1.2;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;';
              label.textContent = `${shortId} ${name}`;
              
              const pos = window.getComputedStyle(dom).position;
              if (pos === 'static') dom.style.position = 'relative';
              dom.appendChild(label);
              count++;
            }
          }
          return count;
        }, elementMap);
        console.log(`  🏷️ Labeled ${labeled}/${elementMap.length}`);
        await page.waitForTimeout(200);
      }

      // Capture
      const totalHeight = await page.evaluate(() => document.body.scrollHeight);
      if (sections) {
        const chunkH = 800;
        const images = [];
        for (let y = 0; y < totalHeight; y += chunkH) {
          const h = Math.min(chunkH, totalHeight - y);
          const shot = await page.screenshot({ type: 'png', clip: { x: 0, y, width: vw, height: h }, encoding: 'base64' });
          images.push(`data:image/png;base64,${shot}`);
        }
        results.push({ viewport: vw, images, totalHeight, chunks: images.length });
        console.log(`  ✅ ${vw}px: ${images.length} sections`);
      } else {
        const shot = await page.screenshot({ type: 'png', fullPage: true, encoding: 'base64' });
        results.push({ viewport: vw, images: [`data:image/png;base64,${shot}`] });
        console.log(`  ✅ ${vw}px: full page`);
      }
    }

    console.log(`  ⏱️ ${Date.now() - startTime}ms`);
    res.json({ screenshots: results, elapsed: Date.now() - startTime });
  } catch (err) {
    console.error('❌', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0; const dist = 300;
      const t = setInterval(() => {
        window.scrollBy(0, dist); total += dist;
        if (total >= document.body.scrollHeight) { clearInterval(t); resolve(); }
      }, 100);
    });
  });
}

const PORT = process.env.PORT || 3456;
app.listen(PORT, () => console.log(`🚀 BBO Screenshot Server v2.0 on port ${PORT}`));
process.on('SIGTERM', async () => { if (browser) await browser.close(); process.exit(0); });
