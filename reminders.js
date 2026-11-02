const root = document.getElementById('reminders-root');
if (root) {
  const STORAGE_KEY = 'esekli-reminders-v1';
  const TEAM = [{ id:'nehorai', name:'נהוראי מרציאנו', initial:'נ', tone:'peach' }, { id:'partner', name:'דוב', initial:'ד', tone:'mint' }];
  const REPEAT = { none:'ללא חזרה', daily:'כל יום', weekly:'כל שבוע', monthly:'כל חודש' };
  const GROUPS = [['overdue','באיחור'],['today','היום'],['tomorrow','מחר'],['week','השבוע'],['later','בהמשך']];
  const pad = value => String(value).padStart(2,'0');
  const dayKey = date => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  const addDays = (days, from = new Date()) => { const date = new Date(from); date.setDate(date.getDate() + days); return dayKey(date); };
  const fromKey = key => new Date(`${key}T12:00:00`);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const toast = message => (window.showToast ? window.showToast(message) : console.info(message));
  const newId = () => `rem-${crypto.randomUUID?.() || Date.now()}`;
  const shortDate = key => new Intl.DateTimeFormat('he-IL', { weekday:'short', day:'numeric', month:'short' }).format(fromKey(key));
  // Writes go through the shared store (history + backups) when it is loaded.
  const persist = (key, value) => window.esekliStore ? window.esekliStore.write(key, value) : localStorage.setItem(key, JSON.stringify(value));

  function nextMonthStart() { const date = new Date(); date.setMonth(date.getMonth() + 1, 1); return dayKey(date); }
  const sampleReminders = () => [
    ['לבדוק מפוח ומספרי גיזום', addDays(0), '07:30', 'weekly', 'partner', '', 'לפני יציאה למסלול'],
    ['להביא דשן לגינת הדרים', addDays(0), '11:00', 'none', 'nehorai', 'משפחת לוי', 'הדשן ברשימת הקניות'],
    ['להתקשר לחברת הניהול של בית הדקל', addDays(0), '13:00', 'none', 'nehorai', 'ניצנות בית הדקל', 'לגבי הצעת מחיר לשדרוג ההשקיה'],
    ['לגבות תשלום מחברת אזורים', addDays(-1), '10:00', 'none', 'nehorai', 'חברת אזורים', 'חשבונית של החודש הקודם'],
    ['לתאם גיזום עונתי עם משפחת כהן', addDays(1), '09:00', 'none', 'partner', 'משפחת כהן', ''],
    ['לחדש ביטוח לרכב הגינון', addDays(3), '12:00', 'none', 'nehorai', '', 'קיה ריו 123-45-678'],
    ['להזמין שתילים לעונה', addDays(6), '08:00', 'none', 'partner', '', ''],
    ['לשלוח חשבוניות חודשיות ללקוחות', nextMonthStart(), '09:00', 'monthly', 'nehorai', '', ''],
    ['לבדוק תוקף רישיון ריסוס', addDays(20), '10:00', 'none', 'nehorai', '', ''],
    ['לשלוח סיכום ביקור לוועד בניין השרון', addDays(-2), '17:00', 'none', 'partner', 'בניין השרון', '', true]
  ].map(([title, date, time, repeat, owner, client, notes, done], index) => ({ id:`sample-rem-${index}`, title, date, time, repeat, owner, client, notes, done:Boolean(done), doneAt:done ? Date.now() - 86400000 : null, createdAt:Date.now() - (30 - index) * 3600000 }));

  let reminders;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    reminders = Array.isArray(stored) ? stored : sampleReminders();
  } catch { reminders = sampleReminders(); }
  let filter = 'active';
  let editingId = null;

  const save = () => { try { persist(STORAGE_KEY, reminders); } catch { toast('אין מספיק מקום לשמירת התזכורות במכשיר.'); } };
  const byId = id => reminders.find(item => item.id === id);
  const ownerOf = item => TEAM.find(member => member.id === item.owner);
  const searchQuery = () => (document.getElementById('searchInput')?.value || '').trim().toLocaleLowerCase('he');
  const sortKey = item => `${item.date} ${item.time || '99:99'}`;

  function bucket(item) {
    const today = addDays(0);
    if (item.date < today) return 'overdue';
    if (item.date === today) return 'today';
    if (item.date === addDays(1)) return 'tomorrow';
    if (item.date <= addDays(7)) return 'week';
    return 'later';
  }
  function nextDate(item) {
    const date = fromKey(item.date);
    if (item.repeat === 'daily') date.setDate(date.getDate() + 1);
    if (item.repeat === 'weekly') date.setDate(date.getDate() + 7);
    if (item.repeat === 'monthly') date.setMonth(date.getMonth() + 1);
    let key = dayKey(date);
    // Skip occurrences that are already in the past.
    while (key < addDays(0)) key = nextDate({ ...item, date:key });
    return key;
  }
  function counts() {
    const active = reminders.filter(item => !item.done);
    return {
      today:active.filter(item => bucket(item) === 'today').length,
      overdue:active.filter(item => bucket(item) === 'overdue').length,
      week:active.filter(item => ['today','tomorrow','week'].includes(bucket(item))).length,
      repeating:active.filter(item => item.repeat !== 'none').length,
      done:reminders.length - active.length,
      active:active.length
    };
  }
  function row(item) {
    const owner = ownerOf(item);
    const late = !item.done && bucket(item) === 'overdue';
    const when = ['today','tomorrow'].includes(bucket(item)) && !item.done ? '' : shortDate(item.date);
    const meta = [when && `<span class="${late ? 't-overdue' : ''}">${safe(when)}</span>`, item.repeat !== 'none' && `<span class="t-priority low">↻ ${REPEAT[item.repeat]}</span>`, item.client && `<span>👤 ${safe(item.client)}</span>`, item.notes && `<span class="t-note">${safe(item.notes)}</span>`].filter(Boolean).join('<i aria-hidden="true">·</i>');
    return `<article class="t-item ${item.done ? 'done' : ''} ${late ? 'late' : ''}"><input class="t-check" type="checkbox" ${item.done ? 'checked' : ''} data-action="toggle" data-id="${safe(item.id)}" aria-label="סימון ${safe(item.title)} כבוצעה"><button type="button" class="t-body x-rem" data-action="edit" data-id="${safe(item.id)}"><span class="x-time">${safe(item.time || '—')}</span><span><b>${safe(item.title)}</b><span class="t-meta">${meta}</span></span></button><span class="task-owner t-owner ${owner?.tone || 'none'}" title="${safe(owner?.name || 'ללא אחראי')}">${safe(owner?.initial || '—')}</span></article>`;
  }
  function listBody() {
    const query = searchQuery();
    const list = reminders.filter(item => (filter === 'done' ? item.done : !item.done) && (!query || `${item.title} ${item.client} ${item.notes}`.toLocaleLowerCase('he').includes(query)));
    if (!list.length) return `<div class="v-empty">${query ? 'לא נמצאו תזכורות שמתאימות לחיפוש.' : filter === 'done' ? 'עדיין אין תזכורות שבוצעו.' : 'אין תזכורות פעילות.'}</div>`;
    if (filter === 'done') return `<section class="t-group"><div class="t-group-head"><h2>בוצעו</h2><small>${list.length}</small></div><div class="t-list">${list.sort((a,b) => (b.doneAt || 0) - (a.doneAt || 0)).map(row).join('')}</div></section>`;
    const sorted = list.sort((a,b) => sortKey(a).localeCompare(sortKey(b)));
    return GROUPS.map(([key,label]) => {
      const group = sorted.filter(item => bucket(item) === key);
      return group.length ? `<section class="t-group"><div class="t-group-head ${key}"><h2>${label}</h2><small>${group.length}</small></div><div class="t-list">${group.map(row).join('')}</div></section>` : '';
    }).join('');
  }
  function render() {
    const count = counts();
    root.innerHTML = `<div class="v-page t-page x-page">
      <header class="v-heading"><div class="v-title-wrap"><span class="v-mark x-mark rem" aria-hidden="true">🔔</span><div><p class="v-eyebrow">כדי ששום דבר לא יתפספס</p><h1>תזכורות</h1><p>תזכורות אישיות וצוותיות, כולל תזכורות חוזרות</p></div></div><button class="v-button primary" type="button" data-action="new">＋ תזכורת חדשה</button></header>
      <div class="v-stats"><div class="v-stat"><span class="v-stat-icon">◷</span><span><small>להיום</small><b>${count.today}</b></span></div><div class="v-stat"><span class="v-stat-icon t-alert">!</span><span><small>באיחור</small><b>${count.overdue}</b></span></div><div class="v-stat"><span class="v-stat-icon">▦</span><span><small>בשבוע הקרוב</small><b>${count.week}</b></span></div><div class="v-stat"><span class="v-stat-icon">↻</span><span><small>חוזרות</small><b>${count.repeating}</b></span></div></div>
      <div class="v-toolbar"><div class="v-tabs t-tabs x-tabs2" role="tablist"><button type="button" role="tab" class="${filter === 'active' ? 'selected' : ''}" aria-selected="${filter === 'active'}" data-action="filter" data-filter="active">פעילות<span class="t-tab-count">${count.active}</span></button><button type="button" role="tab" class="${filter === 'done' ? 'selected' : ''}" aria-selected="${filter === 'done'}" data-action="filter" data-filter="done">בוצעו<span class="t-tab-count">${count.done}</span></button></div></div>
      <div class="t-groups">${listBody()}</div>
      <p class="v-notes">תזכורת חוזרת עוברת למועד הבא כשמסמנים אותה. התראות לטלפון יתווספו עם חיבור השרת.</p></div>`;
    renderDashboard(count);
  }
  function renderDashboard(count = counts()) {
    const list = document.getElementById('dashboardReminders');
    if (list) {
      const empty = list.querySelector('[data-empty]');
      list.querySelectorAll('.reminder').forEach(item => item.remove());
      const top = reminders.filter(item => !item.done && ['overdue','today','tomorrow'].includes(bucket(item))).sort((a,b) => sortKey(a).localeCompare(sortKey(b))).slice(0, 4);
      list.insertAdjacentHTML('afterbegin', top.map(item => {
        const kind = bucket(item);
        return `<div class="reminder" data-search="${safe(`${item.title} ${item.client}`)}"><div class="reminder-time">${safe(item.time || '—')}</div><div class="reminder-copy"><strong>${safe(item.title)}</strong><span>${safe(item.client || REPEAT[item.repeat])} · ${kind === 'overdue' ? 'באיחור' : kind === 'today' ? 'היום' : 'מחר'}</span></div><span class="reminder-icon"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span></div>`;
      }).join(''));
      if (empty) list.append(empty);
      window.applySearch?.();
    }
    const now = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
    const next = reminders.filter(item => !item.done && item.date === addDays(0) && (item.time || '') >= now).sort((a,b) => (a.time || '').localeCompare(b.time || ''))[0];
    const set = (id, text) => { const element = document.getElementById(id); if (element) element.textContent = text; };
    set('reminderTodayCount', count.today + count.overdue);
    set('navReminderCount', count.today + count.overdue);
    set('reminderNext', next ? `הקרובה ב־${next.time}` : count.overdue ? `${count.overdue} באיחור` : 'אין עוד היום');
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'v-dialog';
  document.body.append(dialog);
  function customerNames() {
    try { return (JSON.parse(localStorage.getItem('esekli-customers-v1') || '[]') || []).map(customer => customer.name).filter(Boolean); } catch { return []; }
  }
  function openDialog(item = null) {
    editingId = item?.id || null;
    const value = item || { title:'', date:addDays(0), time:'09:00', repeat:'none', owner:'', client:'', notes:'' };
    const clients = customerNames();
    if (value.client && !clients.includes(value.client)) clients.push(value.client);
    dialog.innerHTML = `<form method="dialog" data-rem-form><h2>${item ? 'עריכת תזכורת' : 'תזכורת חדשה'}</h2>
      <label class="v-field">על מה להזכיר?<input name="title" maxlength="90" value="${safe(value.title)}" required></label>
      <div class="v-form-row"><label class="v-field">תאריך<input name="date" type="date" value="${safe(value.date)}" required></label><label class="v-field">שעה<input name="time" type="time" value="${safe(value.time)}"></label></div>
      <div class="v-form-row"><label class="v-field">חזרה<select name="repeat">${Object.entries(REPEAT).map(([key,label]) => `<option value="${key}" ${key === value.repeat ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="v-field">למי<select name="owner"><option value="">לכל הצוות</option>${TEAM.map(member => `<option value="${member.id}" ${member.id === value.owner ? 'selected' : ''}>${safe(member.name)}</option>`).join('')}</select></label></div>
      <label class="v-field">לקוח<select name="client"><option value="">ללא</option>${clients.map(name => `<option ${name === value.client ? 'selected' : ''}>${safe(name)}</option>`).join('')}</select></label>
      <label class="v-field">הערות<textarea name="notes" maxlength="200">${safe(value.notes)}</textarea></label>
      <div class="v-dialog-actions"><button class="v-button primary" type="submit">${item ? 'שמירה' : 'הוספה'}</button><button class="v-button" type="button" data-close>ביטול</button>${item ? '<button class="v-button t-delete" type="button" data-delete>מחיקה</button>' : ''}</div></form>`;
    dialog.showModal();
  }
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target.closest('[data-close]')) { dialog.close(); return; }
    if (event.target.closest('[data-delete]') && editingId && window.confirm('למחוק את התזכורת?')) {
      reminders = reminders.filter(item => item.id !== editingId);
      save(); dialog.close(); render(); toast('התזכורת נמחקה.');
    }
  });
  dialog.addEventListener('submit', event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    const fields = { title:values.title.trim(), date:values.date, time:values.time, repeat:values.repeat, owner:values.owner, client:values.client, notes:values.notes.trim() };
    if (!fields.title) return;
    const existing = editingId && byId(editingId);
    if (existing) Object.assign(existing, fields);
    else reminders.push({ id:newId(), ...fields, done:false, doneAt:null, createdAt:Date.now() });
    save(); dialog.close(); render();
    toast(existing ? 'התזכורת עודכנה.' : 'התזכורת נוספה.');
  });

  function complete(id, done) {
    const item = byId(id);
    if (!item) return;
    if (done && item.repeat !== 'none') {
      item.date = nextDate(item);
      save(); render();
      toast(`בוצע. התזכורת הבאה: ${shortDate(item.date)}${item.time ? ` ב־${item.time}` : ''}.`);
      return;
    }
    item.done = done;
    item.doneAt = done ? Date.now() : null;
    save(); render();
  }
  root.addEventListener('change', event => { if (event.target.matches('[data-action="toggle"]')) complete(event.target.dataset.id, event.target.checked); });
  root.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    if (target.dataset.action === 'new') openDialog();
    if (target.dataset.action === 'edit') openDialog(byId(target.dataset.id));
    if (target.dataset.action === 'filter') { filter = target.dataset.filter; render(); }
  });
  document.getElementById('notificationButton')?.addEventListener('click', () => {
    const count = counts();
    const total = count.today + count.overdue;
    toast(total ? `יש לך ${total} תזכורות להיום${count.overdue ? `, ${count.overdue} מהן באיחור` : ''}.` : 'אין תזכורות להיום.');
    document.querySelector('.nav-link[data-nav="reminders"]')?.click();
  });
  document.getElementById('searchInput')?.addEventListener('input', () => { if (!root.closest('[hidden]')) render(); });

  save();
  render();
}
