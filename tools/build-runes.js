// Convert the wiki SVGs into a compact, theme-able runes.js
const fs = require('fs');
const path = require('path');
const dir = process.argv[3] || path.join(__dirname, 'svg');
const out = { archaic: {}, modern: {}, musical: {}, latin: {}, digits: {}, punct: {} };

function clean(src) {
  let s = src;
  s = s.replace(/<\?xml[^>]*\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<metadata[\s\S]*?<\/metadata>/g, '');
  s = s.replace(/<sodipodi:namedview[\s\S]*?<\/sodipodi:namedview>/g, '');
  s = s.replace(/<sodipodi:namedview[^>]*\/>/g, '');
  s = s.replace(/<inkscape:[^>]*\/>/g, '');
  s = s.replace(/<defs[^>]*\/>/g, '');
  s = s.replace(/\s(inkscape|sodipodi|xmlns:[a-z]+|id)(:[a-z-]+)?="[^"]*"/g, '');
  const w = parseFloat((s.match(/<svg[^>]*\swidth="([\d.]+)/) || [])[1]);
  const h = parseFloat((s.match(/<svg[^>]*\sheight="([\d.]+)/) || [])[1]);
  s = s.replace(/(<svg[^>]*?)\s(width|height|version)="[^"]*"/g, '$1');
  s = s.replace(/(<svg[^>]*?)\s(width|height|version)="[^"]*"/g, '$1');
  s = s.replace(/(<svg[^>]*?)\s(width|height|version)="[^"]*"/g, '$1');
  s = s.replace('<svg', '<svg fill="currentColor"');
  if (!/viewBox=/.test(s) && w && h) s = s.replace('<svg', `<svg viewBox="0 0 ${w} ${h}"`);
  s = s.replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, 'currentColor');
  s = s.replace(/-?\d+\.\d{3,}/g, (n) => String(+parseFloat(n).toFixed(2)));
  s = s.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
  return s;
}

const key = (n) => ({ '%C3%84': 'Ä', '%C3%96': 'Ö', '%C3%9C': 'Ü', SS: 'ß' }[n] || n);
for (const f of fs.readdirSync(dir)) {
  let m;
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  if ((m = f.match(/^(Archaic|Modern|Musical|Latin)_([A-Z]|SS|%C3%8[4]|%C3%96|%C3%9C)\.svg$/))) {
    out[m[1].toLowerCase()][key(m[2])] = clean(src);
  } else if ((m = f.match(/^Runes_(\d)\.svg$/))) {
    out.digits[m[1]] = clean(src);
  } else if (f === 'Archaic_%25.svg') {
    out.punct['%'] = clean(src);
  }
}
for (const k in out) out[k] = Object.fromEntries(Object.entries(out[k]).sort());
const body =
  '// Witch rune glyphs. Source: Puella Magi Wiki (https://wiki.puella-magi.net/Witch_Runes)\n' +
  '// Generated file — colors replaced with currentColor for theming.\n' +
  'window.RUNES = ' + JSON.stringify(out, null, 1) + ';\n';
fs.writeFileSync(process.argv[2], body);
for (const k in out) console.log(k, Object.keys(out[k]).join(''));
console.log((body.length / 1024).toFixed(1) + ' KB');
