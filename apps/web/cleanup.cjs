const fs = require('fs')

const p = 'src/App.css'
let s = fs.readFileSync(p, 'utf8')

// 1. Remove the now-stale cutout overrides: templates.css owns that now.
const cutStart = s.indexOf('/* ============================================\n   Cutout (background-removed) photos')
const cutEnd = s.indexOf('/* ============================================\n   Keyframes')
if (cutStart !== -1 && cutEnd !== -1 && cutEnd > cutStart) {
  s = s.slice(0, cutStart) + s.slice(cutEnd)
  console.log('removed stale cutout block')
}

// 2. Remove leftover template rules that are now in templates.css.
const stale = [
  /\.tpl-editorial__grid \{[\s\S]*?\n\}\n/g,
  /\.tpl-editorial__hero \{[\s\S]*?\n\}\n/g,
];
for (const re of stale) {
  const before = s.length;
  s = s.replace(re, '');
  if (s.length !== before) console.log('removed stale block', String(re).slice(0, 40));
}

fs.writeFileSync(p, s)
console.log('App.css length now:', s.length)
console.log('has .public__footer:', s.includes('.public__footer'))
console.log('has .sr-only:', s.includes('.sr-only'))
