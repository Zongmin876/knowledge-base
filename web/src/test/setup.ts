import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// jsdom 无 IntersectionObserver：提供惰性桩，组件无限滚动逻辑不报错（测试走「加载更多」按钮路径）。
class IOStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal('IntersectionObserver', IOStub);

// scrollIntoView 在 jsdom 中缺失
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
