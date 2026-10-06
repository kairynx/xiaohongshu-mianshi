import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Star, Sparkles } from 'lucide-react';
import { CATEGORY_COLORS } from '../constants';
import { fetchNote, saveNote } from '../utils/notesApi';
import { extractPost } from '../utils/agentApi';
import { useApp } from '../context/AppContext';
import './PostDetail.css';

export default function PostDetail({ post, onClose }) {
  const { updatePostMeta } = useApp();
  const [activeTab, setActiveTab] = useState('content');
  const [noteContent, setNoteContent] = useState('');
  const [starred, setStarred] = useState(false);
  const [noteLoaded, setNoteLoaded] = useState(false);
  const [metaState, setMetaState] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const saveTimer = useRef(null);
  const mountedRef = useRef(true);

  const localDraftKey = useMemo(() => (post ? `notes_${post.id}` : ''), [post]);

  const debouncedSave = useCallback((value) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveNote(post.id, { content: value });
        localStorage.removeItem(localDraftKey);
      } catch (e) {
        console.warn('[notes] save failed:', e.message);
      }
    }, 500);
  }, [post?.id, localDraftKey]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!post) return;
    let cancelled = false;
    setActiveTab('content');
    setNoteLoaded(false);
    setNoteContent('');
    setStarred(false);
    setMetaState(post?.meta || null);
    setExtracting(false);
    setExtractError('');

    const init = async () => {
      try {
        const note = await fetchNote(post.id);
        if (cancelled || !mountedRef.current) return;
        if (note) {
          setStarred(!!note.starred);
          if (typeof note.content === 'string' && note.content) {
            setNoteContent(note.content);
          } else {
            const draft = localStorage.getItem(localDraftKey) || '';
            if (draft) {
              setNoteContent(draft);
              saveNote(post.id, { content: draft }).catch((e) => console.warn('[notes] migrate draft failed:', e.message));
              localStorage.removeItem(localDraftKey);
            }
          }
        } else {
          const draft = localStorage.getItem(localDraftKey) || '';
          if (draft) {
            setNoteContent(draft);
            saveNote(post.id, { content: draft }).catch((e) => console.warn('[notes] migrate draft failed:', e.message));
            localStorage.removeItem(localDraftKey);
          }
        }
      } catch (e) {
        console.warn('[notes] load failed:', e.message);
        const draft = localStorage.getItem(localDraftKey) || '';
        if (draft) setNoteContent(draft);
      } finally {
        if (!cancelled && mountedRef.current) setNoteLoaded(true);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [post, localDraftKey]);

  useEffect(() => {
    if (!post || !noteLoaded) return;
    const draft = noteContent || '';
    if (draft === '') return;
    localStorage.setItem(localDraftKey, draft);
  }, [noteContent, noteLoaded, localDraftKey, post]);

  if (!post) return null;

  const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  };

  const renderContent = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      if (line.startsWith('### ')) return <h3 key={i} className="md-h3">{escapeHtml(line.replace('### ', ''))}</h3>;
      if (line.startsWith('## ')) return <h2 key={i} className="md-h2">{escapeHtml(line.replace('## ', ''))}</h2>;
      if (line.startsWith('- ')) return <li key={i} className="md-li">{escapeHtml(line.replace('- ', ''))}</li>;
      if (line.trim() === '') return <br key={i} />;
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={i} className="md-p">
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j}>{escapeHtml(part.slice(2, -2))}</strong>;
            }
            return escapeHtml(part);
          })}
        </p>
      );
    });
  };

  const meta = metaState;
  const classification = meta?.classification || null;
  const relevance = typeof post.relevance === 'number' ? post.relevance : null;
  const formatPercent = (value) => Math.round((Number(value) || 0) * 100);
  const toneForRelevance = (value) => {
    if (value >= 0.7) return 'high';
    if (value >= 0.4) return 'medium';
    return 'low';
  };
  const formatTime = (value) => {
    if (!value) return '未知';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('zh-CN', { hour12: false });
  };

  const renderChips = (items, emptyText, chipClassName = 'topic-chip') => {
    if (!Array.isArray(items) || items.length === 0) {
      return <div className="meta-empty">{emptyText}</div>;
    }
    return (
      <div className="meta-chip-list">
        {items.map((item, index) => (
          <span key={`${item}-${index}`} className={chipClassName}>{item}</span>
        ))}
      </div>
    );
  };

  const handleExtract = async () => {
    if (!post || extracting) return;
    setExtracting(true);
    setExtractError('');
    try {
      const meta = await extractPost(post.id);
      setMetaState(meta);
      updatePostMeta(post.id, meta);
    } catch (e) {
      setExtractError(e.message || '生成结构化失败');
    } finally {
      setExtracting(false);
    }
  };

  const toggleStarred = async () => {
    const next = !starred;
    setStarred(next);
    try {
      await saveNote(post.id, { starred: next });
    } catch (e) {
      console.warn('[notes] starred update failed:', e.message);
    }
  };

  const handleClose = () => {
    if (typeof onClose === 'function') {
      onClose({
        postId: post.id,
        starred,
        noteContent,
        post: {
          ...post,
          starred,
          meta: metaState,
        },
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <span
              className="category-badge"
              style={{ backgroundColor: CATEGORY_COLORS[post.category] + '20', color: CATEGORY_COLORS[post.category] }}
            >
              {post.categoryName}
            </span>
            <span className="post-date">{post.date}</span>
            <span className="post-source">📌 {post.source}</span>
            {relevance !== null && relevance >= 0 && (
              <span className={`relevance-badge ${toneForRelevance(relevance)}`} title={classification ? `目标：${classification.target_goal || '未知'}\n理由：${Array.isArray(classification.reasons) ? classification.reasons.join('；') : '无'}` : ''}>
                相关 · {formatPercent(relevance)}%
              </span>
            )}
            <button className={`star-btn ${starred ? 'active' : ''}`} onClick={toggleStarred} title={starred ? '取消收藏' : '收藏'}>
              <Star size={15} fill={starred ? '#fbbf24' : 'none'} />
            </button>
          </div>
          <button className="close-btn" onClick={handleClose}>✕</button>
        </div>

        <div className="modal-title-section">
          <h1 className="modal-title">{post.title}</h1>
          <div className="modal-author">
            <span className="avatar">{post.avatar}</span>
            <span className="author-name">{post.author}</span>
            <div className="modal-stats">
              <span>❤️ {post.likes}</span>
              <span>⭐ {post.collects}</span>
            </div>
          </div>
        </div>

        <div className="modal-tabs">
          <button className={`tab ${activeTab === 'content' ? 'active' : ''}`} onClick={() => setActiveTab('content')}>📑 面经内容</button>
          <button className={`tab ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>📋 我的笔记</button>
          <button className={`tab ${activeTab === 'meta' ? 'active' : ''}`} onClick={() => setActiveTab('meta')}>🧠 结构化</button>
        </div>

        <div className="modal-body">
          {activeTab === 'content' ? (
            <div className="content-view">{renderContent(post.content)}</div>
          ) : activeTab === 'notes' ? (
            <div className="notes-view">
              <textarea
                className="notes-textarea"
                placeholder="在这里记录你的学习笔记..."
                value={noteContent}
                onChange={(e) => {
                  const value = e.target.value;
                  setNoteContent(value);
                  debouncedSave(value);
                }}
              />
              <p className="notes-hint">💡 笔记已同步到云端</p>
            </div>
          ) : (
            <div className="meta-view">
              {!meta ? (
                <div className="meta-empty-state">
                  <Sparkles size={28} />
                  <p>该帖子还没有结构化分析，点击下方按钮用 AI 提取公司、岗位、面试题与知识点。</p>
                  <button className="extract-btn" onClick={handleExtract} disabled={extracting}>
                    {extracting ? '生成中...' : '生成结构化'}
                  </button>
                  {extractError && <div className="extract-error">{extractError}</div>}
                </div>
              ) : (
                <>
              <div className="meta-section">
                <h4 className="meta-section-title">基本信息</h4>
                <div className="meta-kv-row"><span className="meta-key">公司</span><span className="meta-value">{meta?.company || '未识别'}</span></div>
                <div className="meta-kv-row"><span className="meta-key">岗位</span><span className="meta-value">{meta?.role || '未识别'}</span></div>
                <div className="meta-kv-row"><span className="meta-key">阶段</span><span className="meta-value">{meta?.stage || '未知'}</span></div>
                <div className="meta-kv-row"><span className="meta-key">面试轮次</span><span className="meta-value">{Array.isArray(meta?.rounds) && meta.rounds.length > 0 ? meta.rounds.join('，') : '暂无'}</span></div>
                <div className="meta-kv-row">
                  <span className="meta-key">质量分</span>
                  <div className="meta-value quality-wrap">
                    <span>{formatPercent(meta?.quality_score || 0)}%</span>
                    <div className="quality-bar"><div className="quality-bar-fill" style={{ width: `${formatPercent(meta?.quality_score || 0)}%` }} /></div>
                  </div>
                </div>
              </div>

              <div className="meta-section">
                <h4 className="meta-section-title">涉及知识点</h4>
                {renderChips(meta?.topics, '暂无提取')}
              </div>

              <div className="meta-section">
                <h4 className="meta-section-title">AI 摘要</h4>
                <p className="meta-summary">{meta?.summary || '暂无摘要'}</p>
              </div>

              <div className="meta-section">
                <h4 className="meta-section-title">面试题列表</h4>
                {Array.isArray(meta?.questions) && meta.questions.length > 0 ? (
                  <div className="question-list">
                    {meta.questions.map((item, index) => (
                      <div key={`${item.question}-${index}`} className="question-card">
                        <div className="question-card-header">
                          <span className="topic-chip">{item.topic || '未分类'}</span>
                          <span className={`difficulty-badge ${item.difficulty || 'medium'}`}>{item.difficulty || 'medium'}</span>
                        </div>
                        <div className="question-card-body">{item.question}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="meta-empty">未提取到明确面试题</div>
                )}
              </div>

              {classification && (
                <div className="meta-section classification-section">
                  <h4 className="meta-section-title">相关度详情</h4>
                  <div className="meta-kv-row"><span className="meta-key">目标</span><span className="meta-value">{classification.target_goal || '未知'}</span></div>
                  <div className="meta-kv-row">
                    <span className="meta-key">综合分</span>
                    <div className="meta-value quality-wrap">
                      <span>{formatPercent(classification.relevance || 0)}%</span>
                      <div className="quality-bar"><div className="quality-bar-fill" style={{ width: `${formatPercent(classification.relevance || 0)}%` }} /></div>
                    </div>
                  </div>
                  <div className="score-list">
                    {[
                      ['company_match', '公司'],
                      ['role_match', '岗位'],
                      ['stage_match', '阶段'],
                      ['content_useful', '内容'],
                    ].map(([key, label]) => (
                      <div key={key} className="score-row">
                        <span className="meta-key">{label}</span>
                        <div className="score-bar"><div className="score-bar-fill" style={{ width: `${formatPercent(classification[key] || 0)}%` }} /></div>
                        <span className="score-value">{formatPercent(classification[key] || 0)}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="meta-kv-row"><span className="meta-key">匹配理由</span>{renderChips(classification.reasons, '暂无', 'match-chip')}</div>
                  <div className="meta-kv-row"><span className="meta-key">不匹配理由</span>{renderChips(classification.mismatched, '暂无', 'mismatch-chip')}</div>
                  <div className="meta-kv-row"><span className="meta-key">分类时间</span><span className="meta-value">{formatTime(classification.classified_at)}</span></div>
                </div>
              )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
