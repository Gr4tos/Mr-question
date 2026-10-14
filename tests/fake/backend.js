// Finto Realtime Database per i test: tiene i dati in memoria e fa rispettare database.rules.json
// tramite Targaryen. Serve a far girare il vero online.js senza toccare il database reale.
const T = require('targaryen');

class Backend {
  constructor(rules) {
    this.rules = rules;
    this.offset = 0;                 // spostamento dell'orologio del "server" (per simulare il passare del tempo)
    this.db = T.database(rules, {}, Date.now());
    this.clients = new Map();
    this.seq = 0;
    this.denied = [];                // scritture/letture rifiutate (utile nei test)
  }

  now() { return Date.now() + this.offset; }
  json() { return this.db.root.$value() || {}; }
  valueAt(path) {
    let v = this.json();
    for (const k of path.split('/').filter(Boolean)) { if (v == null || typeof v !== 'object') return null; v = v[k]; }
    return v === undefined ? null : v;
  }

  // ---- connessioni ----
  addClient(push) {
    const id = ++this.seq;
    this.clients.set(id, { id, push, listeners: new Map(), disc: [], online: true, last: new Map(), queue: Promise.resolve() });
    return id;
  }
  send(c, id, msg) { c.queue = c.queue.then(() => c.push(id, msg)).catch(() => {}); }

  async removeClient(id) {
    const c = this.clients.get(id);
    if (!c) return;
    this.dropConnection(c);
    this.clients.delete(id);
  }

  // la connessione cade: il server esegue gli onDisconnect del client
  dropConnection(c) {
    if (!c.online) return;
    c.online = false;
    const todo = c.disc; c.disc = [];
    for (const d of todo) this.write(d.uid, d.path, d.patch);
    this.pushInfo();
  }
  goOffline(id) { const c = this.clients.get(id); if (c) this.dropConnection(c); }
  goOnline(id) {
    const c = this.clients.get(id);
    if (!c || c.online) return;
    c.online = true;
    this.pushInfo();
    this.notify();
  }

  // ---- orologio ----
  advance(ms) { this.offset += ms; this.pushInfo(); return Promise.all([...this.clients.values()].map(c => c.queue)); }

  // ---- lettura/scrittura con le regole ----
  canRead(uid, path, query) {
    const db = uid ? this.db.with({ auth: { uid }, now: this.now() }) : T.database(this.rules, this.db.root, this.now());
    const r = db.read(`/${path}`, query ? { query, now: this.now() } : { now: this.now() });
    return r.allowed;
  }

  write(uid, path, patch) {
    const db = uid ? this.db.with({ auth: { uid }, now: this.now() }) : T.database(this.rules, this.db.root, this.now());
    const r = db.update(`/${path}`, patch, { now: this.now() });
    if (!r.allowed) { this.denied.push({ uid, path, keys: Object.keys(patch) }); return { error: 'PERMISSION_DENIED' }; }
    this.db = r.newDatabase;
    this.notify();
    return { ok: true };
  }

  infoValue(c, path) { return path === '.info/connected' ? c.online : this.offset; }
  pushInfo() {
    for (const c of this.clients.values()) {
      for (const [id, l] of c.listeners) {
        if (l.path.startsWith('.info/')) this.deliver(c, id, l, this.infoValue(c, l.path));
      }
    }
  }
  deliver(c, id, l, value) {
    const s = JSON.stringify(value === undefined ? null : value);
    if (l.last === s) return;
    l.last = s;
    this.send(c, id, { value: value === undefined ? null : value });
  }
  notify() {
    for (const c of this.clients.values()) {
      if (!c.online) continue;
      for (const [id, l] of c.listeners) if (!l.path.startsWith('.info/')) this.deliver(c, id, l, this.valueAt(l.path));
    }
  }

  // ---- operazioni chiamate dal browser ----
  call(clientId, op, a) {
    const c = this.clients.get(clientId);
    if (!c) return { error: 'NOCLIENT' };
    if (!c.online && op !== 'unlisten') return { offline: true };
    switch (op) {
      case 'get': {
        if (a.path.startsWith('.info/')) return { value: this.infoValue(c, a.path) };
        if (!this.canRead(a.uid, a.path, a.q)) { this.denied.push({ uid: a.uid, read: a.path }); return { error: 'PERMISSION_DENIED' }; }
        let v = this.valueAt(a.path);
        if (a.q && v && typeof v === 'object') {
          let es = Object.entries(v).sort((x, y) => (x[1] - y[1]) || (x[0] < y[0] ? -1 : 1));
          if (a.q.endAt != null) es = es.filter(e => e[1] <= a.q.endAt);
          if (a.q.limitToFirst != null) es = es.slice(0, a.q.limitToFirst);
          v = Object.fromEntries(es);
        }
        return { value: v };
      }
      case 'update': return this.write(a.uid, a.path, a.patch);
      case 'listen': {
        const l = { path: a.path, last: null };
        if (a.path.startsWith('.info/')) { c.listeners.set(a.id, l); this.deliver(c, a.id, l, this.infoValue(c, a.path)); return { ok: true }; }
        if (!this.canRead(a.uid, a.path)) { this.denied.push({ uid: a.uid, read: a.path }); this.send(c, a.id, { error: 'PERMISSION_DENIED' }); return { ok: true }; }
        c.listeners.set(a.id, l);
        this.deliver(c, a.id, l, this.valueAt(a.path));
        return { ok: true };
      }
      case 'unlisten': c.listeners.delete(a.id); return { ok: true };
      case 'onDisconnect': c.disc.push({ uid: a.uid, path: a.path, patch: a.patch }); return { ok: true };
      case 'cancelDisconnect': c.disc = c.disc.filter(d => d.path !== a.path); return { ok: true };
      default: return { error: 'BADOP' };
    }
  }
}

module.exports = { Backend };
