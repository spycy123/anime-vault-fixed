import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import SearchPage from './pages/SearchPage';
import DetailPage from './pages/DetailPage';
import WatchlistPage from './pages/WatchlistPage';
import RankingsPage from './pages/RankingsPage';
import SeasonalPage from './pages/SeasonalPage';
import GenresPage from './pages/GenresPage';

function NotFound() {
  return <div className="error-state"><h2>Halaman tidak ditemukan</h2><p>URL yang kamu buka tidak tersedia.</p></div>;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/rankings" element={<RankingsPage />} />
        <Route path="/seasonal" element={<SeasonalPage />} />
        <Route path="/genres" element={<GenresPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/anime/:id" element={<DetailPage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
        <Route path="/mylist" element={<WatchlistPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
