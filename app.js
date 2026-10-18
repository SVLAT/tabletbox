import { cloud } from './cloud.js?v=11';

const $ = s => document.querySelector(s);
const KEY = 'pillbox:local:v1';
const today = () => new Date().toISOString().slice(0, 10);
const defaults = () => ({
  profile: { name: 'Лиза' },
  quick: ['Парацетамол — от температуры', 'Цитрамон — от головы', 'Железо — во время месячных'],
  courses: [{ name: 'Мотилиум', start: '2026-10-14', days: 92 }, { name: 'Цинаризин', start: '2026-10-14', days: 92 }],
  doses: [
    { id: 'motilium', name: 'Мотилиум', times: ['12:00', '16:00', '20:00'], course: true },
    { id: 'cinnarizine', name: 'Цинаризин', times: ['12:00', '16:00', '20:00'], course: true },
    { id: 'lamictal', name: 'Ламиктал · 150 мг', times: ['21:00'], course: false }
  ],
  log: []
});
let state = JSON.parse(localStorage.getItem(KEY) || 'null') || defaults();
const save = () => { localStorage.setItem(KEY, JSON.stringify(state)); cloud.push(state).catch(() => {}); };
const esc = value => { const el = document.createElement('i'); el.textContent = value; return el.innerHTML; };
const currentDayEvents = () => state.log.filter(x => x.date === today());
const doseEvents = id => currentDayEvents().filter(x => x.type === 'dose' && x.doseId === id);
const courseDay = c => Math.min(c.days, Math.max(1, Math.floor((new Date() - new Date(`${c.start}T00:00:00`)) / 86400000) + 1));
function toast(text) { const el = $('#toast'); el.textContent = text; el.classList.add('visible'); clearTimeout(window.toastTimeout); window.toastTimeout = setTimeout(() => el.classList.remove('visible'), 2500); }
function record(event) { state.log.push({ id: crypto.randomUUID(), date: today(), at: new Date().toISOString(), ...event }); save(); }
function renderHome() {
  $('#todayLabel').textContent = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  $('h1').textContent = `Доброе утро, ${state.profile.name}`;
  const planned = state.doses.flatMap(d => d.times.map(time => ({ ...d, time }))).sort((a, b) => a.time.localeCompare(b.time));
  const next = planned.find(x => !currentDayEvents().some(e => e.type === 'dose' && e.doseId === x.id && e.time === x.time)) || planned[0];
  $('#nextName').textContent = next.name; $('#nextDetails').textContent = `${next.time} · по расписанию`; $('#nextTime').textContent = next.time;
  const done = currentDayEvents().filter(x => x.type === 'dose').length; $('#doneCounter').textContent = `${done} из ${planned.length}`;
  $('#schedule').innerHTML = state.doses.map(d => { const entries = doseEvents(d.id); const complete = entries.length === d.times.length; return `<article class="dose-item ${complete ? 'done' : ''}"><button class="dose-check" data-dose="${d.id}" aria-label="Отметить ${esc(d.name)}">${complete ? '✓' : '○'}</button><div class="dose-info"><div class="dose-name">${esc(d.name)}</div><div class="dose-note">${d.times.length} ${d.times.length === 1 ? 'приём' : 'приёма'}: ${d.times.join(' · ')}</div></div></article>`; }).join('');
  $('#courses').innerHTML = state.courses.map(c => { const day = courseDay(c), percent = Math.round(day / c.days * 100); return `<article class="course-card"><div class="course-top"><span class="course-dot"></span><h3>${esc(c.name)}</h3></div><p>${day} день из ${c.days}</p><div class="progress-line"><div class="progress-fill" style="width:${percent}%"></div></div><div class="progress-label"><span>Пройдено</span><b>${percent}%</b></div></article>`; }).join('');
  $('#quickMedicine').innerHTML = state.quick.map(x => `<option>${esc(x)}</option>`).join('');
}
function markDose(id) { const dose = state.doses.find(x => x.id === id); const unused = dose.times.find(time => !currentDayEvents().some(e => e.type === 'dose' && e.doseId === id && e.time === time)); if (!unused) return toast('Все приёмы уже отмечены'); record({ type: 'dose', doseId: id, time: unused, label: dose.name }); renderHome(); toast(`${dose.name}: приём в ${unused} отмечен`); }
function show(view) { ['.app-shell', '.bottom-nav'].forEach(s => $(s).hidden = view !== 'home'); $('#statsView').hidden = view !== 'stats'; $('#settingsView').hidden = view !== 'settings'; $('#calendarView').hidden = view !== 'calendar'; }
function renderStats(period = 'month') { const now = new Date(), start = period === 'year' ? new Date(now.getFullYear(), 0, 1) : period === 'all' ? new Date(0) : new Date(now.getFullYear(), now.getMonth(), 1); const quick = state.log.filter(x => x.type === 'quick' && new Date(x.at) >= start); const counts = quick.reduce((all, x) => ((all[x.label] = (all[x.label] || 0) + 1), all), {});
  $('#statsCourses').innerHTML = state.courses.map(c => { const day = courseDay(c), p = Math.round(day / c.days * 100); return `<article class="stat-course"><div><b>${esc(c.name)}</b><span>${day} из ${c.days} дней</span></div><div class="progress-line"><div class="progress-fill" style="width:${p}%"></div></div></article>`; }).join('');
  $('#statsQuick').innerHTML = Object.keys(counts).length ? Object.entries(counts).map(([name, count]) => `<article><b>${esc(name)}</b><span>${count} ${count === 1 ? 'приём' : 'приёма'}</span></article>`).join('') : '<p>За выбранный период быстрых приёмов пока нет.</p>';
}
function renderCalendar() { const container = $('#calendarDays'), now = new Date(), y = now.getFullYear(), m = now.getMonth(), last = new Date(y, m + 1, 0).getDate(); container.innerHTML = ''; for (let d = 1; d <= last; d++) { const button = document.createElement('button'); button.textContent = d; if (d === now.getDate()) button.className = 'selected'; button.onclick = () => { $('#calendarDate').textContent = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(y, m, d)); $('#calendarView .calendar-summary p:last-child').textContent = d === now.getDate() ? 'На сегодня запланированы Мотилиум, Цинаризин и Ламиктал.' : 'Выбранная дата. Приёмы за этот день появятся здесь после синхронизации аккаунта.'; container.querySelectorAll('button').forEach(x => x.classList.remove('selected')); button.classList.add('selected'); }; container.append(button); } }
$('#schedule').addEventListener('click', e => { const id = e.target.closest('[data-dose]')?.dataset.dose; if (id) markDose(id); });
$('#takeNext').onclick = () => { const item = state.doses.find(d => doseEvents(d.id).length < d.times.length); if (item) markDose(item.id); };
$('#openQuickDose').onclick = () => $('#quickDoseDialog').showModal();
$('#quickDoseForm').onsubmit = e => { e.preventDefault(); const f = new FormData(e.target); record({ type: 'quick', label: `${f.get('medicine')} · ${f.get('amount')} ${f.get('unit')}` }); $('#quickDoseDialog').close(); renderHome(); toast('Быстрый приём сохранён'); };
$('#manageQuickList').onclick = () => { $('#quickListItems').innerHTML = state.quick.map((x, i) => `<button class="list-item" type="button" data-remove="${i}">${esc(x)}<span>×</span></button>`).join(''); $('#quickListDialog').showModal(); };
$('#quickListItems').onclick = e => { const id = e.target.closest('[data-remove]')?.dataset.remove; if (id === undefined) return; state.quick.splice(Number(id), 1); save(); $('#manageQuickList').click(); };
$('#quickListForm').onsubmit = e => { e.preventDefault(); const name = new FormData(e.target).get('newMedicine').trim(); if (name) { state.quick.push(name); save(); } $('#quickListDialog').close(); renderHome(); };
$('#calendarButton').onclick = () => { show('calendar'); renderCalendar(); }; $('#statsButton').onclick = () => { show('stats'); renderStats(); }; $('#settingsButton').onclick = () => show('settings');
document.querySelectorAll('[data-home], .nav-item.active').forEach(b => b.onclick = () => show('home'));
$('#backHome').onclick = () => show('home');
$('#periods').onclick = e => { const p = e.target.dataset.period; if (!p) return; $('#periods').querySelectorAll('button').forEach(b => b.classList.toggle('active', b === e.target)); renderStats(p); };
$('#accountButton').onclick = () => { $('#accountForm [name=name]').value = state.profile.name; $('#accountNote').textContent = cloud.ready ? 'Введите почту — отправим безопасную ссылку для входа и синхронизации.' : 'Пока профиль хранится на этом устройстве. Подключение к облаку добавит синхронизацию и настоящий вход.'; $('#accountForm .primary-button').innerHTML = cloud.ready ? 'Отправить ссылку для входа <span>→</span>' : 'Сохранить профиль <span>→</span>'; $('#accountDialog').showModal(); };
$('#accountForm').onsubmit = async e => { e.preventDefault(); const form = new FormData(e.target), email = form.get('email').trim(); state.profile.name = form.get('name').trim(); save(); if (cloud.ready && email) { try { await cloud.signIn(email); $('#accountDialog').close(); toast('Ссылка для входа отправлена на почту'); } catch { toast('Не удалось отправить ссылку. Проверь настройки Supabase.'); } return; } $('#accountDialog').close(); renderHome(); toast('Локальный профиль сохранён'); };
$('#addMedicine').onclick = () => $('#medicineDialog').showModal();
$('#medicineForm').onsubmit = e => { e.preventDefault(); const f = new FormData(e.target); state.doses.push({ id: crypto.randomUUID(), name: f.get('name').trim(), times: [f.get('time')], course: f.get('course') === 'on' }); save(); $('#medicineDialog').close(); renderHome(); };
renderHome();
if (cloud.ready) {
  cloud.pull().then(remote => { if (remote) { state = remote; localStorage.setItem(KEY, JSON.stringify(state)); renderHome(); } else { cloud.push(state).catch(() => {}); } }).catch(() => {});
}
