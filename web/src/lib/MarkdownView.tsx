/**
 * 极简且安全的 Markdown 渲染（S-SEC-03 前端层防御）：
 * 全程构造 React 元素、绝不使用 dangerouslySetInnerHTML，从根上杜绝 XSS。
 * 支持：标题 / 无序列表 / 加粗 / 行内代码 / 段落 / 换行。可选高亮关键词（检索命中片段）。
 */
import { Fragment, type ReactNode } from 'react';

function renderInline(text: string, highlight?: string): ReactNode[] {
  // 先按 **bold** 与 `code` 切分；再对纯文本片段做高亮。
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  const pushText = (s: string) => {
    if (!s) return;
    if (highlight && highlight.trim()) {
      const terms = highlight.trim().split(/\s+/).filter((t) => t.length >= 1);
      const esc = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      if (esc) {
        const parts = s.split(new RegExp(`(${esc})`, 'gi'));
        parts.forEach((p) => {
          if (terms.some((t) => t.toLowerCase() === p.toLowerCase())) {
            nodes.push(<mark key={key++} className="hl">{p}</mark>);
          } else if (p) {
            nodes.push(<Fragment key={key++}>{p}</Fragment>);
          }
        });
        return;
      }
    }
    nodes.push(<Fragment key={key++}>{s}</Fragment>);
  };
  while ((m = regex.exec(text)) !== null) {
    pushText(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) nodes.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    else nodes.push(<code key={key++} className="md-code">{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  pushText(text.slice(last));
  return nodes;
}

export function MarkdownView({ content, highlight }: { content: string; highlight?: string }) {
  const lines = (content ?? '').split('\n');
  const blocks: ReactNode[] = [];
  let listBuf: string[] = [];
  let key = 0;
  const flushList = () => {
    if (listBuf.length) {
      blocks.push(
        <ul key={key++} className="md-ul">
          {listBuf.map((li, i) => (
            <li key={i}>{renderInline(li, highlight)}</li>
          ))}
        </ul>,
      );
      listBuf = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      listBuf.push(line.replace(/^\s*[-*]\s+/, ''));
      continue;
    }
    flushList();
    if (/^#{1,3}\s+/.test(line)) {
      const level = line.match(/^#+/)![0].length;
      const txt = line.replace(/^#+\s+/, '');
      const cls = `md-h${level}`;
      blocks.push(
        level === 1 ? <h2 key={key++} className={cls}>{renderInline(txt, highlight)}</h2>
        : level === 2 ? <h3 key={key++} className={cls}>{renderInline(txt, highlight)}</h3>
        : <h4 key={key++} className={cls}>{renderInline(txt, highlight)}</h4>,
      );
    } else if (line.trim() === '') {
      blocks.push(<div key={key++} className="md-gap" />);
    } else {
      blocks.push(<p key={key++} className="md-p">{renderInline(line, highlight)}</p>);
    }
  }
  flushList();
  return <div className="markdown">{blocks}</div>;
}
