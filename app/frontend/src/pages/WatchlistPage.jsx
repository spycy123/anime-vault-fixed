import { useEffect, useMemo, useState } from 'react';
import { ListChecks, Minus, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, LIST_STATUSES } from '../api';

export default function WatchlistPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ALL');

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    api.watchlist().then((d) => setItems(d.data || [])).finally(() => setLoading(false));
  }

  async function patch(id, body) {
    const res = await api.updateWatchlist(id, body);
    setItems((prev) => prev.map((it) => (String(it.mal_id) === String(id) ? res.data : it)));
  }

  async function remove(id) {
    await api.removeWatchlist(id);
    setItems((prev) => prev.filter((x) => String(x.mal_id) !== String(id)));
  }

  const counts = useMemo(() => {
    const c = { ALL: items.length };
    LIST_STATUSES.forEach((s) => { c[s.value] = items.filter((i) => i.status === s.value).length; });
    return c;
  }, [items]);

  const visible = tab === 'ALL' ? items : items.filter((i) => i.status === tab);

  return (
    <div className="page-content watchlist-page">
      <div className="search-head">
        <div><h1>My List</h1><p>Data list ini disimpan sementara di backend demo (memory).</p></div>
      </div>

      <div className="tab-row">
        <button className={tab === 'ALL' ? 'active' : ''} onClick={() => setTab('ALL')}>All ({counts.ALL})</button>
        {LIST_STATUSES.map((s) => (
          <button key={s.value} className={tab === s.value ? 'active' : ''} onClick={() => setTab(s.value)}>
            {s.label} ({counts[s.value] || 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Memuat list...</div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <ListChecks size={30} />
          <h2>Belum ada anime di sini</h2>
          <p>Buka detail anime lalu klik Add to List.</p>
          <Link className="primary-btn" to="/search">Cari Anime</Link>
        </div>
      ) : (
        <div className="watchlist-list">
          {visible.map((item) => (
            <div className="watch-item" key={item.mal_id}>
              <img src={item.image} alt={item.title} />
              <div className="watch-item-main">
                <Link to={`/anime/${item.mal_id}`}><h3>{item.title}</h3></Link>
                <p>Ditambahkan {new Date(item.addedAt).toLocaleDateString('id-ID')}</p>
              </div>

              <select
                className={`status-select status-${item.status}`}
                value={item.status}
                onChange={(e) => patch(item.mal_id, { status: e.target.value })}
              >
                {LIST_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>

              <div className="progress-control">
                <button onClick={() => patch(item.mal_id, { progress: Math.max(0, (item.progress || 0) - 1) })}><Minus size={13} /></button>
                <span>{item.progress || 0}{item.episodes ? ` / ${item.episodes}` : ''}</span>
                <button onClick={() => patch(item.mal_id, { progress: (item.progress || 0) + 1 })}><Plus size={13} /></button>
              </div>

              <select
                className="score-select"
                value={item.score || 0}
                onChange={(e) => patch(item.mal_id, { score: Number(e.target.value) })}
              >
                <option value={0}>— Skor</option>
                {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>

              <button className="remove-btn" onClick={() => remove(item.mal_id)} title="Hapus"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
