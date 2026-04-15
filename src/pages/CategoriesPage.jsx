import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import PostCard from '../components/PostCard';
import PostDetail from '../components/PostDetail';
import './CategoriesPage.css';

export default function CategoriesPage() {
  const { posts, categories } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPost, setSelectedPost] = useState(null);

  const activeCategory = searchParams.get('cat') || 'frontend';

  const categoryConfig = {
    frontend: { icon: '🖥️', label: '前端开发', color: '#3b82f6', description: 'React、Vue、JavaScript、CSS、浏览器原理等前端技术面试经验' },
    backend: { icon: '⚙️', label: '后端开发', color: '#10b981', description: 'Java、Go、Python、数据库、分布式系统等后端技术面试经验' },
    testdev: { icon: '🧪', label: '测试开发', color: '#f59e0b', description: '自动化测试、性能测试、安全测试、CI/CD等测试开发面试经验' },
    mobile: { icon: '📱', label: '移动端开发', color: '#ef4444', description: 'iOS、Android、Flutter、React Native等移动端面试经验' },
    product: { icon: '📊', label: '产品经理', color: '#8b5cf6', description: '产品设计、数据分析、用户研究、增长策略等产品面试经验' },
  };

  const config = categoryConfig[activeCategory];
  const categoryPosts = posts.filter(p => p.category === activeCategory);

  return (
    <div className="categories-page">
      <div className="page-header">
        <h1>📁 分类管理</h1>
        <p className="page-desc">按岗位类别浏览和管理面经笔记</p>
      </div>

      {/* 分类导航 */}
      <div className="category-nav">
        {Object.entries(categoryConfig).map(([key, cfg]) => (
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
