import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import RankRow from '../components/RankRow';

const TABS = [
  { key: 'top', label: 'Top Rated', fetch: (p) => api.top(p), subtitle: 'Diurutkan dari rata-rata skor tertinggi.' },
  { key: 'popular', label: 'Most Popular', fetch: (p) => api.popular(p), subtitle: 'Diurutkan dari jumlah anggota list terbanyak.' },
  { key: 'favorites', label: 'Most Favorited', fetch: (p) => api.favorites(p), subtitle: 'Diurutkan dari jumlah favorit terbanyak.' },
  { key: 'airing', label: 'Currently Airing', fetch: (p) => api.airing(p), subtitle: 'Anime yang sedang tayang, diurutkan dari trending.' },
  { key: 'upcoming', label: 'Upcoming', fetch: (p) => api.upcoming(p), subtitle: 'Anime yang belum rilis dan paling dinanti.' }
];

export default function RankingsPage() {
  const [params, setParams] = useSearchParams();
  const activeKey = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'top';
  const page = Number(params.get('page') || 1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const tab = TABS.find((t) => t.key === activeKey);

  useEffect(() => {
    setLoading(true);
    tab.fetch(`page=${page}&limit=25`)
      .then((res) => { setItems(res.data || []); setPagination(res.pagination); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeKey, page]); // eslint-disable-line react-hooks/exhaustive-deps

  function switchTab(key) {
    setParams({ tab: key, page: '1' });
  }

  function goPage(next) {
    const p = new URLSearchParams(params);
    p.set('page', String(next));
    setParams(p);
  }

  return (
    <div className="page-content rankings-page">
      <div className="search-head">
        <div>
          <h1>Rankings</h1>
          <p>{tab.subtitle}</p>
        </div>
      </div>

      <div className="tab-row">
        {TABS.map((t) => (
          <button key={t.key} className={t.key === activeKey ? 'active' : ''} onClick={() => switchTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="loading">Memuat ranking...</div>}
      {error && <div className="empty-state"><h2>Terjadi kesalahan</h2><p>{error}</p></div>}
      {!loading && !error && items.length === 0 && <div className="empty-state"><h2>Tidak ada data</h2></div>}

      {!loading && !error && items.length > 0 && (
        <div className="rank-list">
          {items.map((anime, i) => (
            <RankRow key={anime.mal_id} anime={anime} rank={(page - 1) * 25 + i + 1} />
          ))}
        </div>
      )}

      {pagination && pagination.last_visible_page > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => goPage(page - 1)}>Sebelumnya</button>
          <span>Halaman {page} / {pagination.last_visible_page}</span>
          <button disabled={!pagination.has_next_page} onClick={() => goPage(page + 1)}>Berikutnya</button>
        </div>
      )}
    </div>
  );
}
