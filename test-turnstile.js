const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Visiting http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });

  // 1. Check for the overlay
  const overlayVisible = await page.evaluate(() => {
    const overlay = document.getElementById('turnstile-overlay');
    return !!overlay && window.getComputedStyle(overlay).display !== 'none';
  });
  console.log('Turnstile Overlay Present:', overlayVisible);

  // 2. Check for the Turnstile widget inside the container
  const widgetFound = await page.evaluate(() => {
    const container = document.getElementById('turnstile-container');
    return container && container.innerHTML.length > 0;
  });
  console.log('Turnstile Widget Loaded:', widgetFound);

  // 3. Take a screenshot for confirmation (even if headless, we can verify size/content)
  await page.screenshot({ path: 'turnstile-test.png' });
  console.log('Screenshot saved to turnstile-test.png');

  // 4. Check for errors in console (Cloudflare often blocks localhost for production keys)
  // Note: We expect an error if it's "effective" but the key doesn't allow localhost.
  
  await browser.close();
  process.exit(0);
})();
