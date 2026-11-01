// Central data layer: every module writes through esekliStore.write(), which keeps the
// current value in localStorage and records a timestamped snapshot in IndexedDB.
// It also keeps hourly backups, a bin for deleted photos, and backup-file export/import.
const HISTORY_DB = 'esekli-history';
const PHOTO_DB = 'esekli-garden-photos';
const LAST_EXPORT_KEY = 'esekli-last-export';
const HOUR = 3600000;
const DAY = 24 * HOUR;
const COALESCE_MS = 20000;
const MAX_CHANGES_PER_COLLECTION = 400;
const TRASH_DAYS = 30;

const dateLabel = key => key ? new Intl.DateTimeFormat('he-IL', { day:'numeric', month:'numeric', year:'2-digit' }).format(new Date(`${key}T12:00:00`)) : '';
const dateTimeLabel = value => value ? new Intl.DateTimeFormat('he-IL', { day:'numeric', month:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(value)) : '';
const VISIT_STATUS = { planned:'ממתין', inProgress:'בתהליך', completed:'הושלם', missed:'לא בוצע' };
const PRIORITY = { high:'דחוף', normal:'רגיל', low:'נמוך' };

const COLLECTIONS = [
  { id:'tasks', key:'esekli-tasks-v1', label:'משימות', kind:'list',
    title:task => task.title || 'משימה',
    meta:task => [task.done ? 'בוצעה' : 'פתוחה', task.due ? `מועד ${dateLabel(task.due)}` : 'ללא מועד', PRIORITY[task.priority], task.visit && `ביקור: ${task.visit}`] },
  { id:'visits', key:'esekli-garden-visits-v2', label:'ביקורי גינות', kind:'list',
    title:visit => visit.name || 'ביקור',
    meta:visit => [`${dateLabel(visit.date)} ${visit.time || ''}`.trim(), VISIT_STATUS[visit.status], visit.client, Array.isArray(visit.tasks) && `${visit.tasks.filter(task => task.done).length}/${visit.tasks.length} משימות`, Array.isArray(visit.issues) && visit.issues.length && `${visit.issues.length} תקלות`] },
  { id:'calendar', key:'esekli-calendar-v1', label:'יומן', kind:'list',
    title:event => event.title || 'אירוע',
    meta:event => [dateTimeLabel(event.startAt), event.location] },
  { id:'shopping', key:'esekli-shopping-v1', label:'רשימת קניות', kind:'list',
    title:item => item.name || 'פריט',
    meta:item => [item.bought ? 'נקנה' : 'לקנות', item.qty, item.supplier, item.price ? `₪${item.price}` : '', item.visit && `ביקור: ${item.visit}`] },
  { id:'reminders', key:'esekli-reminders-v1', label:'תזכורות', kind:'list',
    title:item => item.title || 'תזכורת',
    meta:item => [item.done ? 'בוצעה' : 'פעילה', `${dateLabel(item.date)} ${item.time || ''}`.trim(), item.repeat && item.repeat !== 'none' && 'חוזרת', item.client] },
  { id:'customers', key:'esekli-customers-v1', label:'תיקי לקוחות', kind:'list',
    title:customer => customer.name || 'לקוח',
    meta:customer => [({ active:'פעיל', lead:'ליד', paused:'מושהה' })[customer.status], customer.contact, customer.phone, customer.plan, customer.price ? `₪${customer.price} לחודש` : '', Array.isArray(customer.log) && `${customer.log.length} רשומות ביומן`] },
  { id:'workday', key:'esekli-workday-v1', label:'צוות ורכב', kind:'object',
    title:() => 'צוות ורכב',
    meta:day => [day.team, Array.isArray(day.members) && day.members.map(member => member.name).join(', '), day.vehicle && `${day.vehicle.model} · ${day.vehicle.plate}`] },
  { id:'settings', key:'esekli-theme', label:'הגדרות', kind:'raw',
    title:() => 'מראה',
    meta:value => [value === 'light' ? 'מצב בהיר' : 'מצב כהה'] }
];
const FIELD_LABELS = {
  title:'כותרת', due:'מועד', priority:'עדיפות', owner:'אחראי', visit:'ביקור', notes:'הערות', done:'בוצע', completedAt:'זמן השלמה',
  name:'שם', client:'לקוח', service:'שירות', address:'כתובת', date:'תאריך', time:'שעה', duration:'משך', team:'צוות', phone:'טלפון',
  status:'סטטוס', tasks:'משימות הביקור', issues:'תקלות', startedAt:'התחלה', finishedAt:'סיום', photo:'תמונה', samplePhotos:'תמונות',
  startAt:'התחלה', endAt:'סיום', allDay:'כל היום', location:'מיקום', description:'תיאור', participantIds:'משתתפים', taskId:'משימה מקושרת',
  reminderMinutes:'תזכורת', members:'אנשי צוות', vehicle:'רכב',
  qty:'כמות', category:'קטגוריה', supplier:'ספק', price:'מחיר', bought:'נקנה', boughtAt:'זמן קנייה', repeat:'חזרה', doneAt:'זמן ביצוע',
  type:'סוג', contact:'איש קשר', email:'אימייל', plan:'חבילת שירות', sites:'גינות', since:'לקוח מאז', log:'יומן פעילות'
};
const byKey = Object.fromEntries(COLLECTIONS.map(collection => [collection.key, collection]));

// Time-sortable ids, so IndexedDB key order is chronological order.
let idCounter = 0;
const uid = () => `${Date.now().toString(36).padStart(9,'0')}-${(idCounter++ % 1296).toString(36).padStart(2,'0')}${Math.random().toString(36).slice(2,6)}`;

function openDb(name, version, upgrade) {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB לא זמין')); return; }
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => upgrade(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
let historyDbPromise;
const historyDb = () => historyDbPromise ||= openDb(HISTORY_DB, 1, db => {
  const changes = db.createObjectStore('changes', { keyPath:'id' });
  changes.createIndex('key', 'key');
  db.createObjectStore('snapshots', { keyPath:'id' });
  db.createObjectStore('backups', { keyPath:'id' });
  db.createObjectStore('photoTrash', { keyPath:'id' });
});
let photoDbPromise;
const photoDb = () => photoDbPromise ||= openDb(PHOTO_DB, 1, db => { if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath:'id' }); });

function run(dbPromise, stores, mode, body) {
  return dbPromise.then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result;
    const done = body(tx, value => { result = value; });
    if (done && 'onsuccess' in done) done.onsuccess = () => { result = done.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}
const getOne = (store, id) => run(historyDb(), store, 'readonly', tx => tx.objectStore(store).get(id));
const getAll = (dbPromise, store) => run(dbPromise, store, 'readonly', tx => tx.objectStore(store).getAll());

// Walks a cursor newest-first (or oldest-first) and collects matches.
function walk({ store = 'changes', key = null, direction = 'prev', filter = () => true, limit = Infinity, offset = 0 }) {
  return run(historyDb(), store, 'readonly', (tx, setResult) => {
    const source = key ? tx.objectStore(store).index('key') : tx.objectStore(store);
    const request = source.openCursor(key ? IDBKeyRange.only(key) : null, direction);
    const found = [];
    let skipped = 0;
    setResult(found);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || found.length >= limit) return;
      if (filter(cursor.value)) {
        if (skipped < offset) skipped++;
        else found.push(cursor.value);
      }
      cursor.continue();
    };
  });
}

