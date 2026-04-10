const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');
const app = express();
app.use(express.static(path.join(__dirname)));

const MULTI_PROJECTS = ['ab','as','bb','bbss','brkut','calculator','cc','cgol','Minecraft','minesweeper','p','piano','pm','pvz','rcs','shootthemonster','solitaire','sss','Wordscapes'];

const server = app.listen(0, async () => {
    const port = server.address().port;
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    
    for (const proj of MULTI_PROJECTS) {
        const page = await browser.newPage();
        let errors = [];
        page.on('pageerror', e => errors.push('PAGE_ERROR: ' + e.message));
        page.on('console', msg => { if (msg.type() === 'error') errors.push('CONSOLE_ERR: ' + msg.text()); });
        
        try {
            await page.goto(`http://localhost:${port}/${proj}/index.html`, { waitUntil: 'domcontentloaded', timeout: 5000 });
            await new Promise(r => setTimeout(r, 500));
            const state = await page.evaluate(() => {
                const e1 = document.getElementById('error-message');
                const e2 = document.getElementById('custom-error-message');
                return (e1 && e1.textContent) || (e2 && e2.textContent) || '';
            });
            if (state || errors.length) {
                console.log(`BROKEN [${proj}]: ${errors.join(' | ')} ${state}`);
            } else {
                console.log(`OK [${proj}]`);
            }
        } catch(e) {
            console.log(`ERROR [${proj}]: ${e.message}`);
        }
        await page.close();
    }
    
    await browser.close();
    server.close();
});
