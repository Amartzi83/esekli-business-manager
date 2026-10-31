const root = document.getElementById('visits-root');
if (root) {
  const STORAGE_KEY = 'esekli-garden-visits-v1';
  const DEFAULT_TASKS = ['כיסוח דשא', 'גיזום שיחים ועצים', 'בדיקת מערכת ההשקיה', 'ניקוי ערוגות וניכוש עשבים', 'פינוי גזם ופסולת', 'צילום מצב הגינה'];
  const sampleVisits = [
    { id:'garden-1', time:'08:00', name:'גינת השרון', client:'משפחת לוי · ביקור קבוע', address:'רמת השרון', treatment:'טיפול ואחזקה', duration:75, team:'נהוראי מרציאנו ושותף לעסק', icon:'🌿', notes:'לשים לב לטפטפת ליד עץ הלימון. לתאם עם הלקוח לפני הכניסה.', status:'planned', tasks:['כיסוח דשא','גיזום שיחים ועצים','בדיקת מערכת ההשקיה','ניקוי ערוגות וניכוש עשבים','פינוי גזם ופסולת','צילום מצב הגינה'].map((label,i)=>({id:`g1-${i}`,label,done:false})) },
    { id:'garden-2', time:'09:30', name:'בית הדקל', client:'ועד הבית · ביקור דו שבועי', address:'הרצליה', treatment:'גיזום עונתי', duration:60, team:'נהוראי מרציאנו ושותף לעסק', icon:'🌴', notes:'גיזום שיחי החזית ופינוי הגזם לפח הירוק.', status:'planned', tasks:['גיזום שיחי החזית','גיזום דקלים לפי הצורך','פינוי גזם','בדיקת טפטפות','צילום לפני ואחרי'].map((label,i)=>({id:`g2-${i}`,label,done:false})) },
    { id:'garden-3', time:'11:00', name:'גינת הדרים', client:'משפחת כהן · ביקור חודשי', address:'תל אביב', treatment:'בדיקת השקיה וטיפול', duration:50, team:'נהוראי מרציאנו ושותף לעסק', icon:'🍋', notes:'לבדוק לחץ מים ולהחליף טפטפות סתומות אם צריך.', status:'planned', tasks:['בדיקת מחשב השקיה','בדיקת טפטפות','ניקוי ערוגות','דישון עצי הדר','צילום מצב הגינה'].map((label,i)=>({id:`g3-${i}`,label,done:false})) },
    { id:'garden-4', time:'12:30', name:'חצר משפחת רז', client:'משפחת רז · ביקור שבועי', address:'רעננה', treatment:'ניקיון ותחזוקה', duration:45, team:'נהוראי מרציאנו ושותף לעסק', icon:'🌱', notes:'', status:'planned', tasks:['כיסוח דשא','ניכוש עשבים','ניקוי שביל','בדיקת השקיה','צילום מצב הגינה'].map((label,i)=>({id:`g4-${i}`,label,done:false})) },
    { id:'garden-5', time:'14:00', name:'גינת משפחת כהן', client:'משפחת כהן · ביקור קבוע', address:'כפר סבא', treatment:'טיפול ואחזקה', duration:60, team:'נהוראי מרציאנו ושותף לעסק', icon:'🌳', notes:'', status:'planned', tasks:['כיסוח דשא','גיזום שיחים','בדיקת השקיה','ניקוי ערוגות','פינוי פסולת','צילום מצב הגינה'].map((label,i)=>({id:`g5-${i}`,label,done:false})) },
    { id:'garden-6', time:'15:30', name:'חברת אזורים', client:'אחזקה שוטפת · ביקור שבועי', address:'פתח תקווה', treatment:'אחזקה וניקיון', duration:75, team:'נהוראי מרציאנו ושותף לעסק', icon:'🏡', notes:'לעדכן אם צריך השלמת דשן עונתי.', status:'planned', tasks:['ניקוי שבילים','גיזום שיחים','כיסוח דשא','בדיקת השקיה','פינוי עלים וגזם','צילום מצב הגינה'].map((label,i)=>({id:`g6-${i}`,label,done:false})) }
  ];
  let visits;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    visits = Array.isArray(stored) && stored.length ? stored : sampleVisits;
  } catch { visits = sampleVisits; }
  let currentView = 'list';
  let selectedVisitId = null;
  let toastTimer;

  const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(visits)); } catch { showToast('אין מספיק מקום לשמירת הנתונים במכשיר.'); } };
  const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const byId = id => visits.find(visit => visit.id === id);
  const sortVisits = () => [...visits].sort((a,b) => (a.time || '').localeCompare(b.time || ''));
  const dateLabel = new Intl.DateTimeFormat('he-IL', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(new Date());
  const durationText = minutes => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2,'0')}`;

  function showToast(message) {
    let toast = root.querySelector('.v-toast');
    if (!toast) { toast = document.createElement('div'); toast.className = 'v-toast'; toast.setAttribute('role','status'); root.append(toast); }
    toast.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.remove(), 3000);
  }

  function statusLabel(status) {
    if (status === 'inProgress') return ['בביקור','active'];
    if (status === 'completed') return ['הושלם','done'];
    return ['מתוכנן',''];
  }

  function heading() {
    return `<header class="v-heading"><div class="v-title-wrap"><span class="v-mark" aria-hidden="true">🌿</span><div><p class="v-eyebrow">תפעול צוות הגינון</p><h1>ביקורי גינות</h1><p>מסלול היום, טיפול ותחזוקה אצל הלקוחות</p></div></div><button class="v-button primary" data-action="new-visit"><span aria-hidden="true">＋</span> ביקור חדש</button></header>`;
  }

  function summary() {
    const done = visits.filter(visit => visit.status === 'completed').length;
    const active = visits.filter(visit => visit.status === 'inProgress').length;
    const hours = visits.reduce((sum,visit) => sum + (Number(visit.duration) || 0),0) / 60;
    const totalLabel = Number.isInteger(hours) ? hours : hours.toFixed(1);
    return `<div class="v-date-row"><div class="v-date-label"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>${safe(dateLabel)}</div><small>${active ? `${active} ביקור פעיל` : 'תוכנית העבודה של הצוות'}</small></div>
      <div class="v-stats" aria-label="סיכום ביקורים"><div class="v-stat"><span class="v-stat-icon">📍</span><span><small>ביקורים היום</small><b>${visits.length}</b></span></div><div class="v-stat"><span class="v-stat-icon">✓</span><span><small>ביקורים הושלמו</small><b>${done} / ${visits.length}</b></span></div><div class="v-stat"><span class="v-stat-icon">◷</span><span><small>שעות מתוכננות</small><b>${totalLabel}</b></span></div><div class="v-stat"><span class="v-stat-icon">🌱</span><span><small>עבודות גינון</small><b>${visits.length}</b></span></div></div>`;
  }

  function visitCard(visit, index) {
    const [label,kind] = statusLabel(visit.status);
    const numberKind = visit.status === 'completed' ? 'done' : visit.status === 'inProgress' ? 'active' : '';
    return `<article class="v-stop" role="button" tabindex="0" data-action="open-visit" data-id="${safe(visit.id)}" aria-label="פתיחת ביקור ${safe(visit.name)}"><div class="v-stop-time">${safe(visit.time || '—')}<small>${safe(visit.duration || 0)} דק׳</small></div><span class="v-stop-number ${numberKind}">${visit.status === 'completed' ? '✓' : index+1}</span><div class="v-stop-main"><span class="v-thumb" aria-hidden="true">${safe(visit.icon || '🌿')}</span><span class="v-stop-copy"><b>${safe(visit.treatment)} — ${safe(visit.name)}</b><span>${safe(visit.client)} · ${safe(visit.address)}</span><span>${safe(visit.team || 'נהוראי מרציאנו · שותף לעסק')}</span></span></div><span class="v-status ${kind}">${label}</span><span class="v-chevron" aria-hidden="true">‹</span></article>`;
  }

  function routeGraphic() {
    return `<div class="v-route-card"><div class="v-route-title"><span>מסלול הצוות להיום</span><span class="v-route-tag">${visits.length} תחנות</span></div><svg viewBox="0 0 700 210" aria-label="איור מסלול בין ביקורי הגינות" role="img"><path d="M74 151 C 116 130, 126 80, 213 87 S 307 159, 367 124 S 441 60, 502 81 S 578 158, 639 112" fill="none" stroke="#fff" stroke-width="15" stroke-linecap="round"/><path d="M74 151 C 116 130, 126 80, 213 87 S 307 159, 367 124 S 441 60, 502 81 S 578 158, 639 112" fill="none" stroke="#168858" stroke-width="7" stroke-linecap="round" stroke-dasharray="1 1"/>${visits.slice(0,6).map((visit,index)=>{const points=[[74,151],[143,86],[213,87],[367,124],[502,81],[639,112]][index]; return `<g><circle cx="${points[0]}" cy="${points[1]}" r="17" fill="#20c96b" stroke="#fff" stroke-width="5"/><text x="${points[0]}" y="${points[1]+5}" text-anchor="middle" font-size="13" font-weight="700" fill="#073719">${index+1}</text></g>`}).join('')}</svg><div class="v-route-foot">סדר הביקורים לפי הלו״ז שהוגדר</div></div>`;
  }

  function listScreen() {
    const sorted = sortVisits();
    return `${heading()}${summary()}<div class="v-toolbar"><div class="v-tabs" role="tablist" aria-label="תצוגת ביקורים"><button type="button" class="${currentView === 'list' ? 'selected' : ''}" role="tab" aria-selected="${currentView === 'list'}" data-action="view-list">קווי עבודה</button><button type="button" class="${currentView === 'route' ? 'selected' : ''}" role="tab" aria-selected="${currentView === 'route'}" data-action="view-route">מסלול היום</button></div><span class="v-count">אפשר לפתוח ביקור כדי לעדכן את הטיפול</span></div>${currentView === 'route' ? routeGraphic() : ''}<div class="v-list">${sorted.length ? sorted.map(visitCard).join('') : '<div class="v-empty">אין עדיין ביקורים ליום הזה. אפשר להוסיף ביקור חדש.</div>'}</div><p class="v-notes">נתוני הדוגמה והעדכונים נשמרים בדפדפן במכשיר הזה. תמונות נשמרות באחסון המקומי של המכשיר.</p>`;
  }

  function detailScreen(visit) {
    const doneCount = visit.tasks.filter(task => task.done).length;
    const progress = visit.tasks.length ? Math.round(doneCount / visit.tasks.length * 100) : 0;
    const [status] = statusLabel(visit.status);
    const starting = visit.status === 'inProgress';
    const completed = visit.status === 'completed';
    return `<div class="v-detail-top"><button class="v-button ghost" data-action="back">→ חזרה למסלול</button><h1>פרטי ביקור</h1><button class="v-button ghost" data-action="edit-note">⋯</button></div>
      <section class="v-hero"><div class="v-hero-content"><div class="v-hero-top"><span class="v-live">${safe(status)}</span><span>${safe(visit.time)} · ${safe(visit.duration)} דקות</span></div><h2>${safe(visit.name)}</h2><p>${safe(visit.client)} · ${safe(visit.treatment)}</p></div></section>
      <div class="v-action-row"><button class="v-action" data-action="contact"><span>☎</span><span>שיחה</span></button><button class="v-action" data-action="whatsapp"><span>◉</span><span>WhatsApp</span></button><button class="v-action" data-action="navigate"><span>⌖</span><span>ניווט</span></button></div>
      <div class="v-detail-tabs"><span class="selected">פרטי ביקור</span><span>משימות (${visit.tasks.length})</span><span>תמונות</span><span>היסטוריה</span></div>
      <div class="v-detail-grid"><div class="v-panel"><div class="v-panel-head"><h3>פרטי הביקור</h3><small>${safe(visit.team || 'נהוראי מרציאנו · שותף לעסק')}</small></div><div class="v-info-grid"><div class="v-info"><span class="v-info-icon">⌖</span><span><small>כתובת</small><b>${safe(visit.address)}</b></span></div><div class="v-info"><span class="v-info-icon">▦</span><span><small>תאריך</small><b>${safe(new Intl.DateTimeFormat('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date()))}</b></span></div><div class="v-info"><span class="v-info-icon">◷</span><span><small>זמן מתוכנן</small><b>${safe(visit.duration)} דקות</b></span></div></div></div>
      <section class="v-panel"><div class="v-panel-head"><h3>רשימת טיפול</h3><small>${doneCount}/${visit.tasks.length} בוצעו</small></div><div class="v-progress-wrap"><div class="v-progress-top"><span>התקדמות הטיפול</span><small>${progress}%</small></div><div class="v-progress"><i style="width:${progress}%"></i></div></div><div class="v-checklist">${visit.tasks.map(task=>`<label class="v-check ${task.done?'checked':''}"><input type="checkbox" ${task.done?'checked':''} data-action="toggle-task" data-visit-id="${safe(visit.id)}" data-task-id="${safe(task.id)}"><span>${safe(task.label)}</span><button type="button" class="v-photo-quick" data-action="photos-hint" aria-label="הוסף צילום" title="צילום לאחר ביצוע">📷</button></label>`).join('')}</div></section>
      <section class="v-panel"><div class="v-panel-head"><h3>תמונות מהביקור</h3><small>תיעוד מצב הגינה</small></div><div class="v-photo-grid" data-photo-grid><button type="button" class="v-add-photo" data-action="add-photo"><b>＋</b><span>הוסף תמונות</span></button></div></section>
      <div class="v-notes"><b>הערות לצוות</b><br>${safe(visit.notes || 'לא נוספו הערות לביקור הזה.')}</div></div>
      <div class="v-bottom-actions">${completed ? '<button class="v-button" data-action="reopen">↻ פתיחת ביקור מחדש</button><button class="v-button primary" data-action="back">חזרה למסלול</button>' : `<button class="v-button" data-action="back">שמור ויציאה</button><button class="v-button primary" data-action="${starting?'finish':'start'}">${starting?'✓ סיום ביקור':'▶ התחלת ביקור'}</button>`}</div>
      <input type="file" accept="image/*" capture="environment" multiple hidden data-photo-input>`;
  }

  function render() {
    const visit = selectedVisitId && byId(selectedVisitId);
    root.innerHTML = `<div class="v-page">${visit ? detailScreen(visit) : listScreen()}<dialog class="v-dialog" data-visit-dialog><form method="dialog" data-visit-form><h2>ביקור גינה חדש</h2><label class="v-field">שם הגינה / האתר<input name="name" maxlength="70" placeholder="למשל: גינת משפחת לוי" required></label><label class="v-field">לקוח או איש קשר<input name="client" maxlength="70" placeholder="שם הלקוח" required></label><label class="v-field">כתובת<input name="address" maxlength="100" placeholder="עיר ורחוב" required></label><div class="v-form-row"><label class="v-field">שעת ביקור<input name="time" type="time" value="${new Date().toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit',hour12:false})}" required></label><label class="v-field">זמן מתוכנן (דקות)<input name="duration" type="number" min="15" max="600" value="60" required></label></div><label class="v-field">סוג טיפול<select name="treatment"><option>טיפול ואחזקה</option><option>גיזום עונתי</option><option>כיסוח דשא</option><option>בדיקת השקיה וטיפול</option><option>ניקיון גינה</option><option>שתילה ודישון</option></select></label><label class="v-field">הערה לצוות<textarea name="notes" maxlength="300" placeholder="דגשים לביקור"></textarea></label><div class="v-dialog-actions"><button class="v-button primary" type="submit">הוספת ביקור</button><button class="v-button" type="button" data-action="close-dialog">ביטול</button></div></form></dialog></div>`;
    if (visit) loadPhotos(visit.id);
  }

  let dbPromise;
  function getPhotoDb() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('אחסון תמונות לא זמין'));
    if (!dbPromise) dbPromise = new Promise((resolve,reject) => {
      const request = indexedDB.open('esekli-garden-photos',1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('photos')) request.result.createObjectStore('photos',{keyPath:'id'}); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }
  async function photoOperation(mode,value) {
    const db = await getPhotoDb();
    return new Promise((resolve,reject) => {
      const tx = db.transaction('photos','readwrite');
      const store = tx.objectStore('photos');
      const req = mode === 'getAll' ? store.getAll() : mode === 'put' ? store.put(value) : store.delete(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function loadPhotos(visitId) {
    try {
      const all = await photoOperation('getAll');
      const images = all.filter(photo=>photo.visitId===visitId);
      const grid = root.querySelector('[data-photo-grid]');
      if (!grid || selectedVisitId !== visitId) return;
      grid.innerHTML = `${images.map(photo=>`<div class="v-photo"><img src="${photo.data}" alt="תמונה מהביקור"><button type="button" data-action="delete-photo" data-id="${safe(photo.id)}" aria-label="מחיקת תמונה">×</button></div>`).join('')}<button type="button" class="v-add-photo" data-action="add-photo"><b>＋</b><span>הוסף תמונות</span></button>`;
    } catch { showToast('אחסון התמונות אינו זמין בדפדפן הזה.'); }
  }
  function resizeImage(file) {
    return new Promise((resolve,reject) => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1,1400/Math.max(image.width,image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width*scale); canvas.height = Math.round(image.height*scale);
        canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',.78));
        URL.revokeObjectURL(image.src);
      };
      image.onerror = reject;
      image.src = URL.createObjectURL(file);
    });
  }
  root.addEventListener('change', async event => {
    const target = event.target;
    if (target.matches('[data-action="toggle-task"]')) {
      const visit = byId(target.dataset.visitId);
      const task = visit?.tasks.find(item=>item.id===target.dataset.taskId);
      if (task) { task.done = target.checked; save(); render(); }
    }
    if (target.matches('[data-photo-input]')) {
      const visit = byId(selectedVisitId);
      if (!visit) return;
      const fileCount = target.files?.length || 0;
      for (const file of target.files || []) {
        if (!file.type.startsWith('image/')) continue;
        try { await photoOperation('put',{id:`${visit.id}-${crypto.randomUUID?.() || Date.now()}`,visitId:visit.id,data:await resizeImage(file),createdAt:Date.now()}); }
        catch { showToast('לא ניתן לשמור את התמונה במכשיר.'); break; }
      }
      target.value = '';
      await loadPhotos(visit.id);
      if (fileCount) showToast('התמונות נוספו לביקור.');
    }
  });
  root.addEventListener('click', async event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const visit = byId(selectedVisitId);
    if (action === 'new-visit') { root.querySelector('[data-visit-dialog]').showModal(); return; }
    if (action === 'close-dialog') { root.querySelector('[data-visit-dialog]').close(); return; }
    if (action === 'view-list' || action === 'view-route') { currentView = action === 'view-list' ? 'list' : 'route'; render(); return; }
    if (action === 'open-visit') { selectedVisitId = target.dataset.id; render(); return; }
    if (action === 'back') { selectedVisitId = null; render(); return; }
    if (action === 'start' && visit) { visit.status = 'inProgress'; visit.startedAt = new Date().toISOString(); save(); render(); showToast('הביקור התחיל. אפשר לסמן את משימות הטיפול.'); return; }
    if (action === 'finish' && visit) { visit.status = 'completed'; visit.finishedAt = new Date().toISOString(); save(); render(); showToast('הביקור נשמר כהושלם.'); return; }
    if (action === 'reopen' && visit) { visit.status = 'planned'; delete visit.finishedAt; save(); render(); return; }
    if (action === 'add-photo') { root.querySelector('[data-photo-input]')?.click(); return; }
    if (action === 'delete-photo') { try { await photoOperation('delete',target.dataset.id); await loadPhotos(selectedVisitId); } catch { showToast('לא ניתן למחוק את התמונה.'); } return; }
    if (action === 'photos-hint') { event.preventDefault(); root.querySelector('[data-photo-input]')?.click(); return; }
    if (action === 'navigate' && visit) { window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(visit.address)}`,'_blank','noopener,noreferrer'); return; }
    if (action === 'contact' || action === 'whatsapp') { showToast('בנתוני הדוגמה עדיין אין מספר טלפון של הלקוח.'); return; }
    if (action === 'edit-note' && visit) {
      const note = window.prompt('הערה לצוות לקראת הביקור:',visit.notes || '');
      if (note !== null) { visit.notes = note.trim(); save(); render(); }
    }
  });
  root.addEventListener('keydown', event => {
    const card = event.target.closest('.v-stop[role="button"]');
    if (card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectedVisitId = card.dataset.id; render(); }
  });
  root.addEventListener('submit', event => {
    if (!event.target.matches('[data-visit-form]')) return;
    event.preventDefault();
    const form = event.target;
    const values = new FormData(form);
    const id = `visit-${Date.now()}`;
    const treatment = String(values.get('treatment') || 'טיפול ואחזקה');
    visits.push({ id,time:String(values.get('time')),name:String(values.get('name')).trim(),client:String(values.get('client')).trim(),address:String(values.get('address')).trim(),treatment,duration:Number(values.get('duration'))||60,team:'נהוראי מרציאנו ושותף לעסק',icon:'🌿',notes:String(values.get('notes')||'').trim(),status:'planned',tasks:DEFAULT_TASKS.map((label,index)=>({id:`${id}-${index}`,label,done:false})) });
    save(); selectedVisitId = null; render(); showToast('הביקור נוסף לתוכנית העבודה.');
  });
  save();
  render();
}
