"use strict";

const fs = require("fs");

const settingsPath = "settings.html";
const scriptName = "security-activity.js";

if (!fs.existsSync(settingsPath)) {
  throw new Error(
    "settings.html was not found. Run this script from the frontend root."
  );
}

let html = fs.readFileSync(settingsPath, "utf8");

if (html.includes(`src="${scriptName}"`)) {
  console.log("Security activity script is already linked.");
  process.exit(0);
}

const scriptTag = `<script src="${scriptName}"></script>`;

if (/<\/body>/i.test(html)) {
  html = html.replace(/<\/body>/i, `  ${scriptTag}\n</body>`);
} else {
  html = `${html.trimEnd()}\n${scriptTag}\n`;
}

fs.writeFileSync(settingsPath, html, "utf8");
console.log("settings.html linked to security-activity.js.");
