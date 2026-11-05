/**
 * Package the production build as one self-contained page (inline CSS + JS) plus the
 * audio worklet file, for hosting as a sandboxed web page.  npm run build:artifact
 */
import fs from 'fs';
import path from 'path';
import { ENGINE_WORKLET_SOURCE } from '../src/audio/engineWorklet.js';

const dist = 'dist';
const out = 'dist-artifact';
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const read = (href) => fs.readFileSync(path.join(dist, href.replace(/^\//, '')), 'utf8');

const title = (html.match(/<title>[\s\S]*?<\/title>/) || [''])[0];
const fonts = [...html.matchAll(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/g)].map((m) => m[0]);
const css = [...html.matchAll(/<link rel="stylesheet"[^>]+href="(\/assets\/[^"]+\.css)"[^>]*>/g)].map((m) => read(m[1]));
const js = [...html.matchAll(/<script type="module"[^>]+src="(\/assets\/[^"]+\.js)"[^>]*><\/script>/g)].map((m) => read(m[1]));
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');

const safeJs = js.map((s) => s.replace(/<\/script/gi, '<\\/script'));
const page = [
  title,
  ...fonts,
  `<style>${css.join('\n')}</style>`,
  body.trim(),
  ...safeJs.map((s) => `<script type="module">${s}</script>`)
].join('\n');

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'apex-v8-engine-studio.html'), page);
fs.writeFileSync(path.join(out, 'engine-worklet.js'), ENGINE_WORKLET_SOURCE);
console.log(`wrote ${out}/apex-v8-engine-studio.html (${(page.length / 1024).toFixed(0)} KB) + engine-worklet.js`);
