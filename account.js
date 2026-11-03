// Sign-in screens, the first-run steps, and the account and sharing panel in Settings.
const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const toast = message => window.showToast?.(message);
const INVITE_KEY = 'esekli-pending-invite';
const ERRORS = {
  'auth/invalid-credential':'האימייל או הסיסמה שגויים.',
  'auth/wrong-password':'האימייל או הסיסמה שגויים.',
  'auth/user-not-found':'האימייל או הסיסמה שגויים.',
  'auth/invalid-email':'כתובת האימייל אינה תקינה.',
  'auth/email-already-in-use':'כבר קיים חשבון עם האימייל הזה. אפשר להיכנס אליו.',
  'auth/weak-password':'הסיסמה קצרה מדי. צריך לפחות 6 תווים.',
  'auth/too-many-requests':'היו יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.',
  'auth/network-request-failed':'אין חיבור לרשת. בדקו את החיבור ונסו שוב.',
  'auth/popup-closed-by-user':'חלון ההתחברות נסגר לפני שהכניסה הסתיימה.',
  'auth/cancelled-popup-request':'חלון ההתחברות נסגר לפני שהכניסה הסתיימה.',
  'auth/configuration-not-found':'שיטות הכניסה עדיין לא הופעלו בפרויקט.',
  'auth/operation-not-allowed':'שיטת הכניסה הזו עדיין לא הופעלה בפרויקט.',
  'auth/unauthorized-domain':'הכתובת הזו לא מאושרת לכניסה עם Google.'
};
const messageFor = error => ERRORS[error?.code] || 'משהו השתבש. נסו שוב.';

function readInviteFromAddress() {
  const value = new URLSearchParams(location.search).get('invite');
  if (value && /^[\w-]+\.[0-9a-f]{48}$/.test(value)) {
    try { sessionStorage.setItem(INVITE_KEY, value); } catch {}
    history.replaceState(null, '', location.pathname);
  }
  try { return sessionStorage.getItem(INVITE_KEY); } catch { return null; }
}
const clearInvite = () => { try { sessionStorage.removeItem(INVITE_KEY); } catch {} };

