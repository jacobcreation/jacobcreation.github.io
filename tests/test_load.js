const fs = require("fs");
const path = require("path");

const entry = path.join(__dirname, "..", "shootthemonster", "src", "main.tsx");

if (!fs.existsSync(entry)) {
	console.error(`Missing Shootthemonster entry: ${entry}`);
	process.exit(1);
}

const content = fs.readFileSync(entry, "utf8");
if (!content.includes("createRoot")) {
	console.error("Shootthemonster entry does not mount the React app.");
	process.exit(1);
}

console.log("Shootthemonster entry is present.");
