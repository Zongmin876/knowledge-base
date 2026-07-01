import { describe, it, expect } from 'vitest';
import { memDb, StubProvider } from '../helpers.ts';
import type { Db } from '../../src/db.ts';
import { createKnowledge } from '../../src/services/knowledge.ts';
import { buildEmbeddings } from '../../src/services/embedding.ts';
import { buildGraph } from '../../src/services/graph.ts';

const stub = new StubProvider();

async function seed(db: Db) {
  const data = [
    { t: '缓存穿透', c: '缓存穿透用布隆过滤器拦截不存在的 key 缓存穿透。' },
    { t: '缓存击穿', c: '缓存击穿用互斥锁解决热点 key 失效缓存击穿。' },
    { t: '缓存雪崩', c: '缓存雪崩给过期时间加随机值缓存雪崩。' },
    { t: '红烧肉', c: '红烧肉需要五花肉冰糖酱油慢炖红烧肉做法。' },
  ];
  const ids: string[] = [];
  for (const d of data) {
    const id = createKnowledge(db, { title: d.t, content: d.c, source_type: 'note' });
    await buildEmbeddings(db, stub, id, d.c);
    ids.push(id);
  }
  return ids;
}

describe('关系图谱（阶段二③）', () => {
  it('节点对应知识、边来自向量相似且无向去重', async () => {
    const db = memDb();
    const ids = await seed(db);
    const g = buildGraph(db, { minRelevance: 0, edgesPerNode: 3 });
    // 4 个节点
    expect(g.nodes.length).toBe(4);
    expect(g.nodes.map((n) => n.id).sort()).toEqual([...ids].sort());
    // 边无向去重：不存在 (a,b) 与 (b,a) 同时出现
    const keys = g.edges.map((e) => (e.source < e.target ? `${e.source}|${e.target}` : `${e.target}|${e.source}`));
    expect(new Set(keys).size).toBe(keys.length);
    // 权重 0-100
    for (const e of g.edges) expect(e.weight).toBeGreaterThanOrEqual(0), expect(e.weight).toBeLessThanOrEqual(100);
    // degree 正确累计
    const byDegree = new Map(g.nodes.map((n) => [n.id, n.degree]));
    for (const e of g.edges) {
      expect(byDegree.get(e.source)).toBeGreaterThan(0);
    }
  });

  it('高阈值时缓存三兄弟相互连通、红烧肉相对孤立', async () => {
    const db = memDb();
    await seed(db);
    const g = buildGraph(db, { minRelevance: 60, edgesPerNode: 3 });
    const idByTitle = new Map(g.nodes.map((n) => [n.title, n.id]));
    const hong = idByTitle.get('红烧肉')!;
    const cacheIds = ['缓存穿透', '缓存击穿', '缓存雪崩'].map((t) => idByTitle.get(t)!);
    const hongDegree = g.nodes.find((n) => n.id === hong)!.degree;
    const cacheDegreeSum = cacheIds.reduce((s, id) => s + g.nodes.find((n) => n.id === id)!.degree, 0);
    // 缓存簇内部连边应明显多于红烧肉
    expect(cacheDegreeSum).toBeGreaterThan(hongDegree);
  });

  it('默认阈值下无关知识（红烧肉）不与缓存簇连边（issue #5）', async () => {
    const db = memDb();
    await seed(db);
    const g = buildGraph(db); // 默认 minRelevance=55
    const hong = g.nodes.find((n) => n.title === '红烧肉')!;
    expect(hong.degree).toBe(0);
  });

  it('空库返回空图不报错', () => {
    const db = memDb();
    const g = buildGraph(db);
    expect(g.nodes).toEqual([]);
    expect(g.edges).toEqual([]);
  });
});
