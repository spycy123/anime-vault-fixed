import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5000;

// --- Data source: AniList GraphQL ---
// We switched away from Jikan (api.jikan.moe) because Jikan scrapes
// MyAnimeList.net live, and whenever MAL is slow/blocking scrapers, Jikan
// returns "Jikan failed to connect to MyAnimeList..." — a failure on their
// end that we can't fix from our side, and some networks/ISPs also have
// trouble reaching api.jikan.moe directly.
// AniList (https://anilist.co) runs its own database (not a live scraper of
// MAL) and exposes a public GraphQL API at graphql.anilist.co, which is
// generally far more stable for a demo like this.
const ANILIST_URL = process.env.ANILIST_URL || 'https://graphql.anilist.co';
const cache = new Map();
const CACHE_TTL = Number(process.env.CACHE_TTL_MS || 60_000);
// Genres barely ever change, so we keep them around much longer — this also
// means the Genres page keeps working from cache even if AniList hiccups.
const GENRES_CACHE_TTL = Number(process.env.GENRES_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
const RETRIES = Number(process.env.ANILIST_RETRIES || 4);
// Some requests to graphql.anilist.co never resolve (dropped connection,
// ISP/firewall interference, etc). Without a timeout those hang until the
// platform's own socket timeout, which the frontend just sees as "Request
// gagal" with no useful detail. Aborting explicitly lets us retry sooner.
const REQUEST_TIMEOUT_MS = Number(process.env.ANILIST_TIMEOUT_MS || 12_000);

app.use(cors());
app.use(express.json());

// mal_id -> { mal_id, title, image, status, score, progress, episodes, addedAt, updatedAt }
const watchlist = new Map();

const LIST_STATUSES = ['WATCHING', 'COMPLETED', 'ON_HOLD', 'DROPPED', 'PLAN_TO_WATCH'];

function cacheKey(query, variables = {}) {
  return `${query}::${JSON.stringify(variables)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Rate limiter ---
// AniList's public API enforces a request-per-minute budget per IP and
// returns 429 with a Retry-After header when exceeded. Our Home page fires
// several list queries at once, so we serialize all outbound GraphQL calls
// through a single queue with a minimum gap between requests instead of
// bursting them all at once.
const MIN_INTERVAL_MS = Number(process.env.ANILIST_MIN_INTERVAL_MS || 700);
let queueTail = Promise.resolve();
let lastRequestAt = 0;

function scheduleCall(fn) {
  const run = queueTail.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return fn();
  });
  queueTail = run.catch(() => {});
  return run;
}

function jitter(ms) {
  // +/- 25% jitter so several queued requests that failed together don't
  // all retry at exactly the same moment and re-trigger the rate limit.
  const spread = ms * 0.25;
  return Math.round(ms - spread + Math.random() * spread * 2);
}

async function anilistFetch(query, variables = {}, { cacheTtl = CACHE_TTL } = {}) {
  const key = cacheKey(query, variables);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < cacheTtl) return cached.data;

  return scheduleCall(async () => {
    let lastError;
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(ANILIST_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            // AniList sits behind Cloudflare, which can silently serve a
            // non-JSON block/challenge page to requests that look like bare
            // scripts (no User-Agent). Node's fetch sends none by default,
            // so we set a descriptive one to keep responses to plain JSON.
            'User-Agent': 'AniVault/1.0 (+https://anilist.co/graphiql; contact: demo-app)'
          },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal
        });

        const rawBody = await response.text();
        let json = {};
        try {
          json = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          // Response wasn't JSON at all (HTML error/block page, empty body,
          // etc). Keep a short snippet so the real cause is easy to spot in
          // logs instead of surfacing a bare, confusing "Not Found".
          json = { __nonJson: rawBody.slice(0, 200) };
        }

        if (response.ok && !json.errors && !json.__nonJson) {
          cache.set(key, { timestamp: Date.now(), data: json.data });
          return json.data;
        }

        const message = json?.errors?.[0]?.message
          || (json.__nonJson
            ? `AniList membalas format tak terduga (HTTP ${response.status}), kemungkinan sedang rate limit atau gangguan sementara.`
            : `AniList returned HTTP ${response.status}`);
        const error = new Error(message);
        error.status = response.status === 200 ? 502 : response.status;
        lastError = error;

        const retryableStatus = [408, 425, 429, 500, 502, 503, 504].includes(response.status) || json.__nonJson;
        if (!retryableStatus || attempt >= RETRIES) {
          throw error;
        }

        const retryAfter = Number(response.headers.get('retry-after'));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : jitter(900 * (attempt + 1));
        await sleep(delay);
      } catch (error) {
        if (error.name === 'AbortError') {
          error.message = 'Waktu tunggu ke AniList habis (timeout).';
        }
        lastError = error;
        if (attempt >= RETRIES) throw error;
        await sleep(jitter(900 * (attempt + 1)));
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError || new Error('Gagal mengambil data dari AniList.');
  });
}

// --- Mapping helpers: AniList shape -> Jikan-like shape ---
// The frontend was built against Jikan's response shape (mal_id, images.jpg/webp,
// synopsis, aired.string, etc). Rather than rewrite every page, we translate
// AniList's Media objects into that same shape here, so the frontend keeps working unchanged.

const FORMAT_TO_TYPE = {
  TV: 'TV', TV_SHORT: 'TV', MOVIE: 'Movie', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'Special', MUSIC: 'Music'
};
const TYPE_TO_FORMAT_IN = {
  TV: ['TV', 'TV_SHORT'], Movie: ['MOVIE'], OVA: ['OVA'], ONA: ['ONA'], Special: ['SPECIAL']
};
const STATUS_TO_LABEL = {
  FINISHED: 'Finished Airing', RELEASING: 'Currently Airing', NOT_YET_RELEASED: 'Not yet aired',
  CANCELLED: 'Cancelled', HIATUS: 'On Hiatus'
};
const LABEL_TO_STATUS = {
  'Currently Airing': 'RELEASING', 'Finished Airing': 'FINISHED', 'Not yet aired': 'NOT_YET_RELEASED'
};
const RELATION_LABEL = {
  ADAPTATION: 'Adaptation', PREQUEL: 'Prequel', SEQUEL: 'Sequel', PARENT: 'Parent Story',
  SIDE_STORY: 'Side Story', CHARACTER: 'Character', SUMMARY: 'Summary', ALTERNATIVE: 'Alternative',
  SPIN_OFF: 'Spin-off', OTHER: 'Other', COMPILATION: 'Compilation', CONTAINS: 'Contains'
};
const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function stripHtml(text) {
  if (!text) return '';
  return text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
}

function formatDate(d) {
  if (!d?.year) return null;
  return d.day && d.month ? `${MONTHS[d.month]} ${d.day}, ${d.year}` : String(d.year);
}

function mapBrief(media) {
  if (!media) return null;
  const cover = media.coverImage || {};
  const image = cover.extraLarge || cover.large || null;
  return {
    mal_id: media.id,
    title: media.title?.english || media.title?.romaji || media.title?.native,
    images: { webp: { image_url: image, large_image_url: image }, jpg: { image_url: image, large_image_url: image } },
    type: FORMAT_TO_TYPE[media.format] || media.format || 'Unknown',
    episodes: media.episodes ?? null,
    score: media.averageScore ? Math.round(media.averageScore) / 10 : null
  };
}

function mapMedia(media) {
  if (!media) return null;
  const cover = media.coverImage || {};
  const image = cover.extraLarge || cover.large || null;
  const ratedRanking = (media.rankings || []).find((r) => r.type === 'RATED' && r.allTime);
  const popularRanking = (media.rankings || []).find((r) => r.type === 'POPULAR' && r.allTime);
  const from = formatDate(media.startDate);
  const to = formatDate(media.endDate);

  return {
    mal_id: media.id,
    title: media.title?.romaji || media.title?.english || media.title?.native,
    title_english: media.title?.english || null,
    title_japanese: media.title?.native || null,
    images: {
      webp: { image_url: cover.large || image, large_image_url: image },
      jpg: { image_url: cover.large || image, large_image_url: image }
    },
    banner: media.bannerImage || null,
    score: media.averageScore ? Math.round(media.averageScore) / 10 : null,
    type: FORMAT_TO_TYPE[media.format] || media.format || 'Unknown',
    status: STATUS_TO_LABEL[media.status] || media.status,
    episodes: media.episodes ?? null,
    duration: media.duration ? `${media.duration} min per ep` : null,
    year: media.seasonYear || media.startDate?.year || null,
    season: media.season ? media.season.charAt(0) + media.season.slice(1).toLowerCase() : null,
    source: media.source ? media.source.replaceAll('_', ' ') : null,
    aired: {
      string: from ? (to && to !== from ? `${from} to ${to}` : from) : 'Tanggal tidak tersedia',
      prop: { from: { year: media.seasonYear || media.startDate?.year || null } }
    },
    synopsis: stripHtml(media.description) || null,
    genres: (media.genres || []).map((name) => ({ mal_id: name.toLowerCase().replace(/\s+/g, '-'), name })),
    studios: (media.studios?.edges || []).map((e) => ({ name: e.node?.name })).filter((s) => s.name),
    rank: ratedRanking?.rank ?? null,
    popularity: popularRanking?.rank ?? null,
    members: media.popularity ?? null,
    favourites: media.favourites ?? null,
    rating: media.isAdult ? 'R+ - Mild Nudity' : null,
    trailer: media.trailer?.site === 'youtube' && media.trailer?.id
      ? { youtube_id: media.trailer.id, url: `https://www.youtube.com/watch?v=${media.trailer.id}`, embed_url: `https://www.youtube.com/embed/${media.trailer.id}` }
      : null,
    externalLinks: (media.externalLinks || []).map((l) => ({ id: l.id, url: l.url, site: l.site })).filter((l) => l.url),
    relations: (media.relations?.edges || [])
      .map((e) => ({ relation: RELATION_LABEL[e.relationType] || e.relationType, anime: mapBrief(e.node) }))
      .filter((r) => r.anime),
    recommendations: (media.recommendations?.nodes || [])
      .map((n) => mapBrief(n.mediaRecommendation))
      .filter(Boolean),
    staff: (media.staff?.edges || [])
      .map((e) => ({ role: e.role, name: e.node?.name?.full, image: e.node?.image?.large || e.node?.image?.medium || null }))
      .filter((s) => s.name),
    reviews: (media.reviews?.nodes || []).map((r) => ({
      id: r.id, score: r.score, summary: stripHtml(r.summary), user: r.user?.name || 'Anonymous'
    })),
    stats: {
      scoreDistribution: media.stats?.scoreDistribution || [],
      statusDistribution: media.stats?.statusDistribution || []
    }
  };
}

