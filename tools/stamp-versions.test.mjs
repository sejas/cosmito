import { test } from "node:test";
import assert from "node:assert/strict";
import { stampHtml, stampJs, isLocal } from "./stamp-versions.mjs";

test("local vs external URLs", () => {
  assert.ok(isLocal("js/app.js"));
  assert.ok(isLocal("../../shared/i18n.js"));
  assert.ok(isLocal("./stage.js"));
  assert.ok(!isLocal("https://fonts.googleapis.com/css2?family=Fredoka"));
  assert.ok(!isLocal("//cdn.example.com/x.js"));
  assert.ok(!isLocal("data:text/javascript,1"));
});

test("HTML scripts, styles and import maps get the same stamp", () => {
  const html = `<link rel="stylesheet" href="../../shared/base.css" />
<link href="https://fonts.googleapis.com/css2?family=Fredoka&display=swap" rel="stylesheet" />
<script src="js/app.js"></script>
<script type="importmap">{ "imports": { "three": "../vendor/three/three.module.min.js", "three/addons/": "../vendor/three/addons/" } }</script>
<script type="module" src="hub/hub3d.js"></script>`;
  const out = stampHtml(html, "abc123");
  assert.match(out, /href="\.\.\/\.\.\/shared\/base\.css\?v=abc123"/);
  assert.match(out, /src="js\/app\.js\?v=abc123"/);
  assert.match(out, /src="hub\/hub3d\.js\?v=abc123"/);
  assert.match(out, /"three": "\.\.\/vendor\/three\/three\.module\.min\.js\?v=abc123"/);
  assert.match(out, /"three\/addons\/": "\.\.\/vendor\/three\/addons\/"/);
  assert.match(out, /family=Fredoka&display=swap"/);
  assert.ok(!out.includes("Fredoka?v="));
});

test("JS relative imports are stamped, bare specifiers are not", () => {
  const js = `import * as THREE from "three";
import { createStage } from "./stage.js";
export { treat } from './treats.js';
import "../games/ready.js";
const m = await import("./lazy.js");
const u = new URL("icons/pepper.svg", document.currentScript.src);`;
  const out = stampJs(js, "v1");
  assert.match(out, /from "three";/);
  assert.match(out, /from "\.\/stage\.js\?v=v1"/);
  assert.match(out, /from '\.\/treats\.js\?v=v1'/);
  assert.match(out, /import "\.\.\/games\/ready\.js\?v=v1"/);
  assert.match(out, /import\("\.\/lazy\.js\?v=v1"\)/);
  assert.match(out, /"icons\/pepper\.svg"/);
});

test("already-stamped URLs are left alone", () => {
  assert.equal(stampJs(`import x from "./a.js?v=old";`, "new"), `import x from "./a.js?v=old";`);
});
