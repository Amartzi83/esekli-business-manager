// Keeps the app's local data and the shared database in step, one record at a time, so two
// people editing different records never overwrite each other. Knows nothing about Firebase:
// the backend is passed in, which also lets this logic be tested on its own.
const FLUSH_DELAY_MS = 300;
const BATCH_LIMIT = 400;

export const docIdFor = (collectionId, itemId) => `${collectionId}~${encodeURIComponent(itemId)}`;

function recordsOf(collection, raw) {
  const records = new Map();
  if (raw == null) return records;
  let value;
  // Unreadable data returns nothing, so a damaged save can never delete the shared records.
  try { value = JSON.parse(raw); } catch { return null; }
  if (collection.kind === 'object') {
    if (value && typeof value === 'object') records.set('value', JSON.stringify(value));
    return records;
  }
  if (Array.isArray(value)) value.forEach(item => { if (item && item.id != null) records.set(String(item.id), JSON.stringify(item)); });
  return records;
}
function rawFrom(collection, records) {
  if (collection.kind === 'object') return records.has('value') ? records.get('value') : null;
  return `[${[...records.values()].join(',')}]`;
}

export function createSync({ collections, commit, setLocal, onRemote = () => {}, onError = () => {}, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const byKey = new Map(collections.map(collection => [collection.key, collection]));
  const byId = new Map(collections.map(collection => [collection.id, collection]));
  const synced = new Map(collections.map(collection => [collection.key, new Map()]));
  const pending = new Map();
  let timer = null;
  let loaded = false;

  function flush() {
    clearTimer(timer);
    timer = null;
    const writes = [];
    pending.forEach((raw, key) => {
      const collection = byKey.get(key);
      const known = synced.get(key);
      const next = recordsOf(collection, raw);
      if (!next) return;
      next.forEach((json, id) => {
        if (known.get(id) !== json) { writes.push({ op:'set', collection:collection.id, id, json }); known.set(id, json); }
      });
      [...known.keys()].forEach(id => {
        if (!next.has(id)) { writes.push({ op:'delete', collection:collection.id, id }); known.delete(id); }
      });
    });
    pending.clear();
    if (!writes.length) return Promise.resolve();
    const batches = [];
    for (let index = 0; index < writes.length; index += BATCH_LIMIT) batches.push(writes.slice(index, index + BATCH_LIMIT));
    return Promise.all(batches.map(batch => Promise.resolve(commit(batch)).catch(onError)));
  }

  return {
    // A local save: only what differs from the last known state is written.
    push(key, raw) {
      if (!byKey.has(key)) return;
      pending.set(key, raw);
      clearTimer(timer);
      timer = setTimer(flush, FLUSH_DELAY_MS);
    },
    flush,
    // changes: [{ type:'added'|'modified'|'removed', collection, id, json, mine }]
    // "mine" marks this session's own writes coming back, which are already applied.
    applyChanges(changes) {
      // Send unsaved local edits first, so they are compared with the state they were made on.
      if (pending.size) flush();
      const touched = new Set();
      changes.forEach(change => {
        const collection = byId.get(change.collection);
        if (!collection || change.mine) return;
        const known = synced.get(collection.key);
        if (change.type === 'removed') {
          if (known.delete(change.id)) touched.add(collection);
        } else if (known.get(change.id) !== change.json) {
          known.set(change.id, change.json);
          touched.add(collection);
        }
      });
      if (!loaded) {
        // The first load fills every collection, even empty ones, so sample data is never created.
        loaded = true;
        collections.forEach(collection => setLocal(collection.key, rawFrom(collection, synced.get(collection.key))));
        return;
      }
      touched.forEach(collection => {
        const raw = rawFrom(collection, synced.get(collection.key));
        setLocal(collection.key, raw);
        onRemote(collection.key, raw);
      });
    }
  };
}
