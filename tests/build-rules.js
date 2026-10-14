// Genera ../database.rules.json. Uso: node build-rules.js
// Le regole sono scritte qui come codice per evitare refusi nelle espressioni lunghe;
// il file generato e' quello da incollare nella console Firebase.
const fs = require('fs');
const path = require('path');

const GRACE = 45000;            // tolleranza di disconnessione (ms)
const DAY = 86400000;           // partite ferme oltre questo tempo si possono cancellare
const SEAT = '/^p[1-7]$/';
const CODE = '/^[A-HJ-NP-Z]{5}$/';
const NUMBER = '/^-?([0-9]+(\\.[0-9]+)?|\\.[0-9]+)([eE][+-]?[0-9]+)?$/';

const G = "root.child('games/'+$code+'/";
const phase = `${G}meta/phase').val()`;
const hostOwner = `root.child('games/'+$code+'/players/'+${G}meta/hostSeat').val()+'/owner').val()`;
const isHost = `auth != null && ${hostOwner} === auth.uid`;
const ownSeat = `auth != null && ${G}players/'+$seat+'/owner').val() === auth.uid`;
const inSeats = `${G}seats/'+$seat).exists()`;
const goneOf = n => `${n}.child('connected').val() === false && now - ${n}.child('disconnectedAt').val() > ${GRACE}`;
const inPhases = (...p) => p.map(x => `${phase} === '${x}'`).join(' || ');

// nomi unici (senza distinguere maiuscole/minuscole): controllo contro gli altri 6 posti
const uniq = (seats, players, mine) => seats.map(s =>
  `($seat === '${s}' || !${players}.child('${s}/name').exists() || ${players}.child('${s}/name').val().toLowerCase() !== ${mine})`).join(' && ');

