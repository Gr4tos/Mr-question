window.__MRQ_APP='6994c8e320'; // impronta di questo file (la scrive tests/bump-version.js); index.html controlla che tutti i file siano della stessa versione
const BUILTIN = [
['Quante ore di tempo libero hai in una giornata media?','Quante ore al giorno passi davanti a uno schermo per svago?','','','vita quotidiana'],
['Quante ore dormi in una notte media?','Quante ore resti a letto in una notte media?','','','abitudini'],
['Quanti minuti impieghi di solito per prepararti a uscire?','Quanti minuti prima di uscire inizi a prepararti?','','','abitudini'],
['Quanti caffè bevi in una giornata normale?','Quante bevande con caffeina bevi in una giornata normale?','','','abitudini'],
['Quanti giorni alla settimana mangi fuori casa?','Quanti giorni alla settimana compri un pasto già pronto?','','','cibo'],
['Quanti minuti al giorno ascolti musica?','Quanti minuti al giorno guardi video per svago?','','','intrattenimento'],
['Quanti minuti al giorno passi sui social network?','Quanti minuti al giorno passi sulle app di messaggistica?','','','telefono'],
['Quanti euro spendi in media per una pausa pranzo?','Quanti euro spendi in media per una cena informale fuori?','','','soldi'],
['Quante volte al mese guardi un film a casa?','Quante volte al mese guardi una serie TV per almeno un’ora?','','','intrattenimento'],
['Quante ore alla settimana giochi ai videogiochi?','Quante ore alla settimana guardi video o streaming di videogiochi?','','','videogiochi'],
['Quanti giorni alla settimana fai attività fisica?','Quanti giorni alla settimana fai almeno una passeggiata di mezz’ora?','','','sport'],
['Quanti minuti impieghi per arrivare al lavoro o a scuola?','Quanti minuti impieghi per tornare a casa dal lavoro o da scuola?','','','spostamenti'],
['Quanti chilometri percorri in una giornata normale?','Quanti chilometri percorri a piedi in una settimana divisa per sette?','','','spostamenti'],
['Quante volte alla settimana ordini cibo a domicilio?','Quante volte alla settimana prendi cibo da asporto?','','','cibo'],
['Quanti euro spendi in una settimana per snack e bibite?','Quanti euro spendi in una settimana per colazioni al bar?','','','soldi'],
['Quanti minuti al giorno passi a cucinare?','Quanti minuti al giorno passi a lavare i piatti e riordinare la cucina?','','','casa'],
['Quante volte al mese esci la sera con amici?','Quante volte al mese organizzi qualcosa a casa con amici?','','','vita sociale'],
['Quanti messaggi mandi in una giornata normale?','Quanti messaggi vocali mandi in una giornata normale?','','','telefono'],
['Quante foto scatti in una settimana normale?','Quanti video registri in una settimana normale?','','','telefono'],
['Quante ore alla settimana dedichi alle faccende domestiche?','Quante ore alla settimana dedichi a fare commissioni?','','','quotidianità'],
['Quanti minuti al giorno passi a cercare qualcosa che hai perso o non trovi?','Quanti minuti al giorno perdi decidendo cosa guardare o ascoltare?','','','abitudini'],
['Quante volte al mese vai al cinema o a vedere uno spettacolo?','Quante volte al mese vai a un evento sportivo o musicale?','','','uscite'],
['Quante ore alla settimana ascolti podcast?','Quante ore alla settimana ascolti musica con le cuffie?','','','audio'],
['Quanti euro spendi in media quando esci con gli amici?','Quanti euro spendi in media quando fai una serata tranquilla fuori?','','','soldi'],
['Quanti giorni alla settimana fai colazione fuori casa?','Quanti giorni alla settimana compri il pranzo fuori casa?','','','cibo'],
['Quante volte al mese fai acquisti non programmati?','Quante volte al mese compri qualcosa solo perché è in offerta?','','','soldi'],
['Quante ore alla settimana passi sui mezzi pubblici?','Quante ore alla settimana passi in auto come conducente o passeggero?','','','spostamenti'],
['Quanti minuti al giorno passi a sistemarti capelli o barba?','Quanti minuti al giorno dedichi alla cura personale davanti allo specchio?','','','routine'],
['Quante volte alla settimana controlli il saldo del conto?','Quante volte alla settimana controlli le spese sul telefono?','','','soldi'],
['Quante ore alla settimana passi a guardare serie TV?','Quante ore alla settimana passi a guardare film?','','','intrattenimento'],
['Quanti giorni alla settimana mangi frutta?','Quanti giorni alla settimana mangi verdura?','','','cibo'],
['Quante volte alla settimana fai una doccia?','Quante volte alla settimana ti lavi i capelli?','','','routine'],
['Quanti minuti impieghi di solito per addormentarti?','Quanti minuti impieghi di solito per alzarti davvero dopo la sveglia?','','','sonno'],
['Quante volte al giorno controlli l’ora sul telefono?','Quante volte al giorno controlli le notifiche sul telefono?','','','telefono'],
['Quanti giorni alla settimana indossi scarpe sportive?','Quanti giorni alla settimana indossi abiti comodi invece di quelli eleganti?','','','stile'],
['Quante ore alla settimana passi con gli amici di persona?','Quante ore alla settimana passi a parlare con gli amici al telefono o in chat?','','','vita sociale'],
['Quante volte al mese provi un ristorante o un locale nuovo?','Quante volte al mese torni in un locale che conosci già?','','','uscite'],
['Quanti euro spendi in media per un regalo a un amico?','Quanti euro spendi in media per un regalo a un familiare?','','','soldi'],
['Quante ore alla settimana dedichi a un hobby?','Quante ore alla settimana dedichi a imparare qualcosa per piacere?','','','tempo libero'],
['Quanti minuti al giorno passi a scorrere contenuti senza cercare qualcosa di preciso?','Quanti minuti al giorno passi a guardare brevi video uno dopo l’altro?','','','telefono'],
['Quante volte al mese fai una gita fuori città?','Quante volte al mese vai in un posto nuovo nella tua zona?','','','uscite'],
['Quanti minuti impieghi in media a scegliere cosa ordinare al ristorante?','Quanti minuti impieghi in media a scegliere cosa guardare in streaming?','','','decisioni'],
['Quanti giorni alla settimana vai a letto dopo mezzanotte?','Quanti giorni alla settimana rimandi la sveglia almeno una volta?','','','sonno'],
['Quante volte alla settimana compri qualcosa da bere fuori casa?','Quante volte alla settimana compri uno snack fuori casa?','','','quotidianità'],
['Quante ore alla settimana passi a leggere, su carta o schermo?','Quante ore alla settimana passi a informarti con articoli o notizie?','','','media'],
['Quante volte al mese giochi a un gioco da tavolo o di carte?','Quante volte al mese giochi a un party game con amici?','','','giochi'],
['Quanti minuti al giorno dedichi a riordinare la tua stanza o casa?','Quanti minuti al giorno dedichi a preparare le cose per il giorno dopo?','','','casa'],
['Quante volte al mese fai sport o attività all’aperto con altre persone?','Quante volte al mese organizzi un’attività all’aperto con amici?','','','sport'],
['Quanti euro spendi in media per una colazione al bar?','Quanti euro spendi in media per una merenda fuori casa?','','','soldi'],
['Quante ore al giorno usi il telefono per motivi personali?','Quante ore al giorno usi il computer per motivi personali?','','','tecnologia']
].map((q,i)=>({id:`base-${i+1}`,common:q[0],impostor:q[1],commonAnswer:q[2],impostorAnswer:q[3],category:q[4]||'varie'}));
const $ = id => document.getElementById(id);
const suspectName = i => `Sospettato ${i+1}`;
const state = { mode: 'local', players: 3, inputs: [], names: [], bank: [], used: [], lastImpostor: null, round: null, vote: null, screen: 'menu' };
const screens = ['menuScreen','homeScreen','turnScreen','voteScreen','ballotScreen','resultScreen','onMenuScreen','onLobbyScreen','onTurnScreen','onSummaryScreen','onVoteScreen','onResultScreen'];
const GAME_SCREENS = ['turn','vote','ballot','onLobby','onTurn','onSummary','onVote','onResult'];
const TURN_SCREENS = ['turn','onTurn'];
const CONFIG = window.MRQ_CONFIG || { grokEndpoint: '' };
function getEndpoint(){ return String(CONFIG.grokEndpoint || '').trim().replace(/\/$/, ''); }
function persist(){ try { localStorage.setItem('mq_bank', JSON.stringify(state.bank)); localStorage.setItem('mq_used', JSON.stringify(state.used)); if(state.lastImpostor) localStorage.setItem('mq_last', state.lastImpostor); } catch(e){} }
function loadSaved(){ try { const b=JSON.parse(localStorage.getItem('mq_bank')||'null'); state.bank=Array.isArray(b)&&b.length?b:BUILTIN.slice(); state.used=JSON.parse(localStorage.getItem('mq_used')||'[]')||[]; state.lastImpostor=localStorage.getItem('mq_last')||null; } catch { state.bank=BUILTIN.slice(); state.used=[]; } }
function showError(id,msg){ const el=$(id); el.textContent=msg; el.classList.remove('hidden'); }
function clearErrors(){ ['homeError','answerError','resultError','menuError'].forEach(id=>{const e=$(id);if(e)e.classList.add('hidden');}); }
function showScreen(name){ state.screen=name; if(typeof paintUpdateBanner==='function')paintUpdateBanner(); $('caseStamp').textContent=(name==='result'||name==='onResult')?'CASO CHIUSO':'CASO APERTO'; $('caseStamp').classList.toggle('hidden',TURN_SCREENS.includes(name)); $('topLabel').classList.toggle('hidden',!TURN_SCREENS.includes(name)); $('exitButton').classList.toggle('hidden',!GAME_SCREENS.includes(name)); screens.forEach(id=>$(id).classList.toggle('active',id===name+'Screen')); window.scrollTo({top:0,behavior:'smooth'}); if(name==='home')renderNames(); }
const SVGNS='http://www.w3.org/2000/svg';
function svgEl(tag,attrs){ const e=document.createElementNS(SVGNS,tag); for(const k in attrs)e.setAttribute(k,attrs[k]); return e; }
// sagoma del detective nel colore del posto n (1..7); i colori sono token CSS (--av-1 .. --av-7)
function avatarSvg(n,cls){ const svg=svgEl('svg',{viewBox:'0 0 200 205',class:'av s'+n+(cls?' '+cls:''),'aria-hidden':'true',focusable:'false'}); const a=svgEl('use',{href:'#mqSilhouette'}); const m=svgEl('use',{href:'#mqMark',class:'av-mark'}); svg.append(a,m); return svg; }
function checkSvg(){ const svg=svgEl('svg',{viewBox:'0 0 24 24','aria-hidden':'true',focusable:'false'}); svg.append(svgEl('path',{d:'M5.5 12.5l4.2 4.2L18.5 8'})); return svg; }
// tessera di un giocatore: numero del posto, sagoma, nome; opzioni: button, cls, tag, off (scollegato), ok (spunta)
function buildTile(o){ const t=document.createElement(o.button?'button':'div'); if(o.button)t.type='button'; t.className='tile'+(o.cls?' '+o.cls:'');
  const b=document.createElement('span'); b.className='badge'; b.textContent=String(o.n); t.append(b);
  if(o.ok){ const k=document.createElement('span'); k.className='ok'; k.append(checkSvg()); t.append(k); }
  if(o.button){ const k=document.createElement('span'); k.className='chk'; k.append(checkSvg()); t.append(k); }
  t.append(avatarSvg(o.n));
  const nm=document.createElement('div'); nm.className='tile-name'; if(o.off){ const d=document.createElement('span'); d.className='dot off'; nm.append(d); } const tx=document.createElement('span'); tx.className='tile-text'; tx.textContent=o.name; nm.append(tx); t.append(nm);
  if(o.tag){ const g=document.createElement('div'); g.className='tile-tag'; g.textContent=o.tag; t.append(g); }
  return t; }
