# three.js (vendored)

- Version: **0.186.1** (r186), from the npm tarball `https://registry.npmjs.org/three/-/three-0.186.1.tgz`.
- License: MIT, see [LICENSE](LICENSE).

## Files

| File | Source |
| --- | --- |
| `three.module.min.js` | `build/three.module.js` + `build/three.core.js` bundled into one minified ES module (the npm package no longer ships `.min.js` files) |

No addons are vendored yet: the kit builds everything from core primitives. Add one only when a page
imports it (copy it unchanged to `addons/<path>` and list it here); the `three/addons/` import-map entry is ready.

Pages load it through an import map (paths relative to the page):

```html
<script type="importmap">
  { "imports": { "three": "../vendor/three/three.module.min.js", "three/addons/": "../vendor/three/addons/" } }
</script>
```

## Updating

```sh
curl -sLO https://registry.npmjs.org/three/-/three-<version>.tgz && tar xzf three-<version>.tgz
npx esbuild package/build/three.module.js --bundle --minify --format=esm --legal-comments=inline \
  --outfile=vendor/three/three.module.min.js
cp package/LICENSE vendor/three/LICENSE
cp package/examples/jsm/<addon>.js vendor/three/addons/<addon>.js   # only addons we use
```

Then open `3d/kit/demo.html` and `3d/index.html` and check nothing broke. Keep only files the project imports.
