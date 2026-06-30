/**
 * 知识关系图谱（阶段二③）。节点=知识，边=向量语义相似（≥阈值）。
 * 以每条知识的向量质心做两两余弦；为控制规模，节点上限取最近 N 条。
 */
import type { Db } from '../db.ts';
import { cosine, toRelevance } from '../util.ts';
import { loadAllEmbeddings } from './embedding.ts';

export interface GraphNode {
  id: string;
  title: string;
  tags: string[];
  degree: number;
}
export interface GraphEdge {
  source: string;
  target: string;
  weight: number; // 0-100 相关度
}
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** 计算每条知识的向量质心。 */
function centroids(db: Db, allowedIds: Set<string>): Map<string, number[]> {
  const rows = loadAllEmbeddings(db).filter((r) => allowedIds.has(r.knowledge_id));
  const acc = new Map<string, { sum: number[]; n: number }>();
  for (const r of rows) {
    const cur = acc.get(r.knowledge_id);
    if (!cur) acc.set(r.knowledge_id, { sum: [...r.vector], n: 1 });
    else if (cur.sum.length === r.vector.length) {
      for (let i = 0; i < cur.sum.length; i++) cur.sum[i] += r.vector[i];
      cur.n += 1;
    }
  }
  const out = new Map<string, number[]>();
  for (const [id, { sum, n }] of acc) out.set(id, sum.map((v) => v / n));
  return out;
}

export interface BuildGraphOpts {
  /** 节点上限（取最近 N 条），防 O(n²) 爆炸。 */
  limit?: number;
  /** 每节点最多保留的边数。 */
  edgesPerNode?: number;
  /** 边的最低相关度阈值（0-100）。 */
  minRelevance?: number;
}

export function buildGraph(db: Db, opts: BuildGraphOpts = {}): Graph {
  const limit = Math.min(500, Math.max(1, opts.limit ?? 120));
  const edgesPerNode = Math.max(1, opts.edgesPerNode ?? 4);
  const minRelevance = opts.minRelevance ?? 55;

  const rows = db
    .prepare(
      `SELECT id, title FROM knowledge WHERE deleted_at IS NULL
       ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .all(limit) as { id: string; title: string }[];
  const ids = rows.map((r) => r.id);
  const idSet = new Set(ids);
  const titleMap = new Map(rows.map((r) => [r.id, r.title]));

  const cents = centroids(db, idSet);
  const present = ids.filter((id) => cents.has(id));

  // 两两相似度，每节点取 top edgesPerNode 且 ≥ 阈值，无向去重。
  const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const edgeMap = new Map<string, GraphEdge>();
  const degree = new Map<string, number>();

  for (const a of present) {
    const va = cents.get(a)!;
    const scored: { id: string; rel: number }[] = [];
    for (const b of present) {
      if (a === b) continue;
      const vb = cents.get(b)!;
      if (vb.length !== va.length) continue;
      const rel = toRelevance(cosine(va, vb));
      if (rel >= minRelevance) scored.push({ id: b, rel });
    }
    scored.sort((x, y) => y.rel - x.rel);
    for (const s of scored.slice(0, edgesPerNode)) {
      const key = edgeKey(a, s.id);
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { source: a, target: s.id, weight: s.rel });
        degree.set(a, (degree.get(a) ?? 0) + 1);
        degree.set(s.id, (degree.get(s.id) ?? 0) + 1);
      }
    }
  }

  const tagRows = ids.length
    ? (db
        .prepare(
          `SELECT kt.knowledge_id AS kid, t.name AS name FROM knowledge_tags kt
           JOIN tags t ON t.id = kt.tag_id WHERE kt.knowledge_id IN (${ids.map(() => '?').join(',')})`,
        )
        .all(...ids) as { kid: string; name: string }[])
    : [];
  const tagsByK = new Map<string, string[]>();
  for (const r of tagRows) {
    const arr = tagsByK.get(r.kid) ?? [];
    arr.push(r.name);
    tagsByK.set(r.kid, arr);
  }

  const nodes: GraphNode[] = ids.map((id) => ({
    id,
    title: titleMap.get(id) ?? '',
    tags: tagsByK.get(id) ?? [],
    degree: degree.get(id) ?? 0,
  }));

  return { nodes, edges: Array.from(edgeMap.values()) };
}
