const root = document.getElementById('history-root');
const store = window.esekliStore;
if (root && store) {
  const PAGE = 30;
  const KIND_LABELS = { auto:'אוטומטי', manual:'ידני', 'pre-restore':'לפני שחזור' };
  const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const toast = message => (window.showToast ? window.showToast(message) : console.info(message));
  const fullTime = at => new Intl.DateTimeFormat('he-IL', { weekday:'short', day:'numeric', month:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(at));
  const clockTime = at => new Intl.DateTimeFormat('he-IL', { hour:'2-digit', minute:'2-digit' }).format(new Date(at));
  const dayTitle = at => new Intl.DateTimeFormat('he-IL', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(new Date(at));
  const relative = new Intl.RelativeTimeFormat('he', { numeric:'auto' });
  function ago(at) {
    if (!at) return 'עדיין לא';
    const minutes = Math.round((Date.now() - at) / 60000);
    if (minutes < 1) return 'עכשיו';
    if (minutes < 60) return relative.format(-minutes, 'minute');
    if (minutes < 1440) return relative.format(-Math.round(minutes / 60), 'hour');
    return relative.format(-Math.round(minutes / 1440), 'day');
  }
  const kb = size => size > 1048576 ? `${(size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
  const listCollections = store.COLLECTIONS.filter(collection => collection.kind === 'list');
  const countOf = (key, raw) => { const value = store.parse(key, raw); return Array.isArray(value) ? value.length : null; };

  const state = { filter:'', changes:[], more:false, backups:[], trash:[], counts:{ changes:0, trash:0 }, photos:false };

  async function load() {
    await store.ready;
    const [changes, backups, trash, counts] = await Promise.all([
      store.listChanges({ key:state.filter || null, limit:PAGE + 1 }), store.listBackups(), store.listTrash(), store.counts()
    ]);
    Object.assign(state, { changes:changes.slice(0, PAGE), more:changes.length > PAGE, backups, trash, counts });
    render();
  }
  async function loadMore() {
    const next = await store.listChanges({ key:state.filter || null, limit:PAGE + 1, offset:state.changes.length });
    state.changes.push(...next.slice(0, PAGE));
    state.more = next.length > PAGE;
    render();
  }

  function changeRows() {
    if (!state.changes.length) return '<div class="v-empty">עדיין אין שינויים מתועדים.</div>';
    let currentDay = '';
    return state.changes.map(change => {
      const collection = store.collection(change.key);
      const day = new Date(change.at).toDateString();
      const header = day !== currentDay ? `<div class="h-day">${safe(dayTitle(change.at))}</div>` : '';
      currentDay = day;
      return `${header}<div class="h-row"><span class="h-time">${clockTime(change.at)}</span><span class="h-chip ${safe(collection?.id)}">${safe(collection?.label || change.key)}</span><span class="h-text">${change.reason ? `<b>${safe(change.reason)}</b> · ` : ''}${safe(store.summaryText(change.summary))}</span><span class="h-actions"><button type="button" class="h-link" data-action="view-change" data-id="${safe(change.id)}">צפייה</button><button type="button" class="h-link" data-action="restore-change" data-id="${safe(change.id)}">שחזור</button></span></div>`;
    }).join('');
  }
  function backupRows() {
    if (!state.backups.length) return '<div class="v-empty">עדיין אין גיבויים. הגיבוי האוטומטי הראשון ייווצר בדקות הקרובות.</div>';
    return state.backups.map(backup => {
      const parts = listCollections.map(collection => {
        const count = countOf(collection.key, backup.collections[collection.key]);
        return count == null ? '' : `${count} ${collection.label}`;
      }).filter(Boolean).join(' · ');
      return `<div class="h-row h-backup"><span class="h-time">${safe(fullTime(backup.at))}</span><span class="h-chip kind-${safe(backup.kind)}">${safe(KIND_LABELS[backup.kind] || backup.kind)}</span><span class="h-text">${backup.note ? `<b>${safe(backup.note)}</b> · ` : ''}${safe(parts)} · ${kb(backup.size)}</span><span class="h-actions"><button type="button" class="h-link" data-action="view-backup" data-id="${safe(backup.id)}">צפייה</button><button type="button" class="h-link" data-action="restore-backup" data-id="${safe(backup.id)}">שחזור הכל</button><button type="button" class="h-link" data-action="download-backup" data-id="${safe(backup.id)}">הורדה</button></span></div>`;
    }).join('');
  }
  function trashGrid() {
    if (!state.trash.length) return '<p class="h-muted">אין תמונות שנמחקו ב־30 הימים האחרונים.</p>';
    const visits = store.read('esekli-garden-visits-v2') || [];
    const customers = store.read('esekli-customers-v1') || [];
    return `<div class="h-trash">${state.trash.map(photo => `<figure><img src="${photo.data}" alt="תמונה שנמחקה"><figcaption>${safe(visits.find(visit => visit.id === photo.visitId)?.name || customers.find(customer => `customer:${customer.id}` === photo.visitId)?.name || 'ביקור')}<small>נמחקה ${safe(ago(photo.deletedAt))}</small></figcaption><button type="button" class="v-button" data-action="restore-photo" data-id="${safe(photo.id)}">שחזור</button></figure>`).join('')}</div>`;
  }

  function render() {
    const lastAuto = state.backups.find(backup => backup.kind === 'auto');
    const lastExport = Number(localStorage.getItem(store.LAST_EXPORT_KEY)) || 0;
    const exportOld = !lastExport || Date.now() - lastExport > 7 * 86400000;
    const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16);
    const tabs = [['', 'הכל'], ...store.COLLECTIONS.map(collection => [collection.key, collection.label])];
    root.innerHTML = `<div class="v-page h-page">
      <header class="v-heading"><div class="v-title-wrap"><span class="v-mark h-mark" aria-hidden="true">↺</span><div><p class="v-eyebrow">שמירה, גיבוי ושחזור</p><h1>היסטוריה וגיבויים</h1><p>כל שינוי נשמר עם שעה. אפשר לשלוף ולשחזר כל חלק לכל נקודה בזמן.</p></div></div><button class="v-button primary" type="button" data-action="backup-now">גיבוי עכשיו</button></header>
      <div class="v-stats"><div class="v-stat"><span class="v-stat-icon">↺</span><span><small>גיבוי אוטומטי אחרון</small><b>${safe(ago(lastAuto?.at))}</b></span></div><div class="v-stat"><span class="v-stat-icon">▤</span><span><small>גיבויים שמורים</small><b>${state.backups.length}</b></span></div><div class="v-stat"><span class="v-stat-icon">✎</span><span><small>שינויים מתועדים</small><b>${state.counts.changes}</b></span></div><div class="v-stat"><span class="v-stat-icon ${exportOld ? 'h-warn' : ''}">⇩</span><span><small>קובץ גיבוי אחרון</small><b>${safe(ago(lastExport))}</b></span></div></div>
      <section class="h-panel h-file ${exportOld ? 'warn' : ''}"><div><h2>קובץ גיבוי</h2><p>${exportOld ? 'הגיבויים נשמרים בדפדפן של המכשיר הזה. כדאי להוריד קובץ גיבוי לפחות פעם בשבוע ולשמור אותו במחשב או ב־Drive, למקרה שהמכשיר יאבד או שהדפדפן יימחק.' : 'הקובץ מכיל את כל הנתונים של האפליקציה. אפשר לטעון אותו בכל מכשיר כדי להחזיר את המצב.'}</p></div>
        <div class="h-file-actions"><label class="h-check"><input type="checkbox" data-action="toggle-photos" ${state.photos ? 'checked' : ''}> כולל תמונות</label><button type="button" class="v-button primary" data-action="export">הורדת קובץ גיבוי</button><button type="button" class="v-button" data-action="import">טעינת קובץ גיבוי</button><input type="file" accept="application/json,.json" hidden data-import-input></div></section>
      <section class="h-panel"><h2>שליפת מידע לפי תאריך ושעה</h2><p class="h-muted">בחרו חלק באפליקציה ונקודת זמן כדי לראות בדיוק מה היה שמור אז, ולשחזר פריט אחד או את הכל.</p>
        <form class="h-lookup" data-lookup><label class="v-field">חלק באפליקציה<select name="key">${store.COLLECTIONS.map(collection => `<option value="${safe(collection.key)}">${safe(collection.label)}</option>`).join('')}</select></label><label class="v-field">תאריך ושעה<input name="time" type="datetime-local" value="${now}" max="${now}" required></label><button class="v-button primary" type="submit">הצגת המצב</button></form></section>
      <section class="h-panel"><div class="h-panel-head"><h2>שינויים אחרונים</h2></div><div class="v-tabs h-tabs" role="tablist">${tabs.map(([key,label]) => `<button type="button" role="tab" class="${state.filter === key ? 'selected' : ''}" aria-selected="${state.filter === key}" data-action="filter" data-key="${safe(key)}">${safe(label)}</button>`).join('')}</div><div class="h-list">${changeRows()}</div>${state.more ? '<button type="button" class="v-button h-more" data-action="more">טעינת שינויים קודמים</button>' : ''}</section>
      <section class="h-panel"><div class="h-panel-head"><h2>גיבויים</h2><small>גיבוי אוטומטי כל שעה כשיש שינוי · נשמרים 48 שעות ואז גיבוי אחד ליום למשך 60 יום</small></div><div class="h-list">${backupRows()}</div></section>
      <section class="h-panel"><div class="h-panel-head"><h2>תמונות שנמחקו</h2><small>נשמרות 30 יום</small></div>${trashGrid()}</section>
    </div>`;
  }

  // Viewer: shows a saved state of one collection, compared with the current data.
  const dialog = document.createElement('dialog');
  dialog.className = 'v-dialog h-viewer';
  document.body.append(dialog);
  let viewer = null;

  function openViewer({ key, raw, at, source }) {
    viewer = { key, raw, at, source, query:'', open:new Set() };
    renderViewer();
    if (!dialog.open) dialog.showModal();
  }
  function renderViewer() {
    const { key, raw, at, source } = viewer;
    const collection = store.collection(key);
    const value = store.parse(key, raw);
    const head = `<div class="h-viewer-head"><div><p class="v-eyebrow">${safe(source)}</p><h2>${safe(collection.label)} · ${safe(fullTime(at))}</h2></div><button type="button" class="v-button" data-close>סגירה</button></div>`;
    let body;
    if (collection.kind !== 'list') {
      const current = store.read(key);
      const same = JSON.stringify(current) === JSON.stringify(value);
      body = `<div class="h-item"><div><b>${safe(collection.title(value))}</b><small>${safe(collection.meta(value).filter(Boolean).join(' · '))}</small></div><span class="h-badge ${same ? 'same' : 'changed'}">${same ? 'זהה למצב הנוכחי' : 'שונה מהמצב הנוכחי'}</span></div>`;
    } else {
      const items = Array.isArray(value) ? value : [];
      const current = store.read(key) || [];
      const currentMap = new Map(current.map(item => [item.id, item]));
      const thenIds = new Set(items.map(item => item.id));
      const addedSince = current.filter(item => !thenIds.has(item.id)).length;
      const query = viewer.query.trim().toLocaleLowerCase('he');
      const shown = items.filter(item => !query || `${collection.title(item)} ${collection.meta(item).join(' ')}`.toLocaleLowerCase('he').includes(query));
      body = `<div class="h-viewer-tools"><input type="search" data-viewer-search value="${safe(viewer.query)}" placeholder="חיפוש בתוך המצב השמור" aria-label="חיפוש"><span>${items.length} רשומות${addedSince ? ` · ${addedSince} נוספו מאז` : ''}</span></div>
        <div class="h-items">${shown.length ? shown.map(item => {
          const now = currentMap.get(item.id);
          const status = !now ? ['removed','נמחק מאז'] : JSON.stringify(now) !== JSON.stringify(item) ? ['changed','שונה מאז'] : ['same','זהה להיום'];
          return `<div class="h-item-wrap"><div class="h-item"><div><b>${safe(collection.title(item))}</b><small>${safe(collection.meta(item).filter(Boolean).join(' · '))}</small></div><span class="h-badge ${status[0]}">${status[1]}</span><span class="h-actions"><button type="button" class="h-link" data-action="item-history" data-item="${safe(item.id)}">${viewer.open.has(item.id) ? 'הסתרת היסטוריה' : 'היסטוריית הפריט'}</button>${status[0] !== 'same' ? `<button type="button" class="h-link" data-action="restore-item" data-item="${safe(item.id)}">שחזור הפריט</button>` : ''}</span></div>${viewer.open.has(item.id) ? `<div class="h-versions" data-versions="${safe(item.id)}">טוען…</div>` : ''}</div>`;
        }).join('') : '<p class="h-muted">אין רשומות להצגה.</p>'}</div>`;
    }
    const sameAll = (store.read(key) == null ? null : JSON.stringify(store.read(key))) === JSON.stringify(value);
    dialog.innerHTML = `<div class="h-viewer-body">${head}${body}<div class="v-dialog-actions"><button type="button" class="v-button primary" data-action="restore-viewer" ${sameAll ? 'disabled' : ''}>שחזור כל ה${safe(collection.label)} למצב הזה</button><button type="button" class="v-button" data-action="download-viewer">הורדה כקובץ</button></div></div>`;
    viewer.open.forEach(id => loadVersions(id));
  }
  async function loadVersions(itemId) {
    const box = dialog.querySelector(`[data-versions="${CSS.escape(itemId)}"]`);
    if (!box) return;
    const versions = await store.itemHistory(viewer.key, itemId);
    const collection = store.collection(viewer.key);
    box.innerHTML = versions.length ? versions.map((version, index) => {
      const label = version.kind === 'added' ? 'נוצר' : version.kind === 'removed' ? 'נמחק' : `עודכן${version.fields.length ? `: ${version.fields.join(', ')}` : ''}`;
      return `<div class="h-version"><span class="h-time">${safe(fullTime(version.at))}</span><span>${safe(label)}${version.item ? ` <small>${safe(collection.meta(version.item).filter(Boolean).join(' · '))}</small>` : ''}</span>${version.item && index > 0 ? `<button type="button" class="h-link" data-action="restore-version" data-item="${safe(itemId)}" data-change="${safe(version.changeId)}">שחזור גרסה זו</button>` : index === 0 ? '<small class="h-current">הגרסה האחרונה</small>' : ''}</div>`;
    }).join('') : '<p class="h-muted">אין היסטוריה לפריט הזה.</p>';
  }

  function finish(message) {
    try { sessionStorage.setItem('esekli-flash', message); } catch {}
    location.reload();
  }
  const ask = message => window.confirm(`${message}\n\nלפני השחזור נשמר גיבוי של המצב הנוכחי, כך שאפשר לחזור אחורה.`);

  dialog.addEventListener('input', event => {
    if (!event.target.matches('[data-viewer-search]')) return;
    viewer.query = event.target.value;
    const position = event.target.selectionStart;
    renderViewer();
    const input = dialog.querySelector('[data-viewer-search]');
    input.focus();
    input.setSelectionRange(position, position);
  });
  dialog.addEventListener('click', async event => {
    if (event.target === dialog || event.target.closest('[data-close]')) { dialog.close(); return; }
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled || !viewer) return;
    const collection = store.collection(viewer.key);
    const action = target.dataset.action;
    if (action === 'item-history') {
      const id = target.dataset.item;
      viewer.open.has(id) ? viewer.open.delete(id) : viewer.open.add(id);
      renderViewer();
    }
    if (action === 'restore-item') {
      const item = (store.parse(viewer.key, viewer.raw) || []).find(entry => entry.id === target.dataset.item);
      if (!item || !ask(`לשחזר את "${collection.title(item)}" כפי שהיה ב־${fullTime(viewer.at)}?`)) return;
      await store.restoreItem(viewer.key, item, `שחזור "${collection.title(item)}"`);
      finish(`"${collection.title(item)}" שוחזר.`);
    }
    if (action === 'restore-version') {
      const raw = await store.snapshotOf(target.dataset.change);
      const item = (store.parse(viewer.key, raw) || []).find(entry => entry.id === target.dataset.item);
      if (!item || !ask(`לשחזר את הגרסה של "${collection.title(item)}"?`)) return;
      await store.restoreItem(viewer.key, item, `שחזור גרסה של "${collection.title(item)}"`);
      finish(`"${collection.title(item)}" שוחזר.`);
    }
    if (action === 'restore-viewer') {
      if (!ask(`לשחזר את כל ה${collection.label} למצב של ${fullTime(viewer.at)}?`)) return;
      await store.restoreCollections({ [viewer.key]:viewer.raw }, `שחזור ${collection.label} ל־${fullTime(viewer.at)}`);
      finish(`${collection.label} שוחזרו למצב של ${fullTime(viewer.at)}.`);
    }
    if (action === 'download-viewer') await store.exportFile({ collections:{ [viewer.key]:viewer.raw }, at:viewer.at });
  });

  root.addEventListener('submit', async event => {
    if (!event.target.matches('[data-lookup]')) return;
    event.preventDefault();
    const form = new FormData(event.target);
    const key = String(form.get('key'));
    const time = new Date(String(form.get('time'))).getTime() + 59999;
    const found = await store.stateAt(key, time);
    if (!found) { toast('אין מידע שמור מלפני הזמן הזה.'); return; }
    openViewer({ key, raw:found.raw, at:found.meta.at, source:`המצב השמור האחרון לפני ${fullTime(time)}` });
  });

  root.addEventListener('change', async event => {
    if (event.target.matches('[data-action="toggle-photos"]')) state.photos = event.target.checked;
    if (!event.target.matches('[data-import-input]')) return;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const data = await store.readBackupFile(file);
      const parts = listCollections.map(collection => {
        const count = countOf(collection.key, data.collections[collection.key]);
        return count == null ? '' : `${count} ${collection.label}`;
      }).filter(Boolean).join(', ');
      if (!ask(`לטעון את קובץ הגיבוי מ־${data.snapshotAt ? fullTime(data.snapshotAt) : 'תאריך לא ידוע'}?\n${parts}${data.photos.length ? `, ${data.photos.length} תמונות` : ''}\nהנתונים הנוכחיים יוחלפו בנתונים מהקובץ.`)) return;
      await store.importBackup(data);
      finish('קובץ הגיבוי נטען.');
    } catch (error) { toast(error.message || 'לא ניתן לקרוא את הקובץ.'); }
  });

  root.addEventListener('click', async event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const backup = state.backups.find(item => item.id === target.dataset.id);
    if (action === 'filter') { state.filter = target.dataset.key; await load(); }
    if (action === 'more') await loadMore();
    if (action === 'backup-now') { await store.createBackup('manual'); toast('הגיבוי נשמר.'); await load(); }
    if (action === 'export') {
      const result = await store.exportFile({ photos:state.photos });
      toast(`קובץ הגיבוי הורד (${kb(result.size)}${result.photos ? `, ${result.photos} תמונות` : ''}).`);
      render();
    }
    if (action === 'import') root.querySelector('[data-import-input]').click();
    if (action === 'view-change' || action === 'restore-change') {
      const change = state.changes.find(item => item.id === target.dataset.id);
      const raw = change && await store.snapshotOf(change.id);
      if (raw == null) { toast('המצב השמור לא נמצא.'); return; }
      const collection = store.collection(change.key);
      if (action === 'view-change') { openViewer({ key:change.key, raw, at:change.at, source:'שינוי מתועד' }); return; }
      if (!ask(`לשחזר את ה${collection.label} למצב של ${fullTime(change.at)}?`)) return;
      await store.restoreCollections({ [change.key]:raw }, `שחזור ${collection.label} ל־${fullTime(change.at)}`);
      finish(`${collection.label} שוחזרו.`);
    }
    if (action === 'view-backup' && backup) {
      const keys = store.COLLECTIONS.filter(collection => backup.collections[collection.key] != null);
      dialog.innerHTML = `<div class="h-viewer-body"><div class="h-viewer-head"><div><p class="v-eyebrow">גיבוי ${safe(KIND_LABELS[backup.kind] || '')}</p><h2>${safe(fullTime(backup.at))}</h2></div><button type="button" class="v-button" data-close>סגירה</button></div><div class="h-items">${keys.map(collection => `<div class="h-item"><div><b>${safe(collection.label)}</b><small>${collection.kind === 'list' ? `${countOf(collection.key, backup.collections[collection.key])} רשומות` : safe(collection.meta(store.parse(collection.key, backup.collections[collection.key])).filter(Boolean).join(' · '))}</small></div><button type="button" class="h-link" data-open-backup-key="${safe(collection.key)}">צפייה ושחזור</button></div>`).join('')}</div></div>`;
      dialog.onclick = clickEvent => {
        const opener = clickEvent.target.closest('[data-open-backup-key]');
        if (!opener) return;
        dialog.onclick = null;
        openViewer({ key:opener.dataset.openBackupKey, raw:backup.collections[opener.dataset.openBackupKey], at:backup.at, source:`גיבוי ${KIND_LABELS[backup.kind] || ''}` });
      };
      if (!dialog.open) dialog.showModal();
    }
    if (action === 'restore-backup' && backup) {
      if (!ask(`לשחזר את כל האפליקציה למצב של ${fullTime(backup.at)}?`)) return;
      await store.restoreCollections(backup.collections, `שחזור גיבוי מ־${fullTime(backup.at)}`);
      finish('האפליקציה שוחזרה מהגיבוי.');
    }
    if (action === 'download-backup' && backup) await store.exportFile({ collections:backup.collections, at:backup.at });
    if (action === 'restore-photo') {
      await store.restorePhoto(target.dataset.id);
      toast('התמונה שוחזרה לביקור.');
      await load();
    }
  });

  // Refresh whenever the page is opened from the menu.
  document.addEventListener('click', event => { if (event.target.closest('[data-nav="history"]')) load(); });
  try {
    const flash = sessionStorage.getItem('esekli-flash');
    if (flash) { sessionStorage.removeItem('esekli-flash'); setTimeout(() => toast(flash), 300); }
  } catch {}
  load();
}
