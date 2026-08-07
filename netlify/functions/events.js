const cheerio = require('cheerio');
const crypto = require('crypto');

const BASE = 'https://gogoldenknights.net';
const SEASON = process.env.SEASON || '2026-27';
const MAX_EVENTS = 30;

const SOURCE_DEFS = [
  ['Football','Varsity','football'], ['Football','JV','jv-football'], ['Football','Frosh','frosh-football'],
  ['Cross Country','Varsity','mens-cross-country'], ['Cross Country','JV','jv-cross-country'],
  ['Water Polo','Varsity','mens-water-polo'], ['Water Polo','JV','jv-water-polo'],
  ['Soccer','Varsity','mens-soccer'], ['Soccer','JV','jv-soccer'], ['Soccer','Frosh','frosh-soccer'],
  ['Basketball','Varsity','mens-basketball'], ['Basketball','JV','jv-basketball'], ['Basketball','Frosh','frosh-basketball'],
  ['Baseball','Varsity','baseball'], ['Baseball','JV','jv-baseball'], ['Baseball','Frosh','frosh-baseball'],
  ['Lacrosse','Varsity','mens-lacrosse'], ['Lacrosse','JV','jv-lacrosse'], ['Lacrosse','Frosh','frosh-lacrosse'],
  ['Golf','Varsity','mens-golf'], ['Golf','JV','jv-golf'],
  ['Swim & Dive','Varsity','mens-swimming-and-diving'], ['Swim & Dive','JV','jv-swim-and-dive'],
  ['Tennis','Varsity','mens-tennis'], ['Tennis','JV','jv-tennis'],
  ['Track & Field','Varsity','mens-track-and-field'], ['Track & Field','JV','jv-track-and-field'],
  ['Volleyball','Varsity','mens-volleyball'], ['Volleyball','JV','jv-volleyball'], ['Volleyball','Frosh','frosh-volleyball']
];

const SOURCES = SOURCE_DEFS.map(([sport, level, slug]) => ({
  sport, level, slug, url: `${BASE}/sports/${slug}/schedule/${SEASON}`
}));

function clean(value = '') {
  return String(value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function inferYear(month) {
  const firstYear = Number(SEASON.slice(0, 4));
  return month >= 6 ? firstYear : firstYear + 1;
}

function parseDate(dateText, timeText) {
  const match = clean(dateText).match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})/i);
  if (!match) return null;

  const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
  const month = months[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = inferYear(month);

  const rawTime = clean(timeText);
  const time = rawTime.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  let hour = 12;
  let minute = 0;
  let tba = true;
  let displayTime = 'TBA';

  if (time) {
    const hour12 = Number(time[1]);
    minute = Number(time[2] || 0);
    const meridiem = time[3].toUpperCase();
    hour = hour12 % 12 + (meridiem === 'PM' ? 12 : 0);
    tba = false;
    displayTime = `${hour12}:${String(minute).padStart(2, '0')} ${meridiem}`;
  }

  // IMPORTANT: sortValue is a timezone-neutral wall-clock value used only for ordering.
  // We deliberately do not convert the posted Pacific time into UTC, because doing so
  // caused 4:00 PM to display as 9:00 AM on the television.
  const sortValue = Date.UTC(year, month, day, hour, minute, 0, 0);
  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return { year, month, day, hour, minute, tba, displayTime, sortValue, dateKey };
}

function homeFrom(text, location) {
  if (/\bat\b/i.test(text)) return false;
  if (/\bvs\.?\b/i.test(text)) return true;
  return /st\. francis|friedman|o['’]connor|golden knights/i.test(location);
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; SF-Athletics-Calendar/1.0)',
        'accept': 'text/html,application/xhtml+xml'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { html: await response.text(), finalUrl: response.url };
  } finally {
    clearTimeout(timeout);
  }
}

