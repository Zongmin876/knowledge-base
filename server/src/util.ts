/** 通用工具：ID、哈希、向量运算。 */
import { randomUUID, createHash } from 'node:crypto';

export function genId(prefix = 'k'): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** 余弦相似度。维度不一致抛错（防向量库被污染，I-LLM-04 联动）。 */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`向量维度不一致: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * 余弦相似度映射到 0–100 相关度（U-SR-06）。
 * 文本嵌入的余弦几乎不为负且整体偏高：无关文本常有 0.3~0.5 的余弦。
 * 旧的 (sim+1)/2 线性映射会把无关文本抬到 50%+，导致图谱给无关知识连边（见 issue #5）。
 * 改为直接取 max(0,sim)×100：余弦即相关度，无关文本落到阈值以下，不再误连。
 */
export function toRelevance(sim: number): number {
  const clamped = Math.max(0, Math.min(1, sim));
  return Math.round(clamped * 100);
}
