'use strict';
const stage = document.querySelector('#stage');
const grid = document.querySelector('#grid');
const clock = document.querySelector('#clock');
const statusText = document.querySelector('#statusText');
const footerStatus = document.querySelector('#footerStatus');
const dot = document.querySelector('#dot');
let lastGood = [];

function fitStage() {
  const baseWidth = 1920;
  const baseHeight = 1080;
  const safeWidth = Math.max(320, window.innerWidth - 8);
  const safeHeight = Math.max(240, window.innerHeight - 8);
  const scale = Math.min(safeWidth / baseWidth, safeHeight / baseHeight);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function format(event) {
  // Parse the official calendar date as a date-only value in UTC so the day cannot
  // shift based on the browser or device timezone. Display the posted time verbatim.
  const parts = String(event.dateKey || '').split('-').map(Number);
  const d = parts.length === 3 ? new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])) : null;
  return {
    weekday: d ? d.toLocaleDateString('en-US', {weekday:'short', timeZone:'UTC'}) : '',
    day: d ? d.toLocaleDateString('en-US', {month:'short',day:'numeric', timeZone:'UTC'}) : '',
    time: event.tba ? 'TBA' : (event.displayTime || 'TBA')
  };
}
function cleanOpponent(value) {
  return String(value || '').replace(/^vs\.?\s+vs\.?\s+/i, 'vs. ').replace(/^at\s+at\s+/i, 'at ');
}
function render(events) {
  if (!events.length) {
    grid.innerHTML = '<div class="empty">No verified upcoming events found.<small>The display will retry automatically. No sample events will be shown.</small></div>';
    return;
  }
  grid.innerHTML = events.slice(0,30).map((event, index) => {
    const f = format(event);
    return `<article class="event-card">
      <div class="card-top"><span class="number">${String(index+1).padStart(2,'0')}</span><span class="date"><strong>${esc(f.weekday)}</strong> ${esc(f.day)}</span><span class="time">${esc(f.time)}</span></div>
      <div class="sport-row"><span class="sport">${esc(event.sport)}</span><span class="level">${esc(event.level)}</span></div>
      <div class="opponent">${esc(cleanOpponent(event.opponent))}</div>
      <div class="location">${esc(event.location || '')}</div>
      ${event.home ? '<span class="home">HOME</span>' : ''}
    </article>`;
  }).join('');
}
async function load() {
  try {
    statusText.textContent = 'Checking official schedules…';
    const response = await fetch('/api/events', {cache:'no-store'});
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.events) || !data.events.length) throw new Error('No verified events returned');
    lastGood = data.events;
    render(lastGood);
    dot.classList.remove('error');
    statusText.textContent = 'Live · refreshes every 60 seconds';
    footerStatus.textContent = `${lastGood.length} verified events · updated ${new Date(data.fetchedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
  } catch (error) {
    dot.classList.add('error');
    if (lastGood.length) {
      render(lastGood);
      statusText.textContent = 'Using last successful update';
      footerStatus.textContent = 'Official schedule connection will retry automatically';
    } else {
      render([]);
      statusText.textContent = 'Unable to retrieve schedules';
      footerStatus.textContent = 'Retrying automatically';
    }
  }
}
function tick() {
  const now = new Date();
  clock.textContent = `${now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} · ${now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}`;
}
window.addEventListener('resize', fitStage);
window.addEventListener('orientationchange', () => setTimeout(fitStage, 150));
fitStage();
tick();
load();
setInterval(tick, 1000);
setInterval(load, 60000);
