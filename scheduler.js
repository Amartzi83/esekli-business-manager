// Suggests when to fit a new garden visit into the schedule with the least extra driving.
// Pure logic: everything it needs is passed in, so it has no access to the page or storage.

// Approximate city centres.
export const CITIES = {
  'תל אביב':[32.0853,34.7818], 'רמת השרון':[32.1461,34.8394], 'הרצליה':[32.1663,34.8436], 'רעננה':[32.1848,34.8713],
  'כפר סבא':[32.1750,34.9070], 'פתח תקווה':[32.0840,34.8878], 'רמת גן':[32.0684,34.8248], 'גבעתיים':[32.0722,34.8125],
  'הוד השרון':[32.1500,34.8880], 'בני ברק':[32.0807,34.8338], 'חולון':[32.0158,34.7874], 'בת ים':[32.0171,34.7454],
  'ראשון לציון':[31.9730,34.7925], 'נתניה':[32.3215,34.8532], 'ראש העין':[32.0956,34.9566], 'כפר יונה':[32.3167,34.9333],
  'גבעת שמואל':[32.0776,34.8488], 'קריית אונו':[32.0636,34.8553], 'אור יהודה':[32.0294,34.8517], 'יהוד':[32.0339,34.8904],
  'אזור':[32.0250,34.8067], 'גני תקווה':[32.0606,34.8733], 'אלעד':[32.0522,34.9514], 'שוהם':[31.9980,34.9460],
  'לוד':[31.9514,34.8953], 'רמלה':[31.9275,34.8625], 'מודיעין':[31.8969,35.0104], 'נס ציונה':[31.9293,34.7987],
  'רחובות':[31.8928,34.8113], 'יבנה':[31.8781,34.7394], 'אשדוד':[31.8014,34.6435], 'אשקלון':[31.6688,34.5743],
  'כוכב יאיר':[32.2230,34.9990], 'צור יגאל':[32.2230,34.9990], 'קדימה':[32.2790,34.9130], 'צורן':[32.2930,34.9180],
  'אבן יהודה':[32.2690,34.8880], 'תל מונד':[32.2510,34.9180], 'כפר שמריהו':[32.1850,34.8240], 'חדרה':[32.4340,34.9196],
  'זכרון יעקב':[32.5720,34.9520], 'חיפה':[32.7940,34.9896], 'ירושלים':[31.7683,35.2137], 'באר שבע':[31.2520,34.7915]
};
// The original cities are the ones labelled on the route map, to keep it readable.
export const MAP_CITIES = ['תל אביב','רמת השרון','הרצליה','רעננה','כפר סבא','פתח תקווה','רמת גן','גבעתיים','הוד השרון','בני ברק','חולון','בת ים','ראשון לציון','נתניה','ראש העין','כפר יונה'];
const ALIASES = {
  'תל-אביב':'תל אביב', 'ת"א':'תל אביב', 'פתח תקוה':'פתח תקווה', 'פתח-תקווה':'פתח תקווה', 'פתח-תקוה':'פתח תקווה', 'פ"ת':'פתח תקווה',
  'ראשון':'ראשון לציון', 'ראשל"צ':'ראשון לציון', 'ר"ג':'רמת גן', 'כ"ס':'כפר סבא', 'רמה"ש':'רמת השרון', 'ב"ב':'בני ברק', 'הוד-השרון':'הוד השרון',
  'ראש-העין':'ראש העין', 'קרית אונו':'קריית אונו', 'בת-ים':'בת ים', 'באר-שבע':'באר שבע', 'זיכרון יעקב':'זכרון יעקב', 'גני-תקווה':'גני תקווה', 'גני תקוה':'גני תקווה'
};
// Base hours in minutes from midnight, by day of the week (0 = Sunday). Saturday is closed.
export const WORK_HOURS = { 0:[450,1080], 1:[450,1080], 2:[450,1080], 3:[450,1080], 4:[450,1080], 5:[450,780] };
// Hours are flexible: when a day has no room, suggestions and plans may run this far past closing, and say so.
const FLEX_MINUTES = 120;
const OVERTIME_PENALTY_KM = 8;
const SEARCH_DAYS = 21;
const ROAD_FACTOR = 1.35;
const AVERAGE_KMH = 35;
const MIN_TRAVEL_MINUTES = 10;
const UNKNOWN_TRAVEL_MINUTES = 20;
// A day with no stops to join means a dedicated trip; this is what such a trip "costs" in the ranking.
const DEDICATED_TRIP_KM = 25;
const KM_PER_DAY_LATER = .4;

