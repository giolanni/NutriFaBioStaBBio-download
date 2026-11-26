const sample = [
  {id:'demo_1',title:'Pasta cremosa ai pomodorini',category:['primo'],ingredients:[{name:'pasta',quantity:160,unit:'g'},{name:'pomodorini',quantity:250,unit:'g'},{name:'ricotta',quantity:100,unit:'g'}],instructions:['Cuoci la pasta in acqua salata.','Salta i pomodorini in padella.','Unisci ricotta, pasta e poca acqua di cottura.'],servings:2,preparation_minutes:20,nutrition:{calories_kcal:480,protein_g:19,carbohydrates_g:70,fat_g:13},source_type:'catalog',visibility:'public',owner_id:'catalog',owner_name:'Nutri Fabio Stabbio'},
  {id:'demo_2',title:'Coppa alle pesche sciroppate',category:['dolce'],ingredients:[{name:'pesche sciroppate',quantity:200,unit:'g'},{name:'yogurt greco',quantity:170,unit:'g'},{name:'biscotti',quantity:40,unit:'g'}],instructions:['Scola e taglia le pesche.','Alterna yogurt, biscotti e pesche in una coppa.','Lascia riposare 20 minuti in frigorifero.'],servings:2,preparation_minutes:10,nutrition:{calories_kcal:270,protein_g:13,carbohydrates_g:43,fat_g:5},source_type:'catalog',visibility:'public',owner_id:'catalog',owner_name:'Nutri Fabio Stabbio'},
  {id:'community_demo',title:'Frittata soffice alle erbette',category:['secondo'],ingredients:[{name:'uova',quantity:4,unit:''},{name:'erbette',quantity:120,unit:'g'}],instructions:['Sbatti le uova.','Unisci le erbette.','Cuoci a fuoco dolce.'],servings:2,preparation_minutes:18,nutrition:{calories_kcal:260},source_type:'user',visibility:'public',owner_id:'community_fabio',owner_name:'Fabio'}
];

const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const norm = s => String(s || '').toLocaleLowerCase('it');
const slug = s => norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'') || 'utente';
const stored = JSON.parse(localStorage.getItem('recipes') || 'null');
let recipes = (stored || sample).map(r => ({...r,source_type:r.source_type || 'catalog',visibility:r.visibility || 'public',owner_id:r.owner_id || 'catalog',owner_name:r.owner_name || r.source?.author || 'Nutri Fabio Stabbio'}));
let profile = JSON.parse(localStorage.getItem('profile') || 'null') || {id:'utente_'+Date.now(),name:''};
let remoteRecipes = [];
recipes=recipes.filter(r=>r.id!=='community_demo');
let active = 'Tutte', view = 'home';
const cats = ['Tutte','Primo','Secondo','Pasto completo','Dolce','Altro'];

function persist(){ localStorage.setItem('recipes', JSON.stringify(recipes)); }
function cleanAuthor(value){
  const name = typeof value === 'string' ? value.trim() : '';
  return /^@?\d+$/.test(name) ? '' : name;
}
function recipeAuthor(r){ return cleanAuthor(r.author) || cleanAuthor(r.source?.author) || (r.source_type === 'user' ? r.owner_name : ''); }
function isMine(r){ return r.source_type === 'user' && r.owner_id === profile.id; }
function canSee(r){ return r.visibility === 'public' || isMine(r) || r.source_type === 'catalog'; }
function visibleRecipes(){
  const query = norm($('#q').value);
  return [...recipes,...remoteRecipes].filter(r => {
    if (!canSee(r)) return false;
    if (view === 'mine' && !isMine(r)) return false;
    if (view === 'community' && !(r.source_type === 'user' && r.visibility === 'public')) return false;
    if (view === 'home' && r.source_type === 'user' && !isMine(r)) return false;
    const categoryOk = active === 'Tutte' || (r.category || []).some(c => norm(c) === norm(active));
    const queryOk = !query || norm(r.title).includes(query) || (r.ingredients || []).some(i => norm(i.name).includes(query)) || (r.category || []).some(c => norm(c).includes(query));
    return categoryOk && queryOk;
  });
}