let queue = Promise.resolve();
const enqueue = task => (queue = queue.then(task).catch(error => console.warn('esekli store:', error)));

const lastRaw = {};
const lastEntry = {};
const parse = (collection, raw) => {
  if (raw == null) return null;
  if (collection.kind === 'raw') return raw;
  try { return JSON.parse(raw); } catch { return null; }
};
const serialize = (collection, value) => collection?.kind === 'raw' ? String(value) : JSON.stringify(value);

function changedFields(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys].filter(field => JSON.stringify(before?.[field]) !== JSON.stringify(after?.[field])).map(field => FIELD_LABELS[field] || field);
}
function summarize(collection, beforeRaw, afterRaw) {
  const before = parse(collection, beforeRaw);
  const after = parse(collection, afterRaw);
  if (collection.kind === 'raw') return { changed:[{ title:collection.meta(after).join(', '), fields:[] }], added:[], removed:[] };
  if (collection.kind === 'object') return { added:[], removed:[], changed:before ? [{ title:collection.title(after), fields:changedFields(before, after) }] : [], created:!before };
  const oldMap = new Map((Array.isArray(before) ? before : []).map(item => [item.id, item]));
  const newMap = new Map((Array.isArray(after) ? after : []).map(item => [item.id, item]));
  const added = [], removed = [], changed = [];
  newMap.forEach((item, id) => {
    if (!oldMap.has(id)) added.push(collection.title(item));
    else if (JSON.stringify(oldMap.get(id)) !== JSON.stringify(item)) changed.push({ title:collection.title(item), fields:changedFields(oldMap.get(id), item) });
  });
  oldMap.forEach((item, id) => { if (!newMap.has(id)) removed.push(collection.title(item)); });
  return { added, removed, changed, created:!before, total:newMap.size };
}
function summaryText(summary) {
  if (!summary) return '';
  const list = (items, limit = 2) => items.length > limit ? `${items.slice(0, limit).join(', ')} ועוד ${items.length - limit}` : items.join(', ');
  if (summary.created) return summary.total != null ? `${summary.total} רשומות` : 'נוצר';
  const parts = [];
  if (summary.added?.length) parts.push(`נוספו: ${list(summary.added)}`);
  if (summary.changed?.length) {
    const one = summary.changed.length === 1 && summary.changed[0].fields.length ? ` (${summary.changed[0].fields.slice(0,3).join(', ')})` : '';
    parts.push(`עודכנו: ${list(summary.changed.map(item => item.title))}${one}`);
  }
  if (summary.removed?.length) parts.push(`נמחקו: ${list(summary.removed)}`);
  return parts.join(' · ') || 'ללא שינוי בתוכן';
}

