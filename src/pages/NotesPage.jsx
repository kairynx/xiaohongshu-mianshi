import { useEffect, useMemo, useState } from 'react';
import { Loader, RefreshCw } from 'lucide-react';
import { listNotes } from '../utils/notesApi';
import PostDetail from '../components/PostDetail';
import NoteCard from '../components/NoteCard';
import './NotesPage.css';

export default function NotesPage() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('updated');
  const [selectedNote, setSelectedNote] = useState(null);

  const loadNotes = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listNotes({ limit: 500 });
      setNotes(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  const counts = useMemo(() => ({
    all: notes.length,
    starred: notes.filter(n => n.starred).length,
    note: notes.filter(n => (n.noteContent || '').trim().length > 0).length,
  }), [notes]);

  const filteredNotes = useMemo(() => {
    let list = notes;
    if (activeTab === 'starred') list = list.filter(n => n.starred);
    if (activeTab === 'note') list = list.filter(n => (n.noteContent || '').trim().length > 0);

    const byRelevance = (a, b) => ((b.post?.relevance || 0) - (a.post?.relevance || 0));
    const byUpdated = (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt);
    const byStarred = (a, b) => Number(!!b.starred) - Number(!!a.starred) || byUpdated(a, b);

    return [...list].sort(
      sortBy === 'relevance'
        ? byRelevance
        : sortBy === 'starred'
          ? byStarred
          : byUpdated
    );
  }, [notes, activeTab, sortBy]);

  const handleClose = (latestNote) => {
    setSelectedNote(null);
    if (latestNote && latestNote.postId) {
      setNotes(prev => prev.map(item => (
        item.postId === latestNote.postId
          ? { ...item, ...latestNote, post: { ...item.post, ...(latestNote.post || {}) } }
          : item
      )));
    }
  };

  return (
    <div className="notes-page">
      <div className="page-header">
        <h1>我的学习</h1>
        <p className="page-desc">收藏的面经和我的笔记</p>
      </div>

      <div className="notes-toolbar">
        <div className="notes-tabs">
          <button className={`notes-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>全部 <span>{counts.all}</span></button>
          <button className={`notes-tab ${activeTab === 'starred' ? 'active' : ''}`} onClick={() => setActiveTab('starred')}>已收藏 <span>{counts.starred}</span></button>
          <button className={`notes-tab ${activeTab === 'note' ? 'active' : ''}`} onClick={() => setActiveTab('note')}>有笔记 <span>{counts.note}</span></button>
        </div>
        <div className="sort-group">
          <label><input type="radio" name="sort" checked={sortBy === 'updated'} onChange={() => setSortBy('updated')} /> 最近更新</label>
          <label><input type="radio" name="sort" checked={sortBy === 'starred'} onChange={() => setSortBy('starred')} /> 最近收藏</label>
          <label><input type="radio" name="sort" checked={sortBy === 'relevance'} onChange={() => setSortBy('relevance')} /> 相关度高低</label>
        </div>
      </div>

      {loading ? (
        <div className="notes-loading"><Loader className="spin" size={18} /> 加载中...</div>
      ) : error ? (
        <div className="notes-error">
          <span>{error}</span>
          <button onClick={loadNotes}><RefreshCw size={16} /> 重试</button>
        </div>
      ) : filteredNotes.length > 0 ? (
        <div className="notes-grid">
          {filteredNotes.map(note => (
            <NoteCard key={note.id} note={note} onClick={() => setSelectedNote(note)} />
          ))}
        </div>
      ) : (
        <div className="notes-empty">还没有收藏或笔记，去 /posts 或 /agent 抓取一些面经，点击详情里的 ⭐ 或写笔记吧</div>
      )}

      {selectedNote && (
        <PostDetail post={selectedNote.post} onClose={handleClose} />
      )}
    </div>
  );
}