function mapCharacterEdge(edge) {
  const node = edge.node || {};
  const image = node.image?.large || node.image?.medium || null;
  return {
    role: edge.role,
    character: {
      mal_id: node.id,
      name: node.name?.full || 'Unknown',
      images: { webp: { image_url: image }, jpg: { image_url: image } }
    }
  };
}

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  coverImage { large extraLarge }
  bannerImage
  averageScore
  popularity
  favourites
  episodes
  duration
  format
  status
  season
  seasonYear
  startDate { year month day }
  endDate { year month day }
  genres
  studios(isMain: true) { edges { node { name } } }
  source
  isAdult
  description(asHtml: false)
  rankings { rank type context allTime }
`;

const DETAIL_EXTRA_FIELDS = `
  trailer { id site }
  externalLinks { id url site }
  relations {
    edges {
      relationType(version: 2)
      node { id title { romaji english native } coverImage { large extraLarge } format episodes averageScore }
    }
  }
  recommendations(sort: RATING_DESC, perPage: 8) {
    nodes { mediaRecommendation { id title { romaji english native } coverImage { large extraLarge } format episodes averageScore } }
  }
  staff(sort: RELEVANCE, perPage: 10) {
    edges { role node { name { full } image { large medium } } }
  }
  reviews(sort: RATING_DESC, perPage: 4) {
    nodes { id score summary user { name } }
  }
  stats { scoreDistribution { score amount } statusDistribution { status amount } }
