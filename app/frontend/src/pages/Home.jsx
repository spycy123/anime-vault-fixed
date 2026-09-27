import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Play, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, animeImage, pickTitle } from '../api';
import AnimeCard from '../components/AnimeCard';
import Section from '../components/Section';

export default function Home() {
  const [top, setTop] = useState([]);
  const [airing, setAiring] = useState([]);
  const [season, setSeason] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [partialErrors, setPartialErrors] = useState([]);

  const loadHome = useCallback(async () => {
    setLoading(true);
    setError('');
    setPartialErrors([]);

    const results = await Promise.allSettled([
      api.top('limit=12'),
      api.airing('limit=12'),
      api.seasonNow(),
      api.upcoming('limit=6')
    ]);

    const [topRes, airingRes, seasonRes, upcomingRes] = results;
    const failures = [];

    if (topRes.status === 'fulfilled') {
      setTop(topRes.value.data || []);
    } else {
      setTop([]);
      failures.push(`Top Anime: ${topRes.reason?.message || 'gagal dimuat'}`);
    }

    if (airingRes.status === 'fulfilled') {
      setAiring(airingRes.value.data || []);
    } else {
      setAiring([]);
      failures.push(`Trending: ${airingRes.reason?.message || 'gagal dimuat'}`);
    }

    if (seasonRes.status === 'fulfilled') {
      setSeason(seasonRes.value.data || []);
    } else {
      setSeason([]);
      failures.push(`Season Sekarang: ${seasonRes.reason?.message || 'gagal dimuat'}`);
    }

    if (upcomingRes.status === 'fulfilled') {
      setUpcoming(upcomingRes.value.data || []);
    } else {
      setUpcoming([]);
      failures.push(`Akan Tayang: ${upcomingRes.reason?.message || 'gagal dimuat'}`);
    }

    setPartialErrors(failures);
    if (topRes.status === 'rejected') {
      setError(topRes.reason?.message || 'Gagal memuat Top Anime dari backend.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadHome();
  }, [loadHome]);

  const hero = top[0];

  if (loading) return <div className="loading">Mengambil katalog anime...</div>;

  if (error && !hero) {
    return (
      <div className="error-state">
        <h2>Gagal memuat katalog</h2>
        <p>{error}</p>
        <button type="button" onClick={loadHome} className="primary-btn">Coba lagi</button>
      </div>
    );
  }

  return (
    <div>
      {partialErrors.length > 0 && (
        <div className="api-notice">
          <strong>Beberapa data gagal dimuat.</strong>
          <span>{partialErrors.join(' · ')}</span>
          <button type="button" onClick={loadHome}>Muat ulang</button>
        </div>
      )}

      {hero && (
        <section
          className="hero"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(11,13,16,.97) 0%, rgba(11,13,16,.82) 46%, rgba(11,13,16,.15) 100%), url(${animeImage(hero, 'large_image_url')})`
          }}
        >
          <div className="hero-inner">
            <p className="hero-kicker">Peringkat #1 sepanjang masa</p>
            <h1>{pickTitle(hero)}</h1>
            <div className="hero-meta">
              <span><Star size={14} fill="currentColor" /> {hero.score ?? 'N/A'}</span>
              <span>{hero.type || 'Unknown'}</span>
              <span>{hero.year || hero.aired?.prop?.from?.year || 'N/A'}</span>
              <span>{hero.episodes || '?'} Episode</span>
            </div>
            <p className="hero-synopsis">{hero.synopsis || 'Temukan anime favoritmu dalam satu tempat.'}</p>
            <div className="hero-actions">
              <Link to={`/anime/${hero.mal_id}`} className="primary-btn"><Play size={16} fill="currentColor" /> Lihat Detail</Link>
              <Link to="/rankings" className="ghost-btn">Jelajahi Rankings <ArrowRight size={16} /></Link>
            </div>
          </div>
        </section>
      )}

      <div className="page-content">
        <Section title="Sedang Tayang" subtitle="Anime dengan aktivitas dan trending tertinggi minggu ini." to="/rankings?tab=airing">
          {airing.length > 0 ? (
            <div className="anime-grid">{airing.slice(0, 6).map((anime) => <AnimeCard key={anime.mal_id} anime={anime} />)}</div>
          ) : (
            <div className="empty-state">Data trending sedang tidak tersedia.</div>
          )}
        </Section>

        <Section title="Top Rated" subtitle="Peringkat tertinggi berdasarkan rata-rata skor pengguna." to="/rankings">
          {top.length > 1 ? (
            <div className="anime-grid">{top.slice(1, 7).map((anime) => <AnimeCard key={anime.mal_id} anime={anime} />)}</div>
          ) : (
            <div className="empty-state">Data top anime sedang tidak tersedia.</div>
          )}
        </Section>

        <Section title="Musim Ini" subtitle="Judul anime yang tayang di season aktif." to="/seasonal">
          {season.length > 0 ? (
            <div className="anime-grid">{season.slice(0, 6).map((anime) => <AnimeCard key={anime.mal_id} anime={anime} />)}</div>
          ) : (
            <div className="empty-state">Data season sekarang sedang tidak tersedia.</div>
          )}
        </Section>

        <Section title="Akan Tayang" subtitle="Anime yang belum rilis dan paling banyak dinanti." to="/rankings?tab=upcoming">
          {upcoming.length > 0 ? (
            <div className="anime-grid">{upcoming.slice(0, 6).map((anime) => <AnimeCard key={anime.mal_id} anime={anime} />)}</div>
          ) : (
            <div className="empty-state">Data akan tayang sedang tidak tersedia.</div>
          )}
        </Section>
      </div>
    </div>
  );
}
