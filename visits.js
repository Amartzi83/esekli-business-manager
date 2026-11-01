const root = document.getElementById('visits-root');
if (root) {
  const STORAGE_KEY = 'esekli-garden-visits-v2';
  const LEGACY_KEY = 'esekli-garden-visits-v1';
  const DAY_KEY = 'esekli-workday-v1';
  const PHOTOS = [1,2,3,4,5,6,7,8].map(n => `./images/garden-${n}.jpg`);
  const DEFAULT_TASKS = ['כיסוח דשא','גיזום שיחים וגדר חיה','ניקוי עלים וגזם','בדיקת מערכת השקיה','דישון','פינוי גזם'];
  const SERVICES = ['תחזוקה חודשית','תחזוקה שבועית','תחזוקה דו שבועית','גיזום עונתי','שתילה ודישון','בדיקת השקיה','ביקור חד פעמי'];
  const STATUS = {
    planned:{ label:'ממתין', route:'ממתין', kind:'wait', icon:'circle', hero:'ממתין לביקור' },
    inProgress:{ label:'בתהליך', route:'התחיל ביקור', kind:'active', icon:'spark', hero:'ביקור פעיל' },
    completed:{ label:'הושלם', route:'הושלם', kind:'done', icon:'check', hero:'ביקור הושלם' },
    missed:{ label:'לא בוצע', route:'לא בוצע', kind:'missed', icon:'flag', hero:'לא בוצע' }
  };
  // Approximate city centres, used for the illustrated map and distance estimates.
  const CITIES = {
    'תל אביב':[32.0853,34.7818], 'רמת השרון':[32.1461,34.8394], 'הרצליה':[32.1663,34.8436], 'רעננה':[32.1848,34.8713],
    'כפר סבא':[32.1750,34.9070], 'פתח תקווה':[32.0840,34.8878], 'רמת גן':[32.0684,34.8248], 'גבעתיים':[32.0722,34.8125],
    'הוד השרון':[32.1500,34.8880], 'בני ברק':[32.0807,34.8338], 'חולון':[32.0158,34.7874], 'בת ים':[32.0171,34.7454],
    'ראשון לציון':[31.9730,34.7925], 'נתניה':[32.3215,34.8532], 'ראש העין':[32.0956,34.9566], 'כפר יונה':[32.3167,34.9333]
  };
  const COAST = [[31.95,34.735],[32.0,34.745],[32.05,34.758],[32.1,34.774],[32.15,34.794],[32.2,34.81],[32.25,34.825],[32.3,34.845],[32.36,34.856]];

  const pad = value => String(value).padStart(2,'0');
  const dayKey = date => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  const fromKey = key => { const [y,m,d] = key.split('-').map(Number); return new Date(y,m-1,d); };
  const shiftDay = (key,days) => { const date = fromKey(key); date.setDate(date.getDate()+days); return dayKey(date); };
  const todayKey = () => dayKey(new Date());
  const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const toast = message => (window.showToast ? window.showToast(message) : console.info(message));
  const uid = prefix => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const longDate = key => new Intl.DateTimeFormat('he-IL',{ weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(fromKey(key));
  const shortDate = key => { const [y,m,d] = key.split('-'); return `${d}/${m}/${y}`; };
  const groupDate = key => new Intl.DateTimeFormat('he-IL',{ weekday:'long', day:'numeric', month:'long' }).format(fromKey(key));
  const clock = minutes => `${Math.floor(minutes/60)}:${pad(Math.round(minutes%60))}`;
  const makeTasks = (prefix, doneCount = 0) => DEFAULT_TASKS.map((label,index) => ({ id:`${prefix}-t${index}`, label, done:index < doneCount }));

  const ICONS = {
    dots:'<circle cx="12" cy="5" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="19" r="1.7" fill="currentColor"/>',
    plus:'<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" stroke-width="1.9"/><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17M7.5 13h2m3 0h2m3 0h0M7.5 16.5h2m3 0h2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    left:'<path d="m14.5 5-7 7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    right:'<path d="m9.5 5 7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    down:'<path d="m6 9.5 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    users:'<circle cx="9" cy="8" r="3.3" fill="currentColor"/><path d="M2.5 19.5c.4-3.6 2.8-5.6 6.5-5.6s6.1 2 6.5 5.6Z" fill="currentColor"/><circle cx="17" cy="9" r="2.6" fill="currentColor" opacity=".75"/><path d="M15.6 13.6c3.3-.3 5.6 1.5 6 5h-4.6c-.2-2-.7-3.6-1.4-5Z" fill="currentColor" opacity=".75"/>',
    sprout:'<path d="M12 21v-8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 13C12 8 8.6 5.5 4 5.5c0 4.6 3 7.5 8 7.5Z" fill="currentColor"/><path d="M12 11.5c0-4.4 2.9-7 7.5-7 0 4.3-2.8 7-7.5 7Z" fill="currentColor" opacity=".8"/>',
    clock:'<circle cx="12" cy="12" r="8.6" stroke="currentColor" stroke-width="2"/><path d="M12 7.3V12l3.2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    car:'<path d="M5 11.2 6.7 6.6A2 2 0 0 1 8.6 5.3h6.8a2 2 0 0 1 1.9 1.3l1.7 4.6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M3.5 12.6a1.8 1.8 0 0 1 1.8-1.8h13.4a1.8 1.8 0 0 1 1.8 1.8V17H3.5Z" fill="currentColor"/><path d="M5 17v2M19 17v2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="7.4" cy="14" r="1.2" fill="#1b2420"/><circle cx="16.6" cy="14" r="1.2" fill="#1b2420"/>',
    filter:'<path d="M4 5h16l-6.2 7.4V19l-3.6-1.8v-4.8Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>',
    expand:'<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
    check:'<path d="m5 12.5 4.3 4.3L19 7.2" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    circle:'<circle cx="12" cy="12" r="6.5" stroke="currentColor" stroke-width="2.6"/>',
    spark:'<circle cx="12" cy="12" r="8" fill="currentColor"/><path d="M9.5 15.2 14.8 9" stroke="#f5a524" stroke-width="2.4" stroke-linecap="round"/><circle cx="15.3" cy="15.3" r="1.3" fill="#f5a524"/>',
    flag:'<path d="M6 21V4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M6 4.5h11.5l-2.6 4 2.6 4H6Z" fill="currentColor"/>',
    pin:'<path d="M12 21.5s7-5.6 7-11.6a7 7 0 0 0-14 0c0 6 7 11.6 7 11.6Z" fill="currentColor"/><circle cx="12" cy="9.8" r="2.6" fill="#141c19"/>',
    pinLine:'<path d="M12 21s6.6-5.4 6.6-11.2a6.6 6.6 0 0 0-13.2 0C5.4 15.6 12 21 12 21Z" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="9.8" r="2.4" stroke="currentColor" stroke-width="1.9"/>',
    play:'<path d="M7.5 4.8v14.4a.8.8 0 0 0 1.2.7l11.4-7.2a.8.8 0 0 0 0-1.4L8.7 4.1a.8.8 0 0 0-1.2.7Z" fill="currentColor"/>',
    stop:'<rect x="5.5" y="5.5" width="13" height="13" rx="2" fill="currentColor"/>',
    nav:'<path d="M3.5 11.2 20.2 3.8l-7.4 16.7-1.9-7.4Z" fill="currentColor"/>',
    layers:'<path d="m12 3.5 9 4.8-9 4.8-9-4.8Z" fill="currentColor"/><path d="m3 12.2 9 4.8 9-4.8M3 16l9 4.8 9-4.8" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>',
    sparkles:'<path d="M10 3.5 11.8 9l5.5 1.8-5.5 1.8L10 18l-1.8-5.4-5.5-1.8L8.2 9Z" fill="currentColor"/><path d="m18 3 .8 2.2L21 6l-2.2.8L18 9l-.8-2.2L15 6l2.2-.8Z" fill="currentColor"/><path d="m18.5 15 .6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6Z" fill="currentColor"/>',
    route:'<circle cx="6" cy="18" r="2.4" stroke="currentColor" stroke-width="1.9"/><circle cx="18" cy="6" r="2.4" stroke="currentColor" stroke-width="1.9"/><path d="M8.4 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    listCheck:'<rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="currentColor"/><path d="m6.6 8.4 1.4 1.4 2.4-2.6M6.6 15l1.4 1.4 2.4-2.6M13 8.8h4.4M13 15.4h4.4" stroke="#0e1a14" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    warning:'<path d="M10.3 4.2a2 2 0 0 1 3.4 0l7.4 12.9a2 2 0 0 1-1.7 3H4.6a2 2 0 0 1-1.7-3Z" fill="currentColor"/><path d="M12 9v4.6" stroke="#2a1414" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="16.9" r="1.2" fill="#2a1414"/>',
    comment:'<path d="M4 5.5A2 2 0 0 1 6 3.5h12a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2h-7.5L6 20.5V17a2 2 0 0 1-2-2Z" fill="currentColor"/><path d="M8 8.6h8M8 12h5.5" stroke="#18211d" stroke-width="1.8" stroke-linecap="round"/>',
    phone:'<path d="M6.8 3.5h2.7l1.4 4.3-2 1.6a12 12 0 0 0 5.7 5.7l1.6-2 4.3 1.4v2.7a2 2 0 0 1-2.1 2A15.6 15.6 0 0 1 4.8 5.6a2 2 0 0 1 2-2.1Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>',
    whatsapp:'<path d="M12 3.3a8.7 8.7 0 0 0-7.5 13.1L3.3 20.7l4.4-1.2A8.7 8.7 0 1 0 12 3.3Z" fill="currentColor"/><path d="M9.2 7.8c-.3 0-.7.1-.9.5-.3.4-.9 1.1-.6 2.4.3 1.4 1.6 3.2 3.4 4.3 1.9 1.1 3.1 1.1 3.9.8.7-.3 1.2-1 1.2-1.5 0-.3-.1-.4-.4-.5l-1.6-.8c-.3-.1-.5 0-.7.2l-.6.8c-.2.2-.4.2-.6.1a6.3 6.3 0 0 1-2.9-2.6c-.1-.2 0-.4.1-.5l.5-.6c.2-.2.2-.4.1-.6l-.7-1.6c-.1-.3-.3-.4-.6-.4Z" fill="#141c19"/>',
    camera:'<path d="M4 8.5a2 2 0 0 1 2-2h2l1.4-2h5.2l1.4 2h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" fill="currentColor"/><circle cx="12" cy="13" r="3.4" fill="#18211d"/><circle cx="12" cy="13" r="1.8" fill="currentColor"/>',
    clipboard:'<rect x="4.5" y="4.5" width="15" height="16.5" rx="2.4" stroke="currentColor" stroke-width="1.9"/><path d="M9 4.5V3.4h6v1.1M8.2 10h7.6M8.2 13.5h7.6M8.2 17h4.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    photo:'<rect x="3.5" y="5" width="17" height="14.5" rx="2.5" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="12.4" r="3.4" stroke="currentColor" stroke-width="1.9"/><path d="M8.5 5 10 3h4l1.5 2" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>',
    locate:'<circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    trash:'<path d="M5 7h14M10 7V4.8h4V7M7 7l.8 12.4a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
    close:'<path d="m6.5 6.5 11 11m0-11-11 11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
  };
  const icon = (name, className = '') => `<svg class="wl-i ${className}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  function sampleVisits() {
    const today = todayKey();
    const visit = (id, date, time, name, client, address, duration, photo, status, doneCount, extra = {}) => ({
      id, date, time, name, client, service:'תחזוקה חודשית', address, duration, team:'צוות 1', phone:'', photo, notes:'',
      status, tasks:makeTasks(id, doneCount), issues:[], samplePhotos:[], ...extra
    });
    return [
      visit('v-1', today, '08:00', 'גינת רמות', 'חברת רמות', 'הרצל 12, תל אביב', 60, 0, 'completed', 6),
      visit('v-2', today, '09:30', 'בניין השרון', 'לקוח פרטי', 'סוקולוב 4, רמת השרון', 50, 1, 'completed', 6),
      visit('v-3', today, '11:00', 'ניצנות בית הדקל', 'חברת ניהול', 'הנדיב 8, הרצליה', 45, 2, 'inProgress', 2, {
        notes:'לשים לב לטפטפת ליד עץ הלימון. לתאם עם ועד הבית לפני הכניסה.',
        samplePhotos:[2,3,4],
        issues:[
          { id:'v-3-i1', text:'טפטפת סתומה בערוגה המזרחית', at:Date.now()-3600000, resolved:false },
          { id:'v-3-i2', text:'ברז הגינה דולף', at:Date.now()-1800000, resolved:false }
        ]
      }),
      visit('v-4', today, '12:30', 'בניין הסביון', 'לקוח פרטי', 'הסביון 15, רעננה', 45, 3, 'planned', 0),
      visit('v-5', today, '14:00', 'משפחת כהן', 'לקוח פרטי', 'ההדרים 3, כפר סבא', 60, 4, 'planned', 0),
      visit('v-6', today, '15:30', 'חברת אזורים', 'חברת ניהול', "ז'בוטינסקי 22, פתח תקווה", 75, 5, 'missed', 0),
      visit('v-7', shiftDay(today,1), '08:30', 'גינת הדרים', 'משפחת לוי', 'ביאליק 20, רמת גן', 60, 6, 'planned', 0),
      visit('v-8', shiftDay(today,1), '10:00', 'גינת השקמים', 'לקוח פרטי', 'השקמים 5, הוד השרון', 45, 7, 'planned', 0),
      visit('v-9', shiftDay(today,2), '09:00', 'בית הדקל', 'ועד הבית', 'הנשיא 14, הרצליה', 60, 1, 'planned', 0),
      visit('v-10', shiftDay(today,-14), '11:00', 'ניצנות בית הדקל', 'חברת ניהול', 'הנדיב 8, הרצליה', 45, 2, 'completed', 6),
      visit('v-11', shiftDay(today,-28), '10:30', 'ניצנות בית הדקל', 'חברת ניהול', 'הנדיב 8, הרצליה', 45, 2, 'completed', 6)
    ];
  }
  function legacyVisits() {
    try {
      const stored = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
      if (!Array.isArray(stored)) return [];
      return stored.filter(visit => !String(visit.id).startsWith('garden-')).map((visit,index) => ({
        id:visit.id, date:todayKey(), time:visit.time || '08:00', name:visit.name || 'ביקור', client:visit.client || '', service:visit.treatment || SERVICES[0],
        address:visit.address || '', duration:Number(visit.duration) || 60, team:'צוות 1', phone:'', photo:index % PHOTOS.length, notes:visit.notes || '',
        status:visit.status || 'planned', tasks:Array.isArray(visit.tasks) ? visit.tasks : makeTasks(visit.id), issues:[], samplePhotos:[]
      }));
    } catch { return []; }
  }

  let visits;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    visits = Array.isArray(stored) ? stored : [...sampleVisits(), ...legacyVisits()];
  } catch { visits = sampleVisits(); }
  let workday;
  try { workday = JSON.parse(localStorage.getItem(DAY_KEY) || 'null'); } catch { workday = null; }
  if (!workday) workday = {
    team:'צוות 1 - נהוראי',
    members:[{ name:'נהוראי מרציאנו', initial:'נ' }, { name:'שותף לעסק', initial:'ש' }],
    vehicle:{ label:'רכב גינון', model:'קיה ריו', plate:'123-45-678' }
  };

  const state = { view:'lines', range:'day', date:todayKey(), status:'', client:'', team:'', compact:false, visitId:null, tab:'details', menu:false, mapStyle:'satellite' };
  // Writes go through the shared store (history + backups) when it is loaded.
  const persist = (key, value) => window.esekliStore ? window.esekliStore.write(key, value) : localStorage.setItem(key, JSON.stringify(value));
  const save = () => {
    try { persist(STORAGE_KEY, visits); persist(DAY_KEY, workday); }
    catch { toast('אין מספיק מקום לשמירת הנתונים במכשיר.'); }
  };
  const byId = id => visits.find(visit => visit.id === id);
  const byTime = (a,b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '');
  const dayVisits = (key = state.date) => visits.filter(visit => visit.date === key).sort(byTime);
  const photoUrl = visit => PHOTOS[(Number(visit.photo) || 0) % PHOTOS.length];
  const progressOf = visit => visit.tasks.length ? Math.round(visit.tasks.filter(task => task.done).length / visit.tasks.length * 100) : 0;
  const nextVisit = list => list.find(visit => visit.status === 'inProgress') || list.find(visit => visit.status === 'planned');

  function cityOf(visit) {
    const name = Object.keys(CITIES).find(city => (visit.address || '').includes(city));
    return name || null;
  }
  function coordsOf(visit) {
    const city = cityOf(visit);
    let hash = 0;
    for (const character of `${visit.address}${visit.name}`) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    const jitterLat = ((hash % 1000) / 1000 - .5) * .012;
    const jitterLng = (((hash >> 10) % 1000) / 1000 - .5) * .012;
    const [lat,lng] = city ? CITIES[city] : [32.11 + ((hash % 97) / 97 - .5) * .1, 34.84 + (((hash >> 7) % 89) / 89 - .5) * .1];
    return [lat + jitterLat, lng + jitterLng];
  }
  function distanceKm(list) {
    let total = 0;
    for (let index = 1; index < list.length; index++) {
      const [lat1,lng1] = coordsOf(list[index-1]);
      const [lat2,lng2] = coordsOf(list[index]);
      const dLat = (lat2-lat1) * Math.PI/180;
      const dLng = (lng2-lng1) * Math.PI/180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
      total += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    return total * 1.35;
  }

  function rangeVisits() {
    const all = [...visits].sort(byTime);
    if (state.range === 'day') return all.filter(visit => visit.date === state.date);
    if (state.range === 'list') return all;
    const anchor = fromKey(state.date);
    if (state.range === 'week') {
      const start = new Date(anchor); start.setDate(anchor.getDate() - anchor.getDay());
      const end = new Date(start); end.setDate(start.getDate() + 6);
      return all.filter(visit => visit.date >= dayKey(start) && visit.date <= dayKey(end));
    }
    const prefix = state.date.slice(0,7);
    return all.filter(visit => visit.date.startsWith(prefix));
  }
  function filtered(list) {
    return list.filter(visit => (!state.status || visit.status === state.status) && (!state.client || visit.client === state.client) && (!state.team || visit.team === state.team));
  }
  function rangeLabel() {
    if (state.range === 'day') return longDate(state.date);
    if (state.range === 'list') return 'כל הביקורים';
    const anchor = fromKey(state.date);
    if (state.range === 'month') return new Intl.DateTimeFormat('he-IL',{ month:'long', year:'numeric' }).format(anchor);
    const start = new Date(anchor); start.setDate(anchor.getDate() - anchor.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const format = new Intl.DateTimeFormat('he-IL',{ day:'numeric', month:'long' });
    return `${format.format(start)} – ${format.format(end)} ${end.getFullYear()}`;
  }

  function statusPill(visit, mode = 'lines') {
    const meta = STATUS[visit.status] || STATUS.planned;
    const bar = mode === 'lines' && visit.status === 'inProgress' ? `<span class="wl-pill-bar"><i style="width:${progressOf(visit)}%"></i></span>` : '';
    return `<span class="wl-pill-wrap"><span class="wl-pill ${meta.kind} ${mode}">${icon(meta.icon)}<span class="wl-he">${mode === 'route' ? meta.route : meta.label}</span></span>${bar}</span>`;
  }
  function select(name, label, options, current) {
    return `<label class="wl-select ${current ? 'set' : ''}"><select data-filter="${name}" aria-label="${safe(label)}"><option value="">${safe(label)}</option>${options.map(([value,text]) => `<option value="${safe(value)}" ${value === current ? 'selected' : ''}>${safe(text)}</option>`).join('')}</select>${icon('down')}</label>`;
  }

  // Screen 1 — work lines
  function linesScreen() {
    const list = rangeVisits();
    const shown = filtered(list);
    const done = list.filter(visit => visit.status === 'completed').length;
    const percent = list.length ? Math.round(done / list.length * 100) : 0;
    const hours = list.reduce((sum,visit) => sum + (Number(visit.duration) || 0), 0) / 60;
    const km = [...new Set(list.map(visit => visit.date))].reduce((sum,date) => sum + distanceKm(list.filter(visit => visit.date === date)), 0);
    const teams = new Set(list.map(visit => visit.team).filter(Boolean)).size;
    const clients = [...new Set(visits.map(visit => visit.client).filter(Boolean))].map(value => [value,value]);
    const teamOptions = [...new Set(visits.map(visit => visit.team).filter(Boolean))].map(value => [value,value]);
    const started = dayVisits(todayKey()).some(visit => visit.status !== 'planned');
    const tabs = [['list','רשימה'],['month','חודש'],['week','שבוע'],['day','יום']];
    const groups = state.range === 'day' ? [[state.date, shown]] : [...new Set(shown.map(visit => visit.date))].map(date => [date, shown.filter(visit => visit.date === date)]);
    const rows = shown.length ? groups.map(([date,items]) => `${state.range === 'day' ? '' : `<div class="wl-group"><span class="wl-he">${safe(groupDate(date))}</span><small>${items.length}</small></div>`}${items.map(lineRow).join('')}`).join('') : `<div class="wl-empty wl-he">${list.length ? 'אין ביקורים שמתאימים לסינון.' : 'אין ביקורים בטווח הזה. אפשר להוסיף ביקור חדש.'}</div>`;
    return `<div class="wl wl-lines ${state.compact ? 'compact' : ''}">
      <header class="wl-top"><button type="button" class="wl-icon-btn wl-menu-shell" data-action="open-menu" aria-label="תפריט">${icon('dots')}</button><h1>${icon('calendar','wl-green')}<span class="wl-he">קווי עבודה</span></h1><button type="button" class="wl-fab" data-action="new-visit" aria-label="ביקור חדש">${icon('plus')}</button></header>
      <div class="wl-date"><button type="button" data-action="date-next" aria-label="הבא">${icon('left')}</button><span>${icon('calendar')}<b class="wl-he">${safe(rangeLabel())}</b></span><button type="button" data-action="date-prev" aria-label="הקודם">${icon('right')}</button></div>
      <div class="wl-seg" role="tablist" aria-label="טווח תצוגה">${tabs.map(([key,label]) => `<button type="button" role="tab" aria-selected="${state.range === key}" class="${state.range === key ? 'on' : ''}" data-action="range" data-range="${key}">${label}</button>`).join('')}</div>
      <div class="wl-stats4">
        <div class="wl-stat blue">${icon('users')}<b>${teams}</b><small class="wl-he">צוותים בשטח</small></div>
        <div class="wl-stat green">${icon('sprout')}<b>${list.length}</b><small class="wl-he">${state.range === 'day' ? 'גינות היום' : 'גינות בטווח'}</small></div>
        <div class="wl-stat">${icon('clock')}<b>${Number.isInteger(hours) ? hours : hours.toFixed(1)}</b><small class="wl-he">שעות עבודה</small></div>
        <div class="wl-stat red">${icon('car')}<b>${Math.round(km)}</b><small class="wl-he">ק״מ משוער</small></div>
      </div>
      <div class="wl-progress"><b>${percent}%</b><span class="wl-bar"><i style="width:${percent}%"></i></span><span class="wl-he">הושלמו ${done}/${list.length}</span></div>
      <div class="wl-filters"><button type="button" class="wl-square ${state.status || state.client || state.team ? 'on' : ''}" data-action="clear-filters" aria-label="ניקוי סינון">${icon('filter')}</button>${select('team','כל הצוותים',teamOptions,state.team)}${select('client','כל הלקוחות',clients,state.client)}${select('status','סטטוס',Object.entries(STATUS).map(([key,meta]) => [key,meta.label]),state.status)}<button type="button" class="wl-square ${state.compact ? 'on' : ''}" data-action="compact" aria-label="תצוגה מצומצמת">${icon('expand')}</button></div>
      <div class="wl-list">${rows}</div>
      <div class="wl-dock"><button type="button" class="wl-cta" data-action="start-day">${icon('play')}<span class="wl-he">${started ? 'המשך יום עבודה' : 'התחל יום עבודה'}</span></button></div>
    </div>`;
  }
  function lineRow(visit) {
    return `<button type="button" class="wl-row" data-action="open-visit" data-id="${safe(visit.id)}"><span class="wl-time">${safe(visit.time)}</span><img class="wl-thumb" src="${photoUrl(visit)}" alt="" loading="lazy"><span class="wl-copy"><b class="wl-he">${safe(visit.name)}</b><span class="wl-he">${safe(visit.client)} | ${safe(visit.service)}</span><span class="wl-addr">${icon('pin')}<span class="wl-he">${safe(visit.address)}</span></span></span>${statusPill(visit)}${icon('right','wl-chev')}</button>`;
  }

  // Screen 2 — daily route
  function mapSvg(list) {
    const W = 400, H = 250, P = 30;
    const kx = Math.cos(32.1 * Math.PI/180);
    const pts = list.map(coordsOf);
    const lats = pts.map(p => p[0]), lngs = pts.map(p => p[1] * kx);
    let minY = Math.min(...lats, 32.08), maxY = Math.max(...lats, 32.12), minX = Math.min(...lngs, 34.8*kx), maxX = Math.max(...lngs, 34.86*kx);
    const spanX = Math.max(maxX - minX, .06), spanY = Math.max(maxY - minY, .05);
    const scale = Math.min((W - 2*P) / spanX, (H - 2*P) / spanY) * .92;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    // Shift down a little: pins are drawn above their point.
    const project = ([lat,lng]) => [W/2 + (lng*kx - cx) * scale, H/2 + 12 - (lat - cy) * scale];
    const path = coords => coords.map(project).map(([x,y],index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const minor = Array.from({ length:46 }, () => {
      let lat = cy + (rand() - .5) * 3 * spanY, lng = (cx + (rand() - .5) * 3 * spanX) / kx;
      const coords = [[lat,lng]];
      const angle = rand() * Math.PI;
      for (let step = 0; step < 4; step++) { lat += Math.sin(angle + (rand()-.5) * .6) * .012; lng += Math.cos(angle + (rand()-.5) * .6) * .012; coords.push([lat,lng]); }
      return `<path d="${path(coords)}"/>`;
    }).join('');
    const highways = [
      [[31.98,34.79],[32.05,34.795],[32.1,34.805],[32.16,34.83],[32.24,34.85],[32.34,34.875]],
      [[31.98,34.82],[32.06,34.835],[32.12,34.86],[32.2,34.885],[32.32,34.9]],
      [[32.14,34.78],[32.145,34.84],[32.15,34.9],[32.155,34.98]],
      [[32.06,34.77],[32.075,34.84],[32.09,34.92],[32.1,34.99]],
      [[31.98,34.94],[32.08,34.945],[32.18,34.95],[32.32,34.96]]
    ].map(coords => `<path d="${path(coords)}"/>`).join('');
    const sea = `${path(COAST)} L ${project(COAST[COAST.length-1])[0] - 600} ${project(COAST[COAST.length-1])[1]} L ${project(COAST[0])[0] - 600} ${project(COAST[0])[1]} Z`;
    const labels = Object.entries(CITIES).map(([name,coords]) => {
      const [x,y] = project(coords);
      return x > -40 && x < W + 40 && y > 0 && y < H + 30 ? `<text x="${x.toFixed(1)}" y="${(y + 17).toFixed(1)}">${safe(name)}</text>` : '';
    }).join('');
    const pinXY = pts.map(project);
    const next = nextVisit(list);
    const pins = list.map((visit,index) => {
      const [x,y] = pinXY[index];
      return `<g class="wl-pin ${visit === next ? 'next' : ''} ${visit.status}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path d="M0 0C-4-6-11-11-11-19a11 11 0 1 1 22 0C11-11 4-6 0 0Z"/><text y="-15.5">${index+1}</text></g>`;
    }).join('');
    const line = pinXY.map(([x,y],index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${(y - 19).toFixed(1)}`).join(' ');
    // "meet" keeps every pin visible; the background layers extend past the viewBox to fill any extra space.
    return `<svg class="wl-map-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="מפת מסלול הביקורים">
      <defs><filter id="wlTexture" x="0" y="0" width="100%" height="100%" filterUnits="objectBoundingBox"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .28  0 0 0 0 .22  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
      <filter id="wlPatches"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="9"/><feColorMatrix values="0 0 0 0 .16  0 0 0 0 .3  0 0 0 0 .18  0 0 0 1.3 -.55"/></filter></defs>
      <rect class="wl-map-land" x="${-W}" y="${-H}" width="${3*W}" height="${3*H}"/>
      <rect class="wl-map-patches" x="${-W}" y="${-H}" width="${3*W}" height="${3*H}" filter="url(#wlPatches)"/>
      <rect class="wl-map-noise" x="${-W}" y="${-H}" width="${3*W}" height="${3*H}" filter="url(#wlTexture)"/>
      <path class="wl-map-sea" d="${sea}"/>
      <g class="wl-map-minor">${minor}</g><g class="wl-map-roads">${highways}</g>
      <g class="wl-map-labels">${labels}</g>
      ${list.length > 1 ? `<path class="wl-route-line" d="${line}"/><path class="wl-route-dots" d="${line}"/>` : ''}
      ${pins}
    </svg>`;
  }
  function routeScreen() {
    const list = dayVisits();
    const done = list.filter(visit => visit.status === 'completed').length;
    const km = distanceKm(list);
    const minutes = list.reduce((sum,visit) => sum + (Number(visit.duration) || 0), 0) + km / 35 * 60;
    const next = nextVisit(list);
    const rows = list.length ? list.map((visit,index) => {
      const meta = STATUS[visit.status] || STATUS.planned;
      return `<button type="button" class="wl-row wl-route-row ${visit === next ? 'is-next' : ''}" data-action="open-visit" data-id="${safe(visit.id)}"><span class="wl-num ${meta.kind}">${index+1}</span><span class="wl-time">${safe(visit.time)}</span><img class="wl-thumb" src="${photoUrl(visit)}" alt="" loading="lazy"><span class="wl-copy"><b class="wl-he">${safe(visit.name)}</b><span class="wl-addr"><span class="wl-he">${safe(visit.address)}</span></span></span>${statusPill(visit,'route')}${icon('right','wl-chev')}</button>`;
    }).join('') : '<div class="wl-empty wl-he">אין ביקורים ביום הזה.</div>';
    return `<div class="wl wl-route">
      <header class="wl-top"><button type="button" class="wl-icon-btn" data-action="back" aria-label="חזרה">${icon('left')}</button><div class="wl-title-stack"><h1>${icon('route','wl-green')}<span class="wl-he">מסלול יומי</span></h1><small class="wl-he">${safe(longDate(state.date))}</small></div><button type="button" class="wl-icon-btn" data-action="menu" aria-label="אפשרויות">${icon('dots')}</button></header>
      ${state.menu ? `<div class="wl-menu"><button type="button" data-action="edit-team" class="wl-he">עריכת שם הצוות</button><button type="button" data-action="edit-vehicle" class="wl-he">עריכת פרטי הרכב</button><button type="button" data-action="new-visit" class="wl-he">הוספת ביקור</button></div>` : ''}
      <div class="wl-cards2">
        <div class="wl-card wl-team"><b class="wl-he">${safe(workday.team)}</b><div class="wl-avatars">${workday.members.map(member => `<span class="wl-avatar" title="${safe(member.name)}">${safe(member.initial)}</span>`).join('')}<button type="button" class="wl-avatar add" data-action="add-member" aria-label="הוספת איש צוות">${icon('plus')}</button></div></div>
        <div class="wl-card wl-vehicle">${carSvg()}<span><b class="wl-he">${safe(workday.vehicle.label)}</b><span class="wl-he">${safe(workday.vehicle.model)}</span><span>${safe(workday.vehicle.plate)}</span></span></div>
      </div>
      <div class="wl-map ${state.mapStyle}">${mapSvg(list)}
        <div class="wl-map-tools"><button type="button" data-action="map-nav">${icon('nav')}<span class="wl-he">ניווט</span></button><button type="button" data-action="map-style">${icon('layers')}<span class="wl-he">מפה</span></button></div>
        <button type="button" class="wl-map-locate" data-action="locate" aria-label="הביקור הבא">${icon('locate')}</button>
        <button type="button" class="wl-optimize" data-action="optimize">${icon('sparkles')}<span class="wl-he">מיטוב מסלול</span></button>
      </div>
      <div class="wl-stats-row">
        <div class="wl-tile">${icon('clock')}<span><small class="wl-he">זמן משוער</small><b>${clock(minutes)}</b></span></div>
        <div class="wl-tile">${icon('route')}<span><small class="wl-he">מרחק כולל</small><b>${Math.round(km)}</b></span></div>
        <div class="wl-tile">${icon('sprout','wl-green')}<span><small class="wl-he">מספר גינות</small><b>${list.length}</b></span></div>
        <div class="wl-tile">${icon('listCheck','wl-green')}<span><small class="wl-he">בוצעו</small><b>${done}/${list.length}</b></span></div>
      </div>
      <div class="wl-list">${rows}</div>
      <div class="wl-dock wl-dock4"><button type="button" class="wl-tool" data-action="end-day">${icon('stop')}<span class="wl-he">סיום יום</span></button><button type="button" class="wl-tool danger" data-action="issue">${icon('warning')}<span class="wl-he">תקלה</span></button><button type="button" class="wl-tool" data-action="note">${icon('comment')}<span class="wl-he">הערה</span></button><button type="button" class="wl-cta" data-action="navigate-next" ${next ? '' : 'disabled'}>${icon('nav')}<span class="wl-he">ניווט לגינה הבאה</span></button></div>
    </div>`;
  }
  function carSvg() {
    return `<svg class="wl-car" viewBox="0 0 120 64" aria-hidden="true"><ellipse cx="60" cy="57" rx="52" ry="5" fill="#000" opacity=".35"/><path d="M10 44c0-7 3-11 10-12l14-2 13-11c3-2 6-3 10-3h22c5 0 9 2 12 5l9 10 6 1c5 1 8 5 8 10v6c0 2-1 3-3 3H13c-2 0-3-1-3-3Z" fill="#f4f6f5"/><path d="M45 29l11-10c2-1 4-2 7-2h9l1 12Zm32 0-1-12h4c4 0 7 2 9 4l7 8Z" fill="#26343a"/><path d="M12 42h8M100 40h8" stroke="#d6dcd9" stroke-width="3" stroke-linecap="round"/><path d="M74 30v18" stroke="#d3d9d6" stroke-width="1.4"/><circle cx="31" cy="50" r="9" fill="#1b1f21"/><circle cx="31" cy="50" r="4.5" fill="#9aa3a6"/><circle cx="92" cy="50" r="9" fill="#1b1f21"/><circle cx="92" cy="50" r="4.5" fill="#9aa3a6"/><path d="M104 38h5" stroke="#ff7a59" stroke-width="3" stroke-linecap="round"/><path d="M12 38h5" stroke="#fff3c4" stroke-width="3" stroke-linecap="round"/></svg>`;
  }

  // Screen 3 — visit details
  function visitScreen(visit) {
    const meta = STATUS[visit.status] || STATUS.planned;
    const doneCount = visit.tasks.filter(task => task.done).length;
    const openIssues = visit.issues.filter(issue => !issue.resolved).length;
    const tabs = [['details','פרטי ביקור'],['issues',`תקלות (${openIssues})`],['tasks',`משימות (${visit.tasks.length})`],['history','היסטוריה']];
    let body = '';
    if (state.tab === 'details') {
      body = `<div class="wl-info3">
          <div class="wl-tile">${icon('pinLine')}<span><small class="wl-he">כתובת</small><b class="wl-he">${safe(visit.address)}</b></span></div>
          <div class="wl-tile">${icon('calendar')}<span><small class="wl-he">תאריך</small><b>${safe(shortDate(visit.date))}</b></span></div>
          <div class="wl-tile">${icon('clock')}<span><small class="wl-he">זמן מתוכנן</small><b class="wl-he">${safe(visit.duration)} דק׳</b></span></div>
        </div>
        ${taskCard(visit, false)}
        <section class="wl-card wl-photos"><div class="wl-card-head">${icon('photo')}<b class="wl-he">תמונות מהביקור</b></div><div class="wl-photo-grid" data-photo-grid>${photoTiles(visit, [])}</div></section>
        ${visit.notes ? `<section class="wl-card wl-notes"><div class="wl-card-head">${icon('comment')}<b class="wl-he">הערות לצוות</b></div><p class="wl-he">${safe(visit.notes)}</p></section>` : ''}`;
    } else if (state.tab === 'tasks') {
      body = `${taskCard(visit, true)}<form class="wl-add-form" data-form="task"><input name="text" maxlength="80" placeholder="משימה נוספת לביקור" aria-label="משימה נוספת" dir="rtl"><button type="submit" class="wl-cta small">${icon('plus')}<span class="wl-he">הוספה</span></button></form>`;
    } else if (state.tab === 'issues') {
      const items = [...visit.issues].sort((a,b) => Number(a.resolved) - Number(b.resolved) || b.at - a.at);
      body = `<section class="wl-card"><div class="wl-card-head">${icon('warning','wl-red')}<b class="wl-he">תקלות בביקור</b><span class="wl-count">${openIssues} פתוחות</span></div>${items.length ? items.map(issue => `<label class="wl-check ${issue.resolved ? 'done' : ''}"><input type="checkbox" ${issue.resolved ? 'checked' : ''} data-action="toggle-issue" data-issue="${safe(issue.id)}"><span class="wl-box">${icon('check')}</span><span class="wl-he wl-check-text">${safe(issue.text)}<small>${safe(new Intl.DateTimeFormat('he-IL',{ hour:'2-digit', minute:'2-digit', day:'numeric', month:'numeric' }).format(new Date(issue.at)))} · ${issue.resolved ? 'טופלה' : 'פתוחה'}</small></span><button type="button" class="wl-mini" data-action="delete-issue" data-issue="${safe(issue.id)}" aria-label="מחיקת תקלה">${icon('trash')}</button></label>`).join('') : '<p class="wl-muted wl-he">לא דווחו תקלות בביקור הזה.</p>'}</section>
        <form class="wl-add-form" data-form="issue"><input name="text" maxlength="120" placeholder="תיאור התקלה" aria-label="תקלה חדשה" dir="rtl"><button type="submit" class="wl-cta small danger">${icon('warning')}<span class="wl-he">דיווח</span></button></form>`;
    } else {
      const past = visits.filter(item => item.name === visit.name && item.id !== visit.id).sort((a,b) => byTime(b,a));
      const log = [visit.startedAt && ['התחלת ביקור', visit.startedAt], visit.finishedAt && ['סיום ביקור', visit.finishedAt]].filter(Boolean);
      body = `<section class="wl-card"><div class="wl-card-head">${icon('clock')}<b class="wl-he">ביקורים קודמים בגינה</b></div>${past.length ? past.map(item => `<button type="button" class="wl-history" data-action="open-visit" data-id="${safe(item.id)}"><span>${safe(shortDate(item.date))}</span><span class="wl-he">${safe(item.service)} · ${item.tasks.filter(task => task.done).length}/${item.tasks.length} משימות</span>${statusPill(item,'route')}</button>`).join('') : '<p class="wl-muted wl-he">אין ביקורים קודמים בגינה הזו.</p>'}</section>
        ${log.length ? `<section class="wl-card"><div class="wl-card-head">${icon('route')}<b class="wl-he">יומן הביקור הנוכחי</b></div>${log.map(([label,at]) => `<div class="wl-history"><span>${safe(new Intl.DateTimeFormat('he-IL',{ hour:'2-digit', minute:'2-digit' }).format(new Date(at)))}</span><span class="wl-he">${label}</span></div>`).join('')}</section>` : ''}`;
    }
    const startLabel = visit.status === 'completed' ? 'פתיחה מחדש' : visit.status === 'inProgress' ? 'הביקור פעיל' : 'התחל ביקור';
    return `<div class="wl wl-visit">
      <header class="wl-top"><button type="button" class="wl-icon-btn" data-action="back" aria-label="חזרה">${icon('left')}</button><h1>${icon('sprout','wl-green')}<span class="wl-he">פרטי ביקור</span></h1><button type="button" class="wl-icon-btn" data-action="menu" aria-label="אפשרויות">${icon('dots')}</button></header>
      ${state.menu ? `<div class="wl-menu"><button type="button" data-action="edit-visit" class="wl-he">עריכת פרטי הביקור</button><button type="button" data-action="edit-note" class="wl-he">עריכת הערה לצוות</button>${visit.status !== 'missed' ? '<button type="button" data-action="mark-missed" class="wl-he">סימון כ״לא בוצע״</button>' : ''}<button type="button" data-action="delete-visit" class="wl-he danger">מחיקת הביקור</button></div>` : ''}
      <div class="wl-hero"><img src="${photoUrl(visit)}" alt="${safe(visit.name)}"><span class="wl-badge ${meta.kind}">${icon('circle')}<span class="wl-he">${meta.hero}</span></span></div>
      <div class="wl-ident"><div><h2 class="wl-he">${safe(visit.name)}</h2><span class="wl-he">${safe(visit.client)}</span></div><div class="wl-contact"><button type="button" data-action="call">${icon('phone')}<span class="wl-he">שיחה</span></button><button type="button" data-action="whatsapp">${icon('whatsapp')}<span>וואטסאפ</span></button><button type="button" data-action="navigate">${icon('pin')}<span class="wl-he">ניווט</span></button></div></div>
      <div class="wl-tabs4" role="tablist">${tabs.map(([key,label]) => `<button type="button" role="tab" aria-selected="${state.tab === key}" class="${state.tab === key ? 'on' : ''}" data-action="tab" data-tab="${key}"><span class="wl-he">${label}</span></button>`).join('')}</div>
      ${body}
      <div class="wl-dock wl-dock2"><button type="button" class="wl-ghost" data-action="finish" ${visit.status === 'inProgress' ? '' : 'disabled'}>${icon('stop')}<span class="wl-he">סיום ביקור</span></button><button type="button" class="wl-cta" data-action="${visit.status === 'completed' ? 'reopen' : 'start'}" ${visit.status === 'inProgress' ? 'disabled' : ''}>${icon('play')}<span class="wl-he">${startLabel}</span></button></div>
      <input type="file" accept="image/*" capture="environment" multiple hidden data-photo-input>
    </div>`;
  }
  function taskCard(visit, editable) {
    const doneCount = visit.tasks.filter(task => task.done).length;
    const percent = progressOf(visit);
    return `<section class="wl-card wl-tasks"><div class="wl-card-head">${icon('clipboard')}<b class="wl-he">רשימת משימות</b><span class="wl-count green">${doneCount}/${visit.tasks.length} ${icon('check')}</span><span class="wl-bar"><i style="width:${percent}%"></i></span></div>
      ${visit.tasks.length ? visit.tasks.map(task => `<label class="wl-check ${task.done ? 'done' : ''}"><input type="checkbox" ${task.done ? 'checked' : ''} data-action="toggle-task" data-task="${safe(task.id)}"><span class="wl-box">${icon('check')}</span><span class="wl-he wl-check-text">${safe(task.label)}</span>${editable ? `<button type="button" class="wl-mini" data-action="delete-task" data-task="${safe(task.id)}" aria-label="מחיקת משימה">${icon('trash')}</button>` : `<button type="button" class="wl-mini" data-action="add-photo" aria-label="צילום">${icon('camera')}</button>${icon('right','wl-chev')}`}</label>`).join('') : '<p class="wl-muted wl-he">אין משימות לביקור הזה.</p>'}</section>`;
  }
  function photoTiles(visit, stored) {
    const sample = (visit.samplePhotos || []).map(index => `<div class="wl-photo"><img src="${PHOTOS[index % PHOTOS.length]}" alt="תמונה מהביקור" loading="lazy"></div>`);
    const uploaded = stored.map(photo => `<div class="wl-photo"><img src="${photo.data}" alt="תמונה מהביקור"><button type="button" data-action="delete-photo" data-photo="${safe(photo.id)}" aria-label="מחיקת תמונה">${icon('close')}</button></div>`);
    return `${[...sample, ...uploaded].join('')}<button type="button" class="wl-add-photo" data-action="add-photo">${icon('plus')}<span class="wl-he">הוסף תמונות</span></button>`;
  }

  function render() {
    const visit = state.view === 'visit' && byId(state.visitId);
    if (state.view === 'visit' && !visit) state.view = 'lines';
    root.innerHTML = state.view === 'route' ? routeScreen() : visit ? visitScreen(visit) : linesScreen();
    document.body.classList.toggle('wl-sub', state.view !== 'lines');
    if (visit && state.tab === 'details') loadPhotos(visit);
  }
  function go(view, extra = {}) {
    Object.assign(state, { view, menu:false }, extra);
    render();
    window.scrollTo(0,0);
  }

  // Photos stay on this device in IndexedDB.
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
  async function loadPhotos(visit) {
    try {
      const all = await photoOperation('getAll');
      const grid = root.querySelector('[data-photo-grid]');
      if (!grid || state.visitId !== visit.id) return;
      grid.innerHTML = photoTiles(visit, all.filter(photo => photo.visitId === visit.id).sort((a,b) => a.createdAt - b.createdAt));
    } catch { toast('אחסון התמונות אינו זמין בדפדפן הזה.'); }
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

  // New / edit visit dialog, attached to <body> so it works from any screen.
  const dialog = document.createElement('dialog');
  dialog.className = 'v-dialog wl-dialog';
  document.body.append(dialog);
  function openVisitDialog(visit = null) {
    const value = visit || { name:'', client:'', service:SERVICES[0], address:'', date:state.date, time:'08:00', duration:60, team:'צוות 1', phone:'', notes:'' };
    const services = SERVICES.includes(value.service) ? SERVICES : [value.service, ...SERVICES];
    dialog.innerHTML = `<form method="dialog" data-visit-form><h2>${visit ? 'עריכת ביקור' : 'ביקור גינה חדש'}</h2>
      <label class="v-field">שם הגינה / האתר<input name="name" maxlength="70" value="${safe(value.name)}" placeholder="למשל: גינת רמות" required></label>
      <div class="v-form-row"><label class="v-field">לקוח<input name="client" maxlength="60" value="${safe(value.client)}" placeholder="חברת ניהול / לקוח פרטי" required></label><label class="v-field">סוג שירות<select name="service">${services.map(service => `<option ${service === value.service ? 'selected' : ''}>${safe(service)}</option>`).join('')}</select></label></div>
      <label class="v-field">כתובת (רחוב, מספר, עיר)<input name="address" maxlength="100" value="${safe(value.address)}" placeholder="הרצל 12, תל אביב" required></label>
      <div class="v-form-row"><label class="v-field">תאריך<input name="date" type="date" value="${safe(value.date)}" required></label><label class="v-field">שעה<input name="time" type="time" value="${safe(value.time)}" required></label></div>
      <div class="v-form-row"><label class="v-field">זמן מתוכנן (דקות)<input name="duration" type="number" min="10" max="600" value="${safe(value.duration)}" required></label><label class="v-field">צוות<input name="team" maxlength="40" value="${safe(value.team)}"></label></div>
      <label class="v-field">טלפון של הלקוח<input name="phone" type="tel" maxlength="20" value="${safe(value.phone)}" placeholder="050-0000000" dir="ltr"></label>
      <label class="v-field">הערה לצוות<textarea name="notes" maxlength="300" placeholder="דגשים לביקור">${safe(value.notes)}</textarea></label>
      <div class="v-dialog-actions"><button class="v-button primary" type="submit">${visit ? 'שמירה' : 'הוספת ביקור'}</button><button class="v-button" type="button" data-close>ביטול</button></div></form>`;
    dialog.dataset.editing = visit?.id || '';
    dialog.showModal();
  }
  dialog.addEventListener('click', event => { if (event.target === dialog || event.target.closest('[data-close]')) dialog.close(); });
  dialog.addEventListener('submit', event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    const fields = { name:values.name.trim(), client:values.client.trim(), service:values.service, address:values.address.trim(), date:values.date, time:values.time, duration:Number(values.duration) || 60, team:values.team.trim() || 'צוות 1', phone:values.phone.trim(), notes:values.notes.trim() };
    const existing = dialog.dataset.editing && byId(dialog.dataset.editing);
    if (existing) Object.assign(existing, fields);
    else {
      const id = uid('v');
      visits.push({ id, ...fields, photo:visits.length % PHOTOS.length, status:'planned', tasks:makeTasks(id), issues:[], samplePhotos:[] });
      state.date = fields.date;
    }
    save(); dialog.close(); render();
    toast(existing ? 'פרטי הביקור עודכנו.' : 'הביקור נוסף לקו העבודה.');
  });

  function optimizeRoute() {
    const list = dayVisits();
    const fixed = list.filter(visit => visit.status === 'completed' || visit.status === 'inProgress');
    const open = list.filter(visit => visit.status === 'planned');
    if (open.length < 2) { toast('אין מספיק ביקורים ממתינים למיטוב.'); return; }
    const before = distanceKm(list);
    const slots = open.map(visit => visit.time).sort();
    let current = fixed.length ? fixed[fixed.length-1] : open[0];
    const ordered = [];
    const remaining = [...open];
    if (!fixed.length) { ordered.push(remaining.shift()); }
    while (remaining.length) {
      const from = ordered.length ? ordered[ordered.length-1] : current;
      remaining.sort((a,b) => distanceKm([from,a]) - distanceKm([from,b]));
      ordered.push(remaining.shift());
    }
    ordered.forEach((visit,index) => { visit.time = slots[index]; });
    const after = distanceKm(dayVisits());
    save(); render();
    toast(after < before - .5 ? `המסלול עודכן · נחסכו כ־${Math.round(before - after)} ק״מ` : 'המסלול כבר בסדר האופטימלי.');
  }
  const mapsUrl = address => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
  const openExternal = url => window.open(url,'_blank','noopener,noreferrer');
  function phoneDigits(visit) {
    const digits = String(visit.phone || '').replace(/\D/g,'');
    return digits ? (digits.startsWith('0') ? `972${digits.slice(1)}` : digits) : '';
  }

  root.addEventListener('change', async event => {
    const target = event.target;
    const visit = byId(state.visitId);
    if (target.matches('[data-filter]')) { state[target.dataset.filter] = target.value; render(); return; }
    if (target.matches('[data-action="toggle-task"]') && visit) {
      const task = visit.tasks.find(item => item.id === target.dataset.task);
      if (task) { task.done = target.checked; save(); render(); }
      return;
    }
    if (target.matches('[data-action="toggle-issue"]') && visit) {
      const issue = visit.issues.find(item => item.id === target.dataset.issue);
      if (issue) { issue.resolved = target.checked; save(); render(); }
      return;
    }
    if (target.matches('[data-photo-input]') && visit) {
      const files = [...(target.files || [])].filter(file => file.type.startsWith('image/'));
      for (const file of files) {
        try { await photoOperation('put',{ id:uid(visit.id), visitId:visit.id, data:await resizeImage(file), createdAt:Date.now() }); }
        catch { toast('לא ניתן לשמור את התמונה במכשיר.'); break; }
      }
      target.value = '';
      await loadPhotos(visit);
      if (files.length) toast('התמונות נוספו לביקור.');
    }
  });

  root.addEventListener('submit', event => {
    const form = event.target.closest('[data-form]');
    const visit = byId(state.visitId);
    if (!form || !visit) return;
    event.preventDefault();
    const text = form.elements.text.value.trim();
    if (!text) return;
    if (form.dataset.form === 'task') visit.tasks.push({ id:uid(`${visit.id}-t`), label:text, done:false });
    else visit.issues.push({ id:uid(`${visit.id}-i`), text, at:Date.now(), resolved:false });
    save(); render();
    root.querySelector(`[data-form="${form.dataset.form}"] input`)?.focus();
  });

  root.addEventListener('click', async event => {
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    const action = target.dataset.action;
    const visit = byId(state.visitId);
    const today = dayVisits();
    const current = nextVisit(today);
    if (action !== 'menu') state.menu = false;

    switch (action) {
      case 'open-menu': window.openAppMenu?.(); return;
      case 'menu': state.menu = !state.menu; render(); return;
      case 'new-visit': state.menu = false; openVisitDialog(); render(); return;
      case 'range': state.range = target.dataset.range; render(); return;
      case 'date-prev': case 'date-next': {
        const step = action === 'date-next' ? 1 : -1;
        if (state.range === 'day') state.date = shiftDay(state.date, step);
        else if (state.range === 'week') state.date = shiftDay(state.date, step * 7);
        else if (state.range === 'month') { const date = fromKey(state.date); date.setMonth(date.getMonth() + step, 1); state.date = dayKey(date); }
        render(); return;
      }
      case 'clear-filters': Object.assign(state, { status:'', client:'', team:'' }); render(); return;
      case 'compact': state.compact = !state.compact; render(); return;
      case 'open-visit': go('visit', { visitId:target.dataset.id, tab:'details' }); return;
      case 'start-day': state.range = 'day'; go('route'); return;
      case 'back': go(state.view === 'visit' && state.cameFromRoute ? 'route' : 'lines'); return;
      case 'tab': state.tab = target.dataset.tab; render(); return;
    }

    if (state.view === 'route') {
      if (action === 'map-style') { state.mapStyle = state.mapStyle === 'satellite' ? 'plain' : 'satellite'; render(); }
      if (action === 'map-nav') {
        const left = today.filter(item => item.status === 'planned' || item.status === 'inProgress');
        if (!left.length) { toast('כל הביקורים להיום הסתיימו.'); return; }
        const destination = left[left.length-1];
        const waypoints = left.slice(0,-1).map(item => item.address).join('|');
        openExternal(`${mapsUrl(destination.address)}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}`);
      }
      if (action === 'locate') {
        const row = root.querySelector('.wl-route-row.is-next');
        if (row) { row.scrollIntoView({ behavior:'smooth', block:'center' }); row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }
        else toast('אין ביקור ממתין ביום הזה.');
      }
      if (action === 'optimize') optimizeRoute();
      if (action === 'navigate-next' && current) openExternal(mapsUrl(current.address));
      if (action === 'add-member') {
        const name = window.prompt('שם איש הצוות:');
        if (name?.trim()) { workday.members.push({ name:name.trim(), initial:name.trim()[0] }); save(); render(); }
      }
      if (action === 'edit-team') {
        const name = window.prompt('שם הצוות:', workday.team);
        if (name?.trim()) { workday.team = name.trim(); save(); }
        render();
      }
      if (action === 'edit-vehicle') {
        const model = window.prompt('דגם הרכב:', workday.vehicle.model);
        if (model === null) { render(); return; }
        const plate = window.prompt('מספר רישוי:', workday.vehicle.plate);
        if (plate === null) { render(); return; }
        workday.vehicle.model = model.trim() || workday.vehicle.model;
        workday.vehicle.plate = plate.trim() || workday.vehicle.plate;
        save(); render();
      }
      if (action === 'issue' || action === 'note') {
        if (!current) { toast('אין ביקור פעיל או ממתין לשיוך.'); return; }
        const text = window.prompt(action === 'issue' ? `דיווח תקלה — ${current.name}:` : `הערה לצוות — ${current.name}:`);
        if (!text?.trim()) return;
        if (action === 'issue') current.issues.push({ id:uid(`${current.id}-i`), text:text.trim(), at:Date.now(), resolved:false });
        else current.notes = [current.notes, text.trim()].filter(Boolean).join('\n');
        save(); render();
        toast(action === 'issue' ? 'התקלה נרשמה בביקור.' : 'ההערה נשמרה בביקור.');
      }
      if (action === 'end-day') {
        const pending = today.filter(item => item.status === 'planned' || item.status === 'inProgress');
        if (pending.length && !window.confirm(`נשארו ${pending.length} ביקורים שלא הושלמו. לסיים את היום ולסמן אותם כ״לא בוצע״?`)) return;
        pending.forEach(item => { item.status = 'missed'; });
        save(); go('lines');
        toast('יום העבודה הסתיים.');
      }
      return;
    }

    if (state.view === 'visit' && visit) {
      if (action === 'start') {
        today.filter(item => item.status === 'inProgress' && item.id !== visit.id).forEach(item => { item.status = 'planned'; });
        visit.status = 'inProgress'; visit.startedAt = new Date().toISOString(); save(); render(); toast('הביקור התחיל. אפשר לסמן את המשימות.');
      }
      if (action === 'finish') { visit.status = 'completed'; visit.finishedAt = new Date().toISOString(); save(); render(); toast('הביקור נשמר כהושלם.'); }
      if (action === 'reopen') { visit.status = 'planned'; delete visit.finishedAt; save(); render(); }
      if (action === 'add-photo') { event.preventDefault(); root.querySelector('[data-photo-input]')?.click(); }
      if (action === 'delete-photo') {
        try {
          // Deleted photos go to the bin on the history screen for 30 days.
          const photo = (await photoOperation('getAll')).find(item => item.id === target.dataset.photo);
          if (photo) await window.esekliStore?.trashPhoto(photo);
          await photoOperation('delete', target.dataset.photo);
          await loadPhotos(visit);
          toast('התמונה נמחקה. אפשר לשחזר אותה ממסך ההיסטוריה.');
        } catch { toast('לא ניתן למחוק את התמונה.'); }
      }
      if (action === 'delete-task') { event.preventDefault(); visit.tasks = visit.tasks.filter(task => task.id !== target.dataset.task); save(); render(); }
      if (action === 'delete-issue') { event.preventDefault(); visit.issues = visit.issues.filter(issue => issue.id !== target.dataset.issue); save(); render(); }
      if (action === 'navigate') openExternal(mapsUrl(visit.address));
      if (action === 'call' || action === 'whatsapp') {
        const digits = phoneDigits(visit);
        if (!digits) { toast('לא הוגדר טלפון ללקוח. אפשר להוסיף אותו בעריכת הביקור.'); return; }
        if (action === 'call') window.location.href = `tel:+${digits}`;
        else openExternal(`https://wa.me/${digits}`);
      }
      if (action === 'edit-visit') { openVisitDialog(visit); render(); }
      if (action === 'edit-note') {
        const note = window.prompt('הערה לצוות:', visit.notes || '');
        if (note !== null) { visit.notes = note.trim(); save(); }
        render();
      }
      if (action === 'mark-missed') { visit.status = 'missed'; save(); render(); }
      if (action === 'delete-visit') {
        if (!window.confirm(`למחוק את הביקור ב${visit.name}?`)) { render(); return; }
        visits = visits.filter(item => item.id !== visit.id);
        save(); go('lines'); toast('הביקור נמחק.');
      }
    }
  });

  // Remember whether a visit was opened from the route, so "back" returns there.
  root.addEventListener('click', event => {
    const opener = event.target.closest('[data-action="open-visit"]');
    if (opener) state.cameFromRoute = Boolean(opener.closest('.wl-route'));
  }, true);

  // Bottom bar: "קווי עבודה" opens the day view, "גינות" opens the full list.
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-nav="visits"], [data-nav="gardens"]');
    if (!link || root.contains(link)) return;
    Object.assign(state, { view:'lines', menu:false, range:link.dataset.nav === 'gardens' ? 'list' : 'day' });
    render();
  });

  save();
  render();
}
