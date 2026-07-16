import { useState, useEffect, useCallback } from 'react';
import { Loader, RefreshCw, Target, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { newMockQuestion, gradeMockAnswer } from '../utils/mockApi';
import { getUserId } from '../hooks/useUserId';
import './MockPage.css';

function getDraftKey() {
  return `mock_draft_${getUserId()}`;
}

export default function MockPage() {
  const [goal, setGoal] = useState('');
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [practice, setPractice] = useState(null);
  const [answer, setAnswer] = useState('');
  const [showHints, setShowHints] = useState(false);
  const [gradeResult, setGradeResult] = useState(null);
  const [showReference, setShowReference] = useState(false);

  const clearDraft = () => localStorage.removeItem(getDraftKey());
  const saveDraft = (value) => {
    if (value) localStorage.setItem(getDraftKey(), value);
    else clearDraft();
  };

  useEffect(() => {
    const saved = localStorage.getItem(getDraftKey());
    if (saved) setAnswer(saved);
  }, []);

  useEffect(() => {
    saveDraft(answer);
  }, [answer]);

  const handleStart = async () => {
    const trimmed = goal.trim();
    if (!trimmed) {
      setError('请输入面试目标');
      return;
    }
    setError('');
    setPhase('loading');
    setShowHints(false);
    setGradeResult(null);
    setShowReference(false);
    try {
      const saved = localStorage.getItem(getDraftKey());
      setAnswer(saved || '');
      const data = await newMockQuestion(trimmed);
      setPractice(data);
      setPhase('answering');
    } catch (e) {
      setError(e.message || '出题失败');
      setPhase('idle');
    }
  };

  const handleSubmit = async () => {
    if (!answer.trim()) {
      setError('请先输入你的答案');
      return;
    }
    setError('');
    setPhase('grading');
    try {
      const data = await gradeMockAnswer(practice.practiceId, answer);
      setGradeResult(data);
      clearDraft();
      setPhase('result');
    } catch (e) {
      setError(e.message || '评分失败');
      setPhase('answering');
    }
  };

  const handleRetry = useCallback(async () => {
    if (!goal.trim()) return;
    setError('');
    setPhase('loading');
    setShowHints(false);
    setGradeResult(null);
    setShowReference(false);
    setAnswer('');
    clearDraft();
    try {
      const data = await newMockQuestion(goal.trim());
      setPractice(data);
      setPhase('answering');
    } catch (e) {
      setError(e.message || '出题失败');
      setPhase('idle');
    }
  }, [goal]);

  const formatScoreColor = (score) => {
    if (score >= 80) return '#16a34a';
    if (score >= 60) return '#6366f1';
    return '#dc2626';
  };

  return (
    <div className="mock-page">
      <div className="page-header">
        <h1>模拟面试</h1>
        <p className="page-desc">AI 出题官根据你的目标生成模拟面试题，答题后可获得评分和反馈</p>
      </div>

      {phase === 'idle' && (
        <div className="mock-idle">
          <Target size={48} color="#c7d2fe" />
          <p>输入你的求职目标，AI 将为你生成一道真实面试题。答题后由 AI 评分并给出改进建议。</p>
          <div className="mock-goal-group">
            <label>面试目标</label>
            <input
              type="text"
              placeholder="例如：字节前端实习"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); }}
            />
          </div>
          <button className="mock-btn" onClick={handleStart}>
            <Target size={18} />
            开始模拟
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <div className="mock-loading">
          <Loader className="spin" size={18} />
          AI 正在出题...
        </div>
      )}

      {error && (
        <div className="mock-error">
          <span>{error}</span>
          <button onClick={phase === 'idle' ? handleStart : handleRetry}>
            <RefreshCw size={16} /> 重试
          </button>
        </div>
      )}

      {(phase === 'answering' || phase === 'grading' || phase === 'result') && practice && (
        <>
          <div className="mock-card">
            <div className="mock-card-header">
              <span className="topic-chip">{practice.topic}</span>
              <span className={`difficulty-badge ${practice.difficulty}`}>{practice.difficulty}</span>
            </div>
            <div className="mock-question">{practice.question}</div>

            {Array.isArray(practice.hints) && practice.hints.length > 0 && (
              <>
                <button className="mock-hints-toggle" onClick={() => setShowHints(!showHints)}>
                  <Lightbulb size={14} />
                  {showHints ? '隐藏提示' : '查看提示'}
                  {showHints ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showHints && (
                  <div className="mock-hints">
                    <h4>提示</h4>
                    {practice.hints.map((hint, i) => (
                      <div key={i} className="mock-hint-item">{hint}</div>
                    ))}
                  </div>
                )}
              </>
            )}

            {phase === 'answering' && (
              <div className="mock-answer-area">
                <textarea
                  placeholder="在此输入你的答案..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={phase !== 'answering'}
                />
                <div className="mock-answer-actions">
                  <button className="mock-btn" onClick={handleSubmit} disabled={!answer.trim()}>
                    提交答题
                  </button>
                  <span className="draft-hint">草稿已自动保存</span>
                </div>
              </div>
            )}
          </div>

          {phase === 'grading' && (
            <div className="mock-loading">
              <Loader className="spin" size={18} />
              AI 正在评分，请稍候...
            </div>
          )}

          {phase === 'result' && gradeResult && (
            <div className="mock-result">
              <div className="mock-score-hero">
                <div>
                  <div className="mock-score-number" style={{ color: formatScoreColor(gradeResult.total_score) }}>
                    {gradeResult.total_score}
                  </div>
                  <div className="mock-score-label">总分 / 100</div>
                  <div className="mock-score-bar-wrap">
                    <div
                      className="mock-score-bar-fill"
                      style={{ width: `${gradeResult.total_score}%`, background: formatScoreColor(gradeResult.total_score) }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mock-verdict">{gradeResult.verdict}</div>
                </div>
              </div>

              {Array.isArray(gradeResult.dimension_scores) && gradeResult.dimension_scores.length > 0 && (
                <div className="mock-section">
                  <h3>各维度评分</h3>
                  <div className="dim-list">
                    {gradeResult.dimension_scores.map((dim, i) => (
                      <div key={i}>
                        <div className="dim-row">
                          <span className="dim-label">{dim.dimension}</span>
                          <div className="dim-bar-wrap">
                            <div
                              className="dim-bar-fill"
                              style={{ width: `${dim.max > 0 ? (dim.score / dim.max) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="dim-score">{dim.score}/{dim.max}</span>
                        </div>
                        {dim.comment && <div className="dim-comment">{dim.comment}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(gradeResult.strengths) && gradeResult.strengths.length > 0 && (
                <div className="mock-section">
                  <h3>亮点</h3>
                  <div className="chip-list">
                    {gradeResult.strengths.map((s, i) => (
                      <span key={i} className="chip-positive">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(gradeResult.improvements) && gradeResult.improvements.length > 0 && (
                <div className="mock-section">
                  <h3>改进建议</h3>
                  <div className="chip-list">
                    {gradeResult.improvements.map((s, i) => (
                      <span key={i} className="chip-improve">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(gradeResult.missing_points) && gradeResult.missing_points.length > 0 && (
                <div className="mock-section">
                  <h3>缺失点</h3>
                  <div className="chip-list">
                    {gradeResult.missing_points.map((s, i) => (
                      <span key={i} className="chip-missing">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {gradeResult.reference_answer && (
                <div className="mock-section">
                  <h3>
                    参考答案
                    <button
                      className="mock-btn secondary"
                      style={{ marginLeft: 12, padding: '4px 12px', fontSize: 12 }}
                      onClick={() => setShowReference(!showReference)}
                    >
                      {showReference ? '收起' : '展开'}
                    </button>
                  </h3>
                  {showReference && (
                    <div className="mock-reference">
                      {gradeResult.reference_answer.split('\n').map((line, i) => (
                        <p key={i} style={{ margin: '4px 0' }}>{line}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mock-actions">
                <button className="mock-btn" onClick={handleRetry}>
                  <RefreshCw size={16} />
                  再来一题
                </button>
                <button className="mock-btn secondary" onClick={() => { setPhase('idle'); setPractice(null); setGradeResult(null); setAnswer(''); }}>
                  返回首页
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
