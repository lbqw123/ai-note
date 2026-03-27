import React, { useState, useRef, useEffect } from 'react';
import { Search, Download, Map, Network, Brain, Settings, PanelLeftClose, PanelLeft, Link2, X, Sparkles, GitBranch, Sun, Moon } from 'lucide-react';
import { useNoteStore, NoteView } from '../store/noteStore';
import { AuthModal } from './AuthModal';

const NAV_VIEWS: { id: NoteView; label: string; icon: React.ReactNode }[] = [
  { id: 'note', label: '笔记', icon: <Brain size={14} /> },
  { id: 'mindmap', label: '思维导图', icon: <GitBranch size={14} /> },
  { id: 'starchain', label: '知识图谱', icon: <Network size={14} /> },
  { id: 'graph', label: '知识星图', icon: <Map size={14} /> },
];

interface TopNavProps {
  darkMode: boolean;
  setDarkMode: (darkMode: boolean) => void;
  isLoggedIn: boolean;
  setShowAuthModal: () => void;
  onLogout: () => void;
}

export function TopNav({ darkMode, setDarkMode, isLoggedIn, setShowAuthModal, onLogout }: TopNavProps) {
  const {
    notes, activeView, setActiveView,
    setSearchOpen, isSearchOpen, searchQuery, setSearchQuery,
    setAISettingsOpen, setLinkParseOpen, sidebarCollapsed, setSidebarCollapsed,
    setActiveNote, setPasswordChangeOpen,
  } = useNoteStore();
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [clearHovered, setClearHovered] = useState(false);
  const [resultHovered, setResultHovered] = useState(false);
  const [themeHovered, setThemeHovered] = useState(false);
  const [settingsHovered, setSettingsHovered] = useState(false);
  const [userHovered, setUserHovered] = useState(false);
  const [showAuthMenu, setShowAuthMenu] = useState(false);

  const results = searchQuery.trim()
    ? notes.filter(n =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  const handleExport = () => {
    const data = { notes, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notes-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="h-14 flex items-center px-4 gap-3 shrink-0 relative z-20 rounded-2xl"
      style={{
        background: darkMode ? 'rgba(10,11,20,0.95)' : 'rgba(234,227,245,0.95)',
        borderBottom: darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
        backdropFilter: 'blur(20px)'
      }}
    >
      {/* Sidebar toggle */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className="p-1.5 rounded-md transition-colors"
        style={{
          background: sidebarHovered ? (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)') : 'transparent',
          color: sidebarHovered ? (darkMode ? '#e2e8f0' : '#334155') : (darkMode ? '#94a3b8' : '#64748b'),
        }}
      >
        {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2 mr-2 hidden sm:flex">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #7c5af0, #22d3ee)' }}
        >
          <Sparkles size={14} className="text-white" />
        </div>
        <span 
          style={{ 
            fontSize: '0.875rem', 
            fontWeight: 600, 
            letterSpacing: '-0.01em',
            color: darkMode ? '#e2e8f0' : '#1e293b'
          }}
        >
          AI星链笔记
        </span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-[120px] relative sm:max-w-xs md:max-w-sm lg:max-w-md">
        <div
          className="flex items-center gap-2 px-3 h-8 rounded-xl transition-all"
          style={{
            background: searchFocused 
              ? 'rgba(124,90,240,0.12)' 
              : darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            border: `1px solid ${searchFocused ? 'rgba(124,90,240,0.4)' : darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          }}
        >
          <Search size={13} style={{ color: darkMode ? '#94a3b8' : '#64748b' }} className="shrink-0" />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            placeholder="搜索笔记..."
            className="bg-transparent outline-none flex-1 min-w-0"
            style={{ 
              fontSize: '0.8125rem',
              color: darkMode ? '#e2e8f0' : '#1e293b'
            }}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')} 
              onMouseEnter={() => setClearHovered(true)}
              onMouseLeave={() => setClearHovered(false)}
              style={{ 
                color: clearHovered ? (darkMode ? '#94a3b8' : '#64748b') : (darkMode ? '#64748b' : '#94a3b8')
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
        {/* Search dropdown */}
        {searchFocused && searchQuery && (
          <div
            className="absolute top-10 left-0 right-0 rounded-xl overflow-hidden z-50"
            style={{ 
              background: darkMode ? '#161929' : '#EAE3F5', 
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, 
              boxShadow: darkMode ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(0,0,0,0.1)'
            }}
          >
            {results.length > 0 ? results.map(note => (
              <button
                key={note.id}
                onClick={() => { setActiveNote(note.id); setSearchQuery(''); }}
                onMouseEnter={() => setResultHovered(true)}
                onMouseLeave={() => setResultHovered(false)}
                className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors"
                style={{
                  background: resultHovered ? (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : 'transparent',
                }}
              >
                <Brain size={14} className="mt-0.5 text-violet-400 shrink-0" />
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: darkMode ? '#e2e8f0' : '#1e293b' }}>{note.title}</div>
                  <div className="mt-0.5 line-clamp-1" style={{ fontSize: '0.75rem', color: darkMode ? '#94a3b8' : '#64748b' }}>
                    {note.content.replace(/[#*`>]/g, '').slice(0, 60)}...
                  </div>
                </div>
              </button>
            )) : (
              <div className="px-4 py-3 text-center" style={{ fontSize: '0.8125rem', color: darkMode ? '#94a3b8' : '#64748b' }}>无匹配结果</div>
            )}
          </div>
        )}
      </div>

      {/* View tabs */}
      <div
        className="hidden md:flex items-center gap-0.5 rounded-lg p-0.5"
        style={{ 
          background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', 
          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`
        }}
      >
        {NAV_VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all"
            style={{
              fontSize: '0.75rem',
              background: activeView === v.id ? 'rgba(124,90,240,0.25)' : 'transparent',
              color: activeView === v.id ? '#a78bfa' : (darkMode ? '#94a3b8' : '#64748b'),
              border: activeView === v.id ? '1px solid rgba(124,90,240,0.3)' : '1px solid transparent',
            }}
          >
            {v.icon}
            <span className="hidden lg:block">{v.label}</span>
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 ml-auto flex-shrink-0 w-fit">
        <button
          onClick={() => setLinkParseOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-sm hidden sm:flex"
          style={{ 
            background: 'linear-gradient(135deg, rgba(124,90,240,0.3), rgba(34,211,238,0.2))', 
            border: '1px solid rgba(124,90,240,0.4)', 
            color: '#c4b5fd'
          }}
        >
          <Link2 size={13} />
          <span style={{ fontSize: '0.75rem' }}>导入链接</span>
        </button>
        <button
          onClick={() => setLinkParseOpen(true)}
          className="p-2 rounded-lg transition-all sm:hidden"
          style={{ 
            background: 'linear-gradient(135deg, rgba(124,90,240,0.3), rgba(34,211,238,0.2))', 
            border: '1px solid rgba(124,90,240,0.4)', 
            color: '#c4b5fd'
          }}
          title="导入链接"
        >
          <Link2 size={13} />
        </button>
        <button
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? '切换到浅色主题' : '切换到深色主题'}
          onMouseEnter={() => setThemeHovered(true)}
          onMouseLeave={() => setThemeHovered(false)}
          className="p-2 rounded-lg transition-colors"
          style={{
            color: themeHovered ? (darkMode ? '#e2e8f0' : '#334155') : (darkMode ? '#94a3b8' : '#64748b'),
            background: themeHovered ? (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)') : 'transparent',
          }}
        >
          {darkMode ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <div className="relative">
          <button
            onClick={isLoggedIn ? () => setShowAuthMenu(!showAuthMenu) : setShowAuthModal}
            title={isLoggedIn ? '用户中心' : '登录/注册'}
            onMouseEnter={() => setUserHovered(true)}
            onMouseLeave={() => setUserHovered(false)}
            className="p-2 rounded-lg transition-colors"
            style={{
              color: userHovered ? (darkMode ? '#e2e8f0' : '#334155') : (darkMode ? '#94a3b8' : '#64748b'),
              background: userHovered ? (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)') : 'transparent',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </button>
          {isLoggedIn && showAuthMenu && (
            <div
              className="absolute right-0 mt-2 z-50 rounded-xl shadow-lg"
              style={{
                background: darkMode ? '#1a1e30' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                minWidth: '120px'
              }}
            >
              <button
                onClick={() => { setShowAuthMenu(false); setPasswordChangeOpen(true); }}
                className="w-full text-left px-4 py-2 text-sm transition-colors hover:bg-opacity-10 hover:bg-white/10 dark:hover:bg-black/10"
                style={{
                  color: darkMode ? '#e2e8f0' : '#1e293b',
                  background: 'transparent'
                }}
              >
                修改密码
              </button>
              <button
                onClick={onLogout}
                className="w-full text-left px-4 py-2 text-sm transition-colors hover:bg-opacity-10 hover:bg-white/10 dark:hover:bg-black/10"
                style={{
                  color: darkMode ? '#e2e8f0' : '#1e293b',
                  background: 'transparent'
                }}
              >
                登出
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => setAISettingsOpen(true)}
          title="AI设置"
          onMouseEnter={() => setSettingsHovered(true)}
          onMouseLeave={() => setSettingsHovered(false)}
          className="p-2 rounded-lg transition-colors"
          style={{
            color: settingsHovered ? (darkMode ? '#e2e8f0' : '#334155') : (darkMode ? '#94a3b8' : '#64748b'),
            background: settingsHovered ? (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)') : 'transparent',
          }}
        >
          <Settings size={15} />
        </button>
      </div>
    </div>
  );
}
