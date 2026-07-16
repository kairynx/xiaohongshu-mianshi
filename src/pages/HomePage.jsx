import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import PostCard from '../components/PostCard';
import PostDetail from '../components/PostDetail';
import { TrendingUp, BookOpen, Clock, Star } from 'lucide-react';
import './HomePage.css';

export default function HomePage() {
  const { posts, dashboardStats, categories } = useApp();
  const [selectedPost, setSelectedPost] = useState(null);

  // 获取最新5条面经
  const recentPosts = [...posts]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  // 获取热门面经（按点赞数排序）
  const hotPosts = [...posts]
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 4);

  return (
    <div className="home-page">
      {/* 顶部欢迎区域 */}
      <div className="hero-section">
        <div className="hero-content">
          <h1>📕 小红书面经助手</h1>
          <p>自动抓取、智能分类、高效管理互联网行业面试经验</p>
          <div className="hero-stats">
            <div className="stat-item">
              <BookOpen size={20} />
              <div>
                <span className="stat-number">{dashboardStats.total}</span>
                <span className="stat-label">面经总数</span>
              </div>
            </div>
            <div className="stat-item">
              <TrendingUp size={20} />
              <div>
                <span className="stat-number">{dashboardStats.unread}</span>
                <span className="stat-label">待阅读</span>
              </div>
            </div>
            <div className="stat-item">
              <Star size={20} />
              <div>
                <span className="stat-number">{dashboardStats.read}</span>
                <span className="stat-label">已阅读</span>
              </div>
            </div>
            <div className="stat-item">
              <Clock size={20} />
              <div>
                <span className="stat-number">近一周</span>
                <span className="stat-label">更新周期</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 分类快捷入口 */}
      <div className="category-grid">
        {categories.filter(c => c.key !== 'all').map(cat => (
          <Link to={`/categories?cat=${cat.key}`} key={cat.key} className="category-card" style={{ '--cat-color': cat.color }}>
            <span className="cat-icon">{cat.icon}</span>
            <span className="cat-label">{cat.label}</span>
            <span className="cat-count">{dashboardStats.byCategory[cat.key] || 0} 篇</span>
          </Link>
        ))}
      </div>

      {/* 最新面经 */}
      <div className="section">
        <div className="section-header">
          <h2>🕐 最新面经</h2>
          <Link to="/posts" className="view-all">查看全部 →</Link>
        </div>
        <div className="posts-grid">
          {recentPosts.map(post => (
            <PostCard key={post.id} post={post} onSelect={setSelectedPost} />
          ))}
        </div>
      </div>

      {/* 热门面经 */}
      <div className="section">
        <div className="section-header">
          <h2>🔥 热门面经</h2>
        </div>
        <div className="hot-list">
          {hotPosts.map((post, index) => (
            <Link to="/posts" key={post.id} className="hot-item">
              <span className="hot-rank" style={{
                background: index < 3 ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : '#e2e8f0',
                color: index < 3 ? 'white' : '#64748b'
              }}>
                {index + 1}
              </span>
              <div className="hot-info">
                <span className="hot-title">{post.title}</span>
                <span className="hot-meta">
                  {post.categoryName} · {post.author} · ❤️ {post.likes}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 面经详情弹窗 */}
      {selectedPost && (
        <PostDetail post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
}
