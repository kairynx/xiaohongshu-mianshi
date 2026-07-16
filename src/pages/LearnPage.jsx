import { useState } from 'react';
import { Loader, RefreshCw, Brain, ChevronRight } from 'lucide-react';
import { aggregateLearn } from '../utils/learnApi';
import './LearnPage.css';

export default function LearnPage() {
  const [goal, setGoal] = useState('');
  const [source, setSource] = useState('starred');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleAnalyze = async () => {
    const trimmed = goal.trim();
    if (!trimmed) {
      setError('请输入学习目标');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await aggregateLearn(trimmed, source);
      setResult(data);
    } catch (e) {
      setError(e.message || '分析失败');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAnalyze();
  };

  const maxCount = (ranking) => {
    if (!Array.isArray(ranking) || ranking.length === 0) return 1;
    return Math.max(...ranking.map(r => r.count || 0));
  };

  const barWidth = (count, max) => {
    const pct = max > 0 ? (count / max) * 100 : 0;
    return Math.max(pct, 8);
  };

  return (
    <div className="learn-page">
      <div className="page-header">
        <h1>学习路径</h1>
        <p className="page-desc">基于你收藏的面经，AI 分析知识点分布与学习路线</p>
      </div>

      <div className="learn-form">
        <div className="learn-goal-group">
          <label>学习目标</label>
          <input
            type="text"
            placeholder="例如：字节前端实习"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
        </div>
        <div className="learn-source-group">
          <label>
            <input type="radio" name="source" checked={source === 'starred'} onChange={() => setSource('starred')} />
            已收藏
          </label>
          <label>
            <input type="radio" name="source" checked={source === 'notes'} onChange={() => setSource('notes')} />
            有笔记
          </label>
          <label>
            <input type="radio" name="source" checked={source === 'all'} onChange={() => setSource('all')} />
            全部
          </label>
        </div>
        <button className="learn-btn" onClick={handleAnalyze} disabled={loading}>
          <Brain size={18} />
          开始分析
        </button>
      </div>

      {loading && (
        <div className="learn-loading">
          <Loader className="spin" size={18} />
          AI 正在分析知识点分布...
        </div>
      )}

      {error && (
        <div className="learn-error">
          <span>{error}</span>
          <button onClick={handleAnalyze}><RefreshCw size={16} /> 重试</button>
        </div>
      )}

      {!loading && !error && result && (
        <div className="learn-result">
          {result.topics_ranking.length > 0 ? (
            <>
              <div className="learn-section">
                <h3>知识点频次排行 {result.source && <span className="learn-source-tag">{result.source === 'llm' ? 'AI 分析' : '启发式统计'}</span>}</h3>
                <div className="ranking-list">
                  {result.topics_ranking.map((item) => (
                    <div key={item.topic} className="ranking-item">
                      <span className="ranking-label" title={item.topic}>{item.topic}</span>
                      <div className="ranking-bar-wrap">
                        <div
                          className={`ranking-bar-fill ${item.importance}`}
                          style={{ width: `${barWidth(item.count, maxCount(result.topics_ranking))}%` }}
                        >
                          {item.count}
                        </div>
                      </div>
                      <span className="ranking-badge">{item.difficulty}</span>
                    </div>
                  ))}
                </div>
              </div>

              {result.learning_path.length > 0 && (
                <div className="learn-section">
                  <h3>建议学习路径</h3>
                  <div className="path-list">
                    {result.learning_path.map((item) => (
                      <div key={`${item.order}-${item.topic}`} className="path-card">
                        <div className="path-order">{item.order}</div>
                        <div className="path-content">
                          <div className="path-topic">{item.topic}</div>
                          <div className="path-reason">{item.reason}</div>
                        </div>
                        <ChevronRight size={16} color="#cbd5e1" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="learn-section">
                <h3>薄弱方向</h3>
                {result.weak_areas.length > 0 ? (
                  <div className="weak-chips">
                    {result.weak_areas.map((area) => (
                      <span key={area} className="weak-chip">{area}</span>
                    ))}
                  </div>
                ) : (
                  <div className="weak-none">暂无明确的薄弱方向，继续保持!</div>
                )}
              </div>

              {result.summary && (
                <div className="learn-section">
                  <h3>AI 总结</h3>
                  <p className="learn-summary">{result.summary}</p>
                </div>
              )}

              <button className="learn-btn" onClick={handleAnalyze} style={{ alignSelf: 'flex-start' }}>
                <RefreshCw size={16} />
                重新分析
              </button>
            </>
          ) : (
            <div className="learn-empty">
              暂无数据。请先收藏一些面经，或选择其他来源重试。
            </div>
          )}
        </div>
      )}

      {!loading && !error && !result && (
        <div className="learn-empty">
          输入你的求职目标，选择面经来源，点击"开始分析"查看学习路径。
        </div>
      )}
    </div>
  );
}
