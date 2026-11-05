// Turns spreadsheet rows into customer records and finds duplicates before anything is saved.
const MAX_ROWS = 5000;

// The first label of each field is the column title used when exporting.
const FIELDS = [
  { key:'name', labels:['שם הלקוח', 'שם לקוח', 'לקוח', 'שם', 'name', 'customer', 'customer name', 'client', 'full name'] },
  { key:'type', labels:['סוג', 'סוג לקוח', 'type', 'customer type'] },
  { key:'contact', labels:['איש קשר', 'אשת קשר', 'contact', 'contact name'] },
  { key:'phone', labels:['טלפון', 'נייד', 'פלאפון', 'מספר טלפון', 'phone', 'mobile', 'telephone', 'tel'] },
  { key:'email', labels:['אימייל', 'מייל', 'דוא"ל', 'דואל', 'דואר אלקטרוני', 'email', 'e-mail', 'mail'] },
  { key:'address', labels:['כתובת', 'address'] },
  { key:'plan', labels:['חבילת שירות', 'חבילה', 'שירות', 'plan', 'service'] },
  { key:'price', labels:['מחיר חודשי', 'מחיר', 'price', 'monthly price'] },
  { key:'status', labels:['סטטוס', 'מצב', 'status'] },
  { key:'since', labels:['לקוח מאז', 'תאריך הצטרפות', 'since', 'customer since'] },
  { key:'sites', labels:['גינות', 'שמות הגינות', 'גינה', 'sites', 'gardens'] },
  { key:'notes', labels:['הערות', 'notes', 'comments'] }
];
const STATUS_LABELS = { active:'פעיל', lead:'ליד', paused:'מושהה' };
const STATUS_WORDS = { 'פעיל':'active', 'פעילה':'active', active:'active', 'ליד':'lead', lead:'lead', 'מושהה':'paused', 'מושהית':'paused', 'בהשהיה':'paused', paused:'paused' };
const LIMITS = { name:60, type:40, contact:50, phone:20, email:80, address:100, plan:40, notes:300 };

const headerKey = text => String(text ?? '').trim().toLowerCase().replace(/[\s_:*]+/g, ' ').trim();
const labelToField = new Map(FIELDS.flatMap(field => field.labels.map(label => [headerKey(label), field.key])));
const compact = text => String(text ?? '').trim().replace(/\s+/g, ' ');

