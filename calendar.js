const DAY_MS = 86400000;
const FIRST_HOUR = 7;
const LAST_HOUR = 21;
const HOUR_HEIGHT = 56;

const demoOrganization = { id: "org-demo", name: "העסק שלי", timeZone: "Asia/Jerusalem" };
const demoMembers = [
  { id: "u-nahorai", name: "נהוראי מרציאנו", initials: "נ", color: "teal", role: "admin" },
  { id: "u-business-partner", name: "שותף לעסק", initials: "ש", color: "blue", role: "member" }
];
const demoTasks = [
  { id: "task-1", title: "לעבור על הזמנת הספקים", organizationId: "org-demo" },
  { id: "task-2", title: "לשלוח הצעת מחיר לדנה לוי", organizationId: "org-demo" },
  { id: "task-3", title: "לעדכן את מחירון החורף", organizationId: "org-demo" },
  { id: "task-4", title: "לחזור ליוסי כהן לגבי הפגישה", organizationId: "org-demo" }
];

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function dateFromKey(value) {
  const parts = value.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function localDateTime(date, time) {
  const d = date.split("-").map(Number);
  const t = time.split(":").map(Number);
  return new Date(d[0], d[1] - 1, d[2], t[0], t[1]);
}

function startOfWeek(date) {
  const result = startOfDay(date);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function formatTime(value) {
  return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}

function formatDay(value) {
  return new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(value);
}

function makeDemoApi(organization, members, currentUser) {
  function at(offset, time) {
    const parts = time.split(":").map(Number);
    const date = new Date();
    date.setDate(date.getDate() + offset);
    date.setHours(parts[0], parts[1] || 0, 0, 0);
    return date.toISOString();
  }
  let events = [
    { id: "event-1", organizationId: organization.id, title: "ישיבת צוות", startAt: at(0, "09:30"), endAt: at(0, "10:30"), allDay: false, location: "חדר ישיבות", description: "תכנון שבועי ומעבר על משימות פתוחות.", participantIds: ["u-nahorai", "u-business-partner"], taskId: "task-1", reminderMinutes: 15, createdById: "u-nahorai" },
    { id: "event-2", organizationId: organization.id, title: "שיחה עם דנה לוי", startAt: at(0, "11:00"), endAt: at(0, "11:45"), allDay: false, location: "שיחת טלפון", description: "מעקב הצעת מחיר.", participantIds: ["u-nahorai", "u-business-partner"], taskId: "task-2", reminderMinutes: 30, createdById: "u-business-partner" },
    { id: "event-3", organizationId: organization.id, title: "קבלת אספקה", startAt: at(0, "13:30"), endAt: at(0, "14:15"), allDay: false, location: "מחסן", description: "בדיקת מלאי והזמנה.", participantIds: ["u-nahorai", "u-business-partner"], taskId: null, reminderMinutes: null, createdById: "u-nahorai" },
    { id: "event-4", organizationId: organization.id, title: "הכנת הצעת מחיר", startAt: at(1, "15:00"), endAt: at(1, "16:00"), allDay: false, location: "", description: "", participantIds: ["u-nahorai", "u-business-partner"], taskId: "task-3", reminderMinutes: 60, createdById: "u-nahorai" },
    { id: "event-5", organizationId: organization.id, title: "יום צילום מוצרים", startAt: at(2, "00:00"), endAt: at(3, "00:00"), allDay: true, location: "סטודיו", description: "", participantIds: ["u-nahorai", "u-business-partner"], taskId: null, reminderMinutes: 1440, createdById: "u-business-partner" },
    { id: "event-6", organizationId: organization.id, title: "פגישת תיאום", startAt: at(3, "10:00"), endAt: at(3, "11:00"), allDay: false, location: "חדר ישיבות", description: "", participantIds: ["u-nahorai", "u-business-partner"], taskId: null, reminderMinutes: 15, createdById: "u-nahorai" }
  ];
  const taskMap = demoTasks.map((task) => Object.assign({}, task, { organizationId: organization.id }));
  function mayEdit(record) {
    return currentUser.role === "admin" || record.createdById === currentUser.id;
  }
  return {
    async listEvents(query) {
      if (query.organizationId !== organization.id) throw new Error("אין גישה לארגון הזה");
      const from = new Date(query.startAt).getTime();
      const to = new Date(query.endAt).getTime();
      return events.filter((item) => item.organizationId === organization.id && new Date(item.startAt).getTime() < to && new Date(item.endAt).getTime() > from).map((item) => Object.assign({}, item));
    },
    async listTasks(query) {
      if (query.organizationId !== organization.id) throw new Error("אין גישה לארגון הזה");
      return taskMap.map((item) => Object.assign({}, item));
    },
    async createEvent(payload) {
      if (payload.organizationId !== organization.id || payload.createdById !== currentUser.id) throw new Error("אין הרשאה ליצור אירוע בארגון הזה");
      if ((payload.participantIds || []).some((id) => !members.some((member) => member.id === id))) throw new Error("אפשר לבחור משתתפים מהארגון בלבד");
      if (payload.taskId && !taskMap.some((task) => task.id === payload.taskId)) throw new Error("המשימה לא נמצאה");
      const record = Object.assign({ id: "event-" + Math.random().toString(36).slice(2, 9) }, payload);
      events.push(record);
      return Object.assign({}, record);
    },
    async updateEvent(payload) {
      if (payload.organizationId !== organization.id) throw new Error("אין גישה לארגון הזה");
      const index = events.findIndex((item) => item.id === payload.eventId && item.organizationId === organization.id);
      if (index < 0 || !mayEdit(events[index])) throw new Error("אין הרשאה לערוך את האירוע");
      const record = Object.assign({}, events[index], payload);
      delete record.eventId;
      events[index] = record;
      return Object.assign({}, record);
    },
    async deleteEvent(query) {
      const index = events.findIndex((item) => item.id === query.eventId && item.organizationId === organization.id);
      if (query.organizationId !== organization.id || index < 0 || !mayEdit(events[index])) throw new Error("אין הרשאה למחוק את האירוע");
      events.splice(index, 1);
    }
  };
}

class WorkCalendar {
  constructor(root, context) {
    this.root = root;
    this.context = context;
    this.organization = context.organization;
    this.currentUser = context.currentUser;
    this.members = context.members;
    this.api = context.api;
    this.date = startOfDay(new Date());
    this.view = matchMedia("(max-width: 760px)").matches ? "list" : "week";
    this.events = [];
    this.tasks = [];
    this.filterId = "";
    this.filterOpen = false;
    this.modal = null;
    this.toastMessage = "";
    this.clickHandler = this.handleClick.bind(this);
    this.submitHandler = this.handleSubmit.bind(this);
    this.changeHandler = this.handleChange.bind(this);
  }

  async mount() {
    this.root.addEventListener("click", this.clickHandler);
    this.root.addEventListener("submit", this.submitHandler);
    this.root.addEventListener("change", this.changeHandler);
    await this.refresh();
  }

  range() {
    if (this.view === "month") {
      const start = startOfWeek(new Date(this.date.getFullYear(), this.date.getMonth(), 1));
      const end = new Date(start);
      end.setDate(end.getDate() + 42);
      return { start, end };
    }
    if (this.view === "week") {
      const start = startOfWeek(this.date);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { start, end };
    }
    const start = startOfDay(this.date);
    const end = new Date(start.getTime() + DAY_MS);
    return { start, end };
  }

  async refresh() {
    this.loading = true;
    this.render();
    const range = this.range();
    try {
      const values = await Promise.all([
        this.api.listEvents({ organizationId: this.organization.id, startAt: range.start.toISOString(), endAt: range.end.toISOString() }),
        this.api.listTasks({ organizationId: this.organization.id })
      ]);
      this.events = values[0].slice().sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
      this.tasks = values[1];
      this.loading = false;
    } catch (error) {
      this.loading = false;
      this.error = error.message || "טעינת היומן נכשלה";
    }
    this.render();
  }

  visibleEvents(date) {
    const key = dateKey(date);
    return this.events.filter((item) => dateKey(new Date(item.startAt)) === key && (!this.filterId || (item.participantIds || []).includes(this.filterId)));
  }

  title() {
    if (this.view === "month") return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(this.date);
    if (this.view === "day" || this.view === "list") return formatDay(this.date);
    const start = startOfWeek(this.date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) return new Intl.DateTimeFormat("he-IL", { day: "numeric" }).format(start) + "–" + new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" }).format(end);
    return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" }).format(start) + "–" + new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", year: "numeric" }).format(end);
  }

  render() {
    const todayEvents = this.visibleEvents(new Date());
    const todayCount = todayEvents.length;
    const linkedCount = todayEvents.filter((item) => item.taskId).length;
    const plannedMinutes = todayEvents.filter((item) => !item.allDay).reduce((total, item) => total + Math.max(0, (new Date(item.endAt) - new Date(item.startAt)) / 60000), 0);
    const plannedHours = Math.round(plannedMinutes / 6) / 10;
    const nextEvent = this.events.find((item) => (!this.filterId || (item.participantIds || []).includes(this.filterId)) && new Date(item.endAt) >= new Date());
    const chosen = this.members.find((item) => item.id === this.filterId);
    this.root.innerHTML = '<div class="cal-app"><div class="cal-heading"><div class="cal-heading-title"><span class="cal-app-mark" aria-hidden="true">▦</span><div><div class="cal-eyebrow">ניהול העסק · צוות</div><h1>יומן העבודה</h1><p>היום שלך מתוכנן במקום אחד.</p></div></div><button class="cal-primary" type="button" data-action="new-event"><span>＋</span> אירוע חדש</button></div>' +
      '<div class="cal-summary"><div class="cal-summary-card"><span class="cal-summary-icon teal">▦</span><span><small>אירועים היום</small><b>' + todayCount + '</b><small>ביומן הצוות</small></span></div><div class="cal-summary-card"><span class="cal-summary-icon blue">✓</span><span><small>משימות מקושרות</small><b>' + linkedCount + '</b><small>מתוך האירועים היום</small></span></div><div class="cal-summary-card"><span class="cal-summary-icon orange">◷</span><span><small>זמן מתוכנן</small><b>' + plannedHours + ' שעות</b><small>לאירועים היום</small></span></div><div class="cal-summary-card"><span class="cal-summary-icon team">♧</span><span><small>חברי הצוות</small><b>' + this.members.length + ' אנשים</b></span><div class="cal-avatars">' + this.members.slice(0, 4).map((member) => '<i class="' + escapeHtml(member.color) + '" title="' + escapeHtml(member.name) + '">' + escapeHtml(member.initials) + '</i>').join("") + '</div></div></div>' +
      '<section class="cal-panel"><div class="cal-toolbar"><div class="cal-date-controls"><button type="button" data-action="previous" aria-label="הקודם">›</button><button type="button" data-action="next" aria-label="הבא">‹</button><button class="cal-today" type="button" data-action="today">היום</button><h2>' + escapeHtml(this.title()) + '</h2></div><div class="cal-tools"><div class="cal-view-tabs" role="tablist" aria-label="תצוגת יומן">' + this.viewButton("list", "רשימה") + this.viewButton("day", "יום") + this.viewButton("week", "שבוע") + this.viewButton("month", "חודש") + '</div><div class="cal-filter-wrap"><button class="cal-filter" type="button" data-action="filter" aria-expanded="' + this.filterOpen + '">♧ ' + escapeHtml(chosen ? chosen.name : "כל הצוות") + '⌄</button>' + (this.filterOpen ? '<div class="cal-filter-menu"><button type="button" data-action="filter-member" data-member="">כל הצוות</button>' + this.members.map((member) => '<button type="button" data-action="filter-member" data-member="' + escapeHtml(member.id) + '"><i class="' + escapeHtml(member.color) + '">' + escapeHtml(member.initials) + '</i>' + escapeHtml(member.name) + '</button>').join("") + '</div>' : "") + '</div></div></div>' +
      (this.error ? '<div class="cal-error">' + escapeHtml(this.error) + ' <button type="button" data-action="retry">ניסיון נוסף</button></div>' : this.loading ? '<div class="cal-loading">טוען את היומן…</div>' : this.renderView()) +
      '<div class="cal-legend"><span><i class="plain"></i>אירוע</span><span><i class="linked"></i>אירוע עם משימה מקושרת</span><small>לחיצה על שעה פנויה תיצור אירוע</small></div></section>' +
      '<p class="cal-demo-note">נתוני הדגמה זמניים · החיבור לשמירה ולשיתוף ארגוני יתווסף בשלב התשתית המשותפת</p>' +
      (this.modal ? this.renderModal() : "") + (this.toastMessage ? '<div class="cal-toast" role="status">' + escapeHtml(this.toastMessage) + '</div>' : "") + '</div>';
  }

  viewButton(value, label) {
    return '<button type="button" role="tab" aria-selected="' + (this.view === value) + '" class="' + (this.view === value ? "selected" : "") + '" data-action="view" data-view="' + value + '">' + label + '</button>';
  }

  renderView() {
    if (this.view === "list") return this.renderList();
    if (this.view === "month") return this.renderMonth();
    if (this.view === "day") return this.renderDay();
    return this.renderWeek();
  }

  eventClass(item) {
    return item.taskId ? "linked" : "plain";
  }

  eventButton(item, compact) {
    return '<button type="button" class="cal-event ' + this.eventClass(item) + (compact ? " compact" : "") + '" data-action="open-event" data-id="' + escapeHtml(item.id) + '"><i></i><span><b>' + escapeHtml(item.title) + '</b>' + (!compact ? '<small>' + (item.allDay ? "כל היום" : formatTime(item.startAt)) + '</small>' : "") + '</span></button>';
  }

  renderList() {
    const items = this.visibleEvents(this.date).slice().sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    if (!items.length) return '<div class="cal-list-empty"><span>▦</span><b>אין אירועים מתוכננים ליום הזה</b><small>אפשר להוסיף אירוע ולשתף אותו עם הצוות.</small><button class="cal-primary" type="button" data-action="new-event"><span>＋</span> אירוע חדש</button></div>';
    const rows = items.map((item) => {
      const participantCount = (item.participantIds || []).length;
      const meta = [item.location, participantCount ? participantCount + (participantCount === 1 ? " איש צוות" : " אנשי צוות") : "ללא משתתפים"].filter(Boolean).join(" · ");
      return '<div class="cal-list-row"><span class="cal-list-time">' + (item.allDay ? "כל היום" : formatTime(item.startAt)) + (item.allDay ? "" : '<small>' + formatTime(item.endAt) + '</small>') + '</span><span class="cal-list-marker ' + this.eventClass(item) + '"></span><button type="button" class="cal-list-card ' + this.eventClass(item) + '" data-action="open-event" data-id="' + escapeHtml(item.id) + '"><span class="cal-list-card-head"><b>' + escapeHtml(item.title) + '</b><span class="cal-list-tag">' + (item.taskId ? "משימה מקושרת" : "אירוע צוותי") + '</span></span><span class="cal-list-meta">' + escapeHtml(meta || "פרטי האירוע") + '</span><span class="cal-list-arrow" aria-hidden="true">‹</span></button></div>';
    }).join("");
    return '<div class="cal-list-view"><div class="cal-list-caption"><b>תוכנית היום</b><span>' + items.length + (items.length === 1 ? " אירוע" : " אירועים") + '</span></div><div class="cal-list-rows">' + rows + '</div><button class="cal-list-add" type="button" data-action="new-event"><span>＋</span> הוספת אירוע ליום</button></div>';
  }

  renderMonth() {
    const first = new Date(this.date.getFullYear(), this.date.getMonth(), 1);
    const gridStart = startOfWeek(first);
    const labels = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
    let cells = "";
    for (let index = 0; index < 42; index++) {
      const day = new Date(gridStart);
      day.setDate(day.getDate() + index);
      const items = this.visibleEvents(day);
      const classes = ["cal-month-cell"];
      if (day.getMonth() !== this.date.getMonth()) classes.push("outside");
      if (dateKey(day) === dateKey(new Date())) classes.push("today");
      cells += '<div class="' + classes.join(" ") + '" data-action="new-day" data-date="' + dateKey(day) + '"><span class="cal-day-number">' + day.getDate() + '</span><div class="cal-month-events">' + items.slice(0, 3).map((item) => this.eventButton(item, true)).join("") + (items.length > 3 ? '<button class="cal-more" type="button" data-action="show-day" data-date="' + dateKey(day) + '">+' + (items.length - 3) + ' נוספים</button>' : "") + '</div></div>';
    }
    return '<div class="cal-month"><div class="cal-weekdays">' + labels.map((label) => '<span>' + label + '</span>').join("") + '</div><div class="cal-month-grid">' + cells + '</div></div>';
  }

  renderWeek() {
    const start = startOfWeek(this.date);
    const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(date.getDate() + index); return date; });
    const header = '<div class="cal-week-head"><div class="cal-timezone">' + escapeHtml(this.organization.timeZone || "זמן מקומי") + '</div>' + days.map((date) => '<div class="cal-week-day ' + (dateKey(date) === dateKey(new Date()) ? "today" : "") + '"><span>' + escapeHtml(new Intl.DateTimeFormat("he-IL", { weekday: "short" }).format(date)) + '</span><b>' + date.getDate() + '</b><div>' + this.visibleEvents(date).filter((item) => item.allDay).slice(0, 1).map((item) => this.eventButton(item, true)).join("") + '</div></div>').join("") + '</div>';
    const hours = '<div class="cal-hour-rail">' + Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, index) => '<span>' + String(index + FIRST_HOUR).padStart(2, "0") + ':00</span>').join("") + '</div>';
    return '<div class="cal-week-scroll"><div class="cal-week-calendar">' + header + '<div class="cal-week-body">' + hours + days.map((date) => this.weekColumn(date)).join("") + '</div></div></div>';
  }

  weekColumn(date) {
    const items = this.visibleEvents(date).filter((item) => !item.allDay);
    const columns = [];
    const positioned = items.map((item) => {
      const start = new Date(item.startAt).getTime();
      const end = new Date(item.endAt).getTime();
      let col = columns.findIndex((lastEnd) => lastEnd <= start);
      if (col < 0) col = columns.length;
      columns[col] = end;
      return { item, col };
    });
    const count = Math.max(1, columns.length);
    const slots = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, index) => '<button type="button" class="cal-hour-slot" aria-label="יצירת אירוע בשעה ' + (index + FIRST_HOUR) + '" data-action="new-at" data-date="' + dateKey(date) + '" data-time="' + String(index + FIRST_HOUR).padStart(2, "0") + ':00"></button>').join("");
    const blocks = positioned.map(({ item, col }) => {
      const start = new Date(item.startAt);
      const end = new Date(item.endAt);
      const top = Math.max(0, ((start.getHours() - FIRST_HOUR) * 60 + start.getMinutes()) / 60 * HOUR_HEIGHT);
      const height = Math.max(33, Math.min((LAST_HOUR - FIRST_HOUR) * HOUR_HEIGHT - top, (end.getTime() - start.getTime()) / 3600000 * HOUR_HEIGHT - 3));
      const width = 100 / count;
      return '<button type="button" class="cal-week-event ' + this.eventClass(item) + '" style="top:' + top + 'px;left:calc(' + (col * width) + '% + 2px);width:calc(' + width + '% - 4px);height:' + height + 'px" data-action="open-event" data-id="' + escapeHtml(item.id) + '"><b>' + escapeHtml(item.title) + '</b><small>' + formatTime(item.startAt) + '–' + formatTime(item.endAt) + '</small></button>';
    }).join("");
    return '<div class="cal-week-column"><div class="cal-slots">' + slots + '</div><div class="cal-week-event-layer">' + blocks + '</div></div>';
  }

  renderDay() {
    const allDay = this.visibleEvents(this.date).filter((item) => item.allDay);
    const timed = this.visibleEvents(this.date).filter((item) => !item.allDay);
    const rows = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, index) => {
      const hour = index + FIRST_HOUR;
      const items = timed.filter((item) => new Date(item.startAt).getHours() === hour);
      return '<div class="cal-day-row"><span>' + String(hour).padStart(2, "0") + ':00</span><div><button type="button" data-action="new-at" data-date="' + dateKey(this.date) + '" data-time="' + String(hour).padStart(2, "0") + ':00" aria-label="יצירת אירוע בשעה ' + hour + '"></button>' + items.map((item) => this.eventButton(item, false)).join("") + '</div></div>';
    }).join("");
    return '<div class="cal-day-view"><div class="cal-day-title"><b>' + escapeHtml(formatDay(this.date)) + '</b><span>' + this.visibleEvents(this.date).length + ' אירועים</span></div>' + (allDay.length ? '<div class="cal-all-day"><span>כל היום</span><div>' + allDay.map((item) => this.eventButton(item, false)).join("") + '</div></div>' : "") + rows + '</div>';
  }

  canEdit(item) {
    return this.currentUser.role === "admin" || item.createdById === this.currentUser.id;
  }

  renderModal() {
    if (this.modal.type === "details") return this.detailsModal(this.modal.item);
    return this.editorModal(this.modal.item);
  }

  detailsModal(item) {
    const participantNames = (item.participantIds || []).map((id) => this.members.find((member) => member.id === id)).filter(Boolean).map((member) => escapeHtml(member.name)).join(" · ");
    const task = this.tasks.find((value) => value.id === item.taskId);
    return '<div class="cal-overlay" data-action="backdrop"><section class="cal-dialog" role="dialog" aria-modal="true" aria-labelledby="calDialogTitle"><div class="cal-dialog-top"></div><div class="cal-dialog-head"><small>פרטי אירוע</small><button type="button" data-action="close" aria-label="סגירה">×</button></div><h2 id="calDialogTitle">' + escapeHtml(item.title) + '</h2><div class="cal-detail-list"><p><b>מועד</b><span>' + escapeHtml(formatDay(new Date(item.startAt))) + ' · ' + (item.allDay ? "כל היום" : formatTime(item.startAt) + "–" + formatTime(item.endAt)) + '</span></p>' + (item.location ? '<p><b>מיקום</b><span>' + escapeHtml(item.location) + '</span></p>' : "") + (item.description ? '<p><b>תיאור</b><span>' + escapeHtml(item.description) + '</span></p>' : "") + '<p><b>משתתפים</b><span>' + (participantNames || "לא נבחרו") + '</span></p>' + (task ? '<p><b>משימה מקושרת</b><span>' + escapeHtml(task.title) + '</span></p>' : "") + (item.reminderMinutes != null ? '<p><b>תזכורת</b><span>' + escapeHtml(this.reminderLabel(item.reminderMinutes)) + '</span></p>' : "") + '</div><div class="cal-dialog-actions">' + (this.canEdit(item) ? '<button class="cal-delete" type="button" data-action="delete" data-id="' + escapeHtml(item.id) + '">מחיקה</button><button class="cal-primary" type="button" data-action="edit" data-id="' + escapeHtml(item.id) + '">עריכת אירוע</button>' : '<span>רק יוצר האירוע או מנהל יכולים לערוך אותו</span>') + '</div></section></div>';
  }

  editorModal(item) {
    const edit = Boolean(item);
    const date = item ? dateKey(new Date(item.startAt)) : dateKey(this.modal.date || this.date);
    const start = item && !item.allDay ? this.inputTime(item.startAt) : this.modal.time || "09:00";
    const end = item && !item.allDay ? this.inputTime(item.endAt) : this.modal.time ? String(Math.min(23, Number(this.modal.time.slice(0, 2)) + 1)).padStart(2, "0") + ":00" : "10:00";
    const picked = item ? item.participantIds || [] : [];
    const taskOptions = '<option value="">ללא משימה</option>' + this.tasks.map((task) => '<option value="' + escapeHtml(task.id) + '" ' + (item && item.taskId === task.id ? "selected" : "") + '>' + escapeHtml(task.title) + '</option>').join("");
    const memberOptions = this.members.map((member) => '<label><input type="checkbox" name="participantIds" value="' + escapeHtml(member.id) + '" ' + (picked.includes(member.id) ? "checked" : "") + '><i class="' + escapeHtml(member.color) + '">' + escapeHtml(member.initials) + '</i>' + escapeHtml(member.name) + '</label>').join("");
    return '<div class="cal-overlay" data-action="backdrop"><section class="cal-dialog cal-editor" role="dialog" aria-modal="true" aria-labelledby="calDialogTitle"><div class="cal-dialog-head"><div><small>' + (edit ? "עדכון בלוח המשותף" : "הוספה ללוח המשותף") + '</small><h2 id="calDialogTitle">' + (edit ? "עריכת אירוע" : "אירוע חדש") + '</h2></div><button type="button" data-action="close" aria-label="סגירה">×</button></div><form id="calEventForm"><input type="hidden" name="id" value="' + (item ? escapeHtml(item.id) : "") + '"><label>שם האירוע<input required maxlength="120" name="title" value="' + (item ? escapeHtml(item.title) : "") + '" placeholder="לדוגמה: פגישת צוות"></label><div class="cal-form-row"><label>תאריך<input required type="date" name="date" value="' + date + '"></label><label class="cal-all-day"><input type="checkbox" name="allDay" ' + (item && item.allDay ? "checked" : "") + '> כל היום</label></div><div class="cal-form-row cal-times ' + (item && item.allDay ? "hidden" : "") + '"><label>התחלה<input required type="time" name="startTime" value="' + start + '"></label><label>סיום<input required type="time" name="endTime" value="' + end + '"></label></div><div class="cal-form-row"><label>מיקום<input maxlength="160" name="location" value="' + (item ? escapeHtml(item.location || "") : "") + '" placeholder="כתובת או קישור"></label><label>משימה מקושרת<select name="taskId">' + taskOptions + '</select></label></div><label>תיאור<textarea name="description" maxlength="1000" rows="2" placeholder="פרטים נוספים">' + (item ? escapeHtml(item.description || "") : "") + '</textarea></label><div class="cal-form-row"><label>תזכורת<select name="reminderMinutes"><option value="" ' + (!item || item.reminderMinutes == null ? "selected" : "") + '>ללא תזכורת</option><option value="5" ' + (item && item.reminderMinutes === 5 ? "selected" : "") + '>5 דקות לפני</option><option value="15" ' + (item && item.reminderMinutes === 15 ? "selected" : "") + '>15 דקות לפני</option><option value="30" ' + (item && item.reminderMinutes === 30 ? "selected" : "") + '>30 דקות לפני</option><option value="60" ' + (item && item.reminderMinutes === 60 ? "selected" : "") + '>שעה לפני</option><option value="1440" ' + (item && item.reminderMinutes === 1440 ? "selected" : "") + '>יום לפני</option></select></label><div></div></div><fieldset><legend>משתתפים מהצוות</legend><div class="cal-member-list">' + memberOptions + '</div></fieldset><div class="cal-form-error" role="status"></div><div class="cal-dialog-actions"><button class="cal-secondary" type="button" data-action="close">ביטול</button><button class="cal-primary" type="submit">' + (edit ? "שמירת שינויים" : "יצירת אירוע") + '</button></div></form></section></div>';
  }

  inputTime(value) {
    const date = new Date(value);
    return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  }

  reminderLabel(minutes) {
    if (minutes === 1440) return "יום לפני";
    if (minutes === 60) return "שעה לפני";
    return minutes + " דקות לפני";
  }

  async handleClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "backdrop" && event.target !== button) return;
    if (action === "previous" || action === "next") {
      const amount = action === "previous" ? -1 : 1;
      if (this.view === "month") this.date.setMonth(this.date.getMonth() + amount);
      else this.date.setDate(this.date.getDate() + amount * (this.view === "week" ? 7 : 1));
      await this.refresh();
    } else if (action === "today") {
      this.date = startOfDay(new Date());
      await this.refresh();
    } else if (action === "view") {
      this.view = button.dataset.view;
      await this.refresh();
    } else if (action === "filter") {
      this.filterOpen = !this.filterOpen;
      this.render();
    } else if (action === "filter-member") {
      this.filterId = button.dataset.member || "";
      this.filterOpen = false;
      this.render();
    } else if (action === "new-event") {
      this.openEditor(null, this.date, "09:00");
    } else if (action === "new-day" || action === "show-day") {
      this.date = dateFromKey(button.dataset.date);
      if (action === "show-day") this.view = "day";
      if (action === "new-day") this.openEditor(null, this.date, "09:00");
      else await this.refresh();
    } else if (action === "new-at") {
      this.openEditor(null, dateFromKey(button.dataset.date), button.dataset.time);
    } else if (action === "open-event") {
      const item = this.events.find((value) => value.id === button.dataset.id);
      if (item) { this.modal = { type: "details", item }; this.render(); }
    } else if (action === "close" || action === "backdrop") {
      this.modal = null;
      this.render();
    } else if (action === "edit") {
      const item = this.events.find((value) => value.id === button.dataset.id);
      if (item && this.canEdit(item)) this.openEditor(item);
    } else if (action === "delete") {
      const item = this.events.find((value) => value.id === button.dataset.id);
      if (item && this.canEdit(item) && confirm("למחוק את האירוע „" + item.title + "”?")) {
        try {
          await this.api.deleteEvent({ organizationId: this.organization.id, eventId: item.id });
          this.modal = null;
          this.toast("האירוע הוסר מהיומן");
          await this.refresh();
        } catch (error) { this.toast(error.message || "מחיקת האירוע נכשלה"); }
      }
    } else if (action === "retry") {
      this.error = "";
      await this.refresh();
    }
  }

  openEditor(item, date, time) {
    if (item && !this.canEdit(item)) return;
    this.modal = { type: "editor", item: item || null, date: date || this.date, time: time || "09:00" };
    this.render();
  }

  async handleSubmit(event) {
    if (event.target.id !== "calEventForm") return;
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const allDay = data.get("allDay") === "on";
    const start = allDay ? localDateTime(data.get("date"), "00:00") : localDateTime(data.get("date"), data.get("startTime"));
    const end = allDay ? new Date(start.getTime() + DAY_MS) : localDateTime(data.get("date"), data.get("endTime"));
    const errorBox = form.querySelector(".cal-form-error");
    if (!data.get("title").trim()) { errorBox.textContent = "צריך להוסיף שם לאירוע."; return; }
    if (end <= start) { errorBox.textContent = "שעת הסיום צריכה להיות אחרי שעת ההתחלה."; return; }
    const payload = {
      organizationId: this.organization.id,
      title: data.get("title").trim(),
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      allDay,
      location: data.get("location").trim(),
      description: data.get("description").trim(),
      participantIds: data.getAll("participantIds"),
      taskId: data.get("taskId") || null,
      reminderMinutes: data.get("reminderMinutes") === "" ? null : Number(data.get("reminderMinutes")),
      updatedById: this.currentUser.id
    };
    const id = data.get("id");
    try {
      if (id) await this.api.updateEvent(Object.assign({ eventId: id }, payload));
      else await this.api.createEvent(Object.assign({ createdById: this.currentUser.id }, payload));
      this.modal = null;
      this.toast(id ? "האירוע עודכן" : "האירוע נוסף ליומן");
      await this.refresh();
    } catch (error) { errorBox.textContent = error.message || "שמירת האירוע נכשלה."; }
  }

  handleChange(event) {
    if (event.target.name === "allDay") {
      const fields = this.root.querySelector(".cal-times");
      if (fields) fields.classList.toggle("hidden", event.target.checked);
    }
  }

  toast(message) {
    this.toastMessage = message;
    this.render();
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastMessage = ""; this.render(); }, 2400);
  }
}

const injected = window.businessAppContext || {};
const organization = injected.organization || demoOrganization;
const currentUser = injected.currentUser || demoMembers[0];
const members = injected.members || demoMembers;
const api = injected.calendarApi || makeDemoApi(organization, members, currentUser);
const root = document.getElementById("calendar-root");
if (root) new WorkCalendar(root, { organization, currentUser, members, api }).mount();
