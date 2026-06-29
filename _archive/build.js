/* Inlines _shared.css + _data.js into each app's source, producing
   self-contained final HTML files. Run: node build.js */
const fs = require("fs");
const path = require("path");

const css = fs.readFileSync(path.join(__dirname, "_shared.css"), "utf8");
const js  = fs.readFileSync(path.join(__dirname, "_data.js"), "utf8");

const targets = [
  ["viewer/_viewer.src.html",   "viewer/viewer-app.html"],
  ["creator/_creator.src.html", "creator/creator-studio.html"],
  ["manager/_manager.src.html", "manager/platform-manager.html"],
];

for (const [src, out] of targets) {
  let html = fs.readFileSync(path.join(__dirname, src), "utf8");
  html = html.replace("/*__SHARED_CSS__*/", () => css)
             .replace("/*__SHARED_JS__*/",  () => js);
  fs.writeFileSync(path.join(__dirname, out), html);
  console.log("built", out, "(" + html.length + " bytes)");
}
