import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { CATEGORY_DETAILS } from '../constants';
import PostCard from '../components/PostCard';
import PostDetail from '../components/PostDetail';
import './CategoriesPage.css';

export default function CategoriesPage() {
  const { posts, categories } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPost, setSelectedPost] = useState(null);

  const activeCategory = searchParams.get('cat') || 'frontend';

  const config = CATEGORY_DETAILS[activeCategory];
  const categoryPosts = posts.filter(p => p.category === activeCategory);

  return (
    <div className="categories-page">
      <div className="page-header">
        <h1>📁 分类管理</h1>
        <p className="page-desc">按岗位类别浏览和管理面经笔记</p>
      </div>

      {/* 分类导航 */}
      <div className="category-nav">
        {Object.entries(CATEGORY_DETAILS).map(([key, cfg]) => (
          <button
            key={key}
            className={`cat-nav-item ${activeCategory === key ? 'active' : ''}`}
            onClick={() => setSearchParams({ cat: key })}
            style={activeCategory === key ? { '--nav-color': cfg.color } : {}}
          >
            <span className="nav-icon">{cfg.icon}</span>
            <span className="nav-label">{cfg.label}</span>
            <span className="nav-count">{posts.filter(p => p.category === key).length}</span>
          </button>
        ))}
      </div>

      {/* 当前分类信息 */}
      <div className="category-info" style={{ borderLeftColor: config.color }}>
        <div className="info-left">
          <span className="info-icon">{config.icon}</span>
          <div>
            <h2>{config.label}</h2>
            <p>{config.description}</p>
          </div>
        </div>
        <div className="info-stats">
          <div className="info-stat">
            <span className="info-stat-number">{categoryPosts.length}</span>
            <span className="info-stat-label">篇面经</span>
          </div>
          <div className="info-stat">
            <span className="info-stat-number">{categoryPosts.filter(p => p.status === 'unread').length}</span>
            <span className="info-stat-label">待阅读</span>
          </div>
          <div className="info-stat">
            <span className="info-stat-number">{categoryPosts.filter(p => p.priority === 'high').length}</span>
            <span className="info-stat-label">高优先</span>
          </div>
        </div>
      </div>

      {/* 面经列表 */}
      <div className="category-posts">
        {categoryPosts.length > 0 ? (
          categoryPosts.map(post => (
            <PostCard key={post.id} post={post} onSelect={setSelectedPost} />
          ))
        ) : (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <p>该分类暂无面经</p>
          </div>
        )}
      </div>

      {selectedPost && (
        <PostDetail post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
}
