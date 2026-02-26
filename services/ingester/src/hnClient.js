const BASE = 'https://hacker-news.firebaseio.com/v0';

async function fetchJSON(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  return res.json();
}

async function getTopStoryIds(limit = 10) {
  const ids = await fetchJSON(`${BASE}/topstories.json`);
  return ids ? ids.slice(0, limit) : [];
}

async function getItem(id) {
  return fetchJSON(`${BASE}/item/${id}.json`);
}

module.exports = { getTopStoryIds, getItem };