function getEventNodes($) {
  const selectors = [
    'li.sidearm-schedule-game',
    '.sidearm-schedule-game',
    'li[class*="schedule-game"]',
    '.sidearm-schedule-games-container li'
  ];
  for (const selector of selectors) {
    const nodes = $(selector);
    if (nodes.length) return nodes;
  }
  return $();
}

async function scrapeSource(source) {
  const { html, finalUrl } = await fetchHtml(source.url);
  const $ = cheerio.load(html);
  const pageTitle = clean(`${$('h1,h2').first().text()} ${$('title').text()}`);
  if (!pageTitle.includes(SEASON)) throw new Error(`Season mismatch: ${pageTitle.slice(0, 80)}`);

  const events = [];
  getEventNodes($).each((_, element) => {
    const node = $(element);
    const text = clean(node.text());
    if (!text || /\bbye\b/i.test(text) || /(?:^|\s)[WLT],?\s*\d/i.test(text)) return;

    const dateText = clean(node.find('.sidearm-schedule-game-opponent-date, .sidearm-schedule-game-date, [class*="opponent-date"]').first().text())
      || ((text.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}/i) || [''])[0]);
    const timeText = clean(node.find('.sidearm-schedule-game-opponent-time, [class*="opponent-time"], time').first().text())
      || ((text.match(/\b(?:\d{1,2}(?::\d{2})?\s*(?:AM|PM)|TBA)\b/i) || ['TBA'])[0]);
    const parsed = parseDate(dateText, timeText);
    if (!parsed) return;

    const opponent = clean(node.find('.sidearm-schedule-game-opponent-name, .sidearm-schedule-game-opponent-text, [class*="opponent-name"]').first().text())
      || clean(node.find('a').first().text());
    if (!opponent) return;

    const location = clean(node.find('.sidearm-schedule-game-location, [class*="location"]').first().text());
    const relation = /\bat\b/i.test(text) ? 'at' : (/\bvs\.?\b/i.test(text) ? 'vs' : '');
    const id = crypto.createHash('sha1').update(`${source.url}|${parsed.dateKey}|${parsed.displayTime}|${opponent}`).digest('hex').slice(0, 16);

    events.push({
      id,
      sport: source.sport,
      level: source.level,
      dateKey: parsed.dateKey,
      sortValue: parsed.sortValue,
      displayTime: parsed.displayTime,
      tba: parsed.tba,
      opponent: clean(`${relation} ${opponent}`),
      location,
      home: homeFrom(text, location),
      sourceUrl: finalUrl
    });
  });

  return { source: { ...source, finalUrl, status: 'ok', count: events.length }, events };
}

exports.handler = async function handler() {
  const results = [];
  for (let i = 0; i < SOURCES.length; i += 6) {
    const batch = SOURCES.slice(i, i + 6);
    const settled = await Promise.all(batch.map(async (source) => {
      try {
        return await scrapeSource(source);
      } catch (error) {
        return { source: { ...source, status: 'error', count: 0, error: error.message }, events: [] };
      }
    }));
    results.push(...settled);
  }

  const nowParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date()).reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {});
  const now = Date.UTC(Number(nowParts.year), Number(nowParts.month) - 1, Number(nowParts.day), Number(nowParts.hour), Number(nowParts.minute)) - 2 * 60 * 60 * 1000;
  const unique = new Map();
  for (const result of results) {
    for (const event of result.events) {
      if (event.sortValue < now) continue;
      unique.set(`${event.dateKey}|${event.displayTime}|${event.sport}|${event.level}|${event.opponent}`, event);
    }
  }

  const events = [...unique.values()]
    .sort((a, b) => a.sortValue - b.sortValue)
    .slice(0, MAX_EVENTS);

  const body = {
    season: SEASON,
    fetchedAt: new Date().toISOString(),
    events,
    sources: results.map((result) => result.source),
    errors: results.filter((result) => result.source.status === 'error').length
  };

  return {
    statusCode: events.length ? 200 : 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      'access-control-allow-origin': '*'
    },
    body: JSON.stringify(body)
  };
};
