import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { useApp } from './context/AppContext';
import { useToast } from './components/Toast';
import HomePage from './pages/HomePage';
import PostsPage from './pages/PostsPage';
import CategoriesPage from './pages/CategoriesPage';
import DashboardPage from './pages/DashboardPage';
import CrawlPage from './pages/CrawlPage';
import './App.css';

function App() {
  const { error } = useApp();
  const addToast = useToast();

  useEffect(() => {
    if (error && addToast) {
      addToast(error, 'error');
    }
  }, [error, addToast]);

  return (
    <div className="app">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/posts" element={<PostsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/crawl" element={<CrawlPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
