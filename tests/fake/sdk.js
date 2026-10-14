// Moduli che sostituiscono l'SDK Firebase nel browser durante i test (stessa interfaccia usata da online.js).
// Parlano con il finto backend (Node) tramite window.__fbCall; il backend risponde con window.__fbPush.
const APP = `export function initializeApp(config) { return { config }; }\n`;

const AUTH = `
export function getAuth() {
  return { authStateReady: async () => {}, get currentUser() { const u = localStorage.getItem('fake_uid'); return u ? { uid: u } : null; } };
}
export async function signInAnonymously() {
  let u = localStorage.getItem('fake_uid');
  if (!u) { u = crypto.randomUUID(); localStorage.setItem('fake_uid', u); }
  return { user: { uid: u } };
}
`;

const DATABASE = `
const hello = window.__fbCall('hello', {});
const handlers = new Map();
let nextId = 1;
window.__fbPush = (id, msg) => { const h = handlers.get(id); if (h) h(msg); };
const uid = () => localStorage.getItem('fake_uid');
async function call(op, args) { await hello; return window.__fbCall(op, { ...args, uid: uid() }); }
const clean = v => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
function fail(res) {
  if (res.offline) return Object.assign(new Error('offline'), { code: 'unavailable' });
  return Object.assign(new Error(res.error), { code: res.error });
}
class Snap {
  constructor(key, v) { this.key = key; this._v = v === undefined ? null : v; }
  val() { return this._v; }
  exists() { return this._v !== null; }
  forEach(cb) { if (this._v && typeof this._v === 'object') for (const k of Object.keys(this._v)) if (cb(new Snap(k, this._v[k])) === true) return true; return false; }
}
export const getDatabase = app => ({ app });
export const ref = (db, path = '') => ({ path: String(path).replace(/^\\/+|\\/+$/g, '') });
export const serverTimestamp = () => ({ '.sv': 'timestamp' });
export const orderByValue = () => ({ orderByValue: true });
export const endAt = v => ({ endAt: v });
export const limitToFirst = n => ({ limitToFirst: n });
export const query = (r, ...c) => ({ path: r.path, q: Object.assign({}, ...c) });
export async function get(r) {
  const res = await call('get', { path: r.path, q: r.q || null });
  if (res.error || res.offline) throw fail(res);
  return new Snap(r.path.split('/').pop(), res.value);
}
export async function set(r, value) {
  const parts = r.path.split('/');
  const last = parts.pop();
  const res = await call('update', { path: parts.join('/'), patch: { [last]: clean(value) } });
  if (res.error || res.offline) throw fail(res);
}
export async function update(r, patch) {
  const res = await call('update', { path: r.path, patch: clean(patch) });
  if (res.error || res.offline) throw fail(res);
}
export function onValue(r, cb, errCb) {
  const id = nextId++;
  handlers.set(id, msg => {
    if (msg.error) { handlers.delete(id); if (errCb) errCb(Object.assign(new Error(msg.error), { code: msg.error })); return; }
    cb(new Snap(r.path.split('/').pop(), msg.value));
  });
  call('listen', { id, path: r.path });
  return () => { handlers.delete(id); call('unlisten', { id }); };
}
export function onDisconnect(r) {
  return {
    update: async patch => { const res = await call('onDisconnect', { path: r.path, patch: clean(patch) }); if (res.error || res.offline) throw fail(res); },
    cancel: async () => { await call('cancelDisconnect', { path: r.path }); }
  };
}
`;

module.exports = {
  'firebase-app.js': APP,
  'firebase-auth.js': AUTH,
  'firebase-database.js': DATABASE
};