`;

const LIST_QUERY = `
  query ($page: Int, $perPage: Int, $sort: [MediaSort], $search: String, $status: MediaStatus, $format_in: [MediaFormat], $season: MediaSeason, $seasonYear: Int, $genre: String) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { currentPage lastPage hasNextPage total }
      media(type: ANIME, sort: $sort, search: $search, status: $status, format_in: $format_in, season: $season, seasonYear: $seasonYear, genre: $genre) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

const DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      ${MEDIA_FIELDS}
      ${DETAIL_EXTRA_FIELDS}
    }
  }
`;

const CHARACTERS_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      characters(sort: [ROLE, RELEVANCE], perPage: 16) {
        edges { role node { id name { full } image { large medium } } }
      }
    }
  }
`;

const GENRES_QUERY = `query { GenreCollection }`;

async function fetchList(variables) {
  const data = await anilistFetch(LIST_QUERY, variables);
  const page = data?.Page || {};
  return {
    data: (page.media || []).map(mapMedia),
    pagination: {
      last_visible_page: page.pageInfo?.lastPage ?? 1,
      has_next_page: Boolean(page.pageInfo?.hasNextPage),
      total: page.pageInfo?.total ?? 0
    }
  };
}

function currentSeason() {
  const month = new Date().getUTCMonth() + 1;
  const year = new Date().getUTCFullYear();
  if (month <= 3) return { season: 'WINTER', seasonYear: year };
  if (month <= 6) return { season: 'SPRING', seasonYear: year };
  if (month <= 9) return { season: 'SUMMER', seasonYear: year };
  return { season: 'FALL', seasonYear: year };
}