const pad = value => String(value).padStart(2,'0');
const dayKey = date => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
const toMinutes = time => { const match = /^(\d{1,2}):(\d{2})/.exec(String(time || '')); return match ? Number(match[1]) * 60 + Number(match[2]) : null; };
export const toTime = minutes => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

// The end of a visit, from its start time and estimated duration.
export function endTimeOf(time, duration) {
  const start = toMinutes(time);
  const minutes = Number(duration);
  if (start == null || !(minutes > 0)) return null;
  const end = start + minutes;
  return { time:toTime(end % 1440), nextDay:end >= 1440 };
}

// The city is normally last in an address, so the match ending latest wins ("הרצליה 5, רעננה" is in רעננה).
export function cityOf(address) {
  const text = String(address || '').replace(/[״”“]/g, '"').replace(/[׳’]/g, "'");
  let best = null, bestEnd = -1;
  for (const name of [...Object.keys(CITIES), ...Object.keys(ALIASES)]) {
    let position = text.lastIndexOf(name);
    while (position >= 0) {
      const before = text[position - 1] || '';
      const after = text[position + name.length] || '';
      const end = position + name.length;
      if (!/[א-ת]/.test(after) && (!/[א-ת]/.test(before) || (before === 'ב' && !/[א-ת]/.test(text[position - 2] || '')))) {
        if (end > bestEnd || (end === bestEnd && name.length > best.length)) { best = name; bestEnd = end; }
        break;
      }
      position = position ? text.lastIndexOf(name, position - 1) : -1;
    }
  }
  return best ? ALIASES[best] || best : null;
}
// A small offset per address keeps different addresses in one city apart.
export function coordsFor(address, name = '') {
  const city = cityOf(address);
  if (!city) return null;
  let hash = 0;
  for (const character of `${address}${name}`) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const [lat, lng] = CITIES[city];
  return [lat + ((hash % 1000) / 1000 - .5) * .012, lng + (((hash >> 10) % 1000) / 1000 - .5) * .012];
}
export function kmBetween(a, b) {
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * ROAD_FACTOR;
}
const travelMinutes = (a, b) => a?.coords && b?.coords ? Math.max(MIN_TRAVEL_MINUTES, Math.ceil(kmBetween(a.coords, b.coords) / AVERAGE_KMH * 60)) : UNKNOWN_TRAVEL_MINUTES;

// Everything already booked on a day: the team's visits plus calendar events (which apply to everyone).
function stopsOn(date, { visits = [], events = [], team = '', excludeId = null }) {
  const fromVisits = visits.filter(visit => visit.date === date && visit.status !== 'missed' && visit.id !== excludeId && (!team || !visit.team || visit.team === team)).map(visit => {
    const start = toMinutes(visit.time);
    return start == null ? null : { label:visit.name, start, end:start + (Number(visit.duration) || 60), coords:coordsFor(visit.address, visit.name), city:cityOf(visit.address) };
  });
  const fromEvents = events.filter(event => !event.allDay && event.startAt && dayKey(new Date(event.startAt)) === date).map(event => {
    const from = new Date(event.startAt), to = new Date(event.endAt || event.startAt);
    const start = from.getHours() * 60 + from.getMinutes();
    return { label:event.title, start, end:Math.max(start, to.getHours() * 60 + to.getMinutes()), coords:coordsFor(event.location), city:cityOf(event.location) };
  });
  return [...fromVisits, ...fromEvents].filter(Boolean).sort((a,b) => a.start - b.start);
}

