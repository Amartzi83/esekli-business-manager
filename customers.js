const root = document.getElementById('customers-root');
if (root) {
  const STORAGE_KEY = 'esekli-customers-v1';
  const VISITS_KEY = 'esekli-garden-visits-v2';
  const TYPES = ['לקוח פרטי','ועד בית','חברת ניהול','חברה','מוסד ציבורי'];
  const PLANS = ['תחזוקה חודשית','תחזוקה דו שבועית','תחזוקה שבועית','ביקורים לפי קריאה','פרויקט חד פעמי'];
  const STATUS = { active:'פעיל', lead:'ליד', paused:'מושהה' };
  const LOG_KINDS = { note:['📝','הערה'], call:['📞','שיחה'], quote:['📄','הצעת מחיר'], payment:['₪','תשלום'], visit:['🌿','ביקור'] };
  const TONES = ['', 'lilac', 'sand'];
  const VISIT_STATUS = { planned:'ממתין', inProgress:'בתהליך', completed:'הושלם', missed:'לא בוצע' };
  const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const toast = message => (window.showToast ? window.showToast(message) : console.info(message));
  const newId = prefix => `${prefix}-${crypto.randomUUID?.() || Date.now()}`;
  const money = value => `₪${Math.round(value || 0).toLocaleString('he-IL')}`;
  const initials = name => String(name || '?').replace(/^(משפחת|חברת|בניין|ועד)\s+/, '').split(/\s+/).slice(0,2).map(word => word[0]).join('');
  const dateLabel = value => new Intl.DateTimeFormat('he-IL', { day:'numeric', month:'short', year:'numeric' }).format(new Date(value));
  const ago = at => {
    const startOfDay = time => new Date(new Date(time).toDateString()).getTime();
    const days = Math.round((startOfDay(Date.now()) - startOfDay(at)) / 86400000);
    if (days < 1) return new Intl.DateTimeFormat('he-IL', { hour:'2-digit', minute:'2-digit' }).format(new Date(at));
    return days === 1 ? 'אתמול' : days < 7 ? `לפני ${days} ימים` : dateLabel(at);
  };
  // Writes go through the shared store (history + backups) when it is loaded.
  const persist = (key, value) => window.esekliStore ? window.esekliStore.write(key, value) : localStorage.setItem(key, JSON.stringify(value));

  function sampleCustomers() {
    const hour = 3600000, day = 24 * hour, now = Date.now();
    const customer = (index, name, type, contact, address, plan, price, status, sites, since, notes, log) => ({
      id:`sample-cust-${index}`, name, type, contact, phone:`050-000-0${String(101 + index).padStart(3,'0')}`, email:`client${index + 1}@example.com`,
      address, plan, price, status, sites, since, notes,
      log:log.map(([kind, text, hoursAgo], logIndex) => ({ id:`sample-cust-${index}-log-${logIndex}`, kind, text, at:now - hoursAgo * hour }))
    });
    return [
      customer(0, 'חברת רמות', 'חברה', 'רונית אברהם', 'הרצל 12, תל אביב', 'תחזוקה חודשית', 1800, 'active', ['גינת רמות'], '2023-03-01', 'כניסה דרך החניון. קוד שער אצל רונית.', [['visit','ביקור תחזוקה הושלם',3],['payment','התקבל תשלום חודש קודם',5 * 24]]),
      customer(1, 'בניין השרון', 'ועד בית', 'יוסי לוי', 'סוקולוב 4, רמת השרון', 'תחזוקה חודשית', 950, 'active', ['בניין השרון'], '2022-09-15', '', [['visit','ביקור תחזוקה הושלם',2],['note','הוועד ביקש להחליף שתילים בכניסה',3 * 24]]),
      customer(2, 'ניצנות בית הדקל', 'חברת ניהול', 'מיכל דהן', 'הנדיב 8, הרצליה', 'תחזוקה חודשית', 2400, 'active', ['ניצנות בית הדקל','בית הדקל'], '2021-05-10', 'לתאם עם מיכל לפני עבודות רועשות.', [['quote','נשלחה הצעת מחיר לשדרוג מערכת ההשקיה',20],['call','שיחה עם מיכל על פינוי גזם',4 * 24]]),
      customer(3, 'בניין הסביון', 'ועד בית', 'אבי פרץ', 'הסביון 15, רעננה', 'תחזוקה דו שבועית', 1100, 'active', ['בניין הסביון'], '2024-01-20', '', [['note','לשים לב לטפטפות ליד הלובי',6 * 24]]),
      customer(4, 'משפחת כהן', 'לקוח פרטי', 'דנה כהן', 'ההדרים 3, כפר סבא', 'תחזוקה חודשית', 650, 'active', ['משפחת כהן'], '2023-07-04', 'כלב בחצר — להודיע לפני כניסה.', [['call','תיאום גיזום עונתי',26]]),
      customer(5, 'חברת אזורים', 'חברה', 'עמית שגיא', "ז'בוטינסקי 22, פתח תקווה", 'תחזוקה שבועית', 3200, 'active', ['חברת אזורים'], '2020-11-01', 'חשבונית חודשית לכתובת הנהלת החשבונות.', [['payment','תזכורת תשלום נשלחה',30],['visit','הביקור לא בוצע — אין גישה לחצר',8]]),
      customer(6, 'משפחת לוי', 'לקוח פרטי', 'שירה לוי', 'ביאליק 20, רמת גן', 'תחזוקה חודשית', 700, 'active', ['גינת הדרים'], '2024-04-12', '', [['note','לדשן את עצי ההדר בביקור הבא',2 * 24]]),
      customer(7, 'גינת השקמים', 'לקוח פרטי', 'רון בן דוד', 'השקמים 5, הוד השרון', 'ביקורים לפי קריאה', 550, 'paused', ['גינת השקמים'], '2022-02-02', 'השהייה עד סוף השיפוץ בבית.', [['note','הלקוח ביקש להשהות עד סוף השיפוץ',15 * 24]]),
      customer(8, 'סטודיו עלמה', 'חברה', 'עלמה רז', 'הרצל 80, ראשון לציון', 'תחזוקה חודשית', 1300, 'lead', [], new Date().toISOString().slice(0,10), 'גינה פנימית ומרפסת גג.', [['quote','נשלחה הצעת מחיר',4]]),
      customer(9, 'יוסי כהן', 'לקוח פרטי', 'יוסי כהן', 'האלון 7, כפר סבא', 'פרויקט חד פעמי', 0, 'lead', [], new Date().toISOString().slice(0,10), 'מעוניין בתכנון גינה חדשה.', [['call','נקבעה פגישת היכרות',22]])
    ];
  }

  let customers;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    customers = Array.isArray(stored) ? stored : sampleCustomers();
  } catch { customers = sampleCustomers(); }
  const state = { filter:'active', selectedId:null, editingId:null };

  const save = () => { try { persist(STORAGE_KEY, customers); } catch { toast('אין מספיק מקום לשמירת הלקוחות במכשיר.'); } };
  const byId = id => customers.find(customer => customer.id === id);
  const toneOf = customer => TONES[customers.indexOf(customer) % TONES.length];
  const searchQuery = () => (document.getElementById('searchInput')?.value || '').trim().toLocaleLowerCase('he');
  const lastActivity = customer => Math.max(0, ...(customer.log || []).map(entry => entry.at));
  function visitsOf(customer) {
    try {
      const visits = JSON.parse(localStorage.getItem(VISITS_KEY) || '[]') || [];
      return visits.filter(visit => (customer.sites || []).includes(visit.name) || visit.client === customer.name).sort((a,b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
    } catch { return []; }
  }
  function counts() {
    const month = new Date().toISOString().slice(0,7);
    const active = customers.filter(customer => customer.status === 'active');
    return {
      active:active.length, lead:customers.filter(customer => customer.status === 'lead').length, paused:customers.filter(customer => customer.status === 'paused').length,
      income:active.reduce((sum, customer) => sum + (Number(customer.price) || 0), 0),
      visitsMonth:customers.reduce((sum, customer) => sum + visitsOf(customer).filter(visit => (visit.date || '').startsWith(month)).length, 0)
    };
  }
  const GALLERY = [1,2,3,4,5,6,7,8].map(number => `./images/garden-${number}.jpg`);
  const photoOwner = customer => `customer:${customer.id}`;
  let customerPhotos = new Map();
  function imageUrl(customer) {
    const image = customer.image;
    if (image?.kind === 'gallery') return GALLERY[image.index % GALLERY.length];
    return image?.kind === 'photo' ? customerPhotos.get(image.id) || null : null;
  }
  const avatar = customer => {
    const url = imageUrl(customer);
    return url ? `<img class="client-avatar x-avatar x-avatar-img" src="${safe(url)}" alt="">` : `<span class="client-avatar x-avatar ${toneOf(customer)}">${safe(initials(customer.name))}</span>`;
  };
  async function refreshPhotos() {
    const ids = new Set(customers.filter(customer => customer.image?.kind === 'photo').map(customer => customer.image.id));
    if (!ids.size || !window.esekliStore) return;
    try {
      customerPhotos = new Map((await window.esekliStore.listPhotos()).filter(photo => ids.has(photo.id)).map(photo => [photo.id, photo.data]));
      render();
    } catch {}
  }

  function listScreen() {
    const count = counts();
    const query = searchQuery();
    const tabs = [['active','פעילים',count.active],['lead','לידים',count.lead],['paused','מושהים',count.paused],['all','הכל',customers.length]];
    const list = customers.filter(customer => (state.filter === 'all' || customer.status === state.filter) && (!query || `${customer.name} ${customer.contact} ${customer.address} ${customer.type} ${customer.phone}`.toLocaleLowerCase('he').includes(query))).sort((a,b) => lastActivity(b) - lastActivity(a));
    return `<header class="v-heading"><div class="v-title-wrap"><span class="v-mark x-mark cust" aria-hidden="true">👥</span><div><p class="v-eyebrow">ניהול קשרי לקוחות</p><h1>תיקי לקוחות</h1><p>פרטי קשר, חבילות שירות, ביקורים ויומן פעילות לכל לקוח</p></div></div><button class="v-button primary" type="button" data-action="new">＋ לקוח חדש</button></header>
      <div class="v-stats"><div class="v-stat"><span class="v-stat-icon">👥</span><span><small>לקוחות פעילים</small><b>${count.active}</b></span></div><div class="v-stat"><span class="v-stat-icon">✦</span><span><small>לידים</small><b>${count.lead}</b></span></div><div class="v-stat"><span class="v-stat-icon">₪</span><span><small>הכנסה חודשית</small><b>${money(count.income)}</b></span></div><div class="v-stat"><span class="v-stat-icon">🌿</span><span><small>ביקורים החודש</small><b>${count.visitsMonth}</b></span></div></div>
      <div class="v-toolbar"><div class="v-tabs t-tabs" role="tablist">${tabs.map(([key,label,number]) => `<button type="button" role="tab" class="${state.filter === key ? 'selected' : ''}" aria-selected="${state.filter === key}" data-action="filter" data-filter="${key}">${label}<span class="t-tab-count">${number}</span></button>`).join('')}</div></div>
      <div class="t-list">${list.length ? list.map(customer => `<button type="button" class="t-item x-customer" data-action="open" data-id="${safe(customer.id)}">${avatar(customer)}<span class="t-body"><b>${safe(customer.name)}</b><span class="t-meta"><span>${safe(customer.type)}</span><i>·</i><span>${safe(customer.plan)}</span><i>·</i><span>${safe((customer.address || '').split(',').pop().trim())}</span>${customer.status !== 'active' ? `<i>·</i><span class="t-priority ${customer.status === 'lead' ? 'low' : ''}">${STATUS[customer.status]}</span>` : ''}</span></span><span class="x-side"><b>${customer.price ? `${money(customer.price)}<small>/חודש</small>` : ''}</b><small>${lastActivity(customer) ? safe(ago(lastActivity(customer))) : ''}</small></span></button>`).join('') : `<div class="v-empty">${query ? 'לא נמצאו לקוחות שמתאימים לחיפוש.' : 'אין לקוחות בקטגוריה הזו.'}</div>`}</div>
      <p class="v-notes">הנתונים נשמרים במכשיר עם היסטוריה וגיבוי. הטלפונים והמיילים בנתוני הדוגמה אינם אמיתיים.</p>`;
  }
  function detailScreen(customer) {
    const visits = visitsOf(customer);
    const log = [...(customer.log || [])].sort((a,b) => b.at - a.at);
    const info = [['איש קשר', customer.contact], ['טלפון', customer.phone, 'ltr'], ['אימייל', customer.email, 'ltr'], ['כתובת', customer.address], ['חבילת שירות', customer.plan], ['מחיר חודשי', customer.price ? money(customer.price) : '—'], ['לקוח מאז', customer.since ? dateLabel(customer.since) : '—'], ['סוג', customer.type]];
    return `<div class="x-detail-top"><button type="button" class="v-button ghost" data-action="back">→ כל הלקוחות</button><button type="button" class="v-button" data-action="edit">עריכה</button></div>
      <section class="h-panel x-card"><div class="x-card-head">${avatar(customer)}<div><h1>${safe(customer.name)}</h1><p>${safe(customer.type)} · ${safe(customer.plan)}</p></div><label class="x-status"><select data-status aria-label="סטטוס הלקוח">${Object.entries(STATUS).map(([key,label]) => `<option value="${key}" ${key === customer.status ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>
        <div class="x-contact"><button type="button" class="v-button" data-action="call">📞 שיחה</button><button type="button" class="v-button" data-action="whatsapp">💬 וואטסאפ</button><button type="button" class="v-button" data-action="email">✉ אימייל</button><button type="button" class="v-button" data-action="navigate">📍 ניווט</button></div>
        <dl class="x-info">${info.map(([label, value, dir]) => `<div><dt>${label}</dt><dd ${dir ? `dir="${dir}"` : ''}>${safe(value || '—')}</dd></div>`).join('')}</dl>
        ${customer.notes ? `<p class="x-notes">${safe(customer.notes)}</p>` : ''}</section>
      <section class="h-panel x-image-card">${imageUrl(customer) ? `<img src="${safe(imageUrl(customer))}" alt="התמונה שנבחרה">` : '<span class="x-image-empty" aria-hidden="true">🌿</span>'}<div><h2>תמונה בקווי העבודה</h2><p>${imageUrl(customer) ? `התמונה הזו מוצגת ב־${visits.length} ביקורים של הלקוח.` : 'לא נבחרה תמונה. כל ביקור מציג את התמונה שלו.'}${visits.length ? '' : ' עדיין אין ביקורים משויכים ללקוח.'}</p><button type="button" class="v-button primary" data-action="pick-image">שינוי תמונה</button></div></section>
      <div class="x-columns">
        <section class="h-panel"><div class="h-panel-head"><h2>ביקורי גינות</h2><small>${visits.length} ביקורים</small></div>${visits.length ? `<div class="x-visits">${visits.slice(0, 8).map(visit => `<div class="x-visit"><span>${safe(visit.date?.split('-').reverse().join('/'))} ${safe(visit.time || '')}</span><b>${safe(visit.name)}</b><span class="h-chip">${VISIT_STATUS[visit.status] || ''}</span></div>`).join('')}</div>` : '<p class="h-muted">אין ביקורים משויכים. ביקורים משויכים לפי שם הגינה או שם הלקוח בביקור.</p>'}</section>
        <section class="h-panel"><div class="h-panel-head"><h2>יומן פעילות</h2><small>${log.length} רשומות</small></div>
          <form class="x-log-form" data-log-form><select name="kind" aria-label="סוג">${Object.entries(LOG_KINDS).map(([key,[emoji,label]]) => `<option value="${key}">${emoji} ${label}</option>`).join('')}</select><input name="text" maxlength="160" placeholder="מה קרה?" aria-label="תיאור" required><button class="v-button primary" type="submit">הוספה</button></form>
          <div class="x-log">${log.length ? log.map(entry => `<div class="x-log-row"><span class="x-log-icon">${LOG_KINDS[entry.kind]?.[0] || '📝'}</span><span><b>${safe(entry.text)}</b><small>${LOG_KINDS[entry.kind]?.[1] || 'הערה'} · ${safe(ago(entry.at))}</small></span><button type="button" class="h-link" data-action="delete-log" data-log="${safe(entry.id)}" aria-label="מחיקה">✕</button></div>`).join('') : '<p class="h-muted">עדיין אין פעילות.</p>'}</div></section>
      </div>`;
  }
  function render() {
    const customer = state.selectedId && byId(state.selectedId);
    if (!customer) state.selectedId = null;
    root.innerHTML = `<div class="v-page t-page x-page">${customer ? detailScreen(customer) : listScreen()}</div>`;
    renderDashboard();
  }
  function renderDashboard() {
    const list = document.getElementById('dashboardCustomers');
    if (list) {
      const empty = list.querySelector('[data-empty]');
      list.querySelectorAll('.client-row').forEach(row => row.remove());
      const recent = customers.filter(customer => customer.log?.length).sort((a,b) => lastActivity(b) - lastActivity(a)).slice(0, 4);
      list.insertAdjacentHTML('afterbegin', recent.map(customer => {
        const last = [...customer.log].sort((a,b) => b.at - a.at)[0];
        return `<a class="client-row" href="#customersPage" data-open-customer="${safe(customer.id)}" data-search="${safe(`${customer.name} ${customer.contact}`)}"><span class="client-avatar ${toneOf(customer)}">${safe(initials(customer.name))}</span><span class="client-copy"><strong>${safe(customer.name)}</strong><span>${safe(last.text)}</span></span><span class="client-date">${safe(ago(last.at))}</span></a>`;
      }).join(''));
      if (empty) list.append(empty);
      window.applySearch?.();
    }
    const count = counts();
    const set = (id, text) => { const element = document.getElementById(id); if (element) element.textContent = text; };
    set('activeCustomerCount', count.active);
    set('customersFoot', `${count.lead} לידים · ${money(count.income)} בחודש`);
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'v-dialog';
  document.body.append(dialog);
  function openDialog(customer = null) {
    state.editingId = customer?.id || null;
    const value = customer || { name:'', type:TYPES[0], contact:'', phone:'', email:'', address:'', plan:PLANS[0], price:'', status:'lead', sites:[], since:new Date().toISOString().slice(0,10), notes:'' };
    dialog.innerHTML = `<form method="dialog" data-customer-form><h2>${customer ? 'עריכת לקוח' : 'לקוח חדש'}</h2>
      <div class="v-form-row"><label class="v-field">שם הלקוח<input name="name" maxlength="60" value="${safe(value.name)}" required></label><label class="v-field">סוג<select name="type">${TYPES.map(type => `<option ${type === value.type ? 'selected' : ''}>${type}</option>`).join('')}</select></label></div>
      <div class="v-form-row"><label class="v-field">איש קשר<input name="contact" maxlength="50" value="${safe(value.contact)}"></label><label class="v-field">טלפון<input name="phone" type="tel" maxlength="20" dir="ltr" value="${safe(value.phone)}"></label></div>
      <div class="v-form-row"><label class="v-field">אימייל<input name="email" type="email" maxlength="80" dir="ltr" value="${safe(value.email)}"></label><label class="v-field">סטטוס<select name="status">${Object.entries(STATUS).map(([key,label]) => `<option value="${key}" ${key === value.status ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>
      <label class="v-field">כתובת<input name="address" maxlength="100" value="${safe(value.address)}" placeholder="רחוב ומספר, עיר"></label>
      <div class="v-form-row"><label class="v-field">חבילת שירות<select name="plan">${PLANS.map(plan => `<option ${plan === value.plan ? 'selected' : ''}>${plan}</option>`).join('')}</select></label><label class="v-field">מחיר חודשי (₪)<input name="price" type="number" min="0" step="10" value="${safe(value.price)}"></label></div>
      <div class="v-form-row"><label class="v-field">שמות הגינות (מופרדים בפסיק)<input name="sites" maxlength="150" value="${safe((value.sites || []).join(', '))}"></label><label class="v-field">לקוח מאז<input name="since" type="date" value="${safe(value.since)}"></label></div>
      <label class="v-field">הערות<textarea name="notes" maxlength="300">${safe(value.notes)}</textarea></label>
      <div class="v-dialog-actions"><button class="v-button primary" type="submit">${customer ? 'שמירה' : 'הוספה'}</button><button class="v-button" type="button" data-close>ביטול</button>${customer ? '<button class="v-button t-delete" type="button" data-delete>מחיקה</button>' : ''}</div></form>`;
    dialog.showModal();
  }
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target.closest('[data-close]')) { dialog.close(); return; }
    const customer = state.editingId && byId(state.editingId);
    if (event.target.closest('[data-delete]') && customer && window.confirm(`למחוק את התיק של ${customer.name}?`)) {
      customers = customers.filter(item => item.id !== customer.id);
      state.selectedId = null;
      save(); dialog.close(); render(); toast('התיק נמחק. אפשר לשחזר אותו ממסך ההיסטוריה.');
    }
  });
  dialog.addEventListener('submit', event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    const fields = { name:values.name.trim(), type:values.type, contact:values.contact.trim(), phone:values.phone.trim(), email:values.email.trim(), status:values.status, address:values.address.trim(), plan:values.plan, price:Number(values.price) || 0, sites:values.sites.split(',').map(site => site.trim()).filter(Boolean), since:values.since, notes:values.notes.trim() };
    if (!fields.name) return;
    const existing = state.editingId && byId(state.editingId);
    if (existing) Object.assign(existing, fields);
    else {
      const id = newId('cust');
      customers.push({ id, ...fields, log:[{ id:newId('log'), kind:'note', text:'התיק נפתח', at:Date.now() }] });
      state.selectedId = id;
    }
    save(); dialog.close(); render();
    toast(existing ? 'פרטי הלקוח עודכנו.' : 'התיק נפתח.');
  });

  // Image picker: an upload, a photo from one of the customer's visits, or a garden photo.
  const picker = document.createElement('dialog');
  picker.className = 'v-dialog x-picker';
  document.body.append(picker);
  const sameImage = (a, b) => a?.kind === b?.kind && a?.id === b?.id && a?.index === b?.index;
  const tile = (customer, image, url, label, removable = '') => `<span class="x-tile ${sameImage(customer.image, image) ? 'on' : ''}"><button type="button" data-pick='${safe(JSON.stringify(image))}' aria-label="${safe(label)}"><img src="${safe(url)}" alt=""></button>${removable}</span>`;
  async function openPicker(customer) {
    let photos = [];
    try { photos = await window.esekliStore.listPhotos(); } catch { toast('אחסון התמונות אינו זמין בדפדפן הזה.'); }
    const uploads = photos.filter(photo => photo.visitId === photoOwner(customer));
    const visitIds = new Set(visitsOf(customer).map(visit => visit.id));
    const fromVisits = photos.filter(photo => visitIds.has(photo.visitId));
    const section = (title, content) => content ? `<h3>${title}</h3><div class="x-tiles">${content}</div>` : '';
    picker.innerHTML = `<div class="h-viewer-body"><div class="h-viewer-head"><div><p class="v-eyebrow">${safe(customer.name)}</p><h2>בחירת תמונה לקווי העבודה</h2></div><button type="button" class="v-button" data-close>סגירה</button></div>
      <div class="x-picker-actions"><label class="v-button primary">העלאת תמונה מהמכשיר<input type="file" accept="image/*" hidden data-image-upload></label><button type="button" class="v-button" data-pick="null" ${customer.image ? '' : 'disabled'}>ללא תמונה קבועה</button></div>
      ${section('תמונות שהעלית', uploads.map(photo => tile(customer, { kind:'photo', id:photo.id }, photo.data, 'תמונה שהעלית', `<button type="button" class="x-tile-remove" data-remove="${safe(photo.id)}" aria-label="מחיקת התמונה">×</button>`)).join(''))}
      ${section('תמונות מהביקורים', fromVisits.map(photo => tile(customer, { kind:'photo', id:photo.id }, photo.data, 'תמונה מביקור')).join(''))}
      ${section('תמונות גינות', GALLERY.map((url, index) => tile(customer, { kind:'gallery', index }, url, `תמונת גינה ${index + 1}`)).join(''))}</div>`;
    picker.dataset.customer = customer.id;
    if (!picker.open) picker.showModal();
  }
  function applyImage(customer, image, message) {
    if (image) customer.image = image; else delete customer.image;
    save();
    render();
    document.dispatchEvent(new CustomEvent('esekli:customer-image'));
    toast(message);
  }
  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(image.src);
        resolve(canvas.toDataURL('image/jpeg', .78));
      };
      image.onerror = reject;
      image.src = URL.createObjectURL(file);
    });
  }
  picker.addEventListener('click', async event => {
    if (event.target === picker || event.target.closest('[data-close]')) { picker.close(); return; }
    const customer = byId(picker.dataset.customer);
    if (!customer) return;
    const pick = event.target.closest('[data-pick]');
    if (pick && !pick.disabled) {
      const image = JSON.parse(pick.dataset.pick);
      if (image?.kind === 'photo' && !customerPhotos.has(image.id)) {
        const photo = (await window.esekliStore.listPhotos()).find(item => item.id === image.id);
        if (photo) customerPhotos.set(photo.id, photo.data);
      }
      picker.close();
      applyImage(customer, image, image ? 'התמונה עודכנה בקווי העבודה.' : 'התמונה הקבועה הוסרה.');
      return;
    }
    const remove = event.target.closest('[data-remove]');
    if (remove && window.confirm('למחוק את התמונה? אפשר לשחזר אותה 30 יום ממסך ההיסטוריה.')) {
      const photo = (await window.esekliStore.listPhotos()).find(item => item.id === remove.dataset.remove);
      if (photo) await window.esekliStore.removePhoto(photo);
      if (customer.image?.id === remove.dataset.remove) applyImage(customer, null, 'התמונה נמחקה.');
      await openPicker(customer);
    }
  });
  picker.addEventListener('change', async event => {
    if (!event.target.matches('[data-image-upload]')) return;
    const customer = byId(picker.dataset.customer);
    const file = event.target.files?.[0];
    if (!customer || !file) return;
    if (!file.type.startsWith('image/')) { toast('אפשר להעלות קובצי תמונה בלבד.'); return; }
    try {
      const photo = { id:newId('customer-photo'), visitId:photoOwner(customer), data:await resizeImage(file), createdAt:Date.now() };
      await window.esekliStore.savePhoto(photo);
      customerPhotos.set(photo.id, photo.data);
      picker.close();
      applyImage(customer, { kind:'photo', id:photo.id }, 'התמונה הועלתה ועודכנה בקווי העבודה.');
    } catch { toast('לא ניתן לשמור את התמונה במכשיר.'); }
  });

  const digits = phone => { const value = String(phone || '').replace(/\D/g,''); return value.startsWith('0') ? `972${value.slice(1)}` : value; };
  const openExternal = url => window.open(url, '_blank', 'noopener,noreferrer');
  root.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const customer = byId(state.selectedId);
    if (action === 'new') openDialog();
    if (action === 'filter') { state.filter = target.dataset.filter; render(); }
    if (action === 'open') { state.selectedId = target.dataset.id; render(); window.scrollTo(0,0); }
    if (action === 'back') { state.selectedId = null; render(); }
    if (!customer) return;
    if (action === 'edit') openDialog(customer);
    if (action === 'pick-image') openPicker(customer);
    if (action === 'call') customer.phone ? (window.location.href = `tel:+${digits(customer.phone)}`) : toast('לא הוגדר טלפון.');
    if (action === 'whatsapp') customer.phone ? openExternal(`https://wa.me/${digits(customer.phone)}`) : toast('לא הוגדר טלפון.');
    if (action === 'email') customer.email ? (window.location.href = `mailto:${customer.email}`) : toast('לא הוגדר אימייל.');
    if (action === 'navigate') customer.address ? openExternal(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(customer.address)}`) : toast('לא הוגדרה כתובת.');
    if (action === 'delete-log' && window.confirm('למחוק את הרשומה מהיומן?')) { customer.log = customer.log.filter(entry => entry.id !== target.dataset.log); save(); render(); }
  });
  root.addEventListener('change', event => {
    const customer = byId(state.selectedId);
    if (!customer || !event.target.matches('[data-status]')) return;
    customer.status = event.target.value;
    customer.log.push({ id:newId('log'), kind:'note', text:`הסטטוס שונה ל${STATUS[customer.status]}`, at:Date.now() });
    save(); render();
  });
  root.addEventListener('submit', event => {
    const customer = byId(state.selectedId);
    if (!customer || !event.target.matches('[data-log-form]')) return;
    event.preventDefault();
    const text = event.target.elements.text.value.trim();
    if (!text) return;
    customer.log.push({ id:newId('log'), kind:event.target.elements.kind.value, text, at:Date.now() });
    save(); render();
  });
  // Dashboard rows open the customer's file directly.
  document.getElementById('dashboardCustomers')?.addEventListener('click', event => {
    const row = event.target.closest('[data-open-customer]');
    if (!row) return;
    event.preventDefault();
    state.selectedId = row.dataset.openCustomer;
    document.querySelector('.nav-link[data-nav="customers"]')?.click();
    render();
  });
  document.getElementById('searchInput')?.addEventListener('input', () => { if (!root.closest('[hidden]')) { state.selectedId = null; render(); } });

  save();
  render();
  refreshPhotos();
}
