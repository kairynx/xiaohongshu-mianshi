import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { CATEGORIES } from '../constants';

const AppContext = createContext(null);
const API_BASE = '/api';

// 初始状态（空，从数据库加载）
const initialState = {
  posts: [],
  filteredPosts: [],
  selectedCategory: 'all',
  searchQuery: '',
  selectedPost: null,
  loading: true,
  error: null,
  dashboardStats: {
    total: 0,
    read: 0,
    unread: 0,
    highPriority: 0,
    byCategory: {
      frontend: 0,
      backend: 0,
      testdev: 0,
      mobile: 0,
      product: 0,
    },
    byCompany: {},
    byDate: {}
  }
};

// 纯函数：根据当前筛选条件过滤帖子
function applyFilters(posts, selectedCategory, searchQuery) {
  let result = posts;
  if (selectedCategory !== 'all') {
    result = result.filter(p => p.category === selectedCategory);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.content || '').toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q)) ||
      p.author.toLowerCase().includes(q)
    );
  }
  return result;
}

// 计算统计数据
function computeStats(posts) {
  const stats = {
    total: posts.length,
    read: posts.filter(p => p.status === 'read').length,
    unread: posts.filter(p => p.status === 'unread').length,
    highPriority: posts.filter(p => p.priority === 'high').length,
    byCategory: {
      frontend: posts.filter(p => p.category === 'frontend').length,
      backend: posts.filter(p => p.category === 'backend').length,
      testdev: posts.filter(p => p.category === 'testdev').length,
      mobile: posts.filter(p => p.category === 'mobile').length,
      product: posts.filter(p => p.category === 'product').length,
    },
    byCompany: {},
    byDate: {}
  };

  // 按公司统计
  posts.forEach(post => {
    const company = (post.tags && post.tags[0]) || '其他';
    stats.byCompany[company] = (stats.byCompany[company] || 0) + 1;
  });

  // 按日期统计
  posts.forEach(post => {
    stats.byDate[post.date] = (stats.byDate[post.date] || 0) + 1;
  });

  return stats;
}

// Reducer
function appReducer(state, action) {
  switch (action.type) {
    case 'SET_POSTS': {
      const posts = action.payload;
      return {
        ...state,
        posts,
        filteredPosts: applyFilters(posts, state.selectedCategory, state.searchQuery),
        loading: false,
        dashboardStats: computeStats(posts)
      };
    }
    case 'SET_CATEGORY': {
      const category = action.payload;
      return {
        ...state,
        selectedCategory: category,
        filteredPosts: applyFilters(state.posts, category, state.searchQuery)
      };
    }
    case 'SET_SEARCH': {
      return {
        ...state,
        searchQuery: action.payload,
        filteredPosts: applyFilters(state.posts, state.selectedCategory, action.payload)
      };
    }
    case 'SELECT_POST': {
      return {
        ...state,
        selectedPost: action.payload
      };
    }
    case 'TOGGLE_STATUS': {
      const { id, newStatus } = action.payload;
      const updatedPosts = state.posts.map(p =>
        p.id === id ? { ...p, status: newStatus } : p
      );
      return {
        ...state,
        posts: updatedPosts,
        filteredPosts: applyFilters(updatedPosts, state.selectedCategory, state.searchQuery),
        dashboardStats: computeStats(updatedPosts)
      };
    }
    case 'SET_PRIORITY': {
      const { id, priority } = action.payload;
      const updatedPosts = state.posts.map(p =>
        p.id === id ? { ...p, priority } : p
      );
      return {
        ...state,
        posts: updatedPosts,
        filteredPosts: applyFilters(updatedPosts, state.selectedCategory, state.searchQuery),
        dashboardStats: computeStats(updatedPosts)
      };
    }
    case 'UPDATE_POST_META': {
      const { id, meta } = action.payload;
      const updatedPosts = state.posts.map(p =>
        p.id === id ? { ...p, meta } : p
      );
      return {
        ...state,
        posts: updatedPosts,
        filteredPosts: applyFilters(updatedPosts, state.selectedCategory, state.searchQuery),
        dashboardStats: computeStats(updatedPosts)
      };
    }
    case 'DELETE_POST': {
      const updatedPosts = state.posts.filter(p => p.id !== action.payload);
      return {
        ...state,
        posts: updatedPosts,
        filteredPosts: applyFilters(updatedPosts, state.selectedCategory, state.searchQuery),
        selectedPost: state.selectedPost?.id === action.payload ? null : state.selectedPost,
        dashboardStats: computeStats(updatedPosts)
      };
    }
    case 'ADD_POSTS': {
      const existingIds = new Set(state.posts.map(p => p.noteId || p.id));
      const newPosts = action.payload.filter(p => !existingIds.has(p.noteId || p.id));
      const merged = [...newPosts, ...state.posts];
      return {
        ...state,
        posts: merged,
        filteredPosts: applyFilters(merged, state.selectedCategory, state.searchQuery),
        dashboardStats: computeStats(merged)
      };
    }
    case 'SET_ERROR': {
      return { ...state, error: action.payload };
    }
    case 'CLEAR_ERROR': {
      return { ...state, error: null };
    }
    case 'REFRESH_STATS': {
      return {
        ...state,
        dashboardStats: computeStats(state.posts)
      };
    }
    default:
      return state;
  }
}

