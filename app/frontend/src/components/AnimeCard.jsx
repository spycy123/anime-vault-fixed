import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { animeImage, pickTitle } from '../api';

export default function AnimeCard({ anime, rank }) {
  return (
    <Link to={`/anime/${anime.mal_id}`} className="anime-card">
      <div className="poster-wrap">
        {rank && <span className="rank-chip">{rank}</span>}
        <img src={animeImage(anime)} alt={pickTitle(anime)} loading="lazy" />
        <span className="score"><Star size={11} fill="currentColor" />{anime.score ?? '—'}</span>
      </div>
      <div className="card-body">
        <h3>{pickTitle(anime)}</h3>
        <p>{anime.type || 'Anime'}{anime.episodes ? ` · ${anime.episodes} eps` : ''}</p>
      </div>
    </Link>
  );
}