// Queued, so it runs after startup has loaded the last recorded value of each collection.
function record(key, raw, reason = '') {
  if (!byKey[key]) return;
  const at = Date.now();
  enqueue(() => saveEntry(key, raw, reason, at));
  scheduleBackupCheck();
}
async function saveEntry(key, raw, reason, at = Date.now()) {
  const collection = byKey[key];
  if (raw === lastRaw[key]) return;
  const previous = lastRaw[key];
  lastRaw[key] = raw;
  const recent = lastEntry[key];
  if (recent && !reason && !recent.reason && at - recent.at < COALESCE_MS && at - recent.start < 6 * COALESCE_MS) {
    // Merge quick consecutive edits (typing, several checkboxes) into one history entry.
    recent.meta.at = at;
    recent.meta.summary = summarize(collection, recent.baseRaw, raw);
    recent.at = at;
    await run(historyDb(), ['changes','snapshots'], 'readwrite', tx => {
      tx.objectStore('changes').put(recent.meta);
      tx.objectStore('snapshots').put({ id:recent.meta.id, data:raw });
    });
    return;
  }
  const meta = { id:uid(), key, at, reason, summary:summarize(collection, previous, raw) };
  await run(historyDb(), ['changes','snapshots'], 'readwrite', tx => {
    tx.objectStore('changes').put(meta);
    tx.objectStore('snapshots').put({ id:meta.id, data:raw });
  });
  lastEntry[key] = { meta, at, start:at, baseRaw:previous, reason };
  await pruneChanges(key);
}

async function pruneChanges(key) {
  const count = await run(historyDb(), 'changes', 'readonly', tx => tx.objectStore('changes').index('key').count(IDBKeyRange.only(key)));
  if (count <= MAX_CHANGES_PER_COLLECTION) return;
  const extra = await walk({ key, direction:'next', limit:count - MAX_CHANGES_PER_COLLECTION });
  await run(historyDb(), ['changes','snapshots'], 'readwrite', tx => extra.forEach(meta => {
    tx.objectStore('changes').delete(meta.id);
    tx.objectStore('snapshots').delete(meta.id);
  }));
}

function write(key, value, reason = '') {
  const raw = serialize(byKey[key], value);
  localStorage.setItem(key, raw);
  record(key, raw, reason);
}
function read(key) {
  const collection = byKey[key];
  return collection ? parse(collection, localStorage.getItem(key)) : null;
}
const snapshotAll = () => Object.fromEntries(COLLECTIONS.map(collection => [collection.key, localStorage.getItem(collection.key)]).filter(([, raw]) => raw != null));
function signature(collections) {
  let hash = 5381;
  const text = JSON.stringify(collections);
  for (let index = 0; index < text.length; index++) hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0;
  return hash.toString(36);
}

