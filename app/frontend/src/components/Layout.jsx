import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, ListChecks } from 'lucide-react';
import { useState } from 'react';

export default function Layout({ children }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  function submit(e) {
    e.preventDefault();
    const q = query.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand"><span className="brand-mark">AV</span>AniVault</Link>
        <nav className="nav-links">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/rankings">Rankings</NavLink>
          <NavLink to="/seasonal">Seasonal</NavLink>
          <NavLink to="/genres">Genres</NavLink>
          <NavLink to="/search">Search</NavLink>
        </nav>
        <form className="search-box" onSubmit={submit}>
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari judul anime..." />
        </form>
        <Link to="/mylist" className="icon-button" title="My List"><ListChecks size={18} /></Link>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <span>AniVault — demo katalog anime</span>
        <span>Data dari AniList API, bukan afiliasi resmi MyAnimeList</span>
      </footer>
    </div>
  );
}
