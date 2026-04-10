const fs = require('fs');
const content = fs.readFileSync('shootthemonster/script.js', 'utf8');
const window = { location: { href: "" } };
const document = {};
const navigator = { userAgent: "node" };
try {
  eval(content);
  console.log("Success! Scaffolding is:", typeof window.Scaffolding);
} catch (e) {
  console.log("Error evaluating:", e);
}
