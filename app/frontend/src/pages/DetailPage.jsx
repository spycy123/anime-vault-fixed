import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Clock3, ExternalLink, Star, Users } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, animeImage, pickTitle } from '../api';
import AddToList from '../components/AddToList';

const TABS = ['Overview', 'Characters & Staff', 'Stats', 'Reviews'];

export default function DetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [anime, setAnime] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [listEntry, setListEntry] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [error, setError] = useState('');

  useEffect(() => {
    setTab('Overview');
    setAnime(null);
    Promise.all([api.detail(id), api.characters(id), api.watchlist()])
      .then(([detail, chars, list]) => {
        setAnime(detail.data);
        setCharacters(chars.data || []);
        setListEntry((list.data || []).find((item) => String(item.mal_id) === String(id)) || null);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="error-state"><h2>Gagal memuat anime</h2><p>{error}</p><button className="primary-btn" onClick={() => navigate(-1)}>Kembali</button></div>;
  if (!anime) return <div className="loading">Memuat detail anime...</div>;

  const maxScoreAmount = Math.max(1, ...(anime.stats?.scoreDistribution || []).map((s) => s.amount));
  const maxStatusAmount = Math.max(1, ...(anime.stats?.statusDistribution || []).map((s) => s.amount));

  return (
    <div className="detail-page">
      <div className="detail-back"><button onClick={() => navigate(-1)}><ArrowLeft size={17} /> Kembali</button></div>
      <section className="detail-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(11,13,16,.97) 0%, rgba(11,13,16,.88) 55%, rgba(11,13,16,.4) 100%), url(${anime.banner || animeImage(anime, 'large_image_url')})` }}>
        <div className="detail-main">
          <img className="detail-poster" src={animeImage(anime, 'large_image_url')} alt={pickTitle(anime)} />
          <div className="detail-info">
            <p className="hero-kicker">{anime.type || 'Anime'} · {anime.status || 'Unknown'}</p>
            <h1>{pickTitle(anime)}</h1>
            <p className="native-title">{anime.title_japanese || 'Judul asli tidak tersedia'}</p>
            <div className="hero-meta">
              <span><Star size={15} fill="currentColor" /> {anime.score ?? 'N/A'} / 10</span>
              <span>{anime.episodes ?? '?'} Episode</span>
              <span><CalendarDays size={14} /> {anime.aired?.string || 'Tanggal tidak tersedia'}</span>
              {anime.members != null && <span><Users size={14} /> {anime.members.toLocaleString('id-ID')}</span>}
            </div>
            <p className="detail-synopsis">{anime.synopsis || 'Sinopsis belum tersedia.'}</p>
            <div className="detail-tags">{(anime.genres || []).slice(0, 6).map((g) => <Link key={g.mal_id} to={`/search?genre=${encodeURIComponent(g.name)}`}>{g.name}</Link>)}</div>
            <div className="hero-actions">
              {anime.trailer && <a className="primary-btn" href={anime.trailer.url} target="_blank" rel="noreferrer">Tonton Trailer</a>}
              <AddToList anime={anime} entry={listEntry} onChange={setListEntry} />
            </div>
          </div>
        </div>
      </section>

      <div className="page-content detail-content">
        <div className="stats-grid">
          <div><span>Rank</span><strong>#{anime.rank ?? '—'}</strong></div>
          <div><span>Popularity</span><strong>#{anime.popularity ?? '—'}</strong></div>
          <div><span>Members</span><strong>{anime.members ? anime.members.toLocaleString('id-ID') : '—'}</strong></div>
          <div><span>Duration</span><strong><Clock3 size={15} /> {anime.duration || '—'}</strong></div>
        </div>

        <div className="tab-row">
          {TABS.map((t) => <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}
        </div>

        {tab === 'Overview' && (
          <>
            {anime.trailer && (
              <section className="section">
                <div className="section-heading"><div><h2>Trailer</h2></div></div>
                <div className="trailer-embed">
                  <iframe
                    src={anime.trailer.embed_url}
                    title="Trailer"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </section>
            )}

            <section className="section">
              <div className="section-heading"><div><h2>Informasi</h2><p>Detail tambahan dari AniList.</p></div></div>
              <div className="info-panel">
                <div><span>Studio</span><strong>{(anime.studios || []).map((x) => x.name).join(', ') || '—'}</strong></div>
                <div><span>Source</span><strong>{anime.source || '—'}</strong></div>
                <div><span>Season</span><strong>{[anime.season, anime.year].filter(Boolean).join(' ') || '—'}</strong></div>
                <div><span>Favorites</span><strong>{anime.favourites != null ? anime.favourites.toLocaleString('id-ID') : '—'}</strong></div>
              </div>
            </section>

            {anime.externalLinks?.length > 0 && (
              <section className="section">
                <div className="section-heading"><div><h2>Tautan Eksternal</h2></div></div>
                <div className="external-links">
                  {anime.externalLinks.map((l) => (
                    <a key={l.id} href={l.url} target="_blank" rel="noreferrer">{l.site} <ExternalLink size={13} /></a>
                  ))}
                </div>
              </section>
            )}

            {anime.relations?.length > 0 && (
              <section className="section">
                <div className="section-heading"><div><h2>Related Anime</h2></div></div>
                <div className="anime-grid compact">
                  {anime.relations.map((r) => (
                    <Link key={r.anime.mal_id} to={`/anime/${r.anime.mal_id}`} className="anime-card">
                      <div className="poster-wrap">
                        <span className="relation-chip">{r.relation}</span>
                        <img src={animeImage(r.anime)} alt={pickTitle(r.anime)} loading="lazy" />
                      </div>
                      <div className="card-body"><h3>{pickTitle(r.anime)}</h3></div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {anime.recommendations?.length > 0 && (
              <section className="section">
                <div className="section-heading"><div><h2>Recommendations</h2><p>Anime serupa yang disukai pengguna lain.</p></div></div>
                <div className="anime-grid compact">
                  {anime.recommendations.map((r) => (
                    <Link key={r.mal_id} to={`/anime/${r.mal_id}`} className="anime-card">
                      <div className="poster-wrap">
                        <img src={animeImage(r)} alt={pickTitle(r)} loading="lazy" />
                        <span className="score"><Star size={11} fill="currentColor" />{r.score ?? '—'}</span>
                      </div>
                      <div className="card-body"><h3>{pickTitle(r)}</h3></div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {tab === 'Characters & Staff' && (
          <>
            <section className="section">
              <div className="section-heading"><div><h2>Characters</h2></div></div>
              {characters.length > 0 ? (
                <div className="character-grid">
                  {characters.map((item) => (
                    <div className="character-card" key={item.character?.mal_id}>
                      <img src={item.character?.images?.webp?.image_url || item.character?.images?.jpg?.image_url} alt={item.character?.name} />
                      <div><strong>{item.character?.name}</strong><span>{item.role}</span></div>
                    </div>
                  ))}
                </div>
              ) : <div className="empty-state">Belum ada data karakter.</div>}
            </section>

            <section className="section">
              <div className="section-heading"><div><h2>Staff</h2></div></div>
              {anime.staff?.length > 0 ? (
                <div className="character-grid">
                  {anime.staff.map((s, i) => (
                    <div className="character-card" key={`${s.name}-${i}`}>
                      <img src={s.image || 'https://placehold.co/96x128/16181d/eef0f2?text=?'} alt={s.name} />
                      <div><strong>{s.name}</strong><span>{s.role}</span></div>
                    </div>
                  ))}
                </div>
              ) : <div className="empty-state">Belum ada data staff.</div>}
            </section>
          </>
        )}

        {tab === 'Stats' && (
          <section className="section">
            <div className="section-heading"><div><h2>Score Distribution</h2><p>Persebaran skor yang diberikan pengguna AniList.</p></div></div>
            {anime.stats?.scoreDistribution?.length > 0 ? (
              <div className="bar-chart">
                {anime.stats.scoreDistribution.map((s) => (
                  <div className="bar-row" key={s.score}>
                    <span className="bar-label">{s.score}</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(s.amount / maxScoreAmount) * 100}%` }} /></div>
                    <span className="bar-amount">{s.amount}</span>
                  </div>
                ))}
              </div>
            ) : <div className="empty-state">Belum ada data skor.</div>}

            <div className="section-heading" style={{ marginTop: 34 }}><div><h2>Status Distribution</h2><p>Status anime ini pada list pengguna AniList.</p></div></div>
            {anime.stats?.statusDistribution?.length > 0 ? (
              <div className="bar-chart">
                {anime.stats.statusDistribution.map((s) => (
                  <div className="bar-row" key={s.status}>
                    <span className="bar-label">{s.status}</span>
                    <div className="bar-track"><div className="bar-fill alt" style={{ width: `${(s.amount / maxStatusAmount) * 100}%` }} /></div>
                    <span className="bar-amount">{s.amount.toLocaleString('id-ID')}</span>
                  </div>
                ))}
              </div>
            ) : <div className="empty-state">Belum ada data status.</div>}
          </section>
        )}

        {tab === 'Reviews' && (
          <section className="section">
            <div className="section-heading"><div><h2>Reviews</h2><p>Ulasan pengguna dari AniList.</p></div></div>
            {anime.reviews?.length > 0 ? (
              <div className="review-list">
                {anime.reviews.map((r) => (
                  <div className="review-card" key={r.id}>
                    <div className="review-head"><strong>{r.user}</strong><span><Star size={13} fill="currentColor" /> {r.score}/100</span></div>
                    <p>{r.summary}</p>
                  </div>
                ))}
              </div>
            ) : <div className="empty-state">Belum ada review untuk anime ini.</div>}
          </section>
        )}
      </div>
    </div>
  );
}