function render(){
  const list = visibleRecipes();
  $('#count').textContent = `${list.length} ricett${list.length === 1 ? 'a' : 'e'}`;
  $('#grid').innerHTML = list.length ? list.map(r => {
    const mine = isMine(r), privacy = mine ? `<span class="privacy ${r.visibility}">${r.visibility === 'private' ? '🔒 Privata' : '🌍 Pubblica'}</span>` : '';
    const name = recipeAuthor(r);
    const author = name ? `<div class="author">di ${esc(name)}</div>` : '';
    return `<article class="card" onclick="openRecipe('${esc(r.id)}')"><div class="photo" style="${r.image_data ? `background-image:url('${esc(r.image_data)}')` : ''}">${r.image_data ? '' : '🍽️'}</div><div class="body"><div class="cardTop"><span class="tag">${esc((r.category || ['ricetta'])[0])}</span>${privacy}</div><h3>${esc(r.title)}</h3>${author}<div class="meta">${esc(r.preparation_minutes || '—')} min · ${esc(r.servings || '—')} porzioni</div></div></article>`;
  }).join('') : `<div class="empty">${view === 'mine' ? '<strong>Il tuo ricettario è ancora vuoto.</strong><br>Crea la prima ricetta con il pulsante “＋ Ricetta”.' : 'Nessuna ricetta trovata.<br>Prova un altro ingrediente.'}</div>`;
}

function renderChips(){ $('#chips').innerHTML = cats.map(c => `<button class="chip ${c === active ? 'on' : ''}" onclick="active='${c}';renderChips();render()">${c}</button>`).join(''); }
function setView(next){
  if(next === 'community') queueMicrotask(()=>cloudRefresh());
  view = next; active = 'Tutte'; $('#q').value = '';
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
  const copy = {home:['Il tuo archivio','Cosa vuoi preparare?'],mine:[`Ricettario di ${profile.name}`,'Le mie ricette'],community:['RICETTE CONDIVISE','Dalla community']};
  $('#eyebrow').textContent = copy[view][0]; $('#viewTitle').textContent = copy[view][1]; renderChips(); render();
}

function openRecipe(id){
  const r = [...recipes,...remoteRecipes].find(x => x.id === id); if (!r || !canSee(r)) return;
  const n = r.nutrition || {}, mine = isMine(r);
  $('#detailBody').innerHTML = `<div class="detailPhoto" style="${r.image_data ? `background-image:url('${esc(r.image_data)}')` : ''}"></div><div class="detailContent"><div class="detailHead"><span class="tag">${esc((r.category || []).join(' · '))}</span>${mine ? `<span class="privacy ${r.visibility}">${r.visibility === 'private' ? '🔒 Privata' : '🌍 Pubblica'}</span>` : ''}</div><h2>${esc(r.title)}</h2>${recipeAuthor(r) ? `<p class="byline">Ricetta di <strong>${esc(recipeAuthor(r))}</strong></p>` : ''}<div class="meta">${esc(r.preparation_minutes || '—')} minuti · ${esc(r.servings || '—')} porzioni</div><h3>Valori nutrizionali</h3><div class="macro"><div><strong>${esc(n.calories_kcal ?? '—')}</strong>kcal</div><div><strong>${esc(n.protein_g ?? '—')} g</strong>proteine</div><div><strong>${esc(n.carbohydrates_g ?? '—')} g</strong>carbo</div><div><strong>${esc(n.fat_g ?? '—')} g</strong>grassi</div></div><h3>Ingredienti</h3><ul>${(r.ingredients || []).map(i => `<li>${esc(i.quantity ?? '')} ${esc(i.unit ?? '')} ${esc(i.name)}</li>`).join('')}</ul><h3>Procedimento</h3><ol>${(r.instructions || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>${mine ? `<div class="actions"><button onclick="detail.close();openEditor('${esc(r.id)}')">Modifica</button><button class="danger" onclick="deleteRecipe('${esc(r.id)}')">Elimina</button></div>` : ''}</div>`;
  $('#detail').showModal();
}

