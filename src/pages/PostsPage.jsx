import { useState } from 'react';
import { useApp } from '../context/AppContext';
import PostCard from '../components/PostCard';
import PostDetail from '../components/PostDetail';
import { Search, Filter, SortAsc, SortDesc } from 'lucide-react';
import './PostsPage.css';

export default function PostsPage() {
  const { filteredPosts, categories, selectedCategory, setCategory, setSearch, searchQuery } = useApp();
  const [selectedPost, setSelectedPost] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.date) - new Date(b.date);
        break;
      case 'likes':
        comparison = a.likes - b.likes;
        break;
      case 'collects':
        comparison = a.collects - b.collects;
        break;
      default:
        comparison = 0;
    }
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  return (
    <div className="posts-page">
      <div className="page-header">
        <h1>📋 面经列表</h1>
        <p className="page-desc">共 {filteredPosts.length} 条面经记录</p>
      </div>

      {/* 搜索和筛选栏 */}
      <div className="filter-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="搜索面经标题、内容、标签、作者..."
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-btn" onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        <div className="filter-controls">
          <div className="sort-control">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="date">按日期</option>
              <option value="likes">按点赞</option>
              <option value="collects">按收藏</option>
            </select>
            <button
              className="sort-order-btn"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            >
              {sortOrder === 'desc' ? <SortDesc size={16} /> : <SortAsc size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* 分类标签 */}
      <div className="category-tabs">
        {categories.map(cat => (
          <button
            key={cat.key}
            className={`cat-tab ${selectedCategory === cat.key ? 'active' : ''}`}
            onClick={() => setCategory(cat.key)}
            style={selectedCategory === cat.key ? { '--active-color': cat.color } : {}}
          >
            {cat.icon} {cat.label}
            <span className="tab-count">
              {cat.key === 'all'
                ? filteredPosts.length
                : filteredPosts.filter(p => p.category === cat.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* 面经列表 */}
      <div className="posts-grid">
        {sortedPosts.length > 0 ? (
          sortedPosts.map(post => (
            <PostCard key={post.id} post={post} onSelect={setSelectedPost} />
          ))
        ) : (
          <div className="empty-state">
            <span className="empty-icon">🔍</span>
            <p>没有找到匹配的面经</p>
            <button onClick={() => { setSearch(''); setCategory('all'); }}>清除筛选</button>
          </div>
        )}
      </div>

      {/* 面经详情弹窗 */}
      {selectedPost && (
        <PostDetail post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
}