async function handle(res, promiseFn, fallbackMessage) {
  try {
    const result = await promiseFn();
    res.json(result);
  } catch (error) {
    console.error('[ANILIST]', error);
    res.status(error.status || 502).json({
      message: error.message || fallbackMessage || 'Gagal mengambil data dari AniList.',
      status: error.status || 502
    });
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'anime-anilist-backend',
    source: ANILIST_URL,
    time: new Date().toISOString()
  });
});

app.get('/api/genres', (_req, res) => {
  handle(res, async () => {
    const data = await anilistFetch(GENRES_QUERY, {}, { cacheTtl: GENRES_CACHE_TTL });
    return { data: data?.GenreCollection || [] };
  });
});

app.get('/api/anime/top', (req, res) => {
  handle(res, () => fetchList({
    page: Number(req.query.page) || 1,
    perPage: Number(req.query.limit) || 24,
    sort: ['SCORE_DESC']
  }));
});

app.get('/api/anime/airing', (req, res) => {
  handle(res, () => fetchList({
    page: Number(req.query.page) || 1,
    perPage: Number(req.query.limit) || 24,
    status: 'RELEASING',
    sort: ['TRENDING_DESC', 'POPULARITY_DESC']
  }));
});

app.get('/api/anime/popular', (req, res) => {
  handle(res, () => fetchList({
    page: Number(req.query.page) || 1,
    perPage: Number(req.query.limit) || 24,
    sort: ['POPULARITY_DESC']
  }));
});

app.get('/api/anime/upcoming', (req, res) => {
  handle(res, () => fetchList({
    page: Number(req.query.page) || 1,
    perPage: Number(req.query.limit) || 24,
    status: 'NOT_YET_RELEASED',
    sort: ['POPULARITY_DESC']
  }));
});

app.get('/api/anime/favorites', (req, res) => {
  handle(res, () => fetchList({
    page: Number(req.query.page) || 1,
    perPage: Number(req.query.limit) || 24,
    sort: ['FAVOURITES_DESC']
  }));
});

app.get('/api/anime/season-now', (req, res) => {
  const { season, seasonYear } = currentSeason();
  handle(res, () => fetchList({
    page: Number(req.query.page) || 1,
    perPage: Number(req.query.limit) || 24,
    season,
    seasonYear,
    sort: ['POPULARITY_DESC']
  }));
});

app.get('/api/anime/season/:year/:season', (req, res) => {
  const season = String(req.params.season || '').toUpperCase();
  const seasonYear = Number(req.params.year);
  handle(res, () => fetchList({
    page: Number(req.query.page) || 1,
    perPage: Number(req.query.limit) || 24,
    season,
    seasonYear,
    sort: ['POPULARITY_DESC']
  }));
});