function setSeat(svg,n){ for(let k=0;k<=7;k++)svg.classList.remove('s'+k); svg.classList.add('s'+n); }
function renderNames(){ const wrap=$('nameFields'); wrap.innerHTML=''; for(let i=0;i<state.players;i++){ const input=document.createElement('input'); input.className='name-input'; input.maxLength=20; input.placeholder=suspectName(i); input.value=state.inputs[i]||''; input.setAttribute('aria-label',`Nome giocatore ${i+1}`); input.autocomplete='off'; input.addEventListener('input',()=>{state.inputs[i]=input.value;clearErrors();}); wrap.appendChild(input); } $('playerCount').textContent=state.players; $('playerCountLabel').textContent=`${state.players} giocatori`; $('minusPlayers').disabled=state.players<=3; $('plusPlayers').disabled=state.players>=7; }
function validQuestions(list){ return Array.isArray(list)&&list.every(q=>q&&typeof q.common==='string'&&typeof q.impostor==='string'&&q.common.trim()&&q.impostor.trim()&&q.common.length<240&&q.impostor.length<240); }
function addQuestions(list){ const added=[]; for(const q of list){ const signature=(q.common+'|'+q.impostor).toLocaleLowerCase('it').replace(/\s+/g,' ').trim(); if(!state.bank.some(old=>(old.common+'|'+old.impostor).toLocaleLowerCase('it').replace(/\s+/g,' ').trim()===signature)){ const item={id:`grok-${Date.now()}-${added.length}-${Math.random().toString(36).slice(2,7)}`,common:q.common.trim(),impostor:q.impostor.trim(),category:q.category||'Grok'}; state.bank.push(item); added.push(item); } } if(added.length)persist(); return added; }
async function fetchLiveQuestions(count=8){ const endpoint=getEndpoint(); if(!navigator.onLine||!endpoint)return []; const recent=state.bank.slice(-18).map(q=>({common:q.common,impostor:q.impostor})); const response=await fetch(endpoint+'/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({count,recent})}); if(!response.ok)throw new Error(`Grok ${response.status}`); const data=await response.json(); if(!validQuestions(data.questions)||!data.questions.length)throw new Error('Formato domande non valido'); return addQuestions(data.questions); }
async function startGame(){ const names=Array.from({length:state.players},(_,i)=>(state.inputs[i]||'').trim()||suspectName(i)); if(new Set(names.map(n=>n.toLocaleLowerCase('it'))).size!==names.length){ showError('homeError','Due sospettati hanno lo stesso nome. Scegliete nomi diversi.'); return; } clearErrors(); state.names=names; const button=$('startGame'), rematch=$('rematch'); let fresh=[]; if(navigator.onLine&&getEndpoint()){ button.disabled=true; if(rematch)rematch.disabled=true; $('startLabel').textContent='Grok sta pensando…'; try{fresh=await fetchLiveQuestions(8);}catch(e){console.warn('Grok non disponibile; uso le domande salvate.',e);}finally{button.disabled=false;if(rematch)rematch.disabled=false;$('startLabel').textContent='Apri le indagini';} } let pool=(fresh.length?fresh:state.bank).filter(q=>!state.used.includes(q.id)); if(!pool.length){state.used=[];pool=(fresh.length?fresh:state.bank).slice();} if(!pool.length){showError(state.screen==='result'?'resultError':'homeError','Nessuna domanda disponibile. Ricarica la pagina quando sei online.');return;} const q=pool[Math.floor(Math.random()*pool.length)]; let impostor=Math.floor(Math.random()*names.length); if(names.length>1&&state.lastImpostor){const previous=names.indexOf(state.lastImpostor);if(previous>=0&&impostor===previous)impostor=(impostor+1+Math.floor(Math.random()*(names.length-1)))%names.length;} state.used.push(q.id); state.round={q,impostor,answers:Array(names.length).fill(null),turn:0};state.vote=null;persist();showTurn(); }
function showTurn(){const r=state.round;if(!r)return;const i=r.turn;$('topLabel').textContent=`TURNO ${i+1} / ${state.names.length}`;setSeat($('turnAvatar'),i+1);$('currentPlayerName').textContent=state.names[i];turnSheet.reset();showScreen('turn');}
function confirmAnswer(){const inp=$('answerInput');if(!inp)return;const val=inp.value.trim();if(val===''||!Number.isFinite(Number(val))){showError('answerError','Serve una risposta numerica.');return;} clearErrors();const r=state.round;r.answers[r.turn]=val;turnSheet.reset();if(r.turn<state.names.length-1){r.turn++;showTurn();}else showPublicAnswers();}
function showPublicAnswers(){const r=state.round;$('commonQuestionText').textContent=r.q.common;const list=$('answersList');list.innerHTML='';state.names.forEach((name,i)=>{const row=document.createElement('div');row.className='answer-row';const n=document.createElement('span');n.className='answer-name';n.textContent=name;const a=document.createElement('strong');a.textContent=r.answers[i];row.append(avatarSvg(i+1),n,a);list.appendChild(row);});list.classList.toggle('compact',state.names.length>=6);showScreen('vote');}
function goVote(){const list=$('voteOptions');list.innerHTML='';list.classList.toggle('compact',state.names.length>=5);state.vote=null;state.names.forEach((name,i)=>{const t=buildTile({n:i+1,name,button:true,cls:'vote-option'});t.addEventListener('click',()=>{state.vote=i;list.querySelectorAll('.vote-option').forEach((b,j)=>b.classList.toggle('sel',j===i));$('voteConfirmText').textContent=`Firma l’accusa a ${name}`;$('confirmVote').classList.remove('hidden');});list.appendChild(t);});$('confirmVote').classList.add('hidden');showScreen('ballot');}
function confirmVote(){if(state.vote===null)return;const r=state.round;const correct=state.vote===r.impostor;setSeat($('revealAvatar'),r.impostor+1);$('resultIcon').textContent=correct?'✓':'×';$('resultIcon').classList.toggle('is-correct',correct);$('resultIcon').classList.toggle('is-wrong',!correct);$('resultEyebrow').textContent=correct?'ACCUSA CORRETTA':'ACCUSA SBAGLIATA';$('resultTitle').textContent=correct?'Beccato!':'Non questa volta.';$('resultText').textContent=correct?`Avete individuato ${state.names[r.impostor]}.`:`Avete votato ${state.names[state.vote]}. L’impostore era ${state.names[r.impostor]}.`;$('impostorReveal').textContent=state.names[r.impostor];state.lastImpostor=state.names[r.impostor];persist();showScreen('result');}
const EXIT_TEXT = {
  local: { q:'Vuoi tornare al menù principale?', n:'La partita in corso andrà persa.', stay:'No, continua', yes:'Sì, torna al menù' },
  online: { q:'Vuoi uscire dalla partita?', n:'Gli altri continueranno senza di te.', stay:'No, resta', yes:'Sì, esci' }
};
function openExit(){ const t=EXIT_TEXT[state.mode]||EXIT_TEXT.local; $('exitQuestion').textContent=t.q; $('exitNote').textContent=t.n; $('exitStay').firstElementChild.textContent=t.stay; $('exitConfirm').textContent=t.yes; $('exitDialog').classList.remove('hidden'); document.querySelector('main').inert=true; $('exitStay').focus(); }
function closeExit(){ $('exitDialog').classList.add('hidden'); document.querySelector('main').inert=false; }
function openHelp(){ $('helpDialog').classList.remove('hidden'); document.querySelector('main').inert=true; $('helpClose').focus(); }
function closeHelp(){ $('helpDialog').classList.add('hidden'); document.querySelector('main').inert=false; $('helpButton').focus(); }
function leaveGame(){ closeExit(); state.round=null; state.vote=null; turnSheet.reset(); clearErrors(); showScreen('menu'); }
function confirmExit(){ if(state.mode==='online'&&window.MRQ.leaveOnline){ closeExit(); window.MRQ.leaveOnline(); } else leaveGame(); }
function pickQuestion(){ let pool=state.bank.filter(q=>!state.used.includes(q.id)); if(!pool.length){state.used=[];pool=state.bank.slice();} if(!pool.length)return null; const q=pool[Math.floor(Math.random()*pool.length)]; state.used.push(q.id); persist(); return {common:q.common,impostor:q.impostor}; }
let onlineModule=null;
async function openOnline(){ clearErrors(); if(!navigator.onLine){ showError('menuError','Sei offline: il party online richiede Internet. Puoi giocare con un solo telefono, anche senza rete.'); return; } const btn=$('goOnline'); btn.disabled=true; try{ onlineModule=onlineModule||await import('./online.js?v='+self.MRQ_VERSION); await onlineModule.startOnline(); }catch(e){ console.warn('Party online non disponibile',e); showError('menuError','Non riesco a collegarmi al party online. Controlla la connessione, oppure gioca con un solo telefono.'); }finally{ btn.disabled=false; } }
window.MRQ = { showScreen, pickQuestion, createSheet, buildTile, avatarSvg, setSeat, escapeHtml: s=>escapeHtml(s), setMode: m=>{ state.mode=m; }, leaveOnline: null };
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
$('minusPlayers').addEventListener('click',()=>{if(state.players>3){state.players--;renderNames();}});$('plusPlayers').addEventListener('click',()=>{if(state.players<7){state.players++;renderNames();}});$('startGame').addEventListener('click',startGame);$('confirmAnswer').addEventListener('click',confirmAnswer);$('goVote').addEventListener('click',goVote);$('confirmVote').addEventListener('click',confirmVote);$('backToAnswers').addEventListener('click',()=>showScreen('vote'));$('rematch').addEventListener('click',startGame);$('newGame').addEventListener('click',()=>showScreen('home'));$('exitButton').addEventListener('click',openExit);$('exitStay').addEventListener('click',closeExit);$('exitConfirm').addEventListener('click',confirmExit);$('goLocal').addEventListener('click',()=>{state.mode='local';clearErrors();showScreen('home');});$('goOnline').addEventListener('click',openOnline);$('backToMenu').addEventListener('click',()=>showScreen('menu'));$('exitDialog').addEventListener('click',e=>{if(e.target===$('exitDialog'))closeExit();});$('helpButton').addEventListener('click',openHelp);$('helpClose').addEventListener('click',closeHelp);$('helpDialog').addEventListener('click',e=>{if(e.target===$('helpDialog'))closeHelp();});document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!$('exitDialog').classList.contains('hidden'))closeExit();else if(!$('helpDialog').classList.contains('hidden'))closeHelp();});$('brandLogo').addEventListener('error',()=>{$('brandLogo').classList.add('logo-missing');});

