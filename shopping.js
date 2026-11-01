const root = document.getElementById('shopping-root');
if (root) {
  const STORAGE_KEY = 'esekli-shopping-v1';
  const VISITS_KEY = 'esekli-garden-visits-v2';
  const CATEGORIES = [['דשנים וקרקע','🌱'],['השקיה','💧'],['צמחים ושתילים','🪴'],['כלים וציוד','🧰'],['הדברה','🐛'],['כללי','📦']];
  const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const toast = message => (window.showToast ? window.showToast(message) : console.info(message));
  const newId = () => `shop-${crypto.randomUUID?.() || Date.now()}`;
  const money = value => `₪${Math.round(value).toLocaleString('he-IL')}`;
  // Writes go through the shared store (history + backups) when it is loaded.
  const persist = (key, value) => window.esekliStore ? window.esekliStore.write(key, value) : localStorage.setItem(key, JSON.stringify(value));

  const sampleItems = () => [
    ['דשן עונתי 20-20-20', '2 שקים', 'דשנים וקרקע', 'משתלת השרון', 180, 'גינת הדרים'],
    ['אדמת שתילה מועשרת', '6 שקים', 'דשנים וקרקע', 'משתלת השרון', 150, ''],
    ['טפטפות 4 ליטר לשעה', 'חבילה של 100', 'השקיה', 'השקיה פלוס', 65, ''],
    ['צינור טפטוף 16 מ״מ', 'גליל 100 מטר', 'השקיה', 'השקיה פלוס', 240, ''],
    ['מחשב השקיה לברז', '1', 'השקיה', 'השקיה פלוס', 320, 'ניצנות בית הדקל'],
    ['שתילי לבנדר', '12', 'צמחים ושתילים', 'משתלת השרון', 144, 'בניין הסביון'],
    ['מרבד דשא', '20 מ״ר', 'צמחים ושתילים', 'דשא ישיר', 600, 'משפחת כהן'],
    ['כפפות עבודה', '3 זוגות', 'כלים וציוד', 'ציוד גינון מרכז', 45, ''],
    ['חוט לחרמש 3 מ״מ', '2 גלילים', 'כלים וציוד', 'ציוד גינון מרכז', 60, ''],
    ['שמן לשרשרת מסור', '1 ליטר', 'כלים וציוד', 'ציוד גינון מרכז', 35, ''],
    ['תכשיר נגד כנימות', '1 בקבוק', 'הדברה', 'משתלת השרון', 55, 'גינת רמות'],
    ['שקיות גזם גדולות', '2 חבילות', 'כללי', 'ציוד גינון מרכז', 40, '', true],
    ['דלק למפוח ולחרמש', '5 ליטר', 'כללי', 'תחנת דלק', 38, '', true]
  ].map(([name, qty, category, supplier, price, visit, bought], index) => ({
    id:`sample-shop-${index}`, name, qty, category, supplier, price, visit, notes:'', bought:Boolean(bought),
    createdAt:Date.now() - (20 - index) * 3600000, boughtAt:bought ? Date.now() - 86400000 : null
  }));

  let items;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    items = Array.isArray(stored) ? stored : sampleItems();
  } catch { items = sampleItems(); }
  let filter = 'open';
  let editingId = null;

  const save = () => { try { persist(STORAGE_KEY, items); } catch { toast('אין מספיק מקום לשמירת הרשימה במכשיר.'); } };
  const byId = id => items.find(item => item.id === id);
  const icon = category => CATEGORIES.find(([name]) => name === category)?.[1] || '📦';
  const searchQuery = () => (document.getElementById('searchInput')?.value || '').trim().toLocaleLowerCase('he');
  const matches = (item, query) => !query || `${item.name} ${item.qty} ${item.supplier} ${item.visit} ${item.category}`.toLocaleLowerCase('he').includes(query);

  function counts() {
    const open = items.filter(item => !item.bought);
    return { open:open.length, bought:items.length - open.length, cost:open.reduce((sum,item) => sum + (Number(item.price) || 0), 0), suppliers:new Set(open.map(item => item.supplier).filter(Boolean)).size };
  }
  function itemRow(item) {
    const meta = [item.qty && `<span>${safe(item.qty)}</span>`, item.supplier && `<span>${safe(item.supplier)}</span>`, item.price ? `<span class="t-priority low">${money(item.price)}</span>` : '', item.visit && `<span>🌿 ${safe(item.visit)}</span>`, item.notes && `<span class="t-note">${safe(item.notes)}</span>`].filter(Boolean).join('<i aria-hidden="true">·</i>');
    return `<article class="t-item ${item.bought ? 'done' : ''}"><input class="t-check" type="checkbox" ${item.bought ? 'checked' : ''} data-action="toggle" data-id="${safe(item.id)}" aria-label="סימון ${safe(item.name)} כנקנה"><button type="button" class="t-body" data-action="edit" data-id="${safe(item.id)}"><b>${safe(item.name)}</b><span class="t-meta">${meta}</span></button><span class="x-emoji" aria-hidden="true">${icon(item.category)}</span></article>`;
  }
  function listBody() {
    const query = searchQuery();
    const list = items.filter(item => (filter === 'all' || (filter === 'bought' ? item.bought : !item.bought)) && matches(item, query));
    if (!list.length) return `<div class="v-empty">${query ? 'לא נמצאו פריטים שמתאימים לחיפוש.' : filter === 'bought' ? 'עדיין לא סומנו פריטים כנקנו.' : 'אין פריטים לקנייה. אפשר להוסיף פריט חדש.'}</div>`;
    const groups = CATEGORIES.map(([category]) => [category, list.filter(item => item.category === category)]);
    const other = list.filter(item => !CATEGORIES.some(([category]) => category === item.category));
    if (other.length) groups.push(['אחר', other]);
    return groups.filter(([, group]) => group.length).map(([category, group]) => `<section class="t-group"><div class="t-group-head"><h2>${icon(category)} ${safe(category)}</h2><small>${group.length}</small></div><div class="t-list">${group.sort((a,b) => Number(a.bought) - Number(b.bought) || a.createdAt - b.createdAt).map(itemRow).join('')}</div></section>`).join('')
      + (filter === 'bought' ? '<button type="button" class="v-button x-clear" data-action="clear-bought">ניקוי הפריטים שנקנו</button>' : '');
  }
  function render() {
    const count = counts();
    const tabs = [['open','לקנות',count.open],['bought','נקנו',count.bought],['all','הכל',items.length]];
    root.innerHTML = `<div class="v-page t-page x-page">
      <header class="v-heading"><div class="v-title-wrap"><span class="v-mark x-mark shop" aria-hidden="true">🛒</span><div><p class="v-eyebrow">ציוד וחומרים לעבודה</p><h1>רשימת קניות</h1><p>מה צריך לקנות, מאיזה ספק ולאיזה ביקור</p></div></div><button class="v-button primary" type="button" data-action="new">＋ פריט חדש</button></header>
      <div class="v-stats"><div class="v-stat"><span class="v-stat-icon">🛒</span><span><small>לקנות</small><b>${count.open}</b></span></div><div class="v-stat"><span class="v-stat-icon">✓</span><span><small>נקנו</small><b>${count.bought}</b></span></div><div class="v-stat"><span class="v-stat-icon">₪</span><span><small>עלות משוערת</small><b>${money(count.cost)}</b></span></div><div class="v-stat"><span class="v-stat-icon">🏪</span><span><small>ספקים</small><b>${count.suppliers}</b></span></div></div>
      <div class="v-toolbar"><div class="v-tabs t-tabs x-tabs3" role="tablist">${tabs.map(([key,label,number]) => `<button type="button" role="tab" class="${filter === key ? 'selected' : ''}" aria-selected="${filter === key}" data-action="filter" data-filter="${key}">${label}<span class="t-tab-count">${number}</span></button>`).join('')}</div></div>
      <form class="t-quick" data-quick-form><input name="name" maxlength="70" placeholder="מה צריך לקנות?" aria-label="פריט חדש" autocomplete="off"><input name="qty" class="x-qty" maxlength="30" placeholder="כמות" aria-label="כמות"><button class="v-button primary" type="submit">הוספה</button></form>
      <div class="t-groups">${listBody()}</div>
      <p class="v-notes">הרשימה נשמרת במכשיר עם היסטוריה וגיבוי (תפריט: היסטוריה וגיבויים).</p></div>`;
    renderDashboard(count);
  }
  function renderDashboard(count = counts()) {
    const list = document.getElementById('dashboardShopping');
    if (list) {
      const empty = list.querySelector('[data-empty]');
      list.querySelectorAll('.shopping-row').forEach(row => row.remove());
      const top = items.filter(item => !item.bought).slice(0, 4);
      list.insertAdjacentHTML('afterbegin', top.map(item => `<label class="shopping-row" data-search="${safe(`${item.name} ${item.supplier}`)}"><input class="shopping-check" type="checkbox" data-id="${safe(item.id)}"><span class="shopping-name">${safe(item.name)}</span><span class="shopping-qty">${safe(item.qty)}</span></label>`).join(''));
      if (empty) list.append(empty);
      window.applySearch?.();
    }
    const subtitle = document.getElementById('shoppingSubtitle');
    if (subtitle) subtitle.textContent = count.open ? `${count.open} פריטים ממתינים · ${money(count.cost)}` : 'הכל נקנה';
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'v-dialog';
  document.body.append(dialog);
  function visitNames() {
    try { return [...new Set((JSON.parse(localStorage.getItem(VISITS_KEY) || '[]') || []).map(visit => visit.name).filter(Boolean))]; } catch { return []; }
  }
  function openDialog(item = null) {
    editingId = item?.id || null;
    const value = item || { name:'', qty:'', category:CATEGORIES[0][0], supplier:'', price:'', visit:'', notes:'' };
    const visits = visitNames();
    if (value.visit && !visits.includes(value.visit)) visits.push(value.visit);
    dialog.innerHTML = `<form method="dialog" data-item-form><h2>${item ? 'עריכת פריט' : 'פריט חדש'}</h2>
      <label class="v-field">פריט<input name="name" maxlength="70" value="${safe(value.name)}" required></label>
      <div class="v-form-row"><label class="v-field">כמות<input name="qty" maxlength="30" value="${safe(value.qty)}"></label><label class="v-field">קטגוריה<select name="category">${CATEGORIES.map(([name]) => `<option ${name === value.category ? 'selected' : ''}>${safe(name)}</option>`).join('')}</select></label></div>
      <div class="v-form-row"><label class="v-field">ספק<input name="supplier" maxlength="50" value="${safe(value.supplier)}"></label><label class="v-field">מחיר משוער (₪)<input name="price" type="number" min="0" step="1" value="${safe(value.price)}"></label></div>
      <label class="v-field">עבור ביקור<select name="visit"><option value="">כללי</option>${visits.map(name => `<option ${name === value.visit ? 'selected' : ''}>${safe(name)}</option>`).join('')}</select></label>
      <label class="v-field">הערות<textarea name="notes" maxlength="200">${safe(value.notes)}</textarea></label>
      <div class="v-dialog-actions"><button class="v-button primary" type="submit">${item ? 'שמירה' : 'הוספה'}</button><button class="v-button" type="button" data-close>ביטול</button>${item ? '<button class="v-button t-delete" type="button" data-delete>מחיקה</button>' : ''}</div></form>`;
    dialog.showModal();
  }
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target.closest('[data-close]')) { dialog.close(); return; }
    if (event.target.closest('[data-delete]') && editingId && window.confirm('למחוק את הפריט?')) {
      items = items.filter(item => item.id !== editingId);
      save(); dialog.close(); render(); toast('הפריט נמחק.');
    }
  });
  dialog.addEventListener('submit', event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    const fields = { name:values.name.trim(), qty:values.qty.trim(), category:values.category, supplier:values.supplier.trim(), price:Number(values.price) || 0, visit:values.visit, notes:values.notes.trim() };
    if (!fields.name) return;
    const existing = editingId && byId(editingId);
    if (existing) Object.assign(existing, fields);
    else items.push({ id:newId(), ...fields, bought:false, createdAt:Date.now(), boughtAt:null });
    save(); dialog.close(); render();
    toast(existing ? 'הפריט עודכן.' : 'הפריט נוסף לרשימה.');
  });

  function setBought(id, bought) {
    const item = byId(id);
    if (!item) return;
    item.bought = bought;
    item.boughtAt = bought ? Date.now() : null;
    save(); render();
  }
  root.addEventListener('change', event => { if (event.target.matches('[data-action="toggle"]')) setBought(event.target.dataset.id, event.target.checked); });
  root.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'new') openDialog();
    if (action === 'edit') openDialog(byId(target.dataset.id));
    if (action === 'filter') { filter = target.dataset.filter; render(); }
    if (action === 'clear-bought' && window.confirm('להסיר מהרשימה את כל הפריטים שנקנו?')) { items = items.filter(item => !item.bought); save(); render(); }
  });
  root.addEventListener('submit', event => {
    if (!event.target.matches('[data-quick-form]')) return;
    event.preventDefault();
    const name = event.target.elements.name.value.trim();
    if (!name) return;
    items.push({ id:newId(), name, qty:event.target.elements.qty.value.trim(), category:'כללי', supplier:'', price:0, visit:'', notes:'', bought:false, createdAt:Date.now(), boughtAt:null });
    save(); render();
    root.querySelector('[data-quick-form] input')?.focus();
  });
  document.getElementById('dashboardShopping')?.addEventListener('change', event => {
    if (event.target.matches('.shopping-check[data-id]')) { setBought(event.target.dataset.id, true); toast('הפריט סומן כנקנה.'); }
  });
  document.getElementById('searchInput')?.addEventListener('input', () => { if (!root.closest('[hidden]')) render(); });

  save();
  render();
}