const rules = {
  rules: {
    '.read': false,
    '.write': false,

    index: {
      '.indexOn': '.value',
      '.read': `auth != null && query.orderByValue === true && query.endAt <= now - ${DAY} && query.limitToFirst <= 10`,
      $code: {
        '.validate': `$code.matches(${CODE}) && newData.isNumber() && newData.val() <= now`,
        '.write': `auth != null && ((!data.exists() && newData.isNumber()) || (data.exists() && newData.isNumber() && ${hostOwner} === auth.uid) || (!newData.exists() && data.val() < now - ${DAY}) || (!newData.exists() && ${hostOwner} === auth.uid && !newData.parent().parent().child('games/'+$code+'/players').exists()))`
      }
    },

    games: {
      $code: {
        '.validate': `$code.matches(${CODE})`,
        '.write': `auth != null && ((!data.exists() && newData.child('meta/hostSeat').val() === 'p1' && newData.child('meta/phase').val() === 'lobby' && newData.child('players/p1/owner').val() === auth.uid) || (!newData.exists() && root.child('index/'+$code).val() < now - ${DAY}))`,

        meta: {
          '.read': 'auth != null',
          '.write': `${isHost} && !newData.exists() && !newData.parent().child('players').exists()`,
          '.validate': "newData.hasChildren(['hostSeat', 'phase', 'round'])",
          hostSeat: {
            '.write': `(${isHost}) || (auth != null && ${G}players/'+newData.val()+'/owner').val() === auth.uid && ${goneOf(`${G}players/'+data.val()+'')`)})`,
            '.validate': `newData.isString() && newData.val().matches(${SEAT}) && newData.parent().parent().child('players/'+newData.val()).exists()`
          },
          phase: {
            '.write': isHost,
            '.validate': "newData.isString() && (newData.val() === 'lobby' || newData.val() === 'answering' || newData.val() === 'summary' || newData.val() === 'vote' || newData.val() === 'result')"
          },
          round: { '.write': isHost, '.validate': 'newData.isNumber() && newData.val() >= 0' },
          createdAt: { '.validate': 'newData.isNumber() && newData.val() <= now' },
          notice: {
            '.write': isHost,
            '.validate': "newData.hasChildren(['code', 'round']) && newData.child('code').isString() && newData.child('code').val().length <= 20 && newData.child('round').isNumber()",
            code: { '.validate': true },
            round: { '.validate': true },
            $other: { '.validate': false }
          },
          $other: { '.validate': false }
        },

        players: {
          '.read': 'auth != null',
          $seat: {
            '.validate': `$seat.matches(${SEAT}) && newData.hasChildren(['owner', 'name', 'connected', 'joinedAt']) && ${uniq(['p5', 'p6', 'p7'], 'newData.parent()', "newData.child('name').val().toLowerCase()")}`,
            '.write': `auth != null && ((!data.exists() && newData.exists() && ${phase} === 'lobby' && newData.child('owner').val() === auth.uid) || (data.child('owner').val() === auth.uid && (newData.exists() || newData.parent().parent().child('meta/hostSeat').val() !== $seat || !newData.parent().exists())) || (data.exists() && newData.exists() && ${goneOf('data')} && newData.child('owner').val() === auth.uid) || (!newData.exists() && (!data.exists() || ${goneOf('data')}) && ${hostOwner} === auth.uid))`,
            owner: { '.validate': 'newData.isString() && newData.val() === auth.uid' },
            name: {
              '.validate': `newData.isString() && newData.val().length >= 1 && newData.val().length <= 20 && (!data.exists() || data.val() === newData.val()) && ${uniq(['p1', 'p2', 'p3', 'p4'], 'newData.parent().parent()', 'newData.val().toLowerCase()')}`
            },
            connected: { '.validate': 'newData.isBoolean()' },
            disconnectedAt: { '.validate': 'newData.isNumber() && newData.val() <= now' },
            joinedAt: { '.validate': 'newData.isNumber() && newData.val() <= now && (!data.exists() || data.val() === newData.val())' },
            $other: { '.validate': false }
          }
        },

        seats: {
          '.read': 'auth != null',
          '.write': isHost,
          $seat: { '.validate': `$seat.matches(${SEAT}) && newData.isBoolean() && newData.val() === true` }
        },

        private: {
          '.write': isHost,
          $seat: {
            '.read': ownSeat,
            '.validate': `$seat.matches(${SEAT}) && newData.hasChildren(['question', 'round'])`,
            question: { '.validate': 'newData.isString() && newData.val().length >= 1 && newData.val().length <= 240' },
            round: { '.validate': 'newData.isNumber()' },
            $other: { '.validate': false }
          }
        },

        hostOnly: {
          '.read': isHost,
          '.write': isHost,
          '.validate': 'newData.hasChild(\'impostor\')',
          impostor: { '.validate': `newData.isString() && newData.val().matches(${SEAT})` },
          prev: { '.validate': `newData.isString() && newData.val().matches(${SEAT})` },
          $other: { '.validate': false }
        },

        reveal: {
          '.read': `auth != null && (${inPhases('summary', 'vote', 'result')} || ${hostOwner} === auth.uid)`,
          '.write': isHost,
          '.validate': "newData.hasChildren(['common', 'round'])",
          common: { '.validate': 'newData.isString() && newData.val().length >= 1 && newData.val().length <= 240' },
          round: { '.validate': 'newData.isNumber()' },
          $other: { '.validate': false }
        },

        answered: {
          '.read': 'auth != null',
          '.write': `${isHost} && !newData.exists()`,
          $seat: {
            '.write': `${ownSeat} && ${phase} === 'answering' && ${inSeats} && !data.exists()`,
            '.validate': `$seat.matches(${SEAT}) && newData.isBoolean() && newData.val() === true`
          }
        },
        answers: {
          '.read': `auth != null && (${inPhases('summary', 'vote', 'result')})`,
          '.write': `${isHost} && !newData.exists()`,
          $seat: {
            '.read': ownSeat,
            '.write': `${ownSeat} && ${phase} === 'answering' && ${inSeats} && !data.exists()`,
            '.validate': `$seat.matches(${SEAT}) && newData.isString() && newData.val().length <= 24 && newData.val().matches(${NUMBER})`
          }
        },

        voted: {
          '.read': 'auth != null',
          '.write': `${isHost} && !newData.exists()`,
          $seat: {
            '.write': `${ownSeat} && ${phase} === 'vote' && ${inSeats} && !data.exists()`,
            '.validate': `$seat.matches(${SEAT}) && newData.isBoolean() && newData.val() === true`
          }
        },
        votes: {
          '.read': `auth != null && ${phase} === 'result'`,
          '.write': `${isHost} && !newData.exists()`,
          $seat: {
            '.read': ownSeat,
            '.write': `${ownSeat} && ${phase} === 'vote' && ${inSeats} && !data.exists()`,
            '.validate': `$seat.matches(${SEAT}) && newData.isString() && newData.val().matches(${SEAT}) && newData.val() !== $seat && ${G}seats/'+newData.val()).exists()`
          }
        },

        result: {
          '.read': `auth != null && ${phase} === 'result'`,
          '.write': isHost,
          '.validate': "newData.hasChildren(['impostor', 'round'])",
          impostor: { '.validate': `newData.isString() && newData.val().matches(${SEAT})` },
          round: { '.validate': 'newData.isNumber()' },
          $other: { '.validate': false }
        },

        $other: { '.validate': false }
      }
    }
  }
};

// controllo: Firebase rifiuta le espressioni oltre 1024 caratteri
let longest = 0;
(function check(node, where) {
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'string' && k.startsWith('.')) {
      longest = Math.max(longest, v.length);
      if (v.length > 1000) throw new Error(`Espressione troppo lunga (${v.length}) in ${where}/${k}`);
    } else if (v && typeof v === 'object') check(v, `${where}/${k}`);
  }
})(rules, '');

const out = path.join(__dirname, '..', 'database.rules.json');
fs.writeFileSync(out, JSON.stringify(rules, null, 2) + '\n');
console.log(`Scritto ${out} (espressione piu' lunga: ${longest} caratteri)`);
