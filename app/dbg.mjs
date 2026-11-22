import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const APP = '/home/hatch/workspace/projects/ora-pro-nobis/wt-v604/app/';
const clientSrc = readFileSync(APP + 'worker/src/client.ts', 'utf8');
const uiSrc = readFileSync(APP + 'worker/src/ui.ts', 'utf8');
const a = clientSrc.indexOf('= `') + 3, b = clientSrc.indexOf('\n`;', a);
const appJs = vm.runInContext('`' + clientSrc.slice(a, b) + '`', vm.createContext({}));
const ss = uiSrc.indexOf('<!DOCTYPE html>'), se = uiSrc.indexOf('`;', ss);
const SHELL = vm.runInContext('`' + uiSrc.slice(ss, se) + '`', vm.createContext({}));
const { JSDOM } = await import('jsdom');
const { webcrypto } = await import('node:crypto');
const JOHN = JSON.parse(readFileSync(process.env.HOME + '/workspace/projects/ora-pro-nobis/john-personal-data-import-v589.json', 'utf8'));
delete JOHN.podcastListens;
const HOOK = '\n;window.__opn = { state, openHeaderMenu, paintPrayersView, opnFoldDay590 };';
const dom = new JSDOM(SHELL.replace('<!--OPN_SHAPE-->', 'public'), { url: 'https://app.orapronobis.media/', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
try { Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, 'crypto', { value: webcrypto }); } catch (e) {} }
w.fetch = (u) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(u.includes('/api/player/day') ? JSON.parse(readFileSync(APP + 'tests/fixtures-v597/production-day-2026-11-21.json', 'utf8')) : {}) });
w.localStorage.setItem('opn-personal-data-v1', JSON.stringify(JOHN));
const s = w.document.createElement('script'); s.textContent = appJs + HOOK; w.document.body.appendChild(s);
await new Promise(r => setTimeout(r, 500));
const O = w.__opn;
console.log('tab', O.state.tab, 'view', JSON.stringify(O.state.prayersView));
try { O.openHeaderMenu(); } catch (e) { console.log('menu threw', e.message); }
await new Promise(r => setTimeout(r, 200));
const items = [...w.document.querySelectorAll('[data-menuitem]')].map(x => x.textContent.trim());
console.log('items', JSON.stringify(items));
console.log('body has menu?', w.document.body.innerHTML.includes('Expand all'));
