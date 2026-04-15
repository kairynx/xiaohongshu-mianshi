import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, FolderOpen, BarChart3, Globe } from 'lucide-react';
import './Sidebar.css';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">📕</div>
        <div className="logo-text">
          <h1>面经助手</h1>
          <span>小红书面经管理平台</span>
        </div>
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
        <NavLink to="/crawl" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Globe size={20} />
          <span>数据抓取</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="footer-info">
          <span>数据来源：小红书</span>
          <span>更新时间：近一周</span>
        </div>
      </div>
    </aside>
  );
}
