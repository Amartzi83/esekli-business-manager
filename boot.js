// Starts the app. On the online address it signs in and loads the shared data before the screens
// run, so they never create sample data. Anywhere else it runs on this device only, as before.
const VERSION = '19';
const MODULES = ['store', 'calendar', 'visits', 'tasks', 'shopping', 'reminders', 'customers', 'history'];
const ONLINE_URL = 'https://esekli-business-manager.web.app/';

async function loadModules() {
  for (const name of MODULES) await import(`./${name}.js?v=${VERSION}`);
}

if (document.documentElement.classList.contains('cloud-mode')) {
  const [{ cloud }, { startAccount }] = await Promise.all([import(`./cloud.js?v=${VERSION}`), import(`./account.js?v=${VERSION}`)]);
  startAccount({ cloud, loadModules });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
} else {
  await loadModules();
  if (location.hostname.endsWith('github.io')) {
    const notice = document.createElement('p');
    notice.className = 'moved-notice';
    notice.innerHTML = `האפליקציה עברה לכתובת חדשה, עם כניסה אישית ושיתוף: <a href="${ONLINE_URL}">${ONLINE_URL}</a>. הנתונים כאן נשארים במכשיר הזה. אפשר להעביר אותם דרך קובץ גיבוי במסך "היסטוריה וגיבויים".`;
    document.querySelector('.main-area')?.prepend(notice);
  }
}