// ---- fascicolo a scorrimento (turno privato, a un telefono e online) ----
// Scheda chiusa = copertina (sagoma, nome, maniglia). Domanda e campo di risposta stanno in un <template> e
// vengono inseriti nella pagina SOLO quando si inizia ad aprire; alla chiusura vengono tolti (la risposta già scritta
// resta in memoria, `draft`, e viene rimessa nel campo alla riapertura). Il codice non sa chi sia l'impostore: stesso gesto,
// stessa animazione per tutti, cambia solo il testo della domanda (lo dà `fill`).
const SHEETS=[];
function createSheet(o){
  const root=o.root,cover=o.cover,inside=o.inside,handle=o.handle,peekBtn=o.peekBtn,sendBtn=o.sendBtn;
  const S={state:'closed',draft:'',justDragged:false};
  let timer=0,kbFlag=false;
  const reduce=()=>!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const input=()=>inside.querySelector('input');
  const saveDraft=()=>{const i=input();if(i)S.draft=i.value;};
  function fill(){
    inside.textContent='';inside.append(o.template.content.cloneNode(true));inside.classList.remove('hidden');
    o.fill(inside);const i=input();if(i&&S.draft)i.value=S.draft;
    const g=inside.querySelector('.sheet-grabber');
    g.addEventListener('click',()=>{if(S.justDragged)return;S.close({focus:true});});
    bindDrag(g,'close');
  }
  function empty(){inside.textContent='';inside.classList.add('hidden');inside.style.transform='';}
  const shift=px=>{inside.style.transform=`translateY(${px}px)`;}; // il foglio sale insieme alla copertina: parte attaccato al suo bordo basso
  function visual(open){
    root.classList.remove('dragging');root.classList.toggle('is-open',open);
    cover.style.transform=open?'translateY(-101%)':'';inside.style.transform=open?'':`translateY(${root.offsetHeight}px)`;
    if(open)cover.setAttribute('aria-hidden','true');else cover.removeAttribute('aria-hidden');
    handle.setAttribute('aria-expanded',String(open));
    sendBtn.classList.toggle('hidden',!open);if(open)peekBtn.classList.add('hidden');
    S.state=open?'open':'closed';
  }
  S.peek=show=>peekBtn.classList.toggle('hidden',!show);
  S.isOpen=()=>S.state==='open';
  S.open=opt=>{
    if(S.state==='open'||(o.canOpen&&!o.canOpen()))return;
    clearTimeout(timer);
    if(inside.classList.contains('hidden')||!input()){fill();shift(root.offsetHeight);void inside.offsetWidth;}
    visual(true);
    if(opt&&opt.focus){const i=input();if(i)i.focus();}
  };
  S.close=opt=>{
    if(S.state==='closed')return;
    saveDraft();clearTimeout(timer);
    if((opt&&opt.instant)||reduce()){root.classList.add('dragging');visual(false);empty();void cover.offsetWidth;root.classList.remove('dragging');}
    else{visual(false);timer=setTimeout(()=>{if(S.state==='closed')empty();},320);}
    if(opt&&opt.focus)handle.focus();
  };
  S.reset=()=>{clearTimeout(timer);S.draft='';root.classList.add('dragging');visual(false);empty();S.peek(false);void cover.offsetWidth;root.classList.remove('dragging');};
  // un telefono in background o una pagina che si chiude: la scheda si copre subito (la risposta scritta resta in memoria)
  S.hideNow=()=>{if(S.state!=='closed')S.close({instant:true});S.peek(false);};

  // ---- gesto: trascinare in su apre, in giù chiude ----
  function bindDrag(el,kind){
    let pid=null,y0=0,samples=[],drag=false,H=0;
    el.addEventListener('pointerdown',e=>{
      if(pid!==null)return;
      if(e.pointerType==='mouse'&&e.button!==0)return;
      if(kind==='open'&&(S.state!=='closed'||(o.canOpen&&!o.canOpen())))return;
      if(kind==='close'&&S.state!=='open')return;
      if(e.clientY>window.innerHeight-40)return; // vicino alla barra della Home: il gesto è del sistema
      pid=e.pointerId;y0=e.clientY;samples=[{t:e.timeStamp,y:e.clientY}];drag=false;H=root.offsetHeight;
    });
    el.addEventListener('pointermove',e=>{
      if(e.pointerId!==pid)return;
      const dy=kind==='open'?y0-e.clientY:e.clientY-y0;
      samples.push({t:e.timeStamp,y:e.clientY});while(samples.length>2&&e.timeStamp-samples[0].t>120)samples.shift();
      if(!drag){
        if(dy<6)return;
        drag=true;try{el.setPointerCapture(e.pointerId);}catch(_){}
        clearTimeout(timer);
        if(kind==='open'){if(!reduce()){fill();}}
        root.classList.add('dragging');root.classList.remove('is-open');cover.removeAttribute('aria-hidden');
      }
      if(reduce())return; // niente movimento: si decide solo al rilascio
      const d=Math.min(Math.max(dy,0),H);
      cover.style.transform=kind==='open'?`translateY(${-d}px)`:`translateY(${d-H}px)`;
      shift(kind==='open'?H-d:d);
    });
    function finish(e,cancelled){
      if(e.pointerId!==pid)return;pid=null;
      try{el.releasePointerCapture(e.pointerId);}catch(_){}
      if(!drag)return;
      S.justDragged=true;setTimeout(()=>{S.justDragged=false;},60);
      const dy=kind==='open'?y0-e.clientY:e.clientY-y0;
      const a=samples[0],b=samples[samples.length-1];
      const v=b.t>a.t?(kind==='open'?a.y-b.y:b.y-a.y)/(b.t-a.t):0; // px/ms nella direzione del gesto
      const passed=!cancelled&&(dy>=(kind==='open'?0.4:0.3)*H||(v>=0.5&&dy>=24));
      root.classList.remove('dragging');
      if(kind==='open'){
        if(passed){if(!input()){fill();shift(H);void inside.offsetWidth;}visual(true);}
        else{cover.style.transform='';shift(H);root.classList.remove('is-open');if(reduce()||!input())empty();else timer=setTimeout(()=>{if(S.state==='closed')empty();},320);}
      }else{
        if(passed){S.state='open';S.close({});}else visual(true);
      }
    }
    el.addEventListener('pointerup',e=>finish(e,false));
    el.addEventListener('pointercancel',e=>finish(e,true));
  }
  bindDrag(cover,'open');
  // maniglia: tastiera = apre subito; tocco (o VoiceOver) = compare il pulsante "Apri il fascicolo"
  handle.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){kbFlag=true;setTimeout(()=>{kbFlag=false;},800);}});
  handle.addEventListener('click',()=>{
    if(S.justDragged)return;
    if(kbFlag){kbFlag=false;S.open({focus:true});return;}
    S.peek(true);peekBtn.focus();
  });
  peekBtn.addEventListener('click',()=>S.open({focus:true}));
  SHEETS.push(S);return S;
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)SHEETS.forEach(s=>s.hideNow());});
window.addEventListener('pagehide',()=>SHEETS.forEach(s=>s.hideNow()));
const turnSheet=createSheet({root:$('turnSheet'),cover:$('turnCover'),inside:$('questionArea'),handle:$('turnHandle'),peekBtn:$('showQuestion'),sendBtn:$('confirmAnswer'),template:$('answerTemplate'),
  fill:box=>{const r=state.round;const q=r.turn===r.impostor?r.q.impostor:r.q.common;$('questionText').textContent=q;box.querySelector('.sheet-who').textContent='FASCICOLO DI '+state.names[r.turn].toLocaleUpperCase('it');
    const inp=$('answerInput');inp.addEventListener('input',clearErrors);inp.addEventListener('keydown',e=>{if(e.key==='Enter')confirmAnswer();});}});
