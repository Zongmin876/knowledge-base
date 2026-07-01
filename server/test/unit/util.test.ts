import { describe, it, expect } from 'vitest';
import { toRelevance, cosine } from '../../src/util.ts';

describe('toRelevance 相关度映射（issue #5）', () => {
  it('低余弦（无关文本）落到远低于图谱默认阈值 55', () => {
    // 无关文本的余弦常在 0.3~0.5，映射后必须 < 55 才不会误连边
    expect(toRelevance(0.05)).toBeLessThan(55);
    expect(toRelevance(0.3)).toBeLessThan(55);
    expect(toRelevance(0.4)).toBeLessThan(55);
  });

  it('高余弦（相关文本）保持高相关度', () => {
    expect(toRelevance(0.7)).toBe(70);
    expect(toRelevance(0.9)).toBe(90);
  });

  it('结果恒在 0–100，负相关钳到 0', () => {
    expect(toRelevance(-0.5)).toBe(0);
    expect(toRelevance(1)).toBe(100);
    expect(toRelevance(1.5)).toBe(100);
  });
});

describe('cosine', () => {
  it('同向为 1、正交为 0', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it('维度不一致抛错', () => {
    expect(() => cosine([1, 0], [1])).toThrow();
  });
});
