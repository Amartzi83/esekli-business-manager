const root = document.getElementById('tasks-root');
if (root) {
  const STORAGE_KEY = 'esekli-tasks-v1';
  const VISITS_KEY = 'esekli-garden-visits-v1';
  const TEAM = [
    { id:'nehorai', name:'נהוראי מרציאנו', initial:'נ', tone:'peach' },
    { id:'partner', name:'דוב', initial:'ד', tone:'mint' }
  ];
  const PRIORITIES = { high:'דחוף', normal:'רגיל', low:'נמוך' };
  const GROUPS = [['overdue','באיחור'],['today','היום'],['tomorrow','מחר'],['later','בהמשך'],['none','ללא מועד']];

  const pad = value => String(value).padStart(2,'0');
  const dayKey = date => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  const addDays = days => { const date = new Date(); date.setDate(date.getDate()+days); return dayKey(date); };
  const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const shortDate = key => new Intl.DateTimeFormat('he-IL', { weekday:'short', day:'numeric', month:'short' }).format(new Date(`${key}T12:00:00`));
  const newId = () => `task-${crypto.randomUUID?.() || Date.now()}`;

  const sampleTasks = () => [
    { title:'לבדוק מערכת השקיה בגינת השרון', due:addDays(0), priority:'high', owner:'nehorai', visit:'גינת השרון', notes:'בביקור הבוקר' },
    { title:'לפנות גזם מבית הדקל', due:addDays(0), priority:'normal', owner:'partner', visit:'בית הדקל', notes:'' },
    { title:'להשלים דישון בגינת הדרים', due:addDays(1), priority:'normal', owner:'nehorai', visit:'גינת הדרים', notes:'' },
    { title:'להכין ציוד לכיסוח ולגיזום', due:addDays(0), priority:'normal', owner:'partner', visit:'', notes:'לפני יציאה למסלול' },
    { title:'לשלוח הצעת מחיר לחברת אזורים', due:addDays(-1), priority:'high', owner:'nehorai', visit:'חברת אזורים', notes:'' },
    { title:'להזמין טפטפות ודשן עונתי', due:addDays(3), priority:'low', owner:'partner', visit:'', notes:'' }
  ].map((task,index) => ({ id:`sample-${index}`, done:false, createdAt:Date.now()+index, ...task }));

  let tasks;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    tasks = Array.isArray(stored) ? stored : sampleTasks();
  } catch { tasks = sampleTasks(); }
  let currentFilter = 'open';
  let ownerFilter = 'all';
  let editingId = null;

  // Writes go through the shared store (history + backups) when it is loaded.
  const persist = (key, value) => window.esekliStore ? window.esekliStore.write(key, value) : localStorage.setItem(key, JSON.stringify(value));
  const save = () => { try { persist(STORAGE_KEY, tasks); } catch { toast('אין מספיק מקום לשמירת המשימות במכשיר.'); } };
  const toast = message => (window.showToast ? window.showToast(message) : console.info(message));
  const byId = id => tasks.find(task => task.id === id);
  const ownerOf = task => TEAM.find(member => member.id === task.owner);
  const searchQuery = () => (document.getElementById('searchInput')?.value || '').trim().toLocaleLowerCase('he');

  function bucket(task) {
    if (!task.due) return 'none';
    const today = addDays(0);
    if (task.due < today) return 'overdue';
    if (task.due === today) return 'today';
    if (task.due === addDays(1)) return 'tomorrow';
    return 'later';
  }
  function dueLabel(task) {
    const kind = bucket(task);
    if (kind === 'none') return 'ללא מועד';
    if (kind === 'today') return 'היום';
    if (kind === 'tomorrow') return 'מחר';
    return kind === 'overdue' ? `באיחור · ${shortDate(task.due)}` : shortDate(task.due);
  }
  const groupOrder = Object.fromEntries(GROUPS.map(([key],index) => [key,index]));
  const priorityOrder = { high:0, normal:1, low:2 };
  const sortOpen = list => [...list].sort((a,b) =>
    groupOrder[bucket(a)] - groupOrder[bucket(b)] ||
    priorityOrder[a.priority] - priorityOrder[b.priority] ||
    (a.due || '').localeCompare(b.due || '') ||
    a.createdAt - b.createdAt);

  function matchesSearch(task, query) {
    if (!query) return true;
    return `${task.title} ${task.notes} ${task.visit} ${ownerOf(task)?.name || ''}`.toLocaleLowerCase('he').includes(query);
  }
  function visibleTasks() {
    const query = searchQuery();
    return tasks.filter(task => {
      if (ownerFilter !== 'all' && task.owner !== ownerFilter) return false;
      if (!matchesSearch(task, query)) return false;
      if (currentFilter === 'done') return task.done;
      if (task.done) return false;
      if (currentFilter === 'today') return ['overdue','today'].includes(bucket(task));
      if (currentFilter === 'overdue') return bucket(task) === 'overdue';
      return true;
    });
  }

  function counts() {
    const open = tasks.filter(task => !task.done);
    return {
      open: open.length,
      today: open.filter(task => bucket(task) === 'today').length,
      overdue: open.filter(task => bucket(task) === 'overdue').length,
      done: tasks.length - open.length
    };
  }

  function heading() {
    return `<header class="v-heading"><div class="v-title-wrap"><span class="v-mark t-mark" aria-hidden="true">✓</span><div><p class="v-eyebrow">ניהול עבודה שוטף</p><h1>משימות</h1><p>כל מה שהצוות צריך לבצע, לפי מועד ועדיפות</p></div></div><button class="v-button primary" data-action="new-task"><span aria-hidden="true">＋</span> משימה חדשה</button></header>`;
  }
  function summary(count) {
    return `<div class="v-stats" aria-label="סיכום משימות"><div class="v-stat"><span class="v-stat-icon">☰</span><span><small>משימות פתוחות</small><b>${count.open}</b></span></div><div class="v-stat"><span class="v-stat-icon">◷</span><span><small>להיום</small><b>${count.today}</b></span></div><div class="v-stat"><span class="v-stat-icon t-alert">!</span><span><small>באיחור</small><b>${count.overdue}</b></span></div><div class="v-stat"><span class="v-stat-icon">✓</span><span><small>הושלמו</small><b>${count.done}</b></span></div></div>`;
  }
  function toolbar(count) {
    const tabs = [['open','פתוחות',count.open],['today','להיום',count.today+count.overdue],['overdue','באיחור',count.overdue],['done','הושלמו',count.done]];
    return `<div class="v-toolbar t-toolbar"><div class="v-tabs t-tabs" role="tablist" aria-label="סינון משימות">${tabs.map(([key,label,number]) => `<button type="button" class="${currentFilter === key ? 'selected' : ''}" role="tab" aria-selected="${currentFilter === key}" data-action="filter" data-filter="${key}">${label}<span class="t-tab-count">${number}</span></button>`).join('')}</div><label class="t-owner-filter"><span>אחראי</span><select data-owner-filter><option value="all">כל הצוות</option>${TEAM.map(member => `<option value="${member.id}" ${ownerFilter === member.id ? 'selected' : ''}>${safe(member.name)}</option>`).join('')}</select></label></div>`;
  }
  function quickAdd() {
    return `<form class="t-quick" data-quick-form><input name="title" maxlength="90" placeholder="הוספה מהירה — מה צריך לעשות היום?" aria-label="משימה חדשה להיום" autocomplete="off"><button class="v-button primary" type="submit">הוספה</button></form>`;
  }
  function taskItem(task) {
    const owner = ownerOf(task);
    const overdue = !task.done && bucket(task) === 'overdue';
    const meta = [
      `<span class="t-priority ${task.priority}">${PRIORITIES[task.priority] || 'רגיל'}</span>`,
      `<span class="${overdue ? 't-overdue' : ''}">${safe(task.done && task.completedAt ? `הושלם ${shortDate(dayKey(new Date(task.completedAt)))}` : dueLabel(task))}</span>`,
      task.visit ? `<span>🌿 ${safe(task.visit)}</span>` : '',
      task.notes ? `<span class="t-note">${safe(task.notes)}</span>` : ''
    ].filter(Boolean).join('<i aria-hidden="true">·</i>');
    return `<article class="t-item ${task.done ? 'done' : ''} ${overdue ? 'late' : ''}"><input class="t-check" type="checkbox" ${task.done ? 'checked' : ''} data-action="toggle" data-id="${safe(task.id)}" aria-label="סימון ${safe(task.title)} כבוצעה"><button type="button" class="t-body" data-action="edit" data-id="${safe(task.id)}"><b>${safe(task.title)}</b><span class="t-meta">${meta}</span></button><span class="task-owner t-owner ${owner?.tone || 'none'}" title="${safe(owner?.name || 'ללא אחראי')}">${safe(owner?.initial || '—')}</span></article>`;
  }
  function listBody() {
    const list = visibleTasks();
    if (!list.length) {
      const message = searchQuery() ? 'לא נמצאו משימות שמתאימות לחיפוש.' : currentFilter === 'done' ? 'עדיין לא הושלמו משימות.' : 'אין משימות פתוחות כאן. אפשר להוסיף משימה חדשה.';
      return `<div class="v-empty">${message}</div>`;
    }
    if (currentFilter === 'done') {
      const sorted = [...list].sort((a,b) => (b.completedAt || 0) - (a.completedAt || 0));
      return `<section class="t-group"><div class="t-group-head"><h2>הושלמו</h2><button type="button" class="t-link" data-action="clear-done">ניקוי משימות שהושלמו</button></div><div class="t-list">${sorted.map(taskItem).join('')}</div></section>`;
    }
    const sorted = sortOpen(list);
    return GROUPS.map(([key,label]) => {
      const items = sorted.filter(task => bucket(task) === key);
      return items.length ? `<section class="t-group"><div class="t-group-head ${key}"><h2>${label}</h2><small>${items.length}</small></div><div class="t-list">${items.map(taskItem).join('')}</div></section>` : '';
    }).join('');
  }

  function render() {
    const count = counts();
    root.innerHTML = `<div class="v-page t-page">${heading()}${summary(count)}${toolbar(count)}${quickAdd()}<div class="t-groups">${listBody()}</div><p class="v-notes">המשימות נשמרות בדפדפן במכשיר הזה. שיתוף בין משתמשים יתווסף עם חיבור השרת.</p></div>`;
    renderDashboard(count);
  }

  function renderDashboard(count = counts()) {
    const list = document.getElementById('taskList');
    if (list) {
      const empty = list.querySelector('[data-empty]');
      const top = sortOpen(tasks.filter(task => !task.done)).slice(0,5);
      list.querySelectorAll('.task-row, .task-all-done').forEach(row => row.remove());
      list.insertAdjacentHTML('afterbegin', top.length ? top.map(task => {
        const owner = ownerOf(task);
        const overdue = bucket(task) === 'overdue';
        return `<label class="task-row" data-search="${safe(`${task.title} ${task.visit} ${task.notes}`)}"><input class="task-check" type="checkbox" data-id="${safe(task.id)}"><span class="task-copy"><span class="task-name">${safe(task.title)}</span><span class="task-meta"><span class="priority ${task.priority === 'high' ? 'high' : ''}"></span> ${PRIORITIES[task.priority] || 'רגיל'} · <span class="${overdue ? 't-overdue' : ''}">${safe(dueLabel(task))}</span></span></span><span class="task-owner ${owner?.tone || ''}">${safe(owner?.initial || '—')}</span></label>`;
      }).join('') : '<div class="empty-hint visible task-all-done">אין משימות פתוחות. כל הכבוד!</div>');
      if (empty) list.append(empty);
      window.applySearch?.();
    }
    const setText = (id,text) => { const element = document.getElementById(id); if (element) element.textContent = text; };
    setText('openTaskCount', count.open);
    setText('navTaskCount', count.open);
    setText('taskProgress', `${count.open} משימות פתוחות`);
    setText('todayTaskCount', count.overdue ? `${count.today} להיום · ${count.overdue} באיחור` : `${count.today} להיום`);
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'v-dialog t-dialog';
  dialog.setAttribute('aria-labelledby','taskDialogTitle');
  document.body.append(dialog);

  function visitNames() {
    try {
      const visits = JSON.parse(localStorage.getItem(VISITS_KEY) || '[]');
      return [...new Set((Array.isArray(visits) ? visits : []).map(visit => visit.name).filter(Boolean))];
    } catch { return []; }
  }

  function openDialog(task = null) {
    editingId = task?.id || null;
    const value = task || { title:'', due:addDays(0), priority:'normal', owner:'', visit:'', notes:'' };
    const visits = visitNames();
    if (value.visit && !visits.includes(value.visit)) visits.push(value.visit);
    dialog.innerHTML = `<form method="dialog" data-task-form><h2 id="taskDialogTitle">${task ? 'עריכת משימה' : 'משימה חדשה'}</h2>
      <label class="v-field">מה צריך לעשות?<input name="title" maxlength="90" value="${safe(value.title)}" placeholder="לדוגמה: לחזור ללקוח" required></label>
      <div class="v-form-row"><label class="v-field">מועד לביצוע<input name="due" type="date" value="${safe(value.due)}"></label><label class="v-field">עדיפות<select name="priority">${Object.entries(PRIORITIES).map(([key,label]) => `<option value="${key}" ${value.priority === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>
      <div class="v-form-row"><label class="v-field">אחראי<select name="owner"><option value="">ללא אחראי</option>${TEAM.map(member => `<option value="${member.id}" ${value.owner === member.id ? 'selected' : ''}>${safe(member.name)}</option>`).join('')}</select></label><label class="v-field">קשור לביקור<select name="visit"><option value="">ללא</option>${visits.map(name => `<option ${value.visit === name ? 'selected' : ''}>${safe(name)}</option>`).join('')}</select></label></div>
      <label class="v-field">הערות<textarea name="notes" maxlength="300" placeholder="פרטים נוספים">${safe(value.notes)}</textarea></label>
      <div class="v-dialog-actions"><button class="v-button primary" type="submit">${task ? 'שמירה' : 'הוספת משימה'}</button><button class="v-button" type="button" data-action="close">ביטול</button>${task ? '<button class="v-button t-delete" type="button" data-action="delete">מחיקה</button>' : ''}</div></form>`;
    dialog.showModal();
    setTimeout(() => dialog.querySelector('input[name="title"]')?.focus(), 50);
  }

  dialog.addEventListener('click', event => {
    if (event.target === dialog) { dialog.close(); return; }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') dialog.close();
    if (action === 'delete' && editingId && window.confirm('למחוק את המשימה?')) {
      tasks = tasks.filter(task => task.id !== editingId);
      save(); dialog.close(); render(); toast('המשימה נמחקה.');
    }
  });
  dialog.addEventListener('submit', event => {
    event.preventDefault();
    const values = new FormData(event.target);
    const title = String(values.get('title') || '').trim();
    if (!title) return;
    const fields = { title, due:String(values.get('due') || ''), priority:String(values.get('priority') || 'normal'), owner:String(values.get('owner') || ''), visit:String(values.get('visit') || ''), notes:String(values.get('notes') || '').trim() };
    const existing = editingId && byId(editingId);
    if (existing) Object.assign(existing, fields);
    else tasks.push({ id:newId(), done:false, createdAt:Date.now(), ...fields });
    save(); dialog.close(); render();
    toast(existing ? 'המשימה עודכנה.' : 'המשימה נוספה.');
  });

  function setDone(id, done) {
    const task = byId(id);
    if (!task) return;
    task.done = done;
    if (done) task.completedAt = Date.now(); else delete task.completedAt;
    save(); render();
    if (done) toast('המשימה סומנה כבוצעה.');
  }

  root.addEventListener('change', event => {
    if (event.target.matches('[data-action="toggle"]')) setDone(event.target.dataset.id, event.target.checked);
    if (event.target.matches('[data-owner-filter]')) { ownerFilter = event.target.value; render(); }
  });
  root.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'new-task') openDialog();
    if (action === 'edit') openDialog(byId(target.dataset.id));
    if (action === 'filter') { currentFilter = target.dataset.filter; render(); }
    if (action === 'clear-done' && window.confirm('למחוק את כל המשימות שהושלמו?')) {
      tasks = tasks.filter(task => !task.done);
      save(); render(); toast('המשימות שהושלמו נמחקו.');
    }
  });
  root.addEventListener('submit', event => {
    if (!event.target.matches('[data-quick-form]')) return;
    event.preventDefault();
    const input = event.target.elements.title;
    const title = input.value.trim();
    if (!title) return;
    tasks.push({ id:newId(), title, due:addDays(0), priority:'normal', owner:'', visit:'', notes:'', done:false, createdAt:Date.now() });
    save(); render();
    root.querySelector('[data-quick-form] input')?.focus();
    toast('המשימה נוספה להיום.');
  });

  document.getElementById('taskList')?.addEventListener('change', event => {
    if (event.target.matches('.task-check[data-id]')) setDone(event.target.dataset.id, event.target.checked);
  });
  document.getElementById('addTaskButton')?.addEventListener('click', () => openDialog());
  document.getElementById('searchInput')?.addEventListener('input', () => { if (!root.closest('[hidden]')) render(); });
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY) return;
    try { const stored = JSON.parse(event.newValue || '[]'); if (Array.isArray(stored)) { tasks = stored; render(); } } catch {}
  });

  save();
  render();
}
