import { useEffect, useMemo, useState } from 'react';
import { Filter, Search as SearchIcon } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import AnimeCard from '../components/AnimeCard';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [genres, setGenres] = useState([]);
  const q = params.get('q') || '';
  const page = Number(params.get('page') || 1);
  const [term, setTerm] = useState(q);
  const [type, setType] = useState(params.get('type') || '');
  const [status, setStatus] = useState(params.get('status') || '');
  const [genre, setGenre] = useState(params.get('genre') || '');
  const [sort, setSort] = useState(params.get('sort') || 'desc');

  const title = useMemo(() => {
    if (q) return `Hasil pencarian: ${q}`;
    if (genre) return `Genre: ${genre}`;
    return 'Temukan Anime';
  }, [q, genre]);

  useEffect(() => { api.genres().then((res) => setGenres(res.data || [])).catch(() => {}); }, []);

  useEffect(() => {
    setTerm(q);
    setType(params.get('type') || '');
    setStatus(params.get('status') || '');
    setGenre(params.get('genre') || '');
    setSort(params.get('sort') || 'desc');
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true);
    const searchParams = { page, limit: 24, order_by: params.get('order_by') || 'score', sort: params.get('sort') || 'desc' };
    if (q) searchParams.q = q;
    if (params.get('type')) searchParams.type = params.get('type');
    if (params.get('status')) searchParams.status = params.get('status');
    if (params.get('genre')) searchParams.genre = params.get('genre');
    api.search(searchParams)
      .then((data) => { setResults(data.data || []); setPagination(data.pagination); setError(''); })
      .catch((e) => { setError(e.message); setResults([]); })
      .finally(() => setLoading(false));
  }, [q, page, params]);

  function submit(e) {
    e.preventDefault();
    const next = new URLSearchParams(params);
    next.set('page', '1');
    term.trim() ? next.set('q', term.trim()) : next.delete('q');
    type ? next.set('type', type) : next.delete('type');
    status ? next.set('status', status) : next.delete('status');
    genre ? next.set('genre', genre) : next.delete('genre');
    next.set('sort', sort);
    setParams(next);
  }

  return (
    <div className="page-content search-page">
      <div className="search-head">
        <div><h1>{title}</h1><p>Cari dan filter katalog anime dari AniList.</p></div>
        <form className="big-search" onSubmit={submit}><SearchIcon size={18} /><input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Contoh: One Piece, Naruto..." /><button>Cari</button></form>
      </div>

      <div className="filter-row">
        <span className="filter-label"><Filter size={16} /> Filter</span>
        <select value={type} onChange={(e) => setType(e.target.value)}><option value="">Semua tipe</option><option value="TV">TV</option><option value="Movie">Movie</option><option value="OVA">OVA</option><option value="ONA">ONA</option><option value="Special">Special</option></select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Semua status</option><option value="Currently Airing">Sedang tayang</option><option value="Finished Airing">Selesai tayang</option><option value="Not yet aired">Belum tayang</option></select>
        <select value={genre} onChange={(e) => setGenre(e.target.value)}><option value="">Semua genre</option>{genres.map((g) => <option key={g} value={g}>{g}</option>)}</select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="desc">Score tertinggi</option><option value="asc">Score terendah</option></select>
        <button className="apply-btn" onClick={submit}>Terapkan</button>
      </div>

      {loading && <div className="loading">Memuat anime...</div>}
      {error && <div className="empty-state"><h2>Terjadi kesalahan</h2><p>{error}</p></div>}
      {!loading && !error && results.length === 0 && <div className="empty-state"><h2>Anime tidak ditemukan</h2><p>Coba kata kunci atau filter lain.</p></div>}
      {!loading && !error && results.length > 0 && <div className="anime-grid">{results.map((anime) => <AnimeCard key={anime.mal_id} anime={anime} />)}</div>}

      {pagination && pagination.last_visible_page > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setParams({ ...Object.fromEntries(params), page: String(page - 1) })}>Sebelumnya</button>
          <span>Halaman {page} / {pagination.last_visible_page}</span>
          <button disabled={!pagination.has_next_page} onClick={() => setParams({ ...Object.fromEntries(params), page: String(page + 1) })}>Berikutnya</button>
        </div>
      )}
    </div>
  );
}
