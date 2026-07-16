import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, FolderOpen, BarChart3, Globe, Sparkles, BookOpen, Brain, Target, Search, Send } from 'lucide-react';
import QADialog from './QADialog';
import './Sidebar.css';

export default function Sidebar() {
  const [showQA, setShowQA] = useState(false);
  const [qaInput, setQaInput] = useState('');

  const handleQASubmit = () => {
    if (!qaInput.trim()) return;
    setShowQA(true);
  };

  const handleQakeyDown = (e) => {
    if (e.key === 'Enter') handleQASubmit();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">面</div>
        <div className="logo-text">
          <h1>面经助手</h1>
          <span>小红书面经管理平台</span>
        </div>
      </div>

      <div className="sidebar-search">
        <Search size={16} className="sidebar-search-icon" />
        <input
          type="text"
          placeholder="问点什么？例如：字节前端一面常问啥？"
          value={qaInput}
          onChange={(e) => setQaInput(e.target.value)}
          onKeyDown={handleQakeyDown}
        />
        <button className="sidebar-search-btn" onClick={handleQASubmit} disabled={!qaInput.trim()}>
          <Send size={14} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={20} />
          <span>首页概览</span>
        </NavLink>
        <NavLink to="/posts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <FileText size={20} />
          <span>面经列表</span>
        </NavLink>
        <NavLink to="/categories" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <FolderOpen size={20} />
          <span>分类管理</span>
        </NavLink>
        <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <BarChart3 size={20} />
          <span>数据看板</span>
        </NavLink>
        <NavLink to="/agent" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Sparkles size={20} />
          <span>AI 助手</span>
        </NavLink>
        <NavLink to="/notes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <BookOpen size={20} />
          <span>我的学习</span>
        </NavLink>
        <NavLink to="/learn" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Brain size={20} />
          <span>学习路径</span>
        </NavLink>
        <NavLink to="/mock" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Target size={20} />
          <span>模拟面试</span>
        </NavLink>
        <NavLink to="/crawl" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Globe size={20} />
          <span>数据抓取</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="footer-info">
          <span>数据来源：小红书</span>
          <span>更新时间：最近一周</span>
        </div>
      </div>

      {showQA && (
        <QADialog
          initialQuestion={qaInput.trim()}
          onClose={() => { setShowQA(false); setQaInput(''); }}
        />
      )}
    </aside>
  );
}
