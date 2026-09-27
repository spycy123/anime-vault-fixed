import { useEffect, useState } from 'react';
import { Check, ChevronDown, ListPlus, Trash2 } from 'lucide-react';
import { LIST_STATUSES, api, animeImage, pickTitle } from '../api';

export default function AddToList({ anime, entry, onChange }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setOpen(false); }, [entry?.status]);

  async function setStatus(status) {
    setBusy(true);
    try {
      const res = await api.addWatchlist({
        mal_id: anime.mal_id,
        title: pickTitle(anime),
        image: animeImage(anime),
        episodes: anime.episodes,
        status,
        score: entry?.score ?? 0,
        progress: entry?.progress ?? 0
      });
      onChange(res.data);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.removeWatchlist(anime.mal_id);
      onChange(null);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  const label = entry ? LIST_STATUSES.find((s) => s.value === entry.status)?.label : 'Add to List';

  return (
    <div className="add-to-list">
      <button
        type="button"
        className={entry ? 'saved-btn' : 'ghost-btn'}
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
      >
        {entry ? <Check size={16} /> : <ListPlus size={16} />} {label} <ChevronDown size={14} />
      </button>
      {open && (
        <div className="add-to-list-menu">
          {LIST_STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              className={entry?.status === s.value ? 'active' : ''}
              onClick={() => setStatus(s.value)}
            >
              {s.label}
            </button>
          ))}
          {entry && (
            <button type="button" className="danger" onClick={remove}>
              <Trash2 size={13} /> Hapus dari list
            </button>
          )}
        </div>
      )}
    </div>
  );
}
