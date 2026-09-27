const API_BASE = import.meta.env.VITE_API_BASE || '/api';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestOnce(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'Request gagal.');
    error.status = data.status || response.status;
    throw error;
  }
  return data;
}

// GET requests are safe to retry silently: most failures here are transient
// (AniList rate limit, a dropped connection, a slow cold start) rather than
// something wrong with the request itself, so one quiet retry clears up a
// lot of the "gagal dimuat" noise before the user ever sees it.
async function request(path, options = {}) {
  const isRead = !options.method || options.method === 'GET';
  try {
    return await requestOnce(path, options);
  } catch (error) {
    if (!isRead) throw error;
    await sleep(700);
    try {
      return await requestOnce(path, options);
    } catch (retryError) {
      throw retryError;
    }
  }
}

export const api = {
  top: (params = '') => request(`/anime/top${params ? `?${params}` : ''}`),
  airing: (params = '') => request(`/anime/airing${params ? `?${params}` : ''}`),
  popular: (params = '') => request(`/anime/popular${params ? `?${params}` : ''}`),
  upcoming: (params = '') => request(`/anime/upcoming${params ? `?${params}` : ''}`),
  favorites: (params = '') => request(`/anime/favorites${params ? `?${params}` : ''}`),
  seasonNow: () => request('/anime/season-now'),
  season: (year, season, params = '') => request(`/anime/season/${year}/${season}${params ? `?${params}` : ''}`),
  genres: () => request('/genres'),
  search: (params) => request(`/anime/search?${new URLSearchParams(params)}`),
  detail: (id) => request(`/anime/${id}`),
  characters: (id) => request(`/anime/${id}/characters`),
  watchlist: () => request('/watchlist'),
  addWatchlist: (anime) => request('/watchlist', { method: 'POST', body: JSON.stringify(anime) }),
  updateWatchlist: (id, patch) => request(`/watchlist/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  removeWatchlist: (id) => request(`/watchlist/${id}`, { method: 'DELETE' })
};

export const LIST_STATUSES = [
  { value: 'WATCHING', label: 'Watching' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ON_HOLD', label: 'On-Hold' },
  { value: 'DROPPED', label: 'Dropped' },
  { value: 'PLAN_TO_WATCH', label: 'Plan to Watch' }
];

export function statusLabel(status) {
  return LIST_STATUSES.find((s) => s.value === status)?.label || status;
}

export function animeImage(anime, size = 'large_image_url') {
  return anime?.images?.webp?.[size]
    || anime?.images?.jpg?.[size]
    || anime?.images?.webp?.image_url
    || anime?.images?.jpg?.image_url
    || 'https://placehold.co/480x680/16181d/eef0f2?text=No+Image';
}

export function pickTitle(anime) {
  return anime?.title_english || anime?.title || anime?.title_japanese || 'Untitled Anime';
}