// Backups ---------------------------------------------------------------
async function createBackup(kind = 'manual', note = '') {
  const collections = snapshotAll();
  const entry = { id:uid(), at:Date.now(), kind, note, collections, sig:signature(collections), size:JSON.stringify(collections).length };
  await run(historyDb(), 'backups', 'readwrite', tx => tx.objectStore('backups').put(entry));
  await pruneBackups();
  return entry;
}
async function listBackups() {
  return (await getAll(historyDb(), 'backups')).sort((a,b) => b.at - a.at);
}
async function pruneBackups() {
  const backups = await listBackups();
  const now = Date.now();
  const keep = new Set();
  const daysSeen = new Set();
  const kindCount = {};
  backups.forEach(backup => {
    if (backup.kind === 'auto') {
      const day = new Date(backup.at).toDateString();
      if (now - backup.at < 2 * DAY) keep.add(backup.id);
      else if (now - backup.at < 60 * DAY && !daysSeen.has(day)) keep.add(backup.id);
      daysSeen.add(day);
    } else {
      kindCount[backup.kind] = (kindCount[backup.kind] || 0) + 1;
      if (kindCount[backup.kind] <= 30) keep.add(backup.id);
    }
  });
  const remove = backups.filter(backup => !keep.has(backup.id));
  if (remove.length) await run(historyDb(), 'backups', 'readwrite', tx => remove.forEach(backup => tx.objectStore('backups').delete(backup.id)));
}
let backupTimer;
function scheduleBackupCheck() {
  clearTimeout(backupTimer);
  backupTimer = setTimeout(() => enqueue(autoBackup), 4000);
}
async function autoBackup() {
  const backups = await listBackups();
  const lastAuto = backups.find(backup => backup.kind === 'auto');
  if (lastAuto && Date.now() - lastAuto.at < HOUR) return;
  if (lastAuto && backups[0]?.sig === signature(snapshotAll())) return;
  await createBackup('auto');
}

// Restore ---------------------------------------------------------------
async function restoreCollections(collections, reason) {
  await queue;
  await createBackup('pre-restore', reason);
  Object.entries(collections).forEach(([key, raw]) => {
    if (!byKey[key] || raw == null) return;
    localStorage.setItem(key, raw);
    record(key, raw, reason);
  });
  await queue;
}
async function restoreItem(key, item, reason) {
  const collection = byKey[key];
  if (!collection || collection.kind !== 'list') return;
  await queue;
  await createBackup('pre-restore', reason);
  const list = read(key) || [];
  const index = list.findIndex(entry => entry.id === item.id);
  if (index >= 0) list[index] = item; else list.push(item);
  write(key, list, reason);
  await queue;
}

// History queries -------------------------------------------------------
const listChanges = ({ key = null, limit = 30, offset = 0 } = {}) => walk({ key, limit, offset });
const snapshotOf = async id => (await getOne('snapshots', id))?.data ?? null;
async function stateAt(key, time) {
  const [meta] = await walk({ key, limit:1, filter:entry => entry.at <= time });
  return meta ? { meta, raw:await snapshotOf(meta.id) } : null;
}
async function itemHistory(key, itemId) {
  const metas = await walk({ key, direction:'next' });
  const versions = [];
  let previous = 'null';
  for (const meta of metas) {
    const list = parse(byKey[key], await snapshotOf(meta.id)) || [];
    const item = list.find(entry => entry.id === itemId) || null;
    const json = JSON.stringify(item);
    if (json !== previous) {
      const before = JSON.parse(previous);
      versions.push({ at:meta.at, changeId:meta.id, item, kind:!item ? 'removed' : !before ? 'added' : 'changed', fields:item && before ? changedFields(before, item) : [], reason:meta.reason });
      previous = json;
    }
  }
  return versions.reverse();
}
async function counts() {
  const changes = await run(historyDb(), 'changes', 'readonly', tx => tx.objectStore('changes').count());
  const trash = await run(historyDb(), 'photoTrash', 'readonly', tx => tx.objectStore('photoTrash').count());
  return { changes, trash };
}

