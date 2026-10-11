const $ = id => document.getElementById(id);
const DEFAULT_NAMES = ['Dani','Tommy','Luca','Giulia','Marco','Sara','Alex'];
const BUILTIN = [
['Quanti minuti dura, in media, una partita di calcio regolamentare senza recupero?','Quanti minuti dura, in media, un tempo di una partita di calcio regolamentare senza recupero?','90','45','sport'],
['Quanti tasti ha normalmente un pianoforte moderno completo?','Quanti tasti bianchi ha, circa, un pianoforte moderno completo?','88','52','musica'],
['Quanti giorni ha un anno bisestile?','Quanti giorni ha un anno normale?','366','365','numeri'],
['Quanti giocatori per squadra sono in campo all’inizio di una partita di pallavolo?','Quanti giocatori per squadra sono in campo all’inizio di una partita di pallacanestro?','6','5','sport'],
['Quanti anelli compaiono nel simbolo olimpico?','Quante stelle ci sono sulla bandiera dell’Unione europea?','5','12','geografia'],
['A quanti gradi Celsius bolle l’acqua al livello del mare?','A quanti gradi Celsius congela l’acqua dolce, in condizioni standard?','100','0','scienza'],
['Quanti lati ha un esagono?','Quanti lati ha un ottagono?','6','8','matematica'],
['Quanti pianeti ci sono nel Sistema solare?','Quanti pianeti nani ufficialmente riconosciuti dall’IAU vengono comunemente elencati?','8','5','spazio'],
['Quanti minuti ci sono in due ore?','Quanti minuti ci sono in un’ora e mezza?','120','90','numeri'],
['Quanti giocatori compongono una squadra di calcio in campo per squadra?','Quanti giocatori compongono una squadra di rugby union in campo per squadra?','11','15','sport'],
['Quanti colori ha tradizionalmente l’arcobaleno nel modello scolastico?','Quanti colori principali si distinguono spesso nel modello RGB?','7','3','scienza'],
['Quante corde ha una chitarra classica standard?','Quante corde ha un basso elettrico standard?','6','4','musica'],
['Quanti mesi dell’anno hanno 31 giorni?','Quanti mesi dell’anno hanno 30 giorni?','7','4','numeri'],
['Quante caselle ha una scacchiera standard?','Quanti pezzi ha ciascun giocatore all’inizio di una partita a scacchi?','64','16','giochi'],
['Quanti punti vale normalmente un tiro libero nel basket?','Quanti punti vale normalmente un canestro realizzato dentro l’arco nel basket?','1','2','sport'],
['Quanti minuti dura un tempo regolamentare di una partita di calcio?','Quanti minuti dura un tempo regolamentare di una partita di futsal?','45','20','sport'],
['Quanti denti permanenti può avere normalmente un adulto, inclusi i denti del giudizio?','Quanti denti da latte ha normalmente un bambino?','32','20','corpo umano'],
['Quante lettere ha l’alfabeto italiano tradizionale?','Quante lettere ha l’alfabeto inglese?','21','26','lingua'],
['Quante facce ha un cubo?','Quanti vertici ha un cubo?','6','8','matematica'],
['Quanti minuti ci sono in un giorno?','Quante ore ci sono in un giorno?','1440','24','numeri'],
['Quante province ha la Lombardia?','Quante regioni ci sono in Italia?','12','20','Italia'],
['Quanti cerchi ha una bicicletta tradizionale?','Quanti pedali ha una bicicletta tradizionale?','2','2','quotidiano'],
['Quanti giocatori per squadra iniziano una partita di baseball in difesa?','Quanti inning ha una partita standard di baseball professionistico?','9','9','sport'],
['Quante carte ha un mazzo francese standard senza jolly?','Quante carte ha un mazzo di tarocchi tradizionale?','52','78','giochi'],
['Quante ore dura una giornata terrestre?','Quanti minuti dura un’ora?','24','60','scienza'],
['Quanti lati ha un triangolo?','Quanti angoli ha un quadrato?','3','4','matematica'],
['Quanti giocatori per squadra sono in campo nella pallamano?','Quanti giocatori per squadra sono in campo nell’hockey su prato?','7','11','sport'],
['Quanti simboli numerici diversi si usano nel sistema decimale?','Quanti simboli numerici diversi si usano nel sistema binario?','10','2','matematica'],
['Quante corde ha normalmente un violino?','Quante corde ha normalmente un violoncello?','4','4','musica'],
['Quante ruote ha un’auto comune?','Quante ruote ha una moto comune?','4','2','quotidiano'],
['Quanti secondi ci sono in un minuto?','Quanti secondi ci sono in mezz’ora?','60','1800','numeri'],
['Quanti lati ha un pentagono?','Quanti lati ha un decagono?','5','10','matematica'],
['Quanti giocatori per squadra sono sul campo in una partita di rugby league?','Quanti giocatori per squadra sono in campo in una partita di rugby union?','13','15','sport'],
['Quanti continenti vengono comunemente insegnati nel modello a sette continenti?','Quanti oceani vengono comunemente riconosciuti oggi?','7','5','geografia'],
['Quanti millimetri ci sono in un centimetro?','Quanti centimetri ci sono in un metro?','10','100','numeri'],
['Quanti lati ha un quadrato?','Quanti lati ha un rombo?','4','4','matematica'],
['Quanti tasti neri ha, circa, un pianoforte standard completo?','Quanti tasti bianchi ha, circa, un pianoforte standard completo?','36','52','musica'],
['Quante zampe ha un ragno?','Quante zampe ha un insetto?','8','6','natura'],
['Quanti giocatori per squadra iniziano in campo una partita di hockey su ghiaccio?','Quanti periodi regolamentari ha una partita standard di hockey su ghiaccio?','6','3','sport'],
['Quante facce ha un dado cubico standard?','Quanti numeri diversi può mostrare un dado cubico standard?','6','6','giochi'],
['Quante lettere ha la parola “impostore”?','Quante lettere ha la parola “mistero”?','9','7','lingua'],
['Quanti minuti dura un episodio da mezz’ora, senza pubblicità?','Quanti minuti dura un episodio da un’ora, senza pubblicità?','30','60','TV'],
['Quante corde ha un ukulele standard più comune?','Quante corde ha un mandolino standard?','4','8','musica'],
['Quante stagioni ci sono in un anno nel modello temperato più comune?','Quanti mesi ci sono in una stagione se l’anno è diviso in quattro parti uguali?','4','3','natura'],
['Quanti lati ha un dodecagono?','Quanti lati ha un ennagono?','12','9','matematica'],
['Quante pedine ha ciascun giocatore all’inizio della dama italiana?','Quanti pezzi ha ciascun giocatore all’inizio degli scacchi?','12','16','giochi'],
['Quanti punti si ottengono con un touchdown nel football americano, prima dell’eventuale extra?','Quanti punti vale un field goal nel football americano?','6','3','sport'],
['Quante vocali ha l’alfabeto italiano tradizionale?','Quante vocali scritte ha l’alfabeto inglese, contando A E I O U?','5','5','lingua'],
['Quanti minuti ci sono in tre quarti d’ora?','Quanti minuti ci sono in un quarto d’ora?','45','15','numeri'],
['Quante facce ha una piramide a base quadrata, contando la base?','Quanti vertici ha una piramide a base quadrata?','5','5','matematica'],
['Quanti giocatori per squadra sono sul parquet nella pallacanestro?','Quanti giocatori per squadra sono in campo nella pallavolo?','5','6','sport'],
['Quanti lati ha un eptagono?','Quanti lati ha un ottagono?','7','8','matematica'],
['Quanti giorni ha il mese di aprile?','Quanti giorni ha il mese di novembre?','30','30','calendario'],
['Quanti mesi hanno esattamente 28 giorni?','Quanti mesi hanno almeno 30 giorni?','12','11','indovinelli'],
['Quante pedine ha ciascun giocatore all’inizio degli scacchi?','Quanti pezzi totali ci sono sulla scacchiera all’inizio degli scacchi?','16','32','giochi'],
['Quanti numeri ci sono su una roulette europea, incluso lo zero?','Quanti numeri ci sono su una roulette americana, inclusi gli zeri?','37','38','giochi'],
['Quanti tiri liberi si assegnano normalmente per un fallo su un tiro da tre punti sbagliato nel basket?','Quanti punti vale una schiacciata nel basket?','3','2','sport'],
['Quanti lati ha un ottagono?','Quanti angoli ha un esagono?','8','6','matematica'],
['Quanti minuti ha una settimana?','Quanti giorni ha una settimana?','10080','7','numeri'],
['Quanti giocatori per squadra iniziano in campo una partita di beach volley?','Quanti set bisogna normalmente vincere per aggiudicarsi una partita di beach volley al meglio dei tre?','2','2','sport'],
['Quanti tasti ha un telefono numerico tradizionale, includendo * e #?','Quante cifre numeriche sono presenti su un tastierino telefonico?','12','10','tecnologia'],
['Quante ruote ha un triciclo tradizionale?','Quante ruote ha una bicicletta tradizionale?','3','2','quotidiano'],
['Quanti lati ha un nonagono?','Quanti lati ha un decagono?','9','10','matematica'],
['Quanti giocatori per squadra sono sul campo in una partita di lacrosse maschile outdoor standard?','Quanti quarti ha una partita standard di basket?','10','4','sport'],
['Quanti bit ci sono in un byte standard?','Quanti bit ci sono in mezzo byte, detto nibble?','8','4','tecnologia'],
['Quante caselle ha una griglia del tris 3 per 3?','Quanti simboli diversi si usano normalmente nel tris?','9','2','giochi'],
['Quanti minuti dura un’ora e un quarto?','Quanti minuti dura un’ora e mezza?','75','90','numeri'],
['Quanti lati ha un rombo?','Quanti lati ha un parallelogramma?','4','4','matematica'],
['Quante sono le corde di un’arpa da concerto moderna, approssimativamente?','Quante sono le corde di un’arpa da studio piccola, approssimativamente?','47','34','musica'],
['Quanti giocatori per squadra sono sul campo in una partita di cricket, in totale per squadra?','Quanti wicket ha una squadra da conquistare in un inning di cricket?','11','10','sport'],
['Quanti mesi ci sono in cinque anni?','Quanti mesi ci sono in un decennio?','60','120','numeri'],
['Quanti lati ha un trapezio?','Quanti lati ha un parallelogramma?','4','4','matematica'],
['Quante ore ci sono in una settimana?','Quanti giorni ci sono in due settimane?','168','14','numeri'],
['Quante lettere ha l’alfabeto greco moderno?','Quante lettere ha l’alfabeto latino di base?','24','26','lingua'],
['Quanti giocatori per squadra sono sul campo nel calcio a 5?','Quanti giocatori per squadra sono in campo nel calcio a 7?','5','7','sport'],
['Quanti colori sono usati nel semaforo stradale standard?','Quante luci ha normalmente un semaforo stradale standard?','3','3','quotidiano'],
['Quante facce ha un tetraedro?','Quanti vertici ha un tetraedro?','4','4','matematica'],
['Quanti giorni ci sono in una quindicina?','Quanti giorni ci sono in una decina?','15','10','numeri'],
['Quanti giocatori per squadra iniziano una partita di football americano in campo?','Quanti punti vale una safety nel football americano?','11','2','sport'],
['Quanti gradi ha un angolo retto?','Quanti gradi ha un angolo piatto?','90','180','matematica'],
['Quanti lati ha un pentadecagono?','Quanti lati ha un esagono?','15','6','matematica'],
['Quanti mesi ci sono in due anni e mezzo?','Quanti mesi ci sono in tre anni?','30','36','numeri'],
['Quante cifre ha un numero di telefono fisso italiano standard, escluso il prefisso internazionale?','Quante cifre ha un codice PIN di quattro cifre?','variabile','4','tecnologia'],
['Quanti giocatori per squadra sono in campo in una partita di pallanuoto?','Quanti tempi regolamentari ha una partita di pallanuoto?','7','4','sport'],
['Quante zampe hanno tre cani in totale?','Quante zampe hanno due gatti in totale?','12','8','natura'],
['Quante lettere ha la parola “domanda”?','Quante lettere ha la parola “risposta”?','7','8','lingua'],
['Quanti lati ha un poligono con dieci lati?','Quanti lati ha un poligono con dodici lati?','10','12','matematica'],
['Quanti minuti ci sono in 24 ore?','Quanti secondi ci sono in un’ora?','1440','3600','numeri'],
['Quanti giocatori per squadra sono in campo nel doppio di tennis?','Quanti giocatori ci sono in campo in una partita singolare di tennis?','2','2','sport'],
['Quante note ci sono nella scala musicale diatonica prima di ripetere l’ottava?','Quante note diverse ci sono nella scala cromatica temperata per ottava?','7','12','musica'],
['Quanti lati ha un esagono?','Quanti vertici ha un esagono?','6','6','matematica'],
['Quante ruote ha un autobus urbano comune?','Quante ruote ha un camion a due assi?','6','6','quotidiano'],
['Quante lettere ha la parola “gioco”?','Quante lettere ha la parola “partita”?','5','7','lingua'],
['Quanti centimetri ci sono in un chilometro?','Quanti metri ci sono in un chilometro?','100000','1000','numeri'],
['Quanti giocatori per squadra sono in campo nella pallavolo indoor?','Quanti giocatori per squadra sono in campo nel basket 3x3?','6','3','sport'],
['Quanti gradi ha un giro completo?','Quanti gradi ha mezzo giro?','360','180','matematica'],
['Quanti giorni ha febbraio in un anno non bisestile?','Quanti giorni ha febbraio in un anno bisestile?','28','29','calendario'],
['Quante caselle per lato ha una scacchiera?','Quante righe ha una scacchiera?','8','8','giochi'],
['Quanti giocatori per squadra sono sul campo in una partita di rugby union?','Quanti giocatori per squadra sono sul campo in una partita di rugby league?','15','13','sport'],
['Quanti mesi ci sono in un secolo?','Quanti anni ci sono in un secolo?','1200','100','numeri'],
['Quante zampe ha un millepiedi esattamente?','Quante zampe ha un centopiedi esattamente?','variabile','variabile','natura'],
['Quanti lati ha un quadrilatero?','Quanti angoli ha un triangolo?','4','3','matematica']
].map((q,i)=>({id:`base-${i+1}`,common:q[0],impostor:q[1],commonAnswer:q[2],impostorAnswer:q[3],category:q[4]||'varie'}));
const GROK_PROMPT = `Genera un pacchetto di 100 coppie di domande per il gioco Mr Question? in italiano. Ogni coppia deve avere una domanda comune e una domanda alternativa per l'impostore: entrambe devono essere brevi, naturali, semanticamente vicine e avere risposte numeriche confrontabili, senza che l'alternativa sia ovviamente riconoscibile. Evita ambiguità, opinioni soggettive, fatti troppo controversi, risposte che cambiano spesso e domande con risposte non numeriche. Varia categorie: cultura pop, sport, geografia, storia, scienza, quotidianità, videogiochi, cinema, musica, cucina, tecnologia, animali, numeri e domande divertenti. Non ripetere le coppie né usare quasi sinonimi. Rispondi SOLO con JSON valido nel formato: {"name":"Pacchetto Grok 001","questions":[{"common":"Domanda comune?","impostor":"Domanda alternativa?","commonAnswer":"12","impostorAnswer":"10","category":"sport"}]}. Le risposte sono esempi per validare la confrontabilità e non vanno mostrate ai giocatori. Usa stringhe per le risposte. Non includere markdown o testo fuori dal JSON.`;

