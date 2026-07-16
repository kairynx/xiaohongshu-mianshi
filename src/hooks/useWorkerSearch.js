import { useState, useEffect, useRef, useCallback } from 'react';

export function useWorkerSearch(posts) {
  const [workerIds, setWorkerIds] = useState(null); // null = 无搜索
  const [highlightQuery, setHighlightQuery] = useState('');
  const [workerReady, setWorkerReady] = useState(false);
  const workerRef = useRef(null);
  const buildTimerRef = useRef(0);
  const searchTimerRef = useRef(0);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/searchWorker.js', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type } = e.data;
      if (type === 'INDEX_READY') {
        setWorkerReady(true);
        if (import.meta.env.DEV) {
          console.log(`[Worker] 索引构建完成: ${e.data.count} 条, 耗时 ${e.data.elapsed}ms`);
        }
      } else if (type === 'SEARCH_RESULT') {
        setWorkerIds(e.data.ids);
        setHighlightQuery(e.data.query);
      }
    };

    return () => worker.terminate();
  }, []);

  // posts 变化时 debounce 500ms 重建索引
  useEffect(() => {
    if (!workerRef.current || posts.length === 0) return;
    clearTimeout(buildTimerRef.current);
    buildTimerRef.current = setTimeout(() => {
      workerRef.current.postMessage({
        type: 'BUILD_INDEX',
        posts: posts.map(p => ({
          id: p.id,
          title: p.title,
          content: p.content || '',
          tags: p.tags || [],
          author: p.author,
        }))
      });
    }, 500);
    return () => clearTimeout(buildTimerRef.current);
  }, [posts]);

  const search = useCallback((query) => {
    if (!workerRef.current) return;
    clearTimeout(searchTimerRef.current);
    if (!query || !query.trim()) {
      setWorkerIds(null);
      setHighlightQuery('');
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      workerRef.current.postMessage({ type: 'SEARCH', query: query.trim() });
    }, 300);
  }, []);

  return { workerIds, highlightQuery, workerReady, search };
}
