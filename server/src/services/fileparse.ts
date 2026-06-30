/**
 * 文件解析（U-ING-04/05/06/07）。
 * 支持 PDF / Word(docx) / Markdown(txt)。
 * - 损坏/加密文件返回明确错误而非崩溃（U-ING-07 / B-BND-06）。
 * - 仅接受内存 Buffer，不接受路径，从根上杜绝路径穿越越权读盘（S-SEC-06）。
 */
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import { config } from '../config.ts';
import { sanitizeContent } from './sanitize.ts';

export type FileKind = 'pdf' | 'docx' | 'markdown';

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export function detectKind(filename: string): FileKind {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'docx';
  if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt')) {
    return 'markdown';
  }
  throw new ParseError(`不支持的文件类型: ${filename}`);
}

export interface ParsedFile {
  title: string;
  content: string;
}

function baseTitle(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').trim() || '未命名文件';
}

/** 解析文件 Buffer 为文本。filename 仅用于类型判定与标题，不做任何文件系统访问。 */
export async function parseFile(filename: string, buffer: Buffer): Promise<ParsedFile> {
  if (!Buffer.isBuffer(buffer)) throw new ParseError('文件内容无效');
  if (buffer.length === 0) throw new ParseError('文件为空');
  if (buffer.length > config.maxUploadBytes) {
    throw new ParseError(
      `文件过大(${buffer.length} 字节)，上限 ${config.maxUploadBytes} 字节`,
    );
  }
  const kind = detectKind(filename);
  try {
    if (kind === 'markdown') {
      const text = buffer.toString('utf8');
      return { title: baseTitle(filename), content: sanitizeContent(text) };
    }
    if (kind === 'pdf') {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text: extracted } = await extractText(pdf, { mergePages: true });
      const text = (Array.isArray(extracted) ? extracted.join('\n') : extracted ?? '').trim();
      if (!text) throw new ParseError('PDF 无可抽取文本（可能为扫描件或加密）');
      return { title: baseTitle(filename), content: sanitizeContent(text) };
    }
    // docx
    const result = await mammoth.extractRawText({ buffer });
    const text = (result?.value ?? '').trim();
    if (!text) throw new ParseError('Word 文档无可抽取文本');
    return { title: baseTitle(filename), content: sanitizeContent(text) };
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(`解析失败(${kind}): ${(err as Error).message}`);
  }
}