export function startAccount({ cloud, loadModules }) {
  const gate = document.createElement('div');
  gate.id = 'authGate';
  gate.className = 'gate';
  document.body.append(gate);
  let view = 'login';
  let notice = '';
  let appStarted = false;

  const card = (title, subtitle, body) => {
    gate.hidden = false;
    gate.innerHTML = `<main class="gate-card"><img class="gate-logo" src="./mz-empire-logo.jpg?v=mz-empire-1" alt="M.Z Empire"><h1>${safe(title)}</h1>${subtitle ? `<p class="gate-sub">${safe(subtitle)}</p>` : ''}${notice ? `<p class="gate-notice" role="status">${safe(notice)}</p>` : ''}<div class="gate-error" role="alert" hidden></div>${body}</main>`;
    notice = '';
  };
  const showLoading = text => { gate.hidden = false; gate.innerHTML = `<main class="gate-card gate-loading" role="status"><span class="gate-spinner" aria-hidden="true"></span><p>${safe(text)}</p></main>`; };
  const showError = message => { const box = gate.querySelector('.gate-error'); if (box) { box.textContent = message; box.hidden = false; } };
  async function submitting(form, task) {
    const button = form.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    try { await task(); }
    catch (error) { showError(messageFor(error)); console.warn(error); }
    if (button) button.disabled = false;
  }

  function renderLogin() {
    const signup = view === 'signup';
    if (view === 'reset') {
      card('שכחת סיסמה?', 'נשלח לאימייל שלך קישור לבחירת סיסמה חדשה.', `<form data-form="reset"><label>אימייל<input name="email" type="email" autocomplete="email" dir="ltr" required></label><button class="gate-primary" type="submit">שליחת קישור</button></form><button type="button" class="gate-link" data-view="login">חזרה לכניסה</button>`);
      return;
    }
    card(signup ? 'יצירת חשבון' : 'כניסה לעסקלי', 'ניהול העסק במקום אחד, בכל מכשיר.', `
      <button type="button" class="gate-google" data-google><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.2Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6Z"/></svg>כניסה עם Google</button>
      <div class="gate-divider"><span>או</span></div>
      <form data-form="${signup ? 'signup' : 'login'}">
        ${signup ? '<label>שם מלא<input name="name" autocomplete="name" maxlength="60" required></label>' : ''}
        <label>אימייל<input name="email" type="email" autocomplete="email" dir="ltr" required></label>
        <label>סיסמה<input name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" dir="ltr" minlength="6" required></label>
        ${signup ? '<small class="gate-hint">לפחות 6 תווים.</small>' : ''}
        <button class="gate-primary" type="submit">${signup ? 'יצירת חשבון' : 'כניסה'}</button>
      </form>
      ${signup ? '' : '<button type="button" class="gate-link" data-view="reset">שכחתי סיסמה</button>'}
      <p class="gate-switch">${signup ? 'כבר יש לך חשבון?' : 'עוד אין לך חשבון?'} <button type="button" class="gate-link" data-view="${signup ? 'login' : 'signup'}">${signup ? 'כניסה' : 'יצירת חשבון'}</button></p>`);
  }
  function renderCreateWorkspace(user) {
    card(`שלום${user.displayName ? ` ${user.displayName}` : ''}`, 'איך קוראים לעסק? אפשר לשנות את זה אחר כך. אם קיבלת קישור הזמנה, פתח אותו כדי להצטרף לעסק קיים.', `<form data-form="workspace"><label>שם העסק<input name="name" maxlength="60" value="M.Z Empire" required></label><button class="gate-primary" type="submit">יצירת העסק</button></form><button type="button" class="gate-link" data-signout>יציאה מהחשבון</button>`);
  }
  async function renderInvite(user, value, profile) {
    const [id, token] = value.split('.');
    showLoading('בודק את ההזמנה…');
    let invite;
    try { invite = await cloud.readInvite(id, token); } catch { invite = { status:'missing' }; }
    if (invite.status !== 'valid') {
      clearInvite();
      notice = invite.status === 'used' ? 'הקישור הזה כבר נוצל. בקש קישור חדש.' : invite.status === 'expired' ? 'תוקף הקישור פג. בקש קישור חדש.' : 'הקישור לא נמצא. בקש קישור חדש.';
      await enter(user);
      return;
    }
    if (profile.workspaceId === id) { clearInvite(); await enter(user); return; }
    card(`הצטרפות אל ${invite.workspaceName}`, `קיבלת הזמנה מ${invite.createdByName} לעבוד יחד באותו עסק. תראו את אותם נתונים ותוכלו לערוך אותם.`, `
      ${profile.workspaceId ? '<p class="gate-warning">כבר יש לך עסק באפליקציה. אחרי ההצטרפות תעבור לעסק החדש, וחשבון זה לא יוכל לחזור לקודם. הורד קודם קובץ גיבוי אם צריך.</p>' : ''}
      <form data-form="join"><button class="gate-primary" type="submit">הצטרפות</button></form><button type="button" class="gate-link" data-decline>לא עכשיו</button>`);
    gate.dataset.invite = value;
  }

  async function enter(user) {
    showLoading('טוען…');
    let profile = {};
    try { profile = await cloud.profile(user.uid); }
    catch (error) { console.warn(error); notice = 'אין חיבור לשרת. נסו לרענן את הדף.'; card('לא ניתן להתחבר', '', '<button type="button" class="gate-primary" data-reload>ניסיון נוסף</button><button type="button" class="gate-link" data-signout>יציאה מהחשבון</button>'); return; }
    const pending = readInviteFromAddress();
    if (pending) { await renderInvite(user, pending, profile); return; }
    if (!profile.workspaceId) { renderCreateWorkspace(user); return; }
    let workspace = null;
    try { workspace = await cloud.workspace(profile.workspaceId); }
    catch (error) {
      if (error.code !== 'permission-denied') { console.warn(error); notice = 'אין חיבור לשרת. נסו לרענן את הדף.'; card('לא ניתן להתחבר', '', '<button type="button" class="gate-primary" data-reload>ניסיון נוסף</button>'); return; }
    }
    if (!workspace) {
      await cloud.forgetWorkspace(user.uid);
      notice = 'הוסרת מהעסק הקודם, או שהוא לא קיים יותר. אפשר ליצור עסק חדש או לבקש הזמנה.';
      renderCreateWorkspace(user);
      return;
    }
    showLoading(`פותח את ${workspace.name}…`);
    await cloud.open(workspace.id);
    await loadModules();
    cloud.startPhotos();
    appStarted = true;
    gate.hidden = true;
    document.documentElement.classList.add('app-ready');
    mountAccountPanel({ cloud, user, workspaceId:workspace.id });
  }

  gate.addEventListener('click', async event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.view) { view = target.dataset.view; renderLogin(); }
    if ('google' in target.dataset) {
      target.disabled = true;
      try { await cloud.google(); } catch (error) { showError(messageFor(error)); console.warn(error); }
      target.disabled = false;
    }
    if ('signout' in target.dataset) { clearInvite(); await cloud.signOut(); }
    if ('reload' in target.dataset) location.reload();
    if ('decline' in target.dataset) { clearInvite(); await enter(cloud.currentUser()); }
  });
  gate.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target;
    const values = Object.fromEntries(new FormData(form));
    const type = form.dataset.form;
    submitting(form, async () => {
      if (type === 'login') await cloud.signIn(values.email.trim(), values.password);
      if (type === 'signup') await cloud.signUp(values.name.trim(), values.email.trim(), values.password);
      if (type === 'reset') {
        await cloud.resetPassword(values.email.trim());
        view = 'login';
        notice = 'אם קיים חשבון עם האימייל הזה, נשלח אליו קישור. בדקו גם בתיקיית הספאם.';
        renderLogin();
      }
      if (type === 'workspace') { await cloud.createWorkspace(values.name.trim()); await enter(cloud.currentUser()); }
      if (type === 'join') {
        const [id, token] = gate.dataset.invite.split('.');
        await cloud.acceptInvite(id, token);
        clearInvite();
        await enter(cloud.currentUser());
      }
    });
  });

  readInviteFromAddress();
  showLoading('טוען…');
  cloud.redirectResult?.().catch(error => { if (view === 'login' && !appStarted) { renderLogin(); showError(messageFor(error)); } });
  let knownUser = null;
  cloud.onUser(user => {
    if (appStarted && !user) { location.reload(); return; }
    if (appStarted || (user && knownUser === user.uid)) return;
    if (user) { knownUser = user.uid; enter(user).catch(error => { console.warn(error); notice = 'פתיחת העסק נכשלה. נסו שוב.'; card('לא ניתן להתחבר', '', '<button type="button" class="gate-primary" data-reload>ניסיון נוסף</button><button type="button" class="gate-link" data-signout>יציאה מהחשבון</button>'); }); }
    else { knownUser = null; view = 'login'; renderLogin(); }
  });
}

