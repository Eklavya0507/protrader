"use strict";

const fs = require("fs");

let failed = false;
const pass = (message) => console.log(`PASS: ${message}`);
const fail = (message) => {
  failed = true;
  console.error(`FAIL: ${message}`);
};

if (fs.existsSync("security-activity.js")) {
  pass("security-activity.js exists");
} else {
  fail("security-activity.js is missing");
}

if (fs.existsSync("settings.html")) {
  const html = fs.readFileSync("settings.html", "utf8");

  if (html.includes('src="security-activity.js"')) {
    pass("settings.html loads security-activity.js");
  } else {
    fail("settings.html does not load security-activity.js");
  }
} else {
  fail("settings.html is missing");
}

try {
  new Function(
    fs.readFileSync("security-activity.js", "utf8")
  );
  pass("security-activity.js syntax parses");
} catch (error) {
  fail(`Frontend syntax failed: ${error.message}`);
}

if (failed) {
  console.error("Frontend security-activity audit FAILED.");
  process.exit(1);
}

console.log("Frontend security-activity audit PASSED.");