function bestSlotOn(date, target, duration, context, now, extra = 0) {
  const base = WORK_HOURS[new Date(`${date}T12:00:00`).getDay()];
  if (!base) return null;
  const hours = [base[0], base[1] + extra];
  const stops = stopsOn(date, context);
  const isToday = date === dayKey(now);
  const open = isToday ? Math.max(hours[0], Math.ceil((now.getHours() * 60 + now.getMinutes() + 30) / 5) * 5) : hours[0];
  const known = stops.filter(stop => stop.coords);
  let best = null;
  let cursor = open;
  let previous = null;
  for (let index = 0; index <= stops.length; index++) {
    const next = stops[index] || null;
    const gapEnd = next ? Math.min(next.start, hours[1]) : hours[1];
    const inMinutes = previous ? travelMinutes(previous, target) : 0;
    const outMinutes = next ? travelMinutes(target, next) : 0;
    const earliest = Math.ceil((cursor + inMinutes) / 5) * 5;
    const latest = Math.floor((gapEnd - outMinutes - duration) / 5) * 5;
    if (earliest <= latest) {
      const before = known.filter(stop => stop.start < (next ? next.start : Infinity) && stop.end <= (next ? next.start : Infinity)).pop() || null;
      const after = next ? known.find(stop => stop.start >= next.start) || null : null;
      const extraKm = before && after ? kmBetween(before.coords, target.coords) + kmBetween(target.coords, after.coords) - kmBetween(before.coords, after.coords)
        : before ? kmBetween(before.coords, target.coords) : after ? kmBetween(target.coords, after.coords) : null;
      // With a stop only after the gap, arrive right before it instead of waiting around.
      const start = !before && after ? latest : earliest;
      if (!best || (extraKm ?? Infinity) < (best.extraKm ?? Infinity) - .01) best = { start, extraKm };
    }
    if (next) { cursor = Math.max(cursor, next.end); previous = next; }
  }
  if (!best) return null;
  const nearest = known.map(stop => ({ stop, km:kmBetween(stop.coords, target.coords) })).sort((a,b) => a.km - b.km)[0] || null;
  return {
    date, time:toTime(best.start), endTime:toTime(best.start + duration),
    overtimeMinutes:Math.max(0, best.start + duration - base[1]),
    extraKm:best.extraKm == null ? null : Math.max(0, best.extraKm),
    stops:stops.length, bookedMinutes:stops.reduce((sum, stop) => sum + stop.end - stop.start, 0),
    nearest:nearest && { label:nearest.stop.label, city:nearest.stop.city, time:toTime(nearest.stop.start), km:nearest.km, sameCity:nearest.stop.city === target.city }
  };
}

export function suggestSlots({ address, name = '', duration, team = '', visits = [], events = [], excludeId = null, now = new Date(), days = SEARCH_DAYS, limit = 3 }) {
  const city = cityOf(address);
  const minutes = Number(duration);
  if (!city || !(minutes > 0)) return { city, suggestions:[] };
  const target = { coords:coordsFor(address, name), city };
  const context = { visits, events, team, excludeId };
  const suggestions = [];
  for (let offset = 0; offset < days; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const slot = bestSlotOn(dayKey(date), target, minutes, context, now) || bestSlotOn(dayKey(date), target, minutes, context, now, FLEX_MINUTES);
    if (slot) suggestions.push({ ...slot, score:(slot.extraKm ?? DEDICATED_TRIP_KM) + offset * KM_PER_DAY_LATER + (slot.overtimeMinutes ? OVERTIME_PENALTY_KM : 0) });
  }
  return { city, suggestions:suggestions.sort((a,b) => a.score - b.score).slice(0, limit) };
}

// Checks a date and time chosen by hand, so the form can warn about a clash.
export function checkSlot({ date, time, duration, team = '', visits = [], events = [], excludeId = null }) {
  const start = toMinutes(time);
  if (!date || start == null) return null;
  const end = start + (Number(duration) || 0);
  const hours = WORK_HOURS[new Date(`${date}T12:00:00`).getDay()];
  const overlap = stopsOn(date, { visits, events, team, excludeId }).find(stop => stop.start < end && stop.end > start);
  return { closed:!hours, outsideHours:Boolean(hours) && (start < hours[0] || end > hours[1]), baseHours:hours ? `${toTime(hours[0])}–${toTime(hours[1])}` : '', overlap:overlap ? { label:overlap.label, start:toTime(overlap.start), end:toTime(overlap.end) } : null };
}

// Route planning ---------------------------------------------------------
const MAX_EXACT_STOPS = 7;
const ceil5 = minutes => Math.ceil(minutes / 5) * 5;
const normalTime = time => { const minutes = toMinutes(time); return minutes == null ? '' : toTime(minutes); };