loadSaved();renderNames();
// ---- aggiornamenti: il service worker nuovo resta in attesa; il banner "Aggiorna" compare solo nel menù e nel verdetto ----
const UPDATE_SCREENS=['menu','result','onResult'];
let updateReady=false;
function paintUpdateBanner(){ $('updateBanner').classList.toggle('hidden',!(updateReady&&UPDATE_SCREENS.includes(state.screen))); }
(function(){
  if(!('serviceWorker' in navigator))return;
  let reloading=false,wantReload=false;
  const ask=(worker,type)=>new Promise(resolve=>{const ch=new MessageChannel();ch.port1.onmessage=e=>resolve(e.data);try{worker.postMessage({type},[ch.port2]);}catch(_){resolve(null);}setTimeout(()=>resolve(null),1500);});
  async function handle(reg){
    const w=reg.waiting; if(!w||!navigator.serviceWorker.controller)return; // al primo avvio non c'è niente da aggiornare
    const theirs=await ask(w,'VERSION');
    if(theirs&&theirs===self.MRQ_VERSION){ w.postMessage({type:'SKIP_WAITING'}); return; } // la pagina è già la versione nuova: ci si allinea senza disturbare
    updateReady=true; paintUpdateBanner();
  }
  navigator.serviceWorker.addEventListener('controllerchange',()=>{ if(wantReload&&!reloading){reloading=true;location.reload();} });
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
      window.MRQ_SW=reg; handle(reg);
      reg.addEventListener('updatefound',()=>{ const n=reg.installing; if(n)n.addEventListener('statechange',()=>{ if(n.state==='installed')handle(reg); }); });
      let last=Date.now();
      const check=()=>{ if(Date.now()-last>10*60*1000){last=Date.now();reg.update().catch(()=>{});} };
      document.addEventListener('visibilitychange',()=>{ if(!document.hidden)check(); });
      setInterval(()=>{last=0;check();},30*60*1000);
      $('updateNow').addEventListener('click',()=>{ const w=reg.waiting; if(!w){location.reload();return;} wantReload=true; w.postMessage({type:'SKIP_WAITING'}); });
    }).catch(()=>{});
  });
})();

