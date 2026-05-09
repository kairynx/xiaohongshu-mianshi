import { useApp } from '../context/AppContext';
import { CATEGORY_COLORS } from '../constants';
import './PostCard.css';

export default function PostCard({ post, onSelect }) {
  const { toggleStatus, deletePost, setPriority } = useApp();

  const priorityLabels = {
    high: '高优先',
    medium: '中优先',
    low: '低优先'
  };

  const priorityColors = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#6b7280'
  };

  return (
    <div className={`post-card ${post.status === 'unread' ? 'unread' : ''}`}>
      <div className="card-header">
        <div className="card-meta">
          <span
            className="category-badge"
            style={{ backgroundColor: CATEGORY_COLORS[post.category] + '20', color: CATEGORY_COLORS[post.category] }}
          >
            {post.categoryName}
          </span>
          <span className="post-date">{post.date}</span>
        </div>
        <div className="card-actions">
          <select
            className="priority-select"
            value={post.priority}
            onChange={(e) => setPriority(post.id, e.target.value)}
            style={{ color: priorityColors[post.priority] }}
          >
            <option value="high">🔴 高优先</option>
            <option value="medium">🟡 中优先</option>
            <option value="low">⚪ 低优先</option>
          </select>
          <button
            className={`status-btn ${post.status}`}
            onClick={() => toggleStatus(post.id)}
            title={post.status === 'read' ? '标记为未读' : '标记为已读'}
          >
            {post.status === 'read' ? '✅' : '📖'}
          </button>
          <button
            className="delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('确定删除这条面经吗？')) {
                deletePost(post.id);
              }
            }}
            title="删除"
          >
            🗑️
          </button>
        </div>
      </div>

      <div className="card-body" onClick={() => onSelect(post)}>
        <h3 className="card-title">{post.title}</h3>
        <p className="card-preview">
          {post.content.replace(/#{1,6}\s/g, '').replace(/\*\*/g, '').substring(0, 120)}...
        </p>
      </div>

      <div className="card-footer">
        <div className="author-info">
          <span className="avatar">{post.avatar}</span>
          <span className="author-name">{post.author}</span>
        </div>
        <div className="post-stats">
          <span>❤️ {post.likes}</span>
          <span>⭐ {post.collects}</span>
        </div>
      </div>

      <div className="card-tags">
        {post.tags.map((tag, i) => (
          <span key={i} className="tag">#{tag}</span>
        ))}
      </div>
    </div>
  );
}
