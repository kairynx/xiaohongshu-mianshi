import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  AlertCircle,
  Brain,
  CheckCircle,
  Loader,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import './CrawlPage.css';
import './AgentPage.css';

const API_BASE = '/api';

function normalizeKeyword(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 100);
}

function uniqueKeywords(list) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    const keyword = normalizeKeyword(item);
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    out.push(keyword);
  }
  return out;
}

function getStrategyTone(strategy) {
  if (strategy === 'focused') return 'focused';
  if (strategy === 'broad') return 'broad';
  return 'mixed';
}

function getSourceTone(source) {
  return source === 'llm' ? 'llm' : 'fallback';
}

function getStepMeta(step) {
  if (step?.error) return { tone: 'error', icon: AlertCircle, label: '错误' };
  switch (step?.step) {
    case 'plan':
      return { tone: 'plan', icon: Sparkles, label: '计划' };
    case 'round':
      return { tone: 'round', icon: Search, label: '轮次' };
    case 'reflect':
      return { tone: 'reflect', icon: Brain, label: '反思' };
    case 'search':
    case 'batch':
    case 'save':
    case 'dedupe':
      return { tone: 'substep', icon: RefreshCw, label: '子步骤' };
    default:
      return { tone: 'info', icon: Wand2, label: '步骤' };
  }
}