// ---- tema chiaro / scuro (theme.js applica il tema; qui solo il selettore nel menù) ----
(function(){
  const ids={light:'themeLight',auto:'themeAuto',dark:'themeDark'};
  const paint=()=>{const cur=window.MQTheme?window.MQTheme.get():'auto';Object.keys(ids).forEach(k=>$(ids[k]).setAttribute('aria-checked',String(k===cur)));};
  Object.keys(ids).forEach(k=>$(ids[k]).addEventListener('click',()=>{if(window.MQTheme)window.MQTheme.set(k);paint();}));
  paint();
})();

// ---- tastiera su iPhone: con la tastiera aperta la barra dei pulsanti smette di stare incollata in basso
// (altrimenti finirebbe sotto la tastiera o sopra il campo) e torna normale quando si chiude ----
(function(){
  const vv=window.visualViewport; if(!vv)return;
  const root=document.documentElement;
  const upd=()=>{ const open=window.innerHeight-vv.height>120; root.classList.toggle('kb',open); };
  vv.addEventListener('resize',upd); vv.addEventListener('scroll',upd);
  document.addEventListener('focusout',()=>setTimeout(upd,250));
  upd();
})();

try{sessionStorage.removeItem('mq_boot_retry');}catch(e){}
window.__mrqReady=true; // avvio riuscito: spegne la schermata d'errore all'avvio (vedi index.html)
