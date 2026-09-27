# AniVault — React + Express + AniList API

Demo full-stack katalog anime bergaya MyAnimeList dengan:
- Frontend: React + Vite + React Router
- Backend: Node.js + Express
- Data anime: AniList GraphQL API (graphql.anilist.co)
- My List: simulasi penyimpanan di memory backend, dengan status/skor/progress ala MAL

## Fitur

- **Home** — hero, sedang tayang, top rated, musim ini, akan tayang
- **Rankings** — tab Top Rated / Most Popular / Most Favorited / Currently Airing / Upcoming, tampilan list bernomor seperti halaman Top Anime MAL
- **Seasonal** — jelajah katalog per musim (winter/spring/summer/fall) dengan navigasi maju-mundur
- **Genres** — daftar semua genre AniList, klik untuk browse
- **Search** — pencarian + filter tipe, status, genre, urutan skor
- **Detail anime** — tab Overview / Characters & Staff / Stats / Reviews, trailer YouTube ter-embed, tautan eksternal, related anime, recommendations, grafik score & status distribution
- **My List** — tambah anime dengan status Watching/Completed/On-Hold/Dropped/Plan to Watch, atur skor (0-10) dan progress episode, filter per status

> Sebelumnya project ini memakai Jikan REST API (yang men-scrape MyAnimeList
> secara live). Karena Jikan sering gagal dengan pesan "Jikan failed to
> connect to MyAnimeList...", backend sekarang memakai AniList — API yang
> punya database sendiri (bukan scraper) sehingga jauh lebih stabil. Bentuk
> respons backend dibuat tetap sama seperti sebelumnya (mal_id, images,
> synopsis, aired, dll) supaya frontend tidak perlu diubah.

## Struktur

```text
anime-jikan-fullstack/
├── backend/
│   ├── src/server.js
│   └── package.json
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── package.json
└── README.md
```

## Menjalankan

### Cara 1 — dari root

```bash
npm install
npm run install:all
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:5000

### Cara 2 — terminal terpisah

Terminal backend:

```bash
cd backend
npm install
npm run dev
```

Terminal frontend:

```bash
cd frontend
npm install
npm run dev
```

## Endpoint backend

- `GET /api/health`
- `GET /api/genres`
- `GET /api/anime/top`
- `GET /api/anime/airing`
- `GET /api/anime/popular`
- `GET /api/anime/upcoming`
- `GET /api/anime/favorites`
- `GET /api/anime/season-now`
- `GET /api/anime/season/:year/:season` (mis. `/api/anime/season/2026/fall`)
- `GET /api/anime/search?q=naruto&genre=Action&type=TV&status=Currently%20Airing`
- `GET /api/anime/:id` (termasuk trailer, external links, relations, recommendations, staff, reviews, stats)
- `GET /api/anime/:id/characters`
- `GET /api/watchlist`
- `POST /api/watchlist` (body: `mal_id`, `title`, `image`, `episodes`, `status`, `score`, `progress`)
- `PATCH /api/watchlist/:id` (update `status`/`score`/`progress`)
- `DELETE /api/watchlist/:id`

## Catatan

Backend memakai cache sederhana 60 detik agar navigasi berulang tidak terus-menerus memanggil AniList.

Semua request ke AniList diantre lewat satu queue dengan jeda minimum (`ANILIST_MIN_INTERVAL_MS`, default 500ms) supaya tidak kena rate limit walau ada beberapa request bersamaan (mis. Home yang memuat 3 section sekaligus).

Watchlist sengaja dibuat in-memory sebagai simulasi backend. Data akan hilang saat server direstart. Untuk project produksi, bagian ini bisa diganti MySQL/PostgreSQL/MongoDB.

## Catatan error AniList

Home memakai `Promise.allSettled()` agar kegagalan satu endpoint (mis. `/season-now`) tidak membuat seluruh halaman kosong. Backend juga melakukan retry dengan backoff untuk HTTP 429/500/502/503/504.

Tes backend:
- http://localhost:5000/api/health
- http://localhost:5000/api/anime/top
- http://localhost:5000/api/anime/airing
- http://localhost:5000/api/anime/season-now
- http://localhost:5000/api/anime/1 (Cowboy Bebop, bagus untuk tes cepat)

Kalau `/api/health` bisa diakses tapi endpoint anime lain tetap gagal, kemungkinan besar jaringan/firewall kamu memblokir `graphql.anilist.co` — coba akses https://graphql.anilist.co langsung di browser (harus muncul halaman GraphiQL/error 400 method GET, bukan gagal konek).