export default function AgentPage() {
  useApp();
  const navigate = useNavigate();

  const [goal, setGoal] = useState('');
  const [maxRounds, setMaxRounds] = useState(3);
  const [plan, setPlan] = useState(null);
  const [planError, setPlanError] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [logs, setLogs] = useState([]);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState('idle');
  const [finalResult, setFinalResult] = useState(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);

  const eventSourceRef = useRef(null);
  const lastStepCountRef = useRef(0);

  const busy = isPlanning || isCrawling;
  const canStartSmart = !!plan?.keywords?.length && !busy;
  const canStartPlain = !!plan?.keywords?.length && !busy;

  const closeEventSource = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  useEffect(() => () => closeEventSource(), []);

  const appendLog = (entry) => {
    setLogs((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, ...entry }]);
  };

  const syncJobSteps = (job) => {
    if (!job || !Array.isArray(job.steps)) return;
    if (!jobId || job.id !== jobId) {
      lastStepCountRef.current = 0;
      setJobId(job.id || null);
    }

    const prevCount = lastStepCountRef.current;
    const nextSteps = job.steps.slice(prevCount);
    lastStepCountRef.current = job.steps.length;

    nextSteps.forEach((step) => {
      appendLog({
        time: step.time || new Date().toLocaleTimeString(),
        step: step.step || 'info',
        message: step.message || '',
        error: !!step.error,
      });
    });

    setJobStatus(job.status || 'pending');
    if (job.result) setFinalResult(job.result);
  };

  const refreshPosts = async () => {
    try {
      const res = await fetch(`${API_BASE}/posts`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        window.dispatchEvent(new CustomEvent('posts-updated', { detail: data.data }));
      }
    } catch {
      // no-op
    }
  };

  const openJobStream = (id) => {
    closeEventSource();
    lastStepCountRef.current = 0;

    const es = new EventSource(`${API_BASE}/agent/jobs/${id}/events`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type !== 'snapshot' && msg.type !== 'update') return;

      syncJobSteps(msg.job);

      if (msg.job?.status === 'done') {
        setIsCrawling(false);
        setJobStatus('done');
        setFinalResult(msg.job.result || null);
        closeEventSource();
        refreshPosts().finally(() => navigate('/posts'));
      }

      if (msg.job?.status === 'failed') {
        setIsCrawling(false);
        setJobStatus('failed');
        setFinalResult(msg.job.result || null);
        closeEventSource();
      }
    };

    es.onerror = () => {
      appendLog({
        time: new Date().toLocaleTimeString(),
        step: 'error',
        message: 'SSE 连接断开',
        error: true,
      });
      setIsCrawling(false);
      setJobStatus('failed');
      closeEventSource();
    };
  };

  const createJob = async (endpoint, body) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '请求失败');
    return data.data;
  };

  const handleGeneratePlan = async () => {
    const cleanGoal = goal.trim();
    if (!cleanGoal) {
      setPlanError('请输入一个目标岗位');
      return;
    }

    setIsPlanning(true);
    setPlanError('');
    try {
      const data = await createJob('/agent/plan', { goal: cleanGoal });
      setPlan({ ...data, keywords: uniqueKeywords(data.keywords || []) });
      setKeywordInput('');
    } catch (err) {
      setPlanError(err.message);
      setPlan(null);
    } finally {
      setIsPlanning(false);
    }
  };

  const startTracking = async (endpoint, body) => {
    setIsCrawling(true);
    setLogs([]);
    setFinalResult(null);
    setJobStatus('pending');

    try {
      const job = await createJob(endpoint, body);
      setJobId(job.id);
      appendLog({
        time: new Date().toLocaleTimeString(),
        step: 'info',
        message: `Job 已创建：${job.id}`,
      });
      openJobStream(job.id);
    } catch (err) {
      appendLog({
        time: new Date().toLocaleTimeString(),
        step: 'error',
        message: `提交失败：${err.message}`,
        error: true,
      });
      setJobStatus('failed');
      setIsCrawling(false);
      closeEventSource();
    }
  };

  const handleStartSmart = async () => {
    if (!canStartSmart) return;
    await startTracking('/agent/smart-jobs', {
      goal: goal.trim(),
      maxRounds,
    });
  };

  const handleStartPlain = async () => {
    const keywords = uniqueKeywords(plan?.keywords || []);
    if (keywords.length === 0 || busy) return;
    await startTracking('/agent/jobs', { keywords });
  };

  const handleAddKeyword = () => {
    if (!plan || busy) return;
    const next = normalizeKeyword(keywordInput);
    if (!next) return;
    setPlan((prev) => {
      if (!prev) return prev;
      return { ...prev, keywords: uniqueKeywords([...(prev.keywords || []), next]) };
    });
    setKeywordInput('');
  };

  const handleRemoveKeyword = (keyword) => {
    if (!plan || busy) return;
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        keywords: (prev.keywords || []).filter((item) => item !== keyword),
      };
    });
  };

  const summaryText = useMemo(() => {
    if (!finalResult) return '';
    if (typeof finalResult.rounds === 'number') {
      return `完成 - ${finalResult.rounds} 轮，共抓取 ${finalResult.totalCollected || 0} 条，最终决策：${finalResult.finalDecision || 'stop'}`;
    }
    if (typeof finalResult.saved === 'number') {
      return `完成 - 共抓取 ${finalResult.saved} 条`;
    }
    return '完成';
  }, [finalResult]);

  return (
    <div className="agent-page">
      <div className="agent-hero">
        <div>
          <div className="agent-eyebrow">
            <Sparkles size={16} />
            <span>Agent Workflow</span>
          </div>
          <h1>AI 智能抓取</h1>
          <p>输入求职目标，Agent 自动规划关键词、多轮抓取、反思调整。</p>
        </div>
        {jobStatus !== 'idle' && (
          <div className={`agent-status-badge ${jobStatus}`}>
            {jobStatus === 'running' ? '运行中' : jobStatus === 'done' ? '已完成' : jobStatus === 'failed' ? '失败' : '等待中'}
          </div>
        )}
      </div>

      <div className="agent-grid">
        <section className="agent-card">
          <div className="section-title">
            <Search size={18} />
            <span>目标输入</span>
          </div>
          <p className="section-desc">输入一句目标描述，Planner 会先生成可用于小红书搜索的关键词。</p>

          <textarea
            className="goal-input"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="字节跳动前端实习"
            rows={4}
            disabled={busy}
          />

          <div className="round-control">
            <label>
              <span>最大轮次</span>
              <strong>{maxRounds}</strong>
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={maxRounds}
              onChange={(e) => setMaxRounds(parseInt(e.target.value, 10))}
              disabled={busy}
            />
            <input
              type="number"
              min="1"
              max="5"
              value={maxRounds}
              onChange={(e) => {
                const next = Math.min(5, Math.max(1, parseInt(e.target.value || '3', 10)));
                setMaxRounds(Number.isNaN(next) ? 3 : next);
              }}
              disabled={busy}
            />
          </div>

          <button className="primary-btn" onClick={handleGeneratePlan} disabled={busy}>
            {isPlanning ? <Loader size={18} className="spin" /> : <Send size={18} />}
            生成计划
          </button>

          {planError && <div className="inline-error">{planError}</div>}
        </section>

        <section className="agent-card">
          <div className="section-title">
            <Sparkles size={18} />
            <span>计划预览</span>
          </div>
          <p className="section-desc">关键词由服务端 Planner 生成，此处编辑仅供预览确认。</p>

          {!plan ? (
            <div className="empty-panel">
              <Sparkles size={28} />
              <p>点击“生成计划”查看关键词策略</p>
            </div>
          ) : (
            <div className="plan-preview">
              <div className="plan-badges">
                <span className={`strategy-badge ${getStrategyTone(plan.strategy)}`}>{plan.strategy || 'mixed'}</span>
                <span className={`source-badge ${getSourceTone(plan.source)}`}>{plan.source === 'llm' ? 'llm' : 'fallback'}</span>
              </div>

              <p className="plan-reasoning">{plan.reasoning}</p>

              <div className="keyword-editor">
                <div className="keyword-chip-list">
                  {uniqueKeywords(plan.keywords || []).map((keyword) => (
                    <span key={keyword} className="editable-chip">
                      {keyword}
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(keyword)}
                        disabled={busy}
                        aria-label={`删除 ${keyword}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="keyword-add-row">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    placeholder="手动添加关键词"
                    disabled={busy}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddKeyword();
                      }
                    }}
                  />
                  <button type="button" className="ghost-btn" onClick={handleAddKeyword} disabled={busy}>
                    <Plus size={16} />
                    添加
                  </button>
                </div>
              </div>

              <div className="plan-actions">
                <button className="primary-btn" onClick={handleStartSmart} disabled={!canStartSmart}>
                  {isCrawling ? <Loader size={18} className="spin" /> : <Sparkles size={18} />}
                  开始智能抓取
                </button>
                <button className="secondary-btn" onClick={handleStartPlain} disabled={!canStartPlain}>
                  <Search size={18} />
                  仅按此关键词抓取（不启用 Reflector）
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="agent-card agent-log-card">
        <div className="section-title">
          <RefreshCw size={18} />
          <span>执行日志</span>
        </div>
        <p className="section-desc">实时展示计划、轮次、反思和抓取子步骤。</p>

        {summaryText && (
          <div className="result-banner">
            <CheckCircle size={16} />
            <span>{summaryText}</span>
          </div>
        )}

        {jobStatus === 'failed' && finalResult?.error && (
          <div className="fail-banner">
            <AlertCircle size={16} />
            <span>{finalResult.error}</span>
          </div>
        )}

        <div className="crawl-log">
          {logs.length === 0 ? (
            <div className="log-empty">
              <Wand2 size={32} />
              <p>生成计划后开始执行，日志会按时间顺序出现。</p>
            </div>
          ) : (
            logs.map((log) => {
              const meta = getStepMeta(log);
              const Icon = meta.icon;
              return (
                <div key={log.id} className={`log-item ${meta.tone} ${log.error ? 'error' : ''}`}>
                  <span className="log-time">{log.time}</span>
                  <span className="log-step">
                    <Icon size={14} />
                    {meta.label}
                  </span>
                  <span className={`log-message ${meta.tone === 'substep' ? 'subtle' : ''}`}>
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {jobId && (
          <div className="job-footnote">
            <span>Job ID</span>
            <code>{jobId}</code>
          </div>
        )}
      </section>
    </div>
  );
}
