/** 全站骨架：左侧固定导航 + 顶部全局搜索 + 主内容（Outlet）。复刻 pages 原型布局。 */
import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client.ts';

const NAV = [
  { to: '/', label: '全部知识', icon: '📚', end: true },
  { to: '/tags', label: '标签', icon: '🏷️', end: false },
  { to: '/ask', label: '问答', icon: '💬', end: false },
  { to: '/settings', label: '设置', icon: '⚙️', end: false },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    api.stats().then((s) => setCount(s.knowledge)).catch(() => setCount(null));
  }, [location.key]);

  // 顶栏搜索框与 URL 中的 q 同步（在检索页显示当前 query）。
  useEffect(() => {
    if (location.pathname === '/search') {
      const params = new URLSearchParams(location.search);
      setQ(params.get('q') ?? '');
    }
  }, [location.pathname, location.search]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand"><span className="dot" /><span>项目知识库</span></div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="ic">{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
        <div className="sidebar-foot">
          本地优先 · 数据全在本机
          <br />
          {count === null ? '· · ·' : `共 ${count} 条知识`}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <form className="search" onSubmit={onSearch} role="search">
            <span className="si">🔍</span>
            <input
              type="text"
              aria-label="全局搜索"
              placeholder="用大白话搜，比如「上次那篇讲缓存击穿的」"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>
          <button className="btn btn-primary" onClick={() => navigate('/new')}>
            <span>＋</span>新增知识
          </button>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
