import { useState, useEffect, useRef } from 'react';
import { Loader, MessageCircle, Send, X } from 'lucide-react';
import { askQuestion } from '../utils/qaApi';
import './QADialog.css';

function renderMarkdown(text) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) return <h2 key={i}>{line.replace('## ', '')}</h2>;
    if (line.startsWith('### ')) return <h3 key={i}>{line.replace('### ', '')}</h3>;
    if (line.startsWith('- ')) return <li key={i}>{renderInline(line.replace('- ', ''))}</li>;
    if (line.trim() === '') return <br key={i} />;
    return <p key={i}>{renderInline(line)}</p>;
  });
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\])/g);
  return parts.map((part, j) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={j}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function QADialog({ initialQuestion, onClose }) {
  const [question, setQuestion] = useState(initialQuestion || '');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState([]);
  const [relatedTopics, setRelatedTopics] = useState([]);
  const [confidence, setConfidence] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
    if (initialQuestion) handleAsk(initialQuestion);
  }, []);

  const handleAsk = async (q) => {
    const query = (q || question).trim();
    if (!query) return;

    setLoading(true);
    setError('');
    setAnswer('');
    setCitations([]);
    setRelatedTopics([]);
    setConfidence(null);

    try {
      const data = await askQuestion(query);
      setAnswer(data.answer || '');
      setCitations(Array.isArray(data.citations) ? data.citations : []);
      setRelatedTopics(Array.isArray(data.related_topics) ? data.related_topics : []);
      setConfidence(typeof data.confidence === 'number' ? data.confidence : null);
    } catch (e) {
      setError(e.message || '问答失败');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAsk();
  };

  return (
    <div className="qa-overlay" onClick={onClose}>
      <div className="qa-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="qa-header">
          <h3><MessageCircle size={18} /> AI 问答</h3>
          <button className="qa-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="qa-input-row">
          <input
            ref={inputRef}
            type="text"
            placeholder="基于面经库提问，例如：字节前端一面常问啥？"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button className="qa-send-btn" onClick={() => handleAsk()} disabled={loading || !question.trim()}>
            <Send size={14} />
            发送
          </button>
        </div>

        <div className="qa-body">
          {loading && (
            <div className="qa-loading">
              <Loader className="spin" size={16} />
              AI 正在检索面经...
            </div>
          )}

          {error && <div className="qa-error">{error}</div>}

          {!loading && answer && (
            <div className="qa-answer">{renderMarkdown(answer)}</div>
          )}

          {!loading && !answer && !error && (
            <div className="qa-loading" style={{ color: '#94a3b8' }}>
              输入问题，AI 将在已抓取的面经中查找答案
            </div>
          )}
        </div>

        {(citations.length > 0 || relatedTopics.length > 0) && (
          <div className="qa-footer">
            {citations.length > 0 && (
              <div className="qa-citations">
                <h4>引用来源</h4>
                <div className="qa-citation-list">
                  {citations.map((cite) => (
                    <span key={`${cite.index}-${cite.postId}`} className="qa-citation-item">
                      [{cite.index}] {cite.title || cite.postId?.slice(0, 8)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {relatedTopics.length > 0 && (
              <div className="qa-topics">
                <h4>相关话题</h4>
                <div className="qa-topic-chips">
                  {relatedTopics.map((t) => (
                    <span key={t} className="qa-topic-chip">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {confidence !== null && (
              <div className="qa-confidence">
                置信度 <span className="badge">{Math.round(confidence * 100)}%</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
