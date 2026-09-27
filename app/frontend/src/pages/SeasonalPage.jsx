import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api';
import AnimeCard from '../components/AnimeCard';

const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
const SEASON_LABEL = { WINTER: 'Winter', SPRING: 'Spring', SUMMER: 'Summer', FALL: 'Fall' };

function currentSeason() {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  if (month <= 3) return { season: 'WINTER', year };
  if (month <= 6) return { season: 'SPRING', year };
  if (month <= 9) return { season: 'SUMMER', year };
  return { season: 'FALL', year };
}

function shift(season, year, dir) {
  const idx = SEASONS.indexOf(season);
  const nextIdx = idx + dir;
  if (nextIdx < 0) return { season: SEASONS[3], year: year - 1 };
  if (nextIdx > 3) return { season: SEASONS[0], year: year + 1 };
  return { season: SEASONS[nextIdx], year };
}

export default function SeasonalPage() {
  const [cursor, setCursor] = useState(currentSeason());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.season(cursor.year, cursor.season, 'limit=24')
      .then((res) => { setItems(res.data || []); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [cursor, reloadKey]);

  return (
    <div className="page-content search-page">
      <div className="search-head">
        <div>
          <h1>Seasonal Anime</h1>
          <p>Jelajahi katalog anime berdasarkan musim rilis.</p>
        </div>
        <div className="season-switcher">
          <button onClick={() => setCursor((c) => shift(c.season, c.year, -1))}><ChevronLeft size={18} /></button>
          <span>{SEASON_LABEL[cursor.season]} {cursor.year}</span>
          <button onClick={() => setCursor((c) => shift(c.season, c.year, 1))}><ChevronRight size={18} /></button>
        </div>
      </div>

      {loading && <div className="loading">Memuat anime musiman...</div>}
      {error && (
        <div className="empty-state">
          <h2>Terjadi kesalahan</h2>
          <p>{error}</p>
          <button type="button" className="primary-btn" onClick={() => setReloadKey((k) => k + 1)}>Coba lagi</button>
        </div>
      )}
      {!loading && !error && items.length === 0 && <div className="empty-state"><h2>Tidak ada data untuk musim ini</h2></div>}
      {!loading && !error && items.length > 0 && (
        <div className="anime-grid">{items.map((anime) => <AnimeCard key={anime.mal_id} anime={anime} />)}</div>
      )}
    </div>
  );
}