let state={players:3,names:DEFAULT_NAMES.slice(0,3),bank:[],used:[],lastImpostor:null,round:null,vote:null,screen:'home'};
const screens=['homeScreen','turnScreen','voteScreen','ballotScreen','resultScreen','archiveScreen'];
function persist(){localStorage.setItem('mq_bank',JSON.stringify(state.bank));localStorage.setItem('mq_used',JSON.stringify(state.used));localStorage.setItem('mq_last',state.lastImpostor??'');}
function loadSaved(){try{const b=JSON.parse(localStorage.getItem('mq_bank')||'null');state.bank=Array.isArray(b)&&b.length?b:BUILTIN.slice();state.used=JSON.parse(localStorage.getItem('mq_used')||'[]')||[];state.lastImpostor=localStorage.getItem('mq_last')||null;}catch{state.bank=BUILTIN.slice();state.used=[];}}
function showScreen(name){state.screen=name;screens.forEach(id=>$(id).classList.toggle('active',id===name+'Screen'));window.scrollTo({top:0,behavior:'smooth'});if(name==='home')renderNames();if(name==='archive')renderArchive();}
function renderNames(){const wrap=$('nameFields');wrap.innerHTML='';for(let i=0;i<state.players;i++){const input=document.createElement('input');input.className='name-input';input.maxLength=20;input.placeholder=`Giocatore ${i+1}`;input.value=state.names[i]||'';input.setAttribute('aria-label',`Nome giocatore ${i+1}`);input.addEventListener('input',()=>{state.names[i]=input.value;});wrap.appendChild(input);} $('playerCount').textContent=state.players;$('playerCountLabel').textContent=`${state.players} giocatori`;}
function updateBankCount(){$('bankCount').textContent=state.bank.length.toLocaleString('it-IT');}
function validQuestions(list){return Array.isArray(list)&&list.every(q=>q&&typeof q.common==='string'&&typeof q.impostor==='string'&&q.common.trim()&&q.impostor.trim()&&q.common.length<240&&q.impostor.length<240);}
function startGame(rematch=false){let names=state.names.slice(0,state.players).map((n,i)=>(n||'').trim()||DEFAULT_NAMES[i]||`Giocatore ${i+1}`);if(new Set(names.map(n=>n.toLocaleLowerCase('it'))).size!==names.length){alert('Usate nomi diversi, così il voto non diventa un referendum confuso.');return;}state.names=names;let available=state.bank.filter(q=>!state.used.includes(q.id));if(!available.length){state.used=[];available=state.bank.slice();}if(!available.length){alert('Archivio vuoto: importa un pacchetto di domande.');return;}let q=available[Math.floor(Math.random()*available.length)];let impostor=Math.floor(Math.random()*names.length);if(names.length>1&&state.lastImpostor!==null&&names.length>1){const previousIndex=names.indexOf(state.lastImpostor);if(previousIndex>=0&&impostor===previousIndex){impostor=(impostor+1+Math.floor(Math.random()*(names.length-1)))%names.length;}}state.used.push(q.id);state.round={q,impostor,answers:Array(names.length).fill(null),turn:0};state.vote=null;persist();showTurn();}
function showTurn(){const r=state.round;if(!r)return;const i=r.turn;$('turnStep').textContent=`TURNO ${i+1} / ${state.names.length}`;$('progressFill').style.width=`${(i/state.names.length)*100}%`;$('currentPlayerName').textContent=state.names[i];$('turnInstruction').textContent='Quando hai il telefono in mano, mostra la domanda. Non far sbirciare gli altri.';$('showQuestion').classList.remove('hidden');$('questionArea').classList.add('hidden');$('answerInput').value='';showScreen('turn');}
function revealQuestion(){const r=state.round;const q=r.turn===r.impostor?r.q.impostor:r.q.common;$('questionText').textContent=q;$('showQuestion').classList.add('hidden');$('questionArea').classList.remove('hidden');$('answerInput').focus();}
function confirmAnswer(){const val=$('answerInput').value.trim();if(val===''||!Number.isFinite(Number(val))){alert('Inserisci una risposta numerica. Anche l’impostore deve fare i compiti.');return;}const r=state.round;r.answers[r.turn]=val;if(r.turn<state.names.length-1){r.turn++;showTurn();}else{showPublicAnswers();}}
function showPublicAnswers(){const r=state.round;$('commonQuestionText').textContent=r.q.common;const list=$('answersList');list.innerHTML='';state.names.forEach((name,i)=>{const row=document.createElement('div');row.className='answer-row';const n=document.createElement('span');n.className='answer-name';n.textContent=name;const a=document.createElement('strong');a.textContent=r.answers[i];row.append(n,a);list.appendChild(row);});showScreen('vote');}
function goVote(){const list=$('voteOptions');list.innerHTML='';state.names.forEach((name,i)=>{const btn=document.createElement('button');btn.className='vote-option';btn.innerHTML=`<span class="avatar">${escapeHtml(name.trim().slice(0,1).toUpperCase())}</span><strong>${escapeHtml(name)}</strong><span class="check"></span>`;btn.addEventListener('click',()=>{state.vote=i;list.querySelectorAll('.vote-option').forEach((b,j)=>{b.classList.toggle('selected',j===i);b.querySelector('.check').textContent=j===i?'✓':'';});$('voteConfirmText').textContent=`Accusate ${name}? Dopo la conferma il verdetto sarà definitivo.`;$('voteConfirmBox').classList.remove('hidden');});list.appendChild(btn);});$('voteConfirmBox').classList.add('hidden');showScreen('ballot');}
function confirmVote(){if(state.vote===null)return;const r=state.round;const correct=state.vote===r.impostor;$('resultIcon').textContent=correct?'✓':'✕';$('resultIcon').style.color=correct?'var(--green)':'var(--danger)';$('resultEyebrow').textContent=correct?'ACCUSA CORRETTA':'ACCUSA SBAGLIATA';$('resultTitle').textContent=correct?'Beccato.':'Vi ha fregati.';$('resultText').textContent=correct?`Avete individuato ${state.names[r.impostor]}. Per una volta il sospetto era ben riposto.`:`Avete votato ${state.names[state.vote]}, ma l’impostore era ${state.names[r.impostor]}. La fiducia nel gruppo ne uscirà rafforzata, forse.`;$('impostorReveal').textContent=state.names[r.impostor];state.lastImpostor=state.names[r.impostor];persist();showScreen('result');}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderArchive(){$('archiveTotal').textContent=state.bank.length.toLocaleString('it-IT');$('archiveUsed').textContent=state.used.length.toLocaleString('it-IT');$('grokPrompt').value=GROK_PROMPT;$('archiveMessage').textContent='';}
function exportArchive(){const data={name:'Mr Question? Offline Question Archive',version:1,generatedAt:new Date().toISOString(),questions:state.bank};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mr-question-archivio.json';a.click();URL.revokeObjectURL(url);$('archiveMessage').textContent='Archivio esportato. Conserva il file come backup o usalo su un altro dispositivo.';}
async function importArchive(file){try{const data=JSON.parse(await file.text());const qs=Array.isArray(data)?data:data.questions;if(!validQuestions(qs)||!qs.length)throw new Error('Formato non valido o nessuna domanda trovata.');let added=0;for(const q of qs){const signature=(q.common+'|'+q.impostor).toLocaleLowerCase('it').replace(/\s+/g,' ').trim();const exists=state.bank.some(old=>(old.common+'|'+old.impostor).toLocaleLowerCase('it').replace(/\s+/g,' ').trim()===signature);if(!exists){state.bank.push({id:`grok-${Date.now()}-${added}-${Math.random().toString(36).slice(2,7)}`,common:q.common.trim(),impostor:q.impostor.trim(),commonAnswer:q.commonAnswer??'',impostorAnswer:q.impostorAnswer??'',category:q.category??'importate'});added++;}}persist();updateBankCount();renderArchive();$('archiveMessage').textContent=`Importazione completata: ${added} nuove coppie aggiunte su ${qs.length} lette.`;}catch(e){$('archiveMessage').textContent=`Importazione non riuscita: ${e.message}`;}}
$('minusPlayers').addEventListener('click',()=>{if(state.players>3){state.players--;renderNames();}});$('plusPlayers').addEventListener('click',()=>{if(state.players<7){state.players++;renderNames();}});$('startGame').addEventListener('click',()=>startGame());$('showQuestion').addEventListener('click',revealQuestion);$('confirmAnswer').addEventListener('click',confirmAnswer);$('answerInput').addEventListener('keydown',e=>{if(e.key==='Enter')confirmAnswer();});$('goVote').addEventListener('click',goVote);$('restartHome').addEventListener('click',()=>showScreen('home'));$('confirmVote').addEventListener('click',confirmVote);$('changeVote').addEventListener('click',()=>{$('voteConfirmBox').classList.add('hidden');});$('backToAnswers').addEventListener('click',()=>showScreen('vote'));$('rematch').addEventListener('click',()=>startGame(true));$('newGame').addEventListener('click',()=>showScreen('home'));$('archiveOpen').addEventListener('click',()=>showScreen('archive'));$('manageArchive').addEventListener('click',()=>showScreen('archive'));$('closeArchive').addEventListener('click',()=>showScreen('home'));$('exportArchive').addEventListener('click',exportArchive);$('importFile').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)importArchive(file);e.target.value='';});$('resetUsed').addEventListener('click',()=>{state.used=[];persist();renderArchive();$('archiveMessage').textContent='Conteggio azzerato: tutte le coppie sono di nuovo disponibili.';});$('copyPrompt').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(GROK_PROMPT);$('archiveMessage').textContent='Prompt copiato negli appunti.';}catch{$('grokPrompt').select();$('archiveMessage').textContent='Seleziona e copia il testo del prompt.';}});
window.addEventListener('online',()=>{$('connectionStatus').textContent='● ONLINE';});window.addEventListener('offline',()=>{$('connectionStatus').textContent='● OFFLINE';});
loadSaved();if(!state.bank.length)state.bank=BUILTIN.slice();state.names=DEFAULT_NAMES.slice(0,3);renderNames();updateBankCount();$('connectionStatus').textContent=navigator.onLine?'● PRONTO':'● OFFLINE';
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