function parseIngredient(line){
  const match = line.trim().match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?\s+(.+)$/);
  return match ? {quantity:Number(match[1].replace(',','.')),unit:match[2] || '',name:match[3]} : {name:line.trim(),quantity:'',unit:''};
}
function openAddChoice(){ $('#addChoice').showModal(); }
let fetchedCaptionAuthor = null;
function openInstagramImporter(){
  fetchedCaptionAuthor = null;
  $('#addChoice').close();
  $('#igUrl').value = '';
  $('#igCaption').value = '';
  $('#igStatus').textContent = '';
  $('#igDialog').showModal();
}
function fetchIg(){
  const url = $('#igUrl').value.trim();
  if (!url) { $('#igStatus').textContent = 'Inserisci il link Instagram.'; return; }
  fetchedCaptionAuthor = null;
  $('#igFetch').disabled = true;
  $('#igStatus').textContent = 'Lettura della caption da Instagram…';
  if (window.Android && Android.fetchInstagramCaption) Android.fetchInstagramCaption(url);
  else { $('#igFetch').disabled = false; $('#igStatus').textContent = 'Disponibile nell’app Android.'; }
}
function captionResult(raw){
  $('#igFetch').disabled = false;
  const result = JSON.parse(raw);
  if (!$('#igDialog').open || result.url !== $('#igUrl').value.trim()) return;
  if (result.error) { $('#igStatus').textContent = result.error + '. Puoi incollare la caption manualmente.'; return; }
  const doc = new DOMParser().parseFromString(result.html, 'text/html');
  const node = doc.querySelector('.Caption');
  if (!node) { $('#igStatus').textContent = 'Instagram non ha restituito la caption. Incollala manualmente o prova il servizio web.'; return; }
  const username = node.querySelector('.CaptionUsername')?.textContent.trim().replace(/^@/, '');
  if (cleanAuthor(username) && /^[A-Za-z0-9._]{1,30}$/.test(username)) fetchedCaptionAuthor = '@' + username;
  node.querySelectorAll('.CaptionUsername,.CaptionComments,.CaptionCommentsExpand,script,style').forEach(x=>x.remove());
  node.querySelectorAll('br').forEach(x=>x.replaceWith(doc.createTextNode('\n')));
  const caption = node.textContent.trim();
  if (!caption) { $('#igStatus').textContent = 'Caption vuota.'; return; }
  $('#igCaption').value = caption;
  $('#igStatus').textContent = 'Caption recuperata! Controlla il testo e premi Analizza.';
}
let igAnalysisId = 0;
let igPending = null;
function parseIg(){
  if (igPending) return;
  const url = $('#igUrl').value.trim();
  const caption = $('#igCaption').value.trim();
  const lines = $('#igCaption').value.split(/\r?\n/).map(x=>x.replace(/#\S+/g,'').trim()).filter(Boolean);
  if (!lines.length && !url) { $('#igStatus').textContent = 'Inserisci il link Instagram o una caption.'; return; }
  const ingredients=[], steps=[];
  let section='', title=lines[0] || 'Ricetta da Instagram';
  for (const raw of lines.slice(1)){
    let line=raw.replace(/^[^\p{L}\p{N}]+/u,'').trim();
    if (!line) continue;
    const h=line.match(/^(ingredienti|ingredients|procedimento|preparazione|istruzioni|directions|steps|note|consigli)\b\s*[:–-]?\s*/i);
    if(h){section=/^(ingredienti|ingredients)$/i.test(h[1])?'i':/^(note|consigli)$/i.test(h[1])?'n':'s';line=line.slice(h[0].length).trim();}
    if(!line) continue;
    const action=/^(?:per (?:prima cosa|iniziare)\b|inizia\b|taglia\b|cuoci\b|versa\b|mescola\b|scalda\b|prepara\b|scola\b|unisci\b|aggiungi\b|metti\b|in una padella\b|porta a bollore\b|friggi\b|servi\b|tampona\b|asciuga\b|fai\b|prendi\b|passa\b|nel frattempo\b)/i;
    if(section!=='n' && action.test(line)){section='s';steps.push(line);}
    else if(section==='i') ingredients.push(line);
    else if(section==='s') steps.push(line);
    else if(!section && /^\d+(?:[.,/]\d+)?\s*(?:g|kg|ml|l|uova|cucchiai|cucchiaini)\b/i.test(line)) ingredients.push(line);
  }
  if(!steps.length){for(const line of lines.slice(1)){if(/\b(?:cuoci|versa|mescola|scalda|taglia|aggiungi|servi|padella|bollore)\b/i.test(line)&&!ingredients.includes(line))steps.push(line);}}
  const draft = {title, ingredients, steps, author: fetchedCaptionAuthor};
  if (url) {
    if (!window.Android?.analyzeInstagram) {
      $('#igStatus').textContent = 'Analisi video non disponibile. Puoi provare il servizio web.';
      return;
    }
    igPending = {id: ++igAnalysisId, draft, caption};
    $('#igAnalyze').disabled = true;
    $('#igFetch').disabled = true;
    $('#igStatus').textContent = ingredients.length && steps.length
      ? 'Sto cercando una foto nel Reel…'
      : 'Sto analizzando il Reel e cercando una foto…';
    Android.analyzeInstagram(url, caption, igPending.id);
    return;
  }
  showInstagramDraft(draft, caption);
}

function analysisResult(id, raw) {
  if (igPending?.id !== id) return;
  const {draft, caption} = igPending;
  igPending = null;
  $('#igAnalyze').disabled = false;
  $('#igFetch').disabled = false;
  if (!$('#igDialog').open) return;
  const {recipe, error} = JSON.parse(raw);
  if (recipe) {
    const captionComplete = draft.ingredients.length && draft.steps.length;
    const result = captionComplete ? {...draft, image_data: recipe.image_data} : recipe;
    showInstagramDraft({...result, author: cleanAuthor(recipe.author) || draft.author}, caption);
  } else if (draft.ingredients.length || draft.steps.length) {
    showInstagramDraft({...draft, notes: [error]}, caption);
  } else {
    $('#igStatus').textContent = error;
  }
}

function showInstagramDraft(recipe, caption) {
  $('#igDialog').close();
  openEditor();
  setEditorImage(recipe.image_data);
  $('#editTitle').value = recipe.title.slice(0,100);
  $('#editAuthor').value = cleanAuthor(recipe.author);
  $('#editIngredients').value = recipe.ingredients.join('\n');
  $('#editInstructions').value = recipe.steps.join('\n');
  if (recipe.servings != null) $('#editServings').value = recipe.servings;
  if (recipe.time_minutes != null) $('#editMinutes').value = recipe.time_minutes;
  if (recipe.calories_per_serving != null) $('#editCalories').value = recipe.calories_per_serving;
  const missing = [!recipe.ingredients.length && 'ingredienti', !recipe.steps.length && 'procedimento']
    .filter(Boolean).join(' e ');
  if (missing || recipe.notes?.length) {
    const note = document.createElement('div');
    note.id = 'importNote';
    note.textContent = [missing && ('Da completare: ' + missing + '.'), ...(recipe.notes || [])]
      .filter(Boolean).join(' ');
    if (caption) {
      const original = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Caption originale';
      original.append(summary, document.createTextNode(caption));
      note.append(original);
    }
    $('#editorTitle').after(note);
  }
}
let editorImage=null;
function openEditor(id=''){
  document.getElementById('importNote')?.remove();
  const r = id ? recipes.find(x => x.id === id && isMine(x)) : null;
  $('#recipeForm').reset(); setEditorImage(r?.image_data); $('#editId').value = r?.id || ''; $('#editorTitle').textContent = r ? 'Modifica ricetta' : 'Nuova ricetta';
  if (r) {
    $('#editAuthor').value = cleanAuthor(r.author) || cleanAuthor(r.source?.author);
    $('#editTitle').value = r.title || ''; $('#editCategory').value = (r.category || ['Altro'])[0].replace(/^./, c => c.toUpperCase()); $('#editMinutes').value = r.preparation_minutes || '';
    $('#editIngredients').value = (r.ingredients || []).map(i => [i.quantity,i.unit,i.name].filter(v => v !== '' && v != null).join(' ')).join('\n');
    $('#editInstructions').value = (r.instructions || []).join('\n'); $('#editServings').value = r.servings || ''; $('#editCalories').value = r.nutrition?.calories_kcal || '';
    document.querySelector(`input[name="visibility"][value="${r.visibility}"]`).checked = true;
  }
  $('#editor').showModal();
}

function saveRecipe(event){
  event.preventDefault(); const id = $('#editId').value || `user_${profile.id}_${Date.now()}`;
  const previous = recipes.find(r => r.id === id); if (previous && !isMine(previous)) return;
  const recipe = {image_data:previous?.image_data||null,id,title:$('#editTitle').value.trim(),author:cleanAuthor($('#editAuthor').value) || null,category:[$('#editCategory').value.toLowerCase()],ingredients:$('#editIngredients').value.split('\n').filter(x=>x.trim()).map(parseIngredient),instructions:$('#editInstructions').value.split('\n').filter(x=>x.trim()).map(x=>x.trim()),servings:Number($('#editServings').value) || null,preparation_minutes:Number($('#editMinutes').value) || null,nutrition:{...(previous?.nutrition || {}),calories_kcal:Number($('#editCalories').value) || null},source_type:'user',visibility:document.querySelector('input[name="visibility"]:checked').value,owner_id:profile.id,owner_name:profile.name,updated_at:new Date().toISOString()};
  recipe.image_data=editorImage; recipes = previous ? recipes.map(r => r.id === id ? recipe : r) : [recipe,...recipes]; persist(); $('#editor').close(); setView('mine'); cloudSync();
}
function deleteRecipe(id){
  const r = recipes.find(x => x.id === id); if (!r || !isMine(r) || !confirm(`Eliminare “${r.title}”?`)) return;
  cloudDelete(id); recipes = recipes.filter(x => x.id !== id); persist(); $('#detail').close(); render();
}
function openProfile(){ $('#profileName').value = profile.name; $('#profileDialog').showModal(); }
function saveProfile(event){ event.preventDefault(); const name = $('#profileName').value.trim(); if (!name) return; profile = {id:profile.id,name}; localStorage.setItem('profile',JSON.stringify(profile)); $('#profileDialog').close(); updateProfile(); setView('home'); cloudSync(); }
function updateProfile(){ $('#profileButton').innerHTML = `<span>${esc(profile.name.charAt(0).toUpperCase())}</span><small>${esc(profile.name)}</small>`; }

$('#igDialog').addEventListener('close', () => {
  if (!$('#igDialog').open && igPending) {
    igPending = null;
    $('#igAnalyze').disabled = false;
    $('#igFetch').disabled = false;
  }
});
window.NutriApp = {captionResult, analysisResult, importPackage(raw){
  try {
    const p = JSON.parse(raw), incoming = Array.isArray(p) ? p : (p.recipes || []), map = new Map(recipes.map(r => [r.id,r]));
    incoming.forEach(r => { const old = map.get(r.id); if (old?.source_type === 'user') return; map.set(r.id,{...r,source_type:'catalog',visibility:'public',owner_id:'catalog',owner_name:r.source?.author || 'Nutri Fabio Stabbio'}); });
    recipes = [...map.values()]; persist(); render(); alert(`${incoming.length} ricette importate`);
  } catch(e){ alert('Pacchetto non valido'); }
}};

$('#q').addEventListener('input',render); updateProfile(); setView('home');

if (!profile.name) { openProfile(); $('#profileDialog').addEventListener('cancel', e=>{if(!profile.name)e.preventDefault();}); }

function validImage(s){return typeof s==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s)&&s.length<350000?s:null;}
const cloudURL='https://bpshliyzwjpfmapfkhh.supabase.co';
const cloudKey='sb_publishable_bowOdZCPWKY9IMsqqrpZ7Q_IjddmzEL';
let cloudSession=JSON.parse(localStorage.getItem('cloudSession')||'null');
let cloudBusy=false;
let cloudAgain=false;
let pendingDeletes=JSON.parse(localStorage.getItem('pendingDeletes')||'[]');
const cloudStatus=document.createElement('button');
cloudStatus.textContent='Account e Community';
cloudStatus.style.cssText='display:block;margin:12px auto;padding:10px';
document.body.append(cloudStatus);
const cloudDialog=document.createElement('dialog');
cloudDialog.innerHTML='<form id="cloudForm"><h2>Account Community</h2><p id="cloudMessage"></p><label>Email<input id="cloudEmail" type="email" autocomplete="email" required></label><label>Password<input id="cloudPassword" type="password" autocomplete="current-password" minlength="6" required></label><button type="submit">Accedi</button><button type="button" id="cloudRegister">Registrati</button><button type="button" id="cloudLogout">Esci</button><button type="button" id="cloudClose">Chiudi</button></form>';
document.body.append(cloudDialog);
function cloudMessage(s){$('#cloudMessage').textContent=s;cloudStatus.textContent=s;}
async function cloudRequest(path,method='GET',body,auth=true,prefer=''){
 const headers={apikey:cloudKey,'Content-Type':'application/json'};
 if(auth&&cloudSession?.access_token)headers.Authorization='Bearer '+cloudSession.access_token;
 if(prefer)headers.Prefer=prefer;
 const res=await fetch(cloudURL+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const raw=await res.text();let data;try{data=JSON.parse(raw)}catch{data=raw}
 if(!res.ok)throw Error(data?.msg||data?.message||data?.error_description||'HTTP '+res.status);
 return data;
}
function cloudStore(s){cloudSession=s;localStorage.setItem('cloudSession',JSON.stringify(s));}
async function cloudToken(){if(!cloudSession)throw Error('Accedi alla Community');if((cloudSession.expires_at||0)<Date.now()/1000+60){cloudStore(await cloudRequest('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:cloudSession.refresh_token},false));}return cloudSession.user.id;}
async function cloudLogin(register){
 try{
 const email=$('#cloudEmail').value.trim(),password=$('#cloudPassword').value;
 if(!email||password.length<6)throw Error('Inserisci email e password di almeno 6 caratteri');
 const s=await cloudRequest(register?'/auth/v1/signup':'/auth/v1/token?grant_type=password','POST',{email,password},false);
 if(!s.access_token){cloudMessage('Controlla la email di conferma, poi accedi.');return;}
 const bound=localStorage.getItem('cloudOwner');
 if(bound&&bound!==s.user.id)throw Error('Questo ricettario è già associato a un altro account.');
 cloudStore(s);localStorage.setItem('cloudOwner',s.user.id);$('#cloudPassword').value='';cloudDialog.close();await cloudSync();
 }catch(e){cloudMessage(e.message);}
}
cloudStatus.onclick=()=>{cloudDialog.showModal();};
$('#cloudForm').onsubmit=e=>{e.preventDefault();cloudLogin(false);};
$('#cloudRegister').onclick=()=>cloudLogin(true);
$('#cloudClose').onclick=()=>cloudDialog.close();
$('#cloudLogout').onclick=()=>{cloudSession=null;localStorage.removeItem('cloudSession');remoteRecipes=[];cloudDialog.close();cloudMessage('Account e Community');render();};
async function cloudRefresh(){
 if(!cloudSession){cloudMessage('Accedi per vedere la Community');return;}
 try{const uid=await cloudToken();const rows=await cloudRequest('/rest/v1/recipes?select=*,profiles(display_name)&is_public=eq.true&owner_id=neq.'+uid);
 remoteRecipes=rows.map(r=>({...r.recipe_data,id:'remote_'+r.id,title:r.title,ingredients:r.ingredients,instructions:r.instructions,category:[r.category||'altro'],nutrition:r.nutrition,source_type:'user',visibility:'public',owner_id:r.owner_id,owner_name:r.profiles?.display_name||'Utente',image_data:validImage(r.recipe_data?.image_data)}));render();cloudMessage('Community aggiornata');
 }catch(e){cloudMessage('Community: '+e.message);}
}
async function cloudSync(){
 if(!cloudSession)return;if(cloudBusy){cloudAgain=true;return;}cloudBusy=true;
 try{const uid=await cloudToken();
 await cloudRequest('/rest/v1/profiles?on_conflict=id','POST',{id:uid,display_name:profile.name||'Utente'},true,'resolution=merge-duplicates');
 for(const id of [...pendingDeletes]){
 await cloudRequest('/rest/v1/recipes?owner_id=eq.'+uid+'&local_id=eq.'+encodeURIComponent(id),'DELETE');
 pendingDeletes=pendingDeletes.filter(x=>x!==id);localStorage.setItem('pendingDeletes',JSON.stringify(pendingDeletes));
 }
 const own=await cloudRequest('/rest/v1/recipes?select=*&owner_id=eq.'+uid);
 for(const row of own){
 if(pendingDeletes.includes(row.local_id))continue;
 const old=recipes.find(r=>r.id===row.local_id);
 if(!old||Date.parse(row.updated_at)>Date.parse(old.updated_at||0)){
 const restored={...row.recipe_data,image_data:validImage(row.recipe_data?.image_data),id:row.local_id,title:row.title,ingredients:row.ingredients,instructions:row.instructions,category:[row.category||'altro'],nutrition:row.nutrition,source_type:'user',visibility:row.is_public?'public':'private',owner_id:profile.id,owner_name:profile.name,updated_at:row.updated_at};
 recipes=recipes.filter(r=>r.id!==restored.id);recipes.push(restored);
 }}
 persist();render();
 const rows=recipes.filter(isMine).filter(r=>!own.some(o=>o.local_id===r.id&&Date.parse(o.updated_at)>=Date.parse(r.updated_at||0))).map(r=>({owner_id:uid,local_id:r.id,title:r.title,ingredients:r.ingredients||[],instructions:r.instructions||[],category:r.category?.[0],nutrition:r.nutrition,is_public:r.visibility==='public',recipe_data:{author:r.author,servings:r.servings,preparation_minutes:r.preparation_minutes,image_data:validImage(r.image_data)},updated_at:r.updated_at||new Date().toISOString()}));
 if(rows.length)await cloudRequest('/rest/v1/recipes?on_conflict=owner_id,local_id','POST',rows,true,'resolution=merge-duplicates');
 await cloudRefresh();
 }catch(e){cloudMessage('Sincronizzazione: '+e.message);}finally{cloudBusy=false;if(cloudAgain){cloudAgain=false;cloudSync();}}
}
async function cloudDelete(id){pendingDeletes.push(id);localStorage.setItem('pendingDeletes',JSON.stringify(pendingDeletes));queueMicrotask(cloudSync);}
window.addEventListener('online',cloudSync);
if(cloudSession)cloudSync();
window.addEventListener('focus',cloudSync);

const imageInput=document.createElement('input');
imageInput.type='file';imageInput.accept='image/*';
const imageLabel=document.createElement('label');imageLabel.textContent='Foto della ricetta';imageLabel.append(imageInput);
const imagePreview = document.createElement('img');
imagePreview.alt = 'Anteprima della foto della ricetta';
imagePreview.hidden = true;
imagePreview.style.maxWidth = '100%';
imagePreview.style.maxHeight = '240px';
const removeImage = document.createElement('button');
removeImage.type = 'button';
removeImage.textContent = 'Rimuovi foto';
removeImage.hidden = true;
removeImage.onclick = () => { imageInput.value = ''; setEditorImage(null); };
imageLabel.append(imagePreview, removeImage);
$('#recipeForm').prepend(imageLabel);
function setEditorImage(value) {
  editorImage = validImage(value);
  imagePreview.hidden = removeImage.hidden = !editorImage;
  if (editorImage) imagePreview.src = editorImage;
  else imagePreview.removeAttribute('src');
}
imageInput.onchange=async()=>{try{const file=imageInput.files[0];if(!file)return;const img=new Image();const url=URL.createObjectURL(file);try{img.src=url;await img.decode();const canvas=document.createElement('canvas');const scale=Math.min(1,640/Math.max(img.width,img.height));canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const photo=validImage(canvas.toDataURL('image/jpeg',0.65));if(!photo)throw Error('Foto troppo grande');setEditorImage(photo);}finally{URL.revokeObjectURL(url);}}catch(e){alert(e.message);}};

$('#igUrl').addEventListener('input', () => { fetchedCaptionAuthor = null; });
