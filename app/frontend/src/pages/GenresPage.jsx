import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tags } from 'lucide-react';
import { api } from '../api';

export default function GenresPage() {
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.genres()
      .then((res) => { setGenres(res.data || []); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [reloadKey]);

  return (
    <div className="page-content search-page">
      <div className="search-head">
        <div>
          <h1>Genres</h1>
          <p>Pilih genre untuk menjelajahi katalog anime AniList.</p>
        </div>
      </div>

      {loading && <div className="loading">Memuat daftar genre...</div>}
      {error && (
        <div className="empty-state">
          <h2>Terjadi kesalahan</h2>
          <p>{error}</p>
          <button type="button" className="primary-btn" onClick={() => setReloadKey((k) => k + 1)}>Coba lagi</button>
        </div>
      )}
      {!loading && !error && (
        <div className="genre-grid">
          {genres.map((g) => (
            <Link key={g} to={`/search?genre=${encodeURIComponent(g)}`} className="genre-chip">
              <Tags size={15} /> {g}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
