const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const requiredPages = [
	"index.html",
	"404.html",
	"calculator/index.html",
	"minesweeper/index.html",
	"snake/index.html",
	"tanks/index.html",
];

const missingPages = requiredPages.filter(
	(pagePath) => !fs.existsSync(path.join(root, pagePath)),
);

if (missingPages.length) {
	console.error(`Missing required pages: ${missingPages.join(", ")}`);
	process.exit(1);
}

console.log(`Found ${requiredPages.length} required pages.`);