function mountAccountPanel({ cloud, user, workspaceId }) {
  const page = document.getElementById('settingsPage');
  const panel = document.createElement('section');
  panel.className = 'panel settings-card account-panel';
  page.querySelector('.welcome-row')?.after(panel);
  let workspace = null;
  let invites = [];
  let link = '';
  let canInstall = null;
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); canInstall = event; render(); });
  const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isOwner = () => workspace?.ownerId === user.uid;
  const initialsOf = text => String(text || '?').trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('');

  function updateHeader() {
    const name = user.displayName || user.email || 'החשבון שלי';
    const set = (selector, text) => { const element = document.querySelector(selector); if (element) element.textContent = text; };
    set('.top-user strong', name);
    set('.top-user span', isOwner() ? 'בעלים' : 'חבר צוות');
    set('.top-avatar', initialsOf(name));
    set('.team-copy strong', workspace?.name || '');
    set('.team-copy span', `${workspace?.memberIds?.length || 1} משתמשים`);
    set('.team-avatar', initialsOf(workspace?.name));
  }
  function render() {
    if (!workspace) return;
    const members = Object.entries(workspace.members || {}).sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
    const whatsapp = link ? `https://wa.me/?text=${encodeURIComponent(`הצטרפות אל ${workspace.name} בעסקלי: ${link}`)}` : '';
    panel.innerHTML = `<div class="panel-heading"><div><h2>החשבון והשיתוף</h2><div class="panel-subtitle">${safe(user.email || '')}</div></div><button type="button" class="secondary-button" data-action="signout">יציאה מהחשבון</button></div>
      <div class="account-block"><h3>העסק</h3>${isOwner() ? `<form class="account-row" data-form="rename"><input name="name" value="${safe(workspace.name)}" maxlength="60" aria-label="שם העסק" required><button class="secondary-button" type="submit">שמירה</button></form>` : `<p>${safe(workspace.name)}</p>`}</div>
      <div class="account-block"><h3>משתמשים (${members.length})</h3><ul class="account-members">${members.map(([uid, member]) => `<li><span class="account-avatar">${safe(initialsOf(member.name || member.email))}</span><span class="account-member"><b>${safe(member.name || member.email)}${uid === user.uid ? ' (את/ה)' : ''}</b><small>${safe(member.email)} · ${member.role === 'owner' ? 'בעלים' : 'חבר צוות'}</small></span>${isOwner() && uid !== user.uid ? `<button type="button" class="account-danger" data-action="remove" data-uid="${safe(uid)}" data-name="${safe(member.name || member.email)}">הסרה</button>` : ''}</li>`).join('')}</ul></div>
      ${isOwner() ? `<div class="account-block"><h3>הזמנת משתמש</h3><p>כל קישור מתאים לאדם אחד, עובד פעם אחת ותקף ל־7 ימים. כל מי שמחזיק בקישור יכול להצטרף, אז כדאי לשלוח אותו רק לאנשים מוכרים.</p><button type="button" class="primary-button" data-action="invite">יצירת קישור הזמנה</button>
        ${link ? `<div class="account-link"><input readonly value="${safe(link)}" aria-label="קישור ההזמנה" dir="ltr"><div class="account-actions"><a class="primary-button" href="${safe(whatsapp)}" target="_blank" rel="noopener noreferrer">שליחה ב־WhatsApp</a><button type="button" class="secondary-button" data-action="copy">העתקה</button>${navigator.share ? '<button type="button" class="secondary-button" data-action="share">שיתוף</button>' : ''}</div></div>` : ''}
        ${invites.length ? `<ul class="account-invites">${invites.map(invite => `<li><span>הזמנה פתוחה, בתוקף עד ${safe(new Intl.DateTimeFormat('he-IL', { day:'numeric', month:'numeric' }).format(invite.expiresAt.toDate()))}</span><button type="button" class="account-danger" data-action="cancel-invite" data-token="${safe(invite.token)}">ביטול</button></li>`).join('')}</ul>` : ''}</div>` : `<div class="account-block"><button type="button" class="account-danger" data-action="leave">עזיבת העסק</button></div>`}
      ${installed() ? '' : `<div class="account-block"><h3>התקנה על הטלפון</h3>${canInstall ? '<button type="button" class="primary-button" data-action="install">התקנת האפליקציה</button>' : isIos ? '<p>ב־Safari: לוחצים על כפתור השיתוף ואז "הוספה למסך הבית".</p>' : '<p>בדפדפן הטלפון: פותחים את תפריט הדפדפן ובוחרים "התקנת אפליקציה" או "הוספה למסך הבית".</p>'}</div>`}`;
    updateHeader();
  }
  async function refreshInvites() {
    if (!isOwner()) return;
    try { invites = await cloud.openInvites(workspaceId); render(); } catch (error) { console.warn(error); }
  }
  panel.addEventListener('submit', async event => {
    event.preventDefault();
    if (event.target.dataset.form !== 'rename') return;
    try { await cloud.renameWorkspace(workspaceId, event.target.elements.name.value.trim()); toast('שם העסק עודכן.'); } catch { toast('השמירה נכשלה.'); }
  });
  panel.addEventListener('click', async event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    try {
      if (action === 'signout' && window.confirm('לצאת מהחשבון? הנתונים יימחקו מהמכשיר הזה וישארו שמורים בענן.')) await cloud.signOut();
      if (action === 'invite') { target.disabled = true; link = await cloud.createInvite(workspaceId, workspace.name); await refreshInvites(); render(); toast('הקישור מוכן לשליחה.'); }
      if (action === 'copy') { await navigator.clipboard.writeText(link); toast('הקישור הועתק.'); }
      if (action === 'share') await navigator.share({ title:`הצטרפות אל ${workspace.name}`, url:link });
      if (action === 'cancel-invite') { await cloud.cancelInvite(workspaceId, target.dataset.token); if (link.endsWith(target.dataset.token)) link = ''; await refreshInvites(); toast('ההזמנה בוטלה.'); }
      if (action === 'remove' && window.confirm(`להסיר את ${target.dataset.name} מהעסק? הגישה לנתונים תיחסם.`)) { await cloud.removeMember(workspaceId, target.dataset.uid); toast('המשתמש הוסר.'); }
      if (action === 'leave' && window.confirm('לעזוב את העסק? לא תהיה לך גישה לנתונים שלו.')) await cloud.leaveWorkspace(workspaceId);
      if (action === 'install' && canInstall) { await canInstall.prompt(); canInstall = null; render(); }
    } catch (error) { if (error?.name !== 'AbortError') { console.warn(error); toast('הפעולה נכשלה. נסו שוב.'); } }
  });
  cloud.watchWorkspace(workspaceId, value => {
    if (!value) { location.reload(); return; }
    workspace = value;
    render();
    if (!invites.length) refreshInvites();
  });
}