// Duplicates must match however the details were typed: 050-123 4567, +972 50 1234567 or 501234567.
export function normalizePhone(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('00972')) digits = digits.slice(5);
  else if (digits.startsWith('972')) digits = digits.slice(3);
  if (digits && !digits.startsWith('0')) digits = `0${digits}`;
  return digits.length >= 9 ? digits : '';
}
export const normalizeEmail = value => {
  const email = compact(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
};
const normalizeName = value => compact(value).toLowerCase().replace(/["'׳״`.,־-]/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeAddress = value => normalizeName(value);

// A phone read from a number cell loses its leading zero, so it is restored for display.
function cleanPhone(value) {
  const text = compact(value);
  if (/^\d{8,9}$/.test(text) && !text.startsWith('0')) return `0${text}`;
  return text;
}
function cleanPrice(value) {
  const number = Number(String(value ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}
function cleanDate(value) {
  const text = compact(value);
  if (!text) return '';
  const pad = number => String(number).padStart(2, '0');
  const valid = (year, month, day) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? `${year}-${pad(month)}-${pad(day)}` : '';
  };
  // A date stored by Excel is a count of days.
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(text)) * 86400000);
    return valid(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (match) return valid(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(text);
  if (match) return valid(Number(match[3].length === 2 ? `20${match[3]}` : match[3]), Number(match[2]), Number(match[1]));
  return '';
}

export function rowsToCustomers(rows) {
  const headerIndex = rows.slice(0, 20).findIndex(row => row.some(cell => labelToField.get(headerKey(cell)) === 'name'));
  if (headerIndex < 0) return { error:'no-name-column', customers:[], skipped:[], unknownColumns:[] };
  const columns = new Map();
  const unknownColumns = [];
  rows[headerIndex].forEach((cell, index) => {
    const field = labelToField.get(headerKey(cell));
    if (field && !columns.has(field)) columns.set(field, index);
    else if (!field && compact(cell)) unknownColumns.push(compact(cell));
  });
  const body = rows.slice(headerIndex + 1);
  if (body.length > MAX_ROWS) return { error:'too-many-rows', customers:[], skipped:[], unknownColumns };
  const customers = [];
  const skipped = [];
  body.forEach((row, index) => {
    const line = headerIndex + index + 2;
    if (!row.some(cell => compact(cell))) return;
    // The apostrophe was added on export to stop a cell running as a formula, so it comes off here.
    const read = key => String(columns.has(key) ? row[columns.get(key)] ?? '' : '').replace(/^'(?=[=+\-@])/, '');
    const name = compact(read('name')).slice(0, LIMITS.name);
    if (!name) { skipped.push({ line, reason:'חסר שם לקוח' }); return; }
    customers.push({
      line, name,
      type:compact(read('type')).slice(0, LIMITS.type),
      contact:compact(read('contact')).slice(0, LIMITS.contact),
      phone:cleanPhone(read('phone')).slice(0, LIMITS.phone),
      email:compact(read('email')).slice(0, LIMITS.email),
      address:compact(read('address')).slice(0, LIMITS.address),
      plan:compact(read('plan')).slice(0, LIMITS.plan),
      price:cleanPrice(read('price')),
      status:STATUS_WORDS[compact(read('status')).toLowerCase()] || '',
      since:cleanDate(read('since')),
      sites:String(read('sites') ?? '').split(/[,;]/).map(compact).filter(Boolean),
      notes:compact(read('notes')).slice(0, LIMITS.notes)
    });
  });
  return { customers, skipped, unknownColumns };
}

// Same phone, email, or name and address means the same customer. Same name alone only might be,
// since two different families can share a name, so those are left for the person to decide.
function findMatch(candidate, known) {
  const phone = normalizePhone(candidate.phone);
  const email = normalizeEmail(candidate.email);
  const name = normalizeName(candidate.name);
  const address = normalizeAddress(candidate.address);
  let possible = null;
  for (const item of known) {
    if (phone && normalizePhone(item.phone) === phone) return { kind:'exact', reason:'אותו טלפון', item };
    if (email && normalizeEmail(item.email) === email) return { kind:'exact', reason:'אותו אימייל', item };
    if (normalizeName(item.name) === name) {
      if (address && normalizeAddress(item.address) === address) return { kind:'exact', reason:'אותו שם וכתובת', item };
      possible ||= { kind:'possible', reason:'אותו שם', item };
    }
  }
  return possible;
}

// Sorts the file's rows into new customers, duplicates of saved customers, and repeats within the file.
export function checkDuplicates(incoming, existing) {
  const result = { fresh:[], existingMatches:[], possibleMatches:[], fileRepeats:[] };
  const accepted = [];
  incoming.forEach(customer => {
    const saved = findMatch(customer, existing);
    const inFile = findMatch(customer, accepted);
    if (inFile?.kind === 'exact') { result.fileRepeats.push({ customer, reason:inFile.reason, match:inFile.item }); return; }
    if (saved?.kind === 'exact') { result.existingMatches.push({ customer, reason:saved.reason, match:saved.item }); return; }
    if (saved || inFile) { result.possibleMatches.push({ customer, reason:(saved || inFile).reason, match:(saved || inFile).item }); accepted.push(customer); return; }
    result.fresh.push(customer);
    accepted.push(customer);
  });
  return result;
}

// Fills only the empty details of a saved customer, and never overwrites what is already there.
export function fillMissing(saved, incoming) {
  const merged = { ...saved };
  const changed = [];
  ['type', 'contact', 'phone', 'email', 'address', 'plan', 'since', 'notes'].forEach(key => {
    if (!compact(saved[key]) && compact(incoming[key])) { merged[key] = incoming[key]; changed.push(key); }
  });
  if (!Number(saved.price) && Number(incoming.price)) { merged.price = incoming.price; changed.push('price'); }
  const sites = new Set(saved.sites || []);
  (incoming.sites || []).forEach(site => { if (!sites.has(site)) { sites.add(site); changed.push('sites'); } });
  merged.sites = [...sites];
  return { merged, changed };
}

export function customersToRows(customers) {
  const header = FIELDS.map(field => field.labels[0]);
  const rows = customers.map(customer => FIELDS.map(({ key }) => {
    if (key === 'sites') return (customer.sites || []).join(', ');
    if (key === 'status') return STATUS_LABELS[customer.status] || '';
    if (key === 'price') return Number(customer.price) || 0;
    return customer[key] ?? '';
  }));
  return [header, ...rows];
}
export const sampleRows = () => [
  FIELDS.map(field => field.labels[0]),
  ['משפחת דוגמה', 'לקוח פרטי', 'דנה דוגמה', '050-0000000', 'dana@example.com', 'הרצל 1, תל אביב', 'תחזוקה חודשית', 600, 'פעיל', '2026-01-15', 'גינת דוגמה', 'אפשר למחוק את השורה הזו']
];