// Deleted photos --------------------------------------------------------
async function trashPhoto(photo) {
  await run(historyDb(), 'photoTrash', 'readwrite', tx => tx.objectStore('photoTrash').put({ ...photo, deletedAt:Date.now() }));
}
const listTrash = async () => (await getAll(historyDb(), 'photoTrash')).sort((a,b) => b.deletedAt - a.deletedAt);
async function restorePhoto(id) {
  const photo = await getOne('photoTrash', id);
  if (!photo) return;
  const { deletedAt, ...original } = photo;
  await run(photoDb(), 'photos', 'readwrite', tx => tx.objectStore('photos').put(original));
  await run(historyDb(), 'photoTrash', 'readwrite', tx => tx.objectStore('photoTrash').delete(id));
}
async function purgeTrash() {
  const old = (await listTrash()).filter(photo => Date.now() - photo.deletedAt > TRASH_DAYS * DAY);
  if (old.length) await run(historyDb(), 'photoTrash', 'readwrite', tx => old.forEach(photo => tx.objectStore('photoTrash').delete(photo.id)));
}

// Backup files ----------------------------------------------------------
function download(data, name) {
  const blob = new Blob([JSON.stringify(data)], { type:'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  return blob.size;
}
const fileStamp = time => { const date = new Date(time); const pad = value => String(value).padStart(2,'0'); return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`; };
async function exportFile({ photos = false, collections = snapshotAll(), at = Date.now() } = {}) {
  const data = { format:'esekli-backup', version:1, exportedAt:new Date().toISOString(), snapshotAt:new Date(at).toISOString(), collections };
  if (photos) { try { data.photos = await getAll(photoDb(), 'photos'); } catch { data.photos = []; } }
  const size = download(data, `esekli-backup-${fileStamp(at)}.json`);
  localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()));
  return { size, photos:data.photos?.length || 0 };
}
async function readBackupFile(file) {
  const data = JSON.parse(await file.text());
  if (data?.format !== 'esekli-backup' || typeof data.collections !== 'object') throw new Error('הקובץ אינו קובץ גיבוי של עסקלי.');
  const collections = Object.fromEntries(Object.entries(data.collections).filter(([key, raw]) => byKey[key] && typeof raw === 'string'));
  const photos = Array.isArray(data.photos) ? data.photos.filter(photo => photo && typeof photo.id === 'string' && typeof photo.visitId === 'string' && /^data:image\//.test(photo.data || '')) : [];
  return { collections, photos, snapshotAt:data.snapshotAt || data.exportedAt };
}
async function importBackup({ collections, photos }) {
  await restoreCollections(collections, 'ייבוא קובץ גיבוי');
  if (photos.length) await run(photoDb(), 'photos', 'readwrite', tx => photos.forEach(photo => tx.objectStore('photos').put(photo)));
}

// Startup: record a baseline for data that has no history yet, and catch up on
// changes made while the store was not running (for example in another tab).
const ready = (async () => {
  try {
    await historyDb();
    for (const collection of COLLECTIONS) {
      const raw = localStorage.getItem(collection.key);
      const [latest] = await walk({ key:collection.key, limit:1 });
      const latestRaw = latest ? await snapshotOf(latest.id) : undefined;
      lastRaw[collection.key] = latestRaw;
      if (raw != null && raw !== latestRaw) await saveEntry(collection.key, raw, latest ? 'עדכון מחוץ להיסטוריה' : 'מצב התחלתי');
    }
    await purgeTrash();
    await autoBackup();
    navigator.storage?.persist?.().catch(() => {});
  } catch (error) { console.warn('esekli store unavailable:', error); }
})();
queue = ready;
setInterval(() => enqueue(autoBackup), 5 * 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') enqueue(autoBackup); });
window.addEventListener('storage', event => {
  // Another tab recorded this change already; just keep our baseline in sync.
  if (byKey[event.key]) lastRaw[event.key] = event.newValue;
});

window.esekliStore = {
  COLLECTIONS, FIELD_LABELS, LAST_EXPORT_KEY, ready, write, read, parse:(key, raw) => parse(byKey[key], raw), collection:key => byKey[key],
  summaryText, listChanges, snapshotOf, stateAt, itemHistory, counts,
  createBackup:async (kind, note) => { await queue; return createBackup(kind, note); }, listBackups, restoreCollections, restoreItem,
  trashPhoto, listTrash, restorePhoto, exportFile, readBackupFile, importBackup,
  flush:() => queue
};
