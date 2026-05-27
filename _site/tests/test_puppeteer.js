const puppeteer = require("puppeteer");
const express = require("express");
const path = require("path");
const app = express();

app.use(express.static(path.join(__dirname)));

const server = app.listen(0, async () => {
	const port = server.address().port;
	const browser = await puppeteer.launch({
		headless: "new",
		args: ["--no-sandbox"],
	});
	const page = await browser.newPage();

	page.on("pageerror", (error) =>
		console.error("Browser Page Error:", error.message),
	);
	page.on("console", (msg) => console.log("Console:", msg.type(), msg.text()));

	try {
		await page.goto(`http://localhost:${port}/shootthemonster/index.html`, {
			waitUntil: "networkidle0",
		});
		await new Promise((r) => setTimeout(r, 2000));

		const errorText = await page.evaluate(() => {
			const el1 = document.getElementById("error-message");
			const el2 = document.getElementById("custom-error-message");
			return {
				origError: el1 ? el1.textContent : null,
				customError: el2 ? el2.textContent : null,
				scaffolding: typeof Scaffolding,
			};
		});
		console.log("PAGE STATE:", errorText);
	} catch (e) {
		console.error("Goto error:", e);
	}

	await browser.close();
	server.close();
});