function pathKm(stops) {
  const located = stops.filter(stop => stop.coords);
  return located.slice(1).reduce((sum, stop, index) => sum + kmBetween(located[index].coords, stop.coords), 0);
}

// Places movable visits in the given order around the fixed stops, leaving time to drive between them.
function simulate(order, fixed, cursorStart, close) {
  const queue = [...fixed];
  const sequence = [];
  const unscheduled = [];
  let cursor = cursorStart;
  let previous = null;
  const consume = () => {
    const stop = queue.shift();
    sequence.push(stop);
    cursor = Math.max(cursor, stop.end);
    previous = stop;
  };
  while (queue.length && queue[0].start < cursor) consume();
  for (const visit of order) {
    let placed = false;
    while (!placed) {
      const start = ceil5(cursor + (previous ? travelMinutes(previous, visit) : 0));
      const end = start + visit.duration;
      const next = queue[0];
      if (next ? end + travelMinutes(visit, next) <= next.start : end <= close) {
        const stop = { ...visit, start, end };
        sequence.push(stop);
        cursor = end;
        previous = stop;
        placed = true;
      } else if (next) consume();
      else { unscheduled.push(visit); placed = true; }
    }
  }
  while (queue.length) consume();
  const km = pathKm(sequence);
  const lastEnd = sequence.length ? sequence[sequence.length - 1].end : cursorStart;
  return { sequence, unscheduled, km, score:km + unscheduled.length * 1000 + lastEnd / 1000 };
}

function bestOrder(movable, fixed, cursor, close) {
  let best = simulate(movable, fixed, cursor, close);
  const consider = order => {
    const result = simulate(order, fixed, cursor, close);
    if (result.score < best.score - .01) best = result;
  };
  if (movable.length <= MAX_EXACT_STOPS) {
    const permute = (items, size) => {
      if (size <= 1) { consider(items); return; }
      for (let index = 0; index < size; index++) {
        permute(items, size - 1);
        const swap = size % 2 ? 0 : index;
        [items[swap], items[size - 1]] = [items[size - 1], items[swap]];
      }
    };
    permute([...movable], movable.length);
    return best;
  }
  // Too many stops to try every order: improve by reversing sections until nothing helps.
  let order = [...movable];
  for (let improved = true; improved;) {
    improved = false;
    for (let from = 0; from < order.length - 1; from++) {
      for (let to = from + 1; to < order.length; to++) {
        const candidate = [...order.slice(0, from), ...order.slice(from, to + 1).reverse(), ...order.slice(to + 1)];
        const before = best.score;
        consider(candidate);
        if (best.score < before) { order = candidate; improved = true; }
      }
    }
  }
  return best;
}

// Driving between consecutive visits of a line, and whether the schedule leaves enough time for it.
export function routeLegs(visits) {
  const active = visits.filter(visit => visit.status !== 'missed').map(visit => {
    const start = toMinutes(visit.time) ?? 0;
    return { id:visit.id, start, end:start + (Number(visit.duration) || 60), coords:coordsFor(visit.address, visit.name) };
  }).sort((a,b) => a.start - b.start);
  const legs = {};
  active.slice(1).forEach((stop, index) => {
    const previous = active[index];
    const minutes = travelMinutes(previous, stop);
    legs[stop.id] = { km:previous.coords && stop.coords ? kmBetween(previous.coords, stop.coords) : null, minutes, tight:previous.end + minutes > stop.start };
  });
  return legs;
}

