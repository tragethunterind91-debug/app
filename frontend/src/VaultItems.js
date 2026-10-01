import { useState, useMemo } from 'react';
import { LockKeyhole, Plus, Search, Eye, Copy, Trash2, Pencil, Download, Share2, ShieldAlert, Timer, Lock, Settings, Star, Tag, CheckSquare, Square, X, History } from 'lucide-react';

export default function VaultItems({
  items, query, setQuery, cat, setCat, categories,
  visible, values,
  onReveal, onCopy, onDelete, onStartEdit, onShare,
  onCheckBreach, onExportItem, onRevealTOTP, onShowItemProps,
  onToggleFavorite, onShowHistory,
  isItemLocked, duplicateIds, showForm, setShowForm,
}) {
  const [tagFilter, setTagFilter] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Gather all unique tags from items
  const allTags = useMemo(() => {
    const s = new Set();
    items.forEach(i => (i.tags || []).forEach(t => s.add(t)));
    return [...s].sort();
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.tags || []).some(t => t.toLowerCase().includes(q)) ||
        (i.notes || '').toLowerCase().includes(q)
      );
    }
    if (cat !== 'All') list = list.filter(i => i.category === cat);
    if (tagFilter) list = list.filter(i => (i.tags || []).includes(tagFilter));
    if (favOnly) list = list.filter(i => i.favorite);
    return list;
  }, [items, query, cat, tagFilter, favOnly]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(i => i.id)));
  };
  const exitBulk = () => { setBulkMode(false); setSelectedIds(new Set()); };

  const dupSet = useMemo(() => new Set(duplicateIds || []), [duplicateIds]);

  return (
    <section className="vault-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">YOUR COLLECTION</p>
          <h2>Encrypted values</h2>
        </div>
        <label className="search">
          <Search size={17} />
          <input
            data-testid="vault-search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search vault, tags, notes..."
          />
        </label>
      </div>

      {/* Filter row: categories + favorites + tags */}
      <div className="filter-row">
        <div className="cat-filter">
          {['All', ...new Set(categories)].map(c => (
            <button
              key={c}
              className={`cat-chip${cat === c ? ' active' : ''}`}
              data-testid={`cat-filter-${c.replace(/\s+/g, '-')}`}
              onClick={() => setCat(c)}
            >{c}</button>
          ))}
          <button
            className={`cat-chip fav-chip${favOnly ? ' active' : ''}`}
            data-testid="filter-favorites"
            onClick={() => setFavOnly(!favOnly)}
          >
            <Star size={12} /> Favorites
          </button>
        </div>

        {allTags.length > 0 && (
          <div className="tag-filter-row">
            <Tag size={12} />
            {allTags.map(t => (
              <button
                key={t}
                className={`tag-chip${tagFilter === t ? ' active' : ''}`}
                data-testid={`tag-filter-${t}`}
                onClick={() => setTagFilter(tagFilter === t ? '' : t)}
              >{t}</button>
            ))}
            {tagFilter && (
              <button className="tag-chip tag-clear" onClick={() => setTagFilter('')}>
                <X size={10} /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bulk actions bar */}
      {items.length > 0 && (
        <div className="bulk-bar">
          {!bulkMode ? (
            <button className="bulk-toggle" data-testid="bulk-mode-toggle" onClick={() => setBulkMode(true)}>
              <CheckSquare size={14} /> Select
            </button>
          ) : (
            <div className="bulk-actions-row" data-testid="bulk-actions-bar">
              <button className="bulk-select-all" data-testid="bulk-select-all" onClick={toggleSelectAll}>
                {selectedIds.size === filtered.length ? <CheckSquare size={14} /> : <Square size={14} />}
                {selectedIds.size === filtered.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="bulk-count">{selectedIds.size} selected</span>
              <button
                className="bulk-btn bulk-btn-danger"
                data-testid="bulk-delete-btn"
                disabled={selectedIds.size === 0}
                onClick={() => {
                  if (selectedIds.size === 0) return;
                  if (window.confirm(`Delete ${selectedIds.size} item(s) permanently?`)) {
                    window.__bulkAction?.('delete', [...selectedIds]);
                    exitBulk();
                  }
                }}
              >
                <Trash2 size={13} /> Delete
              </button>
              <button className="bulk-btn bulk-btn-cancel" data-testid="bulk-cancel" onClick={exitBulk}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state" data-testid="empty-vault-state">
          <div className="empty-icon"><LockKeyhole /></div>
          <h3>{query || tagFilter || favOnly ? 'Nothing found' : 'Your vault is quiet'}</h3>
          <p>{query || tagFilter || favOnly ? 'Try a different search or filter.' : 'Add your first value and keep it protected.'}</p>
          {!query && !tagFilter && !favOnly && (
            <button className="primary" data-testid="empty-add-button" onClick={() => setShowForm(true)}>
              <Plus size={17} /> Add your first value
            </button>
          )}
        </div>
      ) : (
        <div className="item-list">
          {filtered.map(item => (
            <article className="item-row" key={item.id} data-testid={`vault-item-${item.id}`}>
              {bulkMode && (
                <button
                  className="bulk-check"
                  data-testid={`bulk-check-${item.id}`}
                  onClick={() => toggleSelect(item.id)}
                >
                  {selectedIds.has(item.id) ? <CheckSquare size={17} className="bulk-checked" /> : <Square size={17} />}
                </button>
              )}
              <div className="item-icon"><LockKeyhole size={18} /></div>
              <div className="item-info">
                <div className="item-name-row">
                  <b data-testid={`item-name-${item.id}`}>{item.name}</b>
                  {item.favorite && <Star size={13} className="fav-star" />}
                  {item.advance_mode && (
                    <span className="adv-badge" title={isItemLocked(item) ? `Locked until ${new Date(item.advance_locked_until).toLocaleDateString()}` : 'Advance Mode'}>
                      <Lock size={12} />{isItemLocked(item) ? ' LOCKED' : ''}
                    </span>
                  )}
                  {dupSet.has(item.id) && <span className="dup-badge" data-testid={`dup-badge-${item.id}`} title="Duplicate password detected">DUP</span>}
                </div>
                <span>
                  {item.category}
                  {(item.tags || []).length > 0 && (
                    <span className="item-tags-inline">
                      {item.tags.map(t => <span key={t} className="item-tag-sm">{t}</span>)}
                    </span>
                  )}
                  {' · '}Updated {new Date(item.updated_at).toLocaleDateString()}
                </span>
              </div>
              <div className="secret-preview" data-testid={`item-value-${item.id}`}>
                {visible[item.id] ? values[item.id] : '••••••••••••'}
              </div>
              <div className="item-actions">
                <button className="icon-btn fav-toggle-btn" data-testid={`fav-item-${item.id}`} onClick={() => onToggleFavorite(item.id)} title={item.favorite ? 'Unfavorite' : 'Favorite'}>
                  <Star size={15} className={item.favorite ? 'fav-active' : ''} />
                </button>
                <button className="icon-btn" data-testid={`props-item-${item.id}`} onClick={() => onShowItemProps(item)} title="Item properties"><Settings size={15} /></button>
                {item.has_totp && <button className="icon-btn totp-btn" data-testid={`totp-item-${item.id}`} onClick={() => onRevealTOTP(item)} title="Get OTP code"><Timer size={16} /></button>}
                <button className="icon-btn" data-testid={`reveal-item-${item.id}`} onClick={() => onReveal(item.id)} title="Reveal value"><Eye size={17} /></button>
                <button className="icon-btn" data-testid={`copy-item-${item.id}`} onClick={() => onCopy(item.id)} title="Copy to clipboard"><Copy size={17} /></button>
                <button className="icon-btn" data-testid={`breach-item-${item.id}`} onClick={() => onCheckBreach(item)} title="Check for breaches" disabled={item.advance_mode} style={item.advance_mode ? { opacity: .3, cursor: 'not-allowed' } : undefined}><ShieldAlert size={16} /></button>
                {!item.advance_mode && <button className="icon-btn" data-testid={`history-item-${item.id}`} onClick={() => onShowHistory(item)} title="Password history"><History size={15} /></button>}
                {!item.advance_mode && <button className="icon-btn" data-testid={`download-item-${item.id}`} onClick={() => onExportItem(item)} title="Download as JSON"><Download size={17} /></button>}
                {!item.advance_mode && !isItemLocked(item) && (
                  <button className="icon-btn share-btn share-btn-prominent" data-testid={`share-item-${item.id}`} onClick={() => onShare(item)} title="Share via expiring link">
                    <Share2 size={16} /><span className="share-btn-label">Share</span>
                  </button>
                )}
                <button className="icon-btn" data-testid={`edit-item-${item.id}`} onClick={() => onStartEdit(item)} title="Edit item"><Pencil size={16} /></button>
                <button className="icon-btn danger" data-testid={`delete-item-${item.id}`} onClick={() => onDelete(item.id)} title="Delete permanently"><Trash2 size={17} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
