import { buildIndex, search } from '../utils/searchIndex';

let index = null;

self.onmessage = (e) => {
  const { type, posts, query } = e.data;
  switch (type) {
    case 'BUILD_INDEX': {
      const result = buildIndex(posts);
      index = result.index;
      self.postMessage({ type: 'INDEX_READY', count: result.count, elapsed: result.elapsed });
      break;
    }
    case 'SEARCH': {
      if (!index || !query) {
        self.postMessage({ type: 'SEARCH_RESULT', query: query || '', ids: [] });
        return;
      }
      const ids = search(index, query);
      self.postMessage({ type: 'SEARCH_RESULT', query, ids });
      break;
    }
  }
};
