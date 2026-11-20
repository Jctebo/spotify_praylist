import { writeFileSync } from 'node:fs';
const date = process.argv[2]; // YYYYMMDD
const url = `https://universalis.com/${date}/jsonpmass.js?callback=universalisCallback`;
const res = await fetch(url, { headers: {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0',
  'Referer': 'https://ora-pro-nobis-app.john-thibeaux.workers.dev/' }});
if (!res.ok) { console.error('HTTP', res.status); process.exit(1); }
const js = await res.text();
let payload = null;
const universalisCallback = (obj) => { payload = obj; };
// The service wraps: universalisCallback({...}) possibly with letter-decoding handled by their code;
// evaluate in this context.
eval(js);
if (!payload) { console.error('no payload captured'); process.exit(1); }
writeFileSync(`/tmp/v487/payload-${date}.json`, JSON.stringify(payload, null, 1));
console.log('keys:', Object.keys(payload).join(', '));
