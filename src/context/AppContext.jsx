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
      return {
        ...state,
        posts: action.payload,
        filteredPosts: state.selectedCategory === 'all'
          ? action.payload
          : action.payload.filter(p => p.category === state.selectedCategory),
        loading: false,
        dashboardStats: computeStats(action.payload)
      };
    }
    case 'SET_CATEGORY': {
      const category = action.payload;
      const filtered = category === 'all'
        ? state.posts
        : state.posts.filter(p => p.category === category);
      return {
        ...state,
        selectedCategory: category,
        filteredPosts: filtered
      };
    }
    case 'SET_SEARCH': {
      const query = action.payload.toLowerCase();
      let filtered = state.posts;
      if (state.selectedCategory !== 'all') {
        filtered = filtered.filter(p => p.category === state.selectedCategory);
      }
      if (query) {
        filtered = filtered.filter(p =>
          p.title.toLowerCase().includes(query) ||
          (p.content || '').toLowerCase().includes(query) ||
          (p.tags || []).some(t => t.toLowerCase().includes(query)) ||
          p.author.toLowerCase().includes(query)
        );
      }
      return {
        ...state,
        searchQuery: action.payload,
        filteredPosts: filtered
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
        filteredPosts: state.filteredPosts.map(p =>
          p.id === id ? { ...p, status: newStatus } : p
        ),
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
        filteredPosts: state.filteredPosts.map(p =>
          p.id === id ? { ...p, priority } : p
        ),
        dashboardStats: computeStats(updatedPosts)
      };
    }
    case 'DELETE_POST': {
      const updatedPosts = state.posts.filter(p => p.id !== action.payload);
      return {
        ...state,
        posts: updatedPosts,
        filteredPosts: state.filteredPosts.filter(p => p.id !== action.payload),
        selectedPost: state.selectedPost?.id === action.payload ? null : state.selectedPost,
        dashboardStats: computeStats(updatedPosts)
      };
    }
    case 'ADD_POSTS': {
      // 合并去重
      const existingIds = new Set(state.posts.map(p => p.noteId || p.id));
      const newPosts = action.payload.filter(p => !existingIds.has(p.noteId || p.id));
      const merged = [...newPosts, ...state.posts];
      return {
        ...state,
        posts: merged,
        filteredPosts: merged,
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
    dispatch({ type: 'TOGGLE_STATUS', payload: { id, newStatus } });
    fetch(`${API_BASE}/posts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    }).catch(() => dispatch({ type: 'SET_ERROR', payload: '更新状态失败，请检查后端服务' }));
  }, [state.posts]);

  const setPriority = useCallback((id, priority) => {
    dispatch({ type: 'SET_PRIORITY', payload: { id, priority } });
    // 同步到数据库
    fetch(`${API_BASE}/posts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority })
    }).catch(() => dispatch({ type: 'SET_ERROR', payload: '更新优先级失败' }));
  }, []);

  const deletePost = useCallback((id) => {
    dispatch({ type: 'DELETE_POST', payload: id });
    // 从数据库删除
    fetch(`${API_BASE}/posts/${id}`, { method: 'DELETE' })
      .catch(() => dispatch({ type: 'SET_ERROR', payload: '删除失败' }));
  }, []);

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
