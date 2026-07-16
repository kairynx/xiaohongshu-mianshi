import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import PostCard from '../components/PostCard';
import PostDetail from '../components/PostDetail';
import { Search, SortAsc, SortDesc } from 'lucide-react';
import { useWorkerSearch } from '../hooks/useWorkerSearch';
import './PostsPage.css';

export default function PostsPage() {
  const { posts, filteredPosts, categories, selectedCategory, setCategory, searchQuery } = useApp();
  const { workerIds, highlightQuery, search } = useWorkerSearch(posts);
  const [selectedPost, setSelectedPost] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [inputValue, setInputValue] = useState(searchQuery);

  useEffect(() => {
    search(inputValue);
  }, [inputValue, search]);

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

  // Worker 搜索结果与分类筛选取交集
  const displayPosts = workerIds !== null
    ? sortedPosts.filter(p => workerIds.includes(p.id))
    : sortedPosts;
  const displayCount = workerIds !== null ? displayPosts.length : filteredPosts.length;

  return (
    <div className="posts-page">
      <div className="page-header">
        <h1>📋 面经列表</h1>
        <p className="page-desc">共 {displayCount} 条面经记录</p>
      </div>

      {/* 搜索和筛选栏 */}
      <div className="filter-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="搜索面经标题、内容、标签、作者..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          {inputValue && (
            <button className="clear-btn" onClick={() => { setInputValue(''); }}>✕</button>
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
                ? posts.length
                : posts.filter(p => p.category === cat.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* 面经列表 */}
      <div className="posts-grid">
        {displayPosts.length > 0 ? (
          displayPosts.map(post => (
            <PostCard key={post.id} post={post} onSelect={setSelectedPost} highlightQuery={highlightQuery} />
          ))
        ) : (
          <div className="empty-state">
            <span className="empty-icon">🔍</span>
            <p>没有找到匹配的面经</p>
            <button onClick={() => { setInputValue(''); setCategory('all'); }}>清除筛选</button>
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