// Proposes the driving order for one team's day. It changes nothing by itself: completed and
// in-progress visits, visits with a locked time and calendar events all stay where they are.
export function planDay({ date, team = '', visits = [], events = [], now = new Date() }) {
  const hours = WORK_HOURS[new Date(`${date}T12:00:00`).getDay()];
  const today = dayKey(now);
  if (!hours || date < today) return null;
  const line = visits.filter(visit => visit.date === date && visit.status !== 'missed' && (!team || !visit.team || visit.team === team));
  const toStop = visit => {
    const start = toMinutes(visit.time) ?? hours[0];
    const duration = Number(visit.duration) || 60;
    return { id:visit.id, label:visit.name, oldTime:visit.time, start, end:start + duration, duration, coords:coordsFor(visit.address, visit.name), fixedTime:Boolean(visit.fixedTime) };
  };
  const isMovable = visit => visit.status === 'planned' && !visit.fixedTime;
  const movable = line.filter(isMovable).map(toStop).sort((a,b) => a.start - b.start);
  if (!movable.length || line.length < 2) return null;
  const fixedVisits = line.filter(visit => !isMovable(visit)).map(toStop);
  const eventStops = events.filter(event => !event.allDay && event.startAt && dayKey(new Date(event.startAt)) === date).map(event => {
    const from = new Date(event.startAt), to = new Date(event.endAt || event.startAt);
    const start = from.getHours() * 60 + from.getMinutes();
    return { label:event.title, isEvent:true, start, end:Math.max(start, to.getHours() * 60 + to.getMinutes()), coords:coordsFor(event.location) };
  });
  const fixed = [...fixedVisits, ...eventStops].sort((a,b) => a.start - b.start);
  const earliestToday = date === today ? ceil5(now.getHours() * 60 + now.getMinutes() + 15) : 0;
  const cursor = Math.max(hours[0], earliestToday, movable[0].start);
  let best = bestOrder(movable, fixed, cursor, hours[1]);
  if (best.unscheduled.length) best = bestOrder(movable, fixed, cursor, hours[1] + FLEX_MINUTES);
  const lastVisitEnd = Math.max(...best.sequence.filter(stop => !stop.isEvent).map(stop => stop.end));
  const currentKm = pathKm([...movable, ...fixed].sort((a,b) => a.start - b.start));
  const tightLegs = Object.values(routeLegs(line)).filter(leg => leg.tight).length;
  const stops = best.sequence.filter(stop => !stop.isEvent).map(stop => ({
    id:stop.id, label:stop.label, oldTime:stop.oldTime, time:toTime(stop.start), endTime:toTime(stop.end),
    moved:toTime(stop.start) !== normalTime(stop.oldTime), locked:stop.fixedTime
  }));
  const savedKm = currentKm - best.km;
  const changes = stops.filter(stop => stop.moved).length;
  return {
    date, team, stops, changes, currentKm, plannedKm:best.km, savedKm, tightLegs, baseClose:toTime(hours[1]), overtimeMinutes:Math.max(0, lastVisitEnd - hours[1]),
    unscheduled:best.unscheduled.map(stop => stop.label),
    worthwhile:!best.unscheduled.length && changes > 0 && (savedKm >= 1 || tightLegs > 0)
  };
}

// Work areas -------------------------------------------------------------
const AREA_RADIUS_KM = 12;
const MAX_AREAS = 3;
const AREA_NAMES = { 'פתח תקווה':'פ"ת', 'רמת השרון':'רמה"ש', 'ראשון לציון':'ראשל"צ' };

// Names the areas of a day, such as "פ"ת והסביבה": each area is the city with the most stops around it.
export function workAreas({ date, visits = [], events = [] }) {
  const located = [
    ...visits.filter(visit => visit.date === date && visit.status !== 'missed').map(visit => ({ city:cityOf(visit.address), start:toMinutes(visit.time) ?? 0 })),
    ...events.filter(event => event.startAt && dayKey(new Date(event.startAt)) === date).map(event => ({ city:cityOf(event.location), start:new Date(event.startAt).getHours() * 60 }))
  ].filter(stop => stop.city);
  const areas = [];
  let remaining = located;
  while (remaining.length) {
    const centres = [...new Set(remaining.map(stop => stop.city))].map(city => {
      const members = remaining.filter(stop => kmBetween(CITIES[city], CITIES[stop.city]) <= AREA_RADIUS_KM);
      return { city, members, own:remaining.filter(stop => stop.city === city).length, first:Math.min(...members.map(stop => stop.start)) };
    }).sort((a,b) => b.members.length - a.members.length || b.own - a.own || a.first - b.first);
    const best = centres[0];
    areas.push({ label:`${AREA_NAMES[best.city] || best.city} והסביבה`, stops:best.members.length, first:best.first });
    remaining = remaining.filter(stop => !best.members.includes(stop));
  }
  return areas.sort((a,b) => b.stops - a.stops || a.first - b.first).slice(0, MAX_AREAS).map(area => area.label);
}
