// Genera tests/diag-index.rules.json: le regole di produzione + un nodo "diag" con varianti della regola di lettura
// di "index", per scoprire quale espressione il database vero valuta in modo diverso dal simulatore.
// SOLO PER DIAGNOSI: dopo la prova si ripubblica database.rules.json. Uso: node build-diag-rules.js
const fs = require('fs');
const path = require('path');
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8'));
const DAY = 86400000;
const variants = {
  d01_controllo: 'auth != null',
  d02_orderByValue_tripleq: 'auth != null && query.orderByValue === true',
  d03_orderByValue_doppioeq: 'auth != null && query.orderByValue == true',
  d04_limite: 'auth != null && query.limitToFirst <= 10',
  d05_endAt_now: `auth != null && query.endAt <= now - ${DAY}`,
  d06_endAt_costante: 'auth != null && query.endAt < 9000000000000',
  d07_endAt_nonnullo: 'auth != null && query.endAt != null',
  d08_produzione: `auth != null && query.orderByValue === true && query.endAt <= now - ${DAY} && query.limitToFirst <= 10`,
  d09_senza_endAt: 'auth != null && query.orderByValue === true && query.limitToFirst <= 10',
  d10_endAt_nonnullo_completa: 'auth != null && query.orderByValue === true && query.endAt != null && query.limitToFirst <= 10',
  d12_now_positivo: 'auth != null && now > 0',
  d13_endAt_vs_ora_fissa: 'auth != null && query.endAt <= 2000000000000',
  d14_orderByValue_or_key: 'auth != null && (query.orderByValue === true || query.orderByKey === true)',
  d15_negazione: `auth != null && !(query.endAt > now - ${DAY})`,
  d16_parentesi: `auth != null && query.endAt <= (now - ${DAY})`,
  d17_endAt_vs_now: 'auth != null && query.endAt <= now',
  d18_orderBy_senza_confronto: 'auth != null && query.orderByValue && query.limitToFirst <= 10',
  d19_limite_5: 'auth != null && query.limitToFirst <= 5'
};
// varianti per una ricerca ordinata per il campo figlio "t" (index/CODICE = { t: ora }): alternativa se orderByValue non e' accettato
const childVariants = {
  e01_child_semplice: "auth != null && query.orderByChild === 't'",
  e02_child_limite: "auth != null && query.orderByChild === 't' && query.limitToFirst <= 10",
  e03_child_completa: `auth != null && query.orderByChild === 't' && query.endAt <= now - ${DAY} && query.limitToFirst <= 10`,
  e04_child_doppioeq: `auth != null && query.orderByChild == 't' && query.endAt <= now - ${DAY}`,
  e05_orderByKey: 'auth != null && query.orderByKey === true'
};
rules.rules.diag = { '.indexOn': '.value', '.write': false };
for (const [k, expr] of Object.entries(variants)) rules.rules.diag[k] = { '.read': expr, '.indexOn': '.value' };
for (const [k, expr] of Object.entries(childVariants)) rules.rules.diag[k] = { '.read': expr, '.indexOn': ['t'] };
const out = path.join(__dirname, 'diag-index.rules.json');
fs.writeFileSync(out, JSON.stringify(rules, null, 2) + '\n');
console.log(`Scritto ${out} con ${Object.keys(variants).length} varianti`);
