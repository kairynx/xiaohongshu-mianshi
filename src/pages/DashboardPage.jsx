import { useApp } from '../context/AppContext';
import { CATEGORY_COLORS, CATEGORY_NAMES_LIST, CATEGORY_KEYS } from '../constants';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { BookOpen, TrendingUp, Eye, Star, Target, Zap } from 'lucide-react';
import './DashboardPage.css';

export default function DashboardPage() {
  const { posts, dashboardStats } = useApp();

  // 分类数据
  const categoryData = CATEGORY_KEYS.map((key, i) => ({
    name: CATEGORY_NAMES_LIST[i],
    value: dashboardStats.byCategory[key],
    color: CATEGORY_COLORS[key]
  }));

  // 公司数据
  const companyData = Object.entries(dashboardStats.byCompany)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // 日期数据
  const dateData = Object.entries(dashboardStats.byDate)
    .map(([date, count]) => ({
      date: date.slice(5), // 只显示月-日
      count
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 优先级数据
  const priorityData = [
    { name: '高优先', value: posts.filter(p => p.priority === 'high').length },
    { name: '中优先', value: posts.filter(p => p.priority === 'medium').length },
    { name: '低优先', value: posts.filter(p => p.priority === 'low').length },
  ];

  // 阅读进度
  const readProgress = dashboardStats.total > 0
    ? Math.round((dashboardStats.read / dashboardStats.total) * 100)
    : 0;

  // 标签统计
  const tagStats = {};
  posts.forEach(post => {
    post.tags.forEach(tag => {
      tagStats[tag] = (tagStats[tag] || 0) + 1;
    });
  });
  const topTags = Object.entries(tagStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>📊 数据看板</h1>
        <p className="page-desc">面经数据统计与管理进度</p>
      </div>

      {/* 顶部统计卡片 */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: '#ede9fe' }}>
            <BookOpen size={22} color="#7c3aed" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{dashboardStats.total}</span>
            <span className="stat-card-label">面经总数</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: '#dbeafe' }}>
            <Eye size={22} color="#2563eb" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{dashboardStats.read}</span>
            <span className="stat-card-label">已阅读</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: '#fef3c7' }}>
            <TrendingUp size={22} color="#d97706" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{dashboardStats.unread}</span>
            <span className="stat-card-label">待阅读</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: '#fee2e2' }}>
            <Star size={22} color="#dc2626" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{dashboardStats.highPriority}</span>
            <span className="stat-card-label">高优先级</span>
          </div>
        </div>
      </div>

      {/* 阅读进度 */}
      <div className="progress-section">
        <div className="progress-header">
          <div className="progress-title">
            <Target size={18} />
            <span>阅读进度</span>
          </div>
          <span className="progress-percent">{readProgress}%</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${readProgress}%` }}
          />
        </div>
        <div className="progress-detail">
          <span>已阅读 {dashboardStats.read} 篇</span>
          <span>剩余 {dashboardStats.unread} 篇</span>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="charts-grid">
        {/* 分类分布饼图 */}
        <div className="chart-card">
          <h3 className="chart-title">📁 分类分布</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [`${value} 篇`, name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 公司分布柱状图 */}
        <div className="chart-card">
          <h3 className="chart-title">🏢 公司分布</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={companyData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => [`${value} 篇`, '面经数量']} />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 每日新增趋势 */}
        <div className="chart-card">
          <h3 className="chart-title">📈 每日新增趋势</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dateData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip formatter={(value) => [`${value} 篇`, '新增面经']} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#6366f1"
                fill="url(#colorGradient)"
                strokeWidth={2}
              />
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 优先级分布 */}
        <div className="chart-card">
          <h3 className="chart-title">⚡ 优先级分布</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={priorityData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                <Cell fill="#ef4444" />
                <Cell fill="#f59e0b" />
                <Cell fill="#6b7280" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 热门标签 */}
      <div className="chart-card">
        <h3 className="chart-title">🏷️ 热门标签 TOP 10</h3>
        <div className="tags-cloud">
          {topTags.map((tag, i) => (
            <span
              key={tag.name}
              className="tag-item"
              style={{
                fontSize: `${Math.max(14, 22 - i)}px`,
                opacity: Math.max(0.5, 1 - i * 0.05)
              }}
            >
              #{tag.name}
              <span className="tag-count">{tag.count}</span>
            </span>
          ))}
        </div>
      </div>

      {/* 分类详细数据 */}
      <div className="chart-card">
        <h3 className="chart-title">📋 分类详细数据</h3>
        <div className="category-table">
          <div className="table-header">
            <span>分类</span>
            <span>总数</span>
            <span>已读</span>
            <span>未读</span>
            <span>高优先</span>
            <span>阅读率</span>
          </div>
          {CATEGORY_KEYS.map((key, i) => {
            const catPosts = posts.filter(p => p.category === key);
            const read = catPosts.filter(p => p.status === 'read').length;
            const unread = catPosts.length - read;
            const high = catPosts.filter(p => p.priority === 'high').length;
            const rate = catPosts.length > 0 ? Math.round((read / catPosts.length) * 100) : 0;
            return (
              <div key={key} className="table-row">
                <span className="table-cat" style={{ color: CATEGORY_COLORS[key] }}>
                  {categoryData[i].name}
                </span>
                <span>{catPosts.length}</span>
                <span>{read}</span>
                <span>{unread}</span>
                <span>{high}</span>
                <span>
                  <div className="mini-progress">
                    <div className="mini-progress-fill" style={{ width: `${rate}%`, background: CATEGORY_COLORS[key] }} />
                    <span>{rate}%</span>
                  </div>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
