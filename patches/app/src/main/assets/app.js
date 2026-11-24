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
let profile = JSON.parse(localStorage.getItem('profile') || 'null') || {id:'utente_giovanni',name:'Giovanni'};
let active = 'Tutte', view = 'home';
const cats = ['Tutte','Primo','Secondo','Pasto completo','Dolce','Altro'];

function persist(){ localStorage.setItem('recipes', JSON.stringify(recipes)); }
function isMine(r){ return r.source_type === 'user' && r.owner_id === profile.id; }
function canSee(r){ return r.visibility === 'public' || isMine(r) || r.source_type === 'catalog'; }
function visibleRecipes(){
  const query = norm($('#q').value);
  return recipes.filter(r => {
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
    const author = r.source_type === 'user' ? `<div class="author">di ${esc(r.owner_name)}</div>` : '';
    return `<article class="card" onclick="openRecipe('${esc(r.id)}')"><div class="photo" style="${r.image_data ? `background-image:url('${esc(r.image_data)}')` : ''}">${r.image_data ? '' : '🍽️'}</div><div class="body"><div class="cardTop"><span class="tag">${esc((r.category || ['ricetta'])[0])}</span>${privacy}</div><h3>${esc(r.title)}</h3>${author}<div class="meta">${esc(r.preparation_minutes || '—')} min · ${esc(r.servings || '—')} porzioni</div></div></article>`;
  }).join('') : `<div class="empty">${view === 'mine' ? '<strong>Il tuo ricettario è ancora vuoto.</strong><br>Crea la prima ricetta con il pulsante “＋ Ricetta”.' : 'Nessuna ricetta trovata.<br>Prova un altro ingrediente.'}</div>`;
}

function renderChips(){ $('#chips').innerHTML = cats.map(c => `<button class="chip ${c === active ? 'on' : ''}" onclick="active='${c}';renderChips();render()">${c}</button>`).join(''); }
function setView(next){
  view = next; active = 'Tutte'; $('#q').value = '';
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
  const copy = {home:['Il tuo archivio','Cosa vuoi preparare?'],mine:[`Ricettario di ${profile.name}`,'Le mie ricette'],community:['RICETTE CONDIVISE','Dalla community']};
  $('#eyebrow').textContent = copy[view][0]; $('#viewTitle').textContent = copy[view][1]; renderChips(); render();
}

function openRecipe(id){
  const r = recipes.find(x => x.id === id); if (!r || !canSee(r)) return;
  const n = r.nutrition || {}, mine = isMine(r);
  $('#detailBody').innerHTML = `<div class="detailPhoto" style="${r.image_data ? `background-image:url('${esc(r.image_data)}')` : ''}"></div><div class="detailContent"><div class="detailHead"><span class="tag">${esc((r.category || []).join(' · '))}</span>${mine ? `<span class="privacy ${r.visibility}">${r.visibility === 'private' ? '🔒 Privata' : '🌍 Pubblica'}</span>` : ''}</div><h2>${esc(r.title)}</h2>${r.source_type === 'user' ? `<p class="byline">Ricetta di <strong>${esc(r.owner_name)}</strong></p>` : ''}<div class="meta">${esc(r.preparation_minutes || '—')} minuti · ${esc(r.servings || '—')} porzioni</div><h3>Valori nutrizionali</h3><div class="macro"><div><strong>${esc(n.calories_kcal ?? '—')}</strong>kcal</div><div><strong>${esc(n.protein_g ?? '—')} g</strong>proteine</div><div><strong>${esc(n.carbohydrates_g ?? '—')} g</strong>carbo</div><div><strong>${esc(n.fat_g ?? '—')} g</strong>grassi</div></div><h3>Ingredienti</h3><ul>${(r.ingredients || []).map(i => `<li>${esc(i.quantity ?? '')} ${esc(i.unit ?? '')} ${esc(i.name)}</li>`).join('')}</ul><h3>Procedimento</h3><ol>${(r.instructions || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>${mine ? `<div class="actions"><button onclick="detail.close();openEditor('${esc(r.id)}')">Modifica</button><button class="danger" onclick="deleteRecipe('${esc(r.id)}')">Elimina</button></div>` : ''}</div>`;
  $('#detail').showModal();
}

function parseIngredient(line){
  const match = line.trim().match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?\s+(.+)$/);
  return match ? {quantity:Number(match[1].replace(',','.')),unit:match[2] || '',name:match[3]} : {name:line.trim(),quantity:'',unit:''};
}
function openAddChoice(){ $('#addChoice').showModal(); }
function openInstagramImporter(){
  $('#addChoice').close();
  const page = 'https://giolanni.github.io/NutriFaBioStaBBio-download/analizza.html';
  if (window.Android && typeof Android.openInstagramImporter === 'function') {
    Android.openInstagramImporter();
  } else {
    window.location.href = page;
  }
}
function openEditor(id=''){
  const r = id ? recipes.find(x => x.id === id && isMine(x)) : null;
  $('#recipeForm').reset(); $('#editId').value = r?.id || ''; $('#editorTitle').textContent = r ? 'Modifica ricetta' : 'Nuova ricetta';
  if (r) {
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
  const recipe = {id,title:$('#editTitle').value.trim(),category:[$('#editCategory').value.toLowerCase()],ingredients:$('#editIngredients').value.split('\n').filter(x=>x.trim()).map(parseIngredient),instructions:$('#editInstructions').value.split('\n').filter(x=>x.trim()).map(x=>x.trim()),servings:Number($('#editServings').value) || null,preparation_minutes:Number($('#editMinutes').value) || null,nutrition:{...(previous?.nutrition || {}),calories_kcal:Number($('#editCalories').value) || null},source_type:'user',visibility:document.querySelector('input[name="visibility"]:checked').value,owner_id:profile.id,owner_name:profile.name,updated_at:new Date().toISOString()};
  recipes = previous ? recipes.map(r => r.id === id ? recipe : r) : [recipe,...recipes]; persist(); $('#editor').close(); setView('mine');
}
function deleteRecipe(id){
  const r = recipes.find(x => x.id === id); if (!r || !isMine(r) || !confirm(`Eliminare “${r.title}”?`)) return;
  recipes = recipes.filter(x => x.id !== id); persist(); $('#detail').close(); render();
}
function openProfile(){ $('#profileName').value = profile.name; $('#profileDialog').showModal(); }
function saveProfile(event){ event.preventDefault(); const name = $('#profileName').value.trim(); if (!name) return; profile = {id:`utente_${slug(name)}`,name}; localStorage.setItem('profile',JSON.stringify(profile)); $('#profileDialog').close(); updateProfile(); setView('home'); }
function updateProfile(){ $('#profileButton').innerHTML = `<span>${esc(profile.name.charAt(0).toUpperCase())}</span><small>${esc(profile.name)}</small>`; }

window.NutriApp = {importPackage(raw){
  try {
    const p = JSON.parse(raw), incoming = Array.isArray(p) ? p : (p.recipes || []), map = new Map(recipes.map(r => [r.id,r]));
    incoming.forEach(r => { const old = map.get(r.id); if (old?.source_type === 'user') return; map.set(r.id,{...r,source_type:'catalog',visibility:'public',owner_id:'catalog',owner_name:r.source?.author || 'Nutri Fabio Stabbio'}); });
    recipes = [...map.values()]; persist(); render(); alert(`${incoming.length} ricette importate`);
  } catch(e){ alert('Pacchetto non valido'); }
}};

$('#q').addEventListener('input',render); updateProfile(); setView('home');
