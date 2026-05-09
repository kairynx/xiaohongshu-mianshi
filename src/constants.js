export const CATEGORY_COLORS = {
  frontend: '#3b82f6',
  backend: '#10b981',
  testdev: '#f59e0b',
  mobile: '#ef4444',
  product: '#8b5cf6',
};

export const CATEGORY_BG_COLORS = {
  frontend: '#dbeafe',
  backend: '#d1fae5',
  testdev: '#fef3c7',
  mobile: '#fee2e2',
  product: '#ede9fe',
};

export const CATEGORY_NAMES = {
  frontend: '前端开发',
  backend: '后端开发',
  testdev: '测试开发',
  mobile: '移动端开发',
  product: '产品经理',
};

export const CATEGORY_KEYS = ['frontend', 'backend', 'testdev', 'mobile', 'product'];

export const CATEGORY_NAMES_LIST = CATEGORY_KEYS.map(k => CATEGORY_NAMES[k]);

export const CATEGORIES = [
  { key: 'all', label: '全部', icon: '📋', color: '#6366f1' },
  { key: 'frontend', label: '前端开发', icon: '🖥️', color: '#3b82f6' },
  { key: 'backend', label: '后端开发', icon: '⚙️', color: '#10b981' },
  { key: 'testdev', label: '测试开发', icon: '🧪', color: '#f59e0b' },
  { key: 'mobile', label: '移动端开发', icon: '📱', color: '#ef4444' },
  { key: 'product', label: '产品经理', icon: '📊', color: '#8b5cf6' },
];

export const CATEGORY_DETAILS = {
  frontend: { icon: '🖥️', label: '前端开发', color: '#3b82f6', description: 'React、Vue、JavaScript、CSS、浏览器原理等前端技术面试经验' },
  backend: { icon: '⚙️', label: '后端开发', color: '#10b981', description: 'Java、Go、Python、数据库、分布式系统等后端技术面试经验' },
  testdev: { icon: '🧪', label: '测试开发', color: '#f59e0b', description: '自动化测试、性能测试、安全测试、CI/CD等测试开发面试经验' },
  mobile: { icon: '📱', label: '移动端开发', color: '#ef4444', description: 'iOS、Android、Flutter、React Native等移动端面试经验' },
  product: { icon: '📊', label: '产品经理', color: '#8b5cf6', description: '产品设计、数据分析、用户研究、增长策略等产品面试经验' },
};

export const CATEGORY_KEYWORDS = {
  frontend: ['前端', 'fe', 'react', 'vue', 'javascript', 'css', 'html', 'web'],
  backend: ['后端', 'java', 'go', 'python', 'c++', '服务端', '后台', 'golang'],
  testdev: ['测试', '测开', 'qa', '自动化测试', 'selenium', '性能测试'],
  mobile: ['移动端', 'ios', 'android', 'flutter', 'react native', 'app', '客户端'],
  product: ['产品', 'pm', '产品经理', '产品设计', '用户研究'],
};