app.get('/api/anime/search', (req, res) => {
  const sortKey = (req.query.order_by || 'score').toUpperCase();
  const sortBase = ['SCORE', 'POPULARITY', 'TRENDING', 'FAVOURITES'].includes(sortKey) ? sortKey : 'SCORE';
  const sort = req.query.sort === 'asc' ? sortBase : `${sortBase}_DESC`;

  handle(res, () => fetchList({
    page: Number(req.query.page) || 1,
    perPage: Number(req.query.limit) || 24,
    search: req.query.q || undefined,
    status: LABEL_TO_STATUS[req.query.status] || undefined,
    format_in: TYPE_TO_FORMAT_IN[req.query.type] || undefined,
    genre: req.query.genre || undefined,
    sort: [sort]
  }));
});

app.get('/api/anime/:id', (req, res) => {
  const id = Number(req.params.id);
  handle(res, async () => {
    const data = await anilistFetch(DETAIL_QUERY, { id });
    if (!data?.Media) {
      const error = new Error('Anime tidak ditemukan.');
      error.status = 404;
      throw error;
    }
    return { data: mapMedia(data.Media) };
  });
});

app.get('/api/anime/:id/characters', (req, res) => {
  const id = Number(req.params.id);
  handle(res, async () => {
    const data = await anilistFetch(CHARACTERS_QUERY, { id });
    const edges = data?.Media?.characters?.edges || [];
    return { data: edges.map(mapCharacterEdge) };
  });
});

// --- My List (watchlist) ---
// MAL-style personal list: each entry has a status (watching / completed /
// on-hold / dropped / plan to watch), a 0-10 score, and episode progress.
// Stored in-memory for this demo (no auth), same as before.

app.get('/api/watchlist', (_req, res) => {
  res.json({ data: [...watchlist.values()], statuses: LIST_STATUSES });
});

app.post('/api/watchlist', (req, res) => {
  const anime = req.body;
  if (!anime?.mal_id || !anime?.title) {
    return res.status(400).json({ message: 'mal_id dan title wajib diisi.' });
  }
  const key = String(anime.mal_id);
  const existing = watchlist.get(key);
  const status = LIST_STATUSES.includes(anime.status) ? anime.status : 'PLAN_TO_WATCH';
  const entry = {
    mal_id: anime.mal_id,
    title: anime.title,
    image: anime.image || anime.images?.jpg?.image_url || null,
    episodes: anime.episodes ?? existing?.episodes ?? null,
    status,
    score: Number.isFinite(Number(anime.score)) ? Number(anime.score) : (existing?.score ?? 0),
    progress: Number.isFinite(Number(anime.progress)) ? Number(anime.progress) : (existing?.progress ?? 0),
    addedAt: existing?.addedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  watchlist.set(key, entry);
  res.status(201).json({ message: 'Anime ditambahkan ke list.', data: entry });
});

app.patch('/api/watchlist/:id', (req, res) => {
  const key = String(req.params.id);
  const existing = watchlist.get(key);
  if (!existing) return res.status(404).json({ message: 'Anime tidak ada di list kamu.' });

  const { status, score, progress } = req.body || {};
  if (status !== undefined) {
    if (!LIST_STATUSES.includes(status)) return res.status(400).json({ message: 'Status tidak valid.' });
    existing.status = status;
  }
  if (score !== undefined) {
    const n = Number(score);
    if (!Number.isFinite(n) || n < 0 || n > 10) return res.status(400).json({ message: 'Skor harus 0-10.' });
    existing.score = n;
  }
  if (progress !== undefined) {
    const n = Number(progress);
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ message: 'Progress tidak valid.' });
    existing.progress = n;
  }
  existing.updatedAt = new Date().toISOString();
  watchlist.set(key, existing);
  res.json({ message: 'List diperbarui.', data: existing });
});

app.delete('/api/watchlist/:id', (req, res) => {
  const deleted = watchlist.delete(String(req.params.id));
  res.json({ message: deleted ? 'Anime dihapus dari list.' : 'Anime tidak ditemukan.', deleted });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT} (data source: AniList)`);
});