// Provider
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const loadedRef = useRef(false);

  // 启动时从数据库加载帖子
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    fetch(`${API_BASE}/posts`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          dispatch({ type: 'SET_POSTS', payload: data.data });
        } else {
          dispatch({ type: 'SET_POSTS', payload: [] });
        }
      })
      .catch(() => {
        dispatch({ type: 'SET_POSTS', payload: [] });
      });
  }, []);

  const setCategory = useCallback((category) => {
    dispatch({ type: 'SET_CATEGORY', payload: category });
  }, []);

  const setSearch = useCallback((query) => {
    dispatch({ type: 'SET_SEARCH', payload: query });
  }, []);

  const selectPost = useCallback((post) => {
    dispatch({ type: 'SELECT_POST', payload: post });
  }, []);

  const toggleStatus = useCallback((id) => {
    const post = state.posts.find(p => p.id === id);
    if (!post) return;
    const newStatus = post.status === 'read' ? 'unread' : 'read';
    const prevPosts = state.posts;
    dispatch({ type: 'TOGGLE_STATUS', payload: { id, newStatus } });
    fetch(`${API_BASE}/posts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    }).then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); })
      .catch(() => {
        dispatch({ type: 'SET_POSTS', payload: prevPosts });
        dispatch({ type: 'SET_ERROR', payload: '更新状态失败，请检查后端服务' });
      });
  }, [state.posts]);

  const setPriority = useCallback((id, priority) => {
    const prevPosts = state.posts;
    dispatch({ type: 'SET_PRIORITY', payload: { id, priority } });
    fetch(`${API_BASE}/posts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority })
    }).then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); })
      .catch(() => {
        dispatch({ type: 'SET_POSTS', payload: prevPosts });
        dispatch({ type: 'SET_ERROR', payload: '更新优先级失败' });
      });
  }, [state.posts]);

  const updatePostMeta = useCallback((id, meta) => {
    dispatch({ type: 'UPDATE_POST_META', payload: { id, meta } });
  }, []);

  const deletePost = useCallback((id) => {
    const prevPosts = state.posts;
    dispatch({ type: 'DELETE_POST', payload: id });
    fetch(`${API_BASE}/posts/${id}`, { method: 'DELETE' })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); })
      .catch(() => {
        dispatch({ type: 'SET_POSTS', payload: prevPosts });
        dispatch({ type: 'SET_ERROR', payload: '删除失败' });
      });
  }, [state.posts]);

  const addPosts = useCallback((posts) => {
    dispatch({ type: 'ADD_POSTS', payload: posts });
    return fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(posts)
    }).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }).catch(err => {
      dispatch({ type: 'SET_ERROR', payload: '保存到数据库失败' });
      throw err;
    });
  }, []);

  const value = {
    ...state,
    categories: CATEGORIES,
    setCategory,
    setSearch,
    selectPost,
    toggleStatus,
    setPriority,
    updatePostMeta,
    deletePost,
    addPosts,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
