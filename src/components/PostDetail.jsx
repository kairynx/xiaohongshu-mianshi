import { useState } from 'react';
import './PostDetail.css';

export default function PostDetail({ post, onClose }) {
  const [activeTab, setActiveTab] = useState('content');

  if (!post) return null;

  const categoryColors = {
    frontend: '#3b82f6',
    backend: '#10b981',
    testdev: '#f59e0b',
    mobile: '#ef4444',
    product: '#8b5cf6'
  };

  // 将markdown内容渲染为HTML
  const renderContent = (text) => {
    return text.split('\n').map((line, i) => {
      // 标题
      if (line.startsWith('### ')) {
        return <h3 key={i} className="md-h3">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={i} className="md-h2">{line.replace('## ', '')}</h2>;
      }
      // 列表项
      if (line.startsWith('- ')) {
        return <li key={i} className="md-li">{line.replace('- ', '')}</li>;
      }
      // 空行
      if (line.trim() === '') {
        return <br key={i} />;
      }
      // 普通段落
      return <p key={i} className="md-p">{line.replace(/\*\*/g, '')}</p>;
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <span
              className="category-badge"
              style={{ backgroundColor: categoryColors[post.category] + '20', color: categoryColors[post.category] }}
            >
              {post.categoryName}
            </span>
            <span className="post-date">{post.date}</span>
            <span className="post-source">📌 {post.source}</span>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-title-section">
          <h1 className="modal-title">{post.title}</h1>
          <div className="modal-author">
            <span className="avatar">{post.avatar}</span>
            <span className="author-name">{post.author}</span>
            <div className="modal-stats">
              <span>❤️ {post.likes}</span>
              <span>⭐ {post.collects}</span>
            </div>
          </div>
        </div>

        <div className="modal-tags">
          {post.tags.map((tag, i) => (
            <span key={i} className="tag">#{tag}</span>
          ))}
        </div>

        <div className="modal-tabs">
          <button
            className={`tab ${activeTab === 'content' ? 'active' : ''}`}
            onClick={() => setActiveTab('content')}
          >
            📝 面经内容
          </button>
          <button
            className={`tab ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            📋 我的笔记
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'content' ? (
            <div className="content-view">
              {renderContent(post.content)}
            </div>
          ) : (
            <div className="notes-view">
              <textarea
                className="notes-textarea"
                placeholder="在这里记录你的学习笔记..."
                defaultValue={localStorage.getItem(`notes_${post.id}`) || ''}
                onChange={(e) => localStorage.setItem(`notes_${post.id}`, e.target.value)}
              />
              <p className="notes-hint">💡 笔记会自动保存在本地浏览器中</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
