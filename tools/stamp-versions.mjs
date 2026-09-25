#!/usr/bin/env node
// Adds ?v=<version> to every local .js/.css reference in a COPY of the site, so
// hosts that cache scripts as "immutable" still serve fresh code after a deploy.
// Never run it on the repo itself: it rewrites files in place.
//
//   node tools/stamp-versions.mjs <deploy-dir> <version>
//
// Rewrites, for relative URLs only (bare module names like "three" and absolute
// http(s) URLs are left alone):
//   - HTML: src="…js", href="…css" / "…js" (modulepreload), and paths inside <script type="importmap">
//   - JS:   static `import … from "…js"`, `import "…js"`, `export … from "…js"`,
//           and dynamic `import("…js")`
// Every reference to a module gets the same stamp, so ES modules keep a single
// instance per page.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

export function isLocal(url) {
  return /^(\.{1,2}\/|\/(?!\/)|[\w-][\w./-]*$)/.test(url) && !/^[a-z]+:/i.test(url);
}

function stamp(url, version) {
  if (!isLocal(url) || /[?#]/.test(url)) return url;
  return `${url}?v=${version}`;
}

export function stampHtml(html, version) {
  let out = html.replace(
    /(<script\b[^>]*\ssrc=")([^"]+\.js)(")/gi,
    (m, a, url, b) => a + stamp(url, version) + b
  );
  // Stylesheets and module preloads (a preload must match the stamped URL the
  // import map resolves to, or the browser fetches the file twice).
  out = out.replace(
    /(<link\b[^>]*\shref=")([^"]+\.(?:css|js))(")/gi,
    (m, a, url, b) => a + stamp(url, version) + b
  );
  out = out.replace(/(<script\b[^>]*type="importmap"[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, json, b) => {
    const map = JSON.parse(json);
    for (const key of Object.keys(map.imports || {})) {
      const url = map.imports[key];
      // Folder prefixes ("three/addons/") can't carry a query string.
      if (url.endsWith(".js")) map.imports[key] = stamp(url, version);
    }
    return a + "\n" + JSON.stringify(map, null, 2) + "\n" + b;
  });
  return out;
}

export function stampJs(js, version) {
  const spec = (url) => (url.startsWith(".") || url.startsWith("/") ? stamp(url, version) : url);
  return js
    .replace(/(\bfrom\s*)(["'])([^"']+\.js)\2/g, (m, a, q, url) => a + q + spec(url) + q)
    .replace(/(\bimport\s*)(["'])([^"']+\.js)\2/g, (m, a, q, url) => a + q + spec(url) + q)
    .replace(/(\bimport\s*\(\s*)(["'])([^"']+\.js)\2/g, (m, a, q, url) => a + q + spec(url) + q);
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dir, version] = process.argv.slice(2);
  if (!dir || !version) {
    console.error("usage: node tools/stamp-versions.mjs <deploy-dir> <version>");
    process.exit(1);
  }
  let changed = 0;
  for (const file of walk(dir)) {
    const ext = extname(file);
    if (ext !== ".html" && ext !== ".js") continue;
    // Vendored three.js is one self-contained module; leave it untouched.
    if (file.includes(`${"/"}vendor/`)) continue;
    const src = readFileSync(file, "utf8");
    const out = ext === ".html" ? stampHtml(src, version) : stampJs(src, version);
    if (out !== src) {
      writeFileSync(file, out);
      changed++;
    }
  }
  console.log(`stamped ${changed} files with ?v=${version}`);
}
