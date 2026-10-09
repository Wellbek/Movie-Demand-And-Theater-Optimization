// Builds the self-contained deliverables ../demo.html and ../proposal.html.
// Every number in the proposal is computed here from the same engine and default settings
// the demo opens with, so the two files cannot disagree.
// Usage: node src/build.cjs
const fs = require('node:fs');
const path = require('node:path');
const E = require('./engine.js');
const katex = require('katex');

const here = __dirname;
const OUT = path.resolve(here, '..');
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');

// LaTeX between \( \) (inline) or \[ \] (display) is typeset by KaTeX at build time.
// Its stylesheet and fonts are embedded as data URIs: no script, CDN or internet is needed.
const katexDir = path.dirname(require.resolve('katex/dist/katex.min.css'));
const katexCss = fs.readFileSync(path.join(katexDir, 'katex.min.css'), 'utf8')
  .replace(/src:url\(fonts\/([\w-]+)\.woff2\)[^;}]*/g, (_, f) => 'src:url(data:font/woff2;base64,' + fs.readFileSync(path.join(katexDir, 'fonts', f + '.woff2')).toString('base64') + ') format("woff2")');
const withKatex = (html) => html.replace('</head>', () => '<style>' + katexCss + '</style>\n</head>');
function texify(src) {
  const render = (tex, displayMode) => katex.renderToString(tex, { output: 'html', displayMode, throwOnError: true }).replace(/ xmlns="[^"]*"/g, '');
  return src.replace(/\\\[([\s\S]+?)\\\]/g, (_, t) => render(t, true)).replace(/\\\(([\s\S]+?)\\\)/g, (_, t) => render(t, false));
}

function check(name, html) {
  // Offline requirement (brief 4.4): no external resource of any kind.
  const external = html.match(/(https?:)?\/\/[a-z0-9-]+\.[a-z]{2,}[^\s"')]*/gi);
  if (external) throw new Error(name + ' references an external resource: ' + external.slice(0, 3).join(', '));
  if (/<(img|link|iframe|object|embed)\b/i.test(html)) throw new Error(name + ' uses an external element tag');
  if (html.includes(String.fromCharCode(0x2014))) throw new Error(name + ' contains an em dash');
  if (html.includes('/*__') || /\{\{\w+\}\}/.test(html)) throw new Error(name + ' has an unreplaced placeholder');
}
function write(name, html) {
  check(name, html);
  fs.writeFileSync(path.join(OUT, name), html);
  console.log('wrote ' + name + ' (' + (html.length / 1024).toFixed(1) + ' KB)');
}

// ---------------------------------------------------------------- demo
const demo = withKatex(texify(read('demo.template.html')))
  .replace('/*__ENGINE__*/', () => read('engine.js'))
  .replace('/*__HEROANIM__*/', () => read('heroanim.js'))
  .replace('/*__FIGURES__*/', () => read('figures.js'))
  .replace('/*__APP__*/', () => read('app.js').replace('/*__STUDY__*/', () => read('study.json').trim()).replace('/*__SWEEP__*/', () => read('sweep.json').trim()));
write('demo.html', demo);

// ---------------------------------------------------------------- proposal
if (fs.existsSync(path.join(here, 'proposal.template.html'))) {
  const N = require('./numbers.cjs')(E, JSON.parse(read('study.json')));
  let html = texify(read('proposal.template.html'));
  html = html.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (!(k in N)) throw new Error('proposal: unknown number {{' + k + '}}');
    return N[k];
  });
  write('proposal.html', withKatex(html));
  fs.writeFileSync(path.join(here, 'numbers.json'), JSON.stringify(N, null, 1) + '\n');
  console.log('wrote src/numbers.json (numbers quoted in problem-definition.md)');
}
