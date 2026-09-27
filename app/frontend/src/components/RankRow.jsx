import { Link } from 'react-router-dom';
import { Star, Users } from 'lucide-react';
import { animeImage, pickTitle } from '../api';

export default function RankRow({ anime, rank }) {
  return (
    <Link to={`/anime/${anime.mal_id}`} className="rank-row">
      <span className="rank-row-num">{rank}</span>
      <img className="rank-row-poster" src={animeImage(anime)} alt={pickTitle(anime)} loading="lazy" />
      <div className="rank-row-body">
        <h3>{pickTitle(anime)}</h3>
        <p className="rank-row-meta">
          {anime.type || 'Anime'}
          {anime.episodes ? ` · ${anime.episodes} eps` : ''}
          {anime.year ? ` · ${anime.year}` : ''}
        </p>
        {anime.genres?.length > 0 && (
          <p className="rank-row-genres">{anime.genres.slice(0, 4).map((g) => g.name).join(', ')}</p>
        )}
      </div>
      <div className="rank-row-stats">
        <span className="rank-row-score"><Star size={13} fill="currentColor" /> {anime.score ?? '—'}</span>
        {anime.members != null && <span className="rank-row-members"><Users size={12} /> {anime.members.toLocaleString('id-ID')}</span>}
      </div>
    </Link>
  );
}
