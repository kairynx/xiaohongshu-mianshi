import { Star } from 'lucide-react';
import { CATEGORY_COLORS } from '../constants';
import './NoteCard.css';

function formatRelativeTime(value) {
  if (!value) return '未知';
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0) return '刚刚';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export default function NoteCard({ note, onClick }) {
  const post = note.post || {};
  const relevance = typeof post.relevance === 'number' ? Math.round(post.relevance * 100) : null;
  const noteText = note.noteContent || '';
  const preview = noteText ? (noteText.length > 120 ? `${noteText.slice(0, 120)}...` : noteText) : '暂无笔记';

  return (
    <div className="note-card" onClick={onClick}>
      <div className="note-card-strip" style={{ background: CATEGORY_COLORS[post.category] || '#cbd5e1' }} />
      <div className="note-card-body">
        <div className="note-card-top">
          <span className="note-card-category" style={{ background: (CATEGORY_COLORS[post.category] || '#64748b') + '18', color: CATEGORY_COLORS[post.category] || '#64748b' }}>
            {post.categoryName || '未分类'}
          </span>
          {relevance !== null && (
            <span className={`note-card-relevance ${relevance >= 70 ? 'high' : relevance >= 40 ? 'medium' : 'low'}`}>
              相关 · {relevance}%
            </span>
          )}
          {note.starred && <Star size={16} fill="#fbbf24" color="#fbbf24" />}
        </div>
        <h3 className="note-card-title">{post.title || '未命名面经'}</h3>
        <p className={`note-card-preview ${noteText ? '' : 'empty'}`}>{preview}</p>
        <div className="note-card-footer">
          <span>{formatRelativeTime(note.updatedAt)}</span>
          <span>{post.categoryName || '未分类'}</span>
          <span>❤️ {post.likes || 0} · ⭐ {post.collects || 0}</span>
        </div>
      </div>
    </div>
  );
}
