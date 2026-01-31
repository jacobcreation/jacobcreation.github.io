const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const HEAD_SNIPPET = `
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#000000">
`;

const BODY_SNIPPET = `
<script>
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js");
}
</script>
`;

function walk(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const full = path.join(dir, file);

        if (fs.statSync(full).isDirectory()) {
            walk(full);
            continue;
        }

        if (!file.toLowerCase().endsWith(".html")) continue;

        let html = fs.readFileSync(full, "utf8");
        let changed = false;

        // add manifest in <head>
        if (!html.includes('rel="manifest"')) {
            html = html.replace(/<head[^>]*>/i, m => m + HEAD_SNIPPET);
            changed = true;
        }

        // add service worker register before </body>
        if (!html.includes("serviceWorker.register")) {
            html = html.replace(/<\/body>/i, BODY_SNIPPET + "\n</body>");
            changed = true;
        }

        if (changed) {
            fs.writeFileSync(full, html, "utf8");
            console.log("Updated:", full);
        }
    }
}

walk(ROOT);
