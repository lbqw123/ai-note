import React, { useState, useEffect, useRef } from 'react';
import { NoteProvider, useNoteStore, NoteView } from './store/noteStore';
import { TopNav } from './components/TopNav';
import { Sidebar } from './components/Sidebar';
import { NoteEditor } from './components/NoteEditor';
import { MindMapView } from './components/MindMapView';
import { KnowledgeGraphView } from './components/KnowledgeGraphView';
import { KnowledgeStarchainView } from './components/KnowledgeStarchainView';
import { AISettingsModal, syncAISettingsToLocalStorage } from './components/AISettingsModal';
import { AIAssistantPanel } from './components/AIAssistantPanel';
import { LinkParseModal } from './components/LinkParseModal';
import { AuthModal } from './components/AuthModal';
import { PasswordChangeModal } from './components/PasswordChangeModal';
import { supabase } from '../lib/supabase';
import './styles/app.css';

function AppContent() {
  const { activeView, setActiveView, isAISettingsOpen, isLinkParseOpen, isPasswordChangeOpen } = useNoteStore();
  const [darkMode, setDarkMode] = React.useState(() => {
    const saved = localStorage.getItem('theme');
    return saved !== 'light';
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // 检查认证状态
  useEffect(() => {
    const checkAuthStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);

      // 如果用户已登录，自动同步AI设置（后台静默执行）
      if (session) {
        syncAISettingsToLocalStorage(session.access_token);
      }
    };

    checkAuthStatus();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);
      // 用户登录时，自动同步AI设置
      if (session) {
        syncAISettingsToLocalStorage(session.access_token);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 登出函数
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('登出失败:', error);
    }
    setIsLoggedIn(false);
  };
  
  // 视图顺序
  const viewOrder: NoteView[] = ['note', 'mindmap', 'starchain', 'graph'];

  // 使用 ref 存储触摸位置
  const touchStartRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isSwipingRef = useRef(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);

  // 通知 App 层开始拖拽操作（由子组件调用）
  useEffect(() => {
    const handlePanningStart = () => { isPanningRef.current = true; };
    const handlePanningEnd = () => { isPanningRef.current = false; };

    window.addEventListener('graph-panning-start', handlePanningStart);
    window.addEventListener('graph-panning-end', handlePanningEnd);

    return () => {
      window.removeEventListener('graph-panning-start', handlePanningStart);
      window.removeEventListener('graph-panning-end', handlePanningEnd);
    };
  }, []);

  // 使用原生事件监听，在 capture 阶段捕获
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    // 只在底部区域响应滑动切换（移动端优化）
    const BOTTOM_SWIPE_AREA = 100; // 底部 100px 区域

    const handleTouchStart = (e: TouchEvent) => {
      // 多指触摸时不处理 swipe
      if (e.touches.length > 1) {
        isSwipingRef.current = false;
        return;
      }
      touchStartRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      isSwipingRef.current = true;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // 正在拖拽时不处理 swipe
      if (isPanningRef.current) {
        isSwipingRef.current = false;
        return;
      }
      if (!isSwipingRef.current) return;
      isSwipingRef.current = false;

      const touchEnd = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const windowHeight = window.innerHeight;
      
      // 只在底部区域响应滑动切换
      const isInBottomArea = touchEndY > windowHeight - BOTTOM_SWIPE_AREA;
      if (!isInBottomArea) return;

      const minSwipeDistance = 50;
      const swipeDistance = touchEnd - touchStartRef.current;
      
      if (Math.abs(swipeDistance) < minSwipeDistance) return;
      
      const currentIndex = viewOrder.indexOf(activeView);
      let newIndex;
      
      if (swipeDistance > 0) {
        newIndex = (currentIndex - 1 + viewOrder.length) % viewOrder.length;
      } else {
        newIndex = (currentIndex + 1) % viewOrder.length;
      }
      
      setActiveView(viewOrder[newIndex]);
    };
    
    // 使用 capture 阶段，确保在子组件处理之前捕获
    main.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
    main.addEventListener('touchend', handleTouchEnd, { capture: true, passive: true });
    
    return () => {
      main.removeEventListener('touchstart', handleTouchStart, { capture: true });
      main.removeEventListener('touchend', handleTouchEnd, { capture: true });
    };
  }, [activeView, setActiveView]);

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  return (
    <div 
            className="h-screen flex flex-col overflow-hidden"
            style={{ 
              background: darkMode ? '#0a0c15' : '#f5f5f5',
              color: darkMode ? '#e2e8f0' : '#1e293b'
            }}
          >
      <TopNav 
        darkMode={darkMode} 
        setDarkMode={setDarkMode} 
        isLoggedIn={isLoggedIn} 
        setShowAuthModal={() => setShowAuthModal(true)} 
        onLogout={handleLogout}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar darkMode={darkMode} />
        <main 
          ref={mainRef}
          className="flex-1 overflow-hidden flex flex-col relative"
        >
                {activeView === 'note' && <NoteEditor darkMode={darkMode} />}
                {activeView === 'mindmap' && <MindMapView darkMode={darkMode} />}
                {activeView === 'starchain' && <KnowledgeGraphView darkMode={darkMode} />}
                {activeView === 'graph' && <KnowledgeStarchainView darkMode={darkMode} />}
              {/* 底部滑动切换指示器 - 移动端 */}
              {/* 底部滑动切换区域 - 移动端（透明） */}
              <div 
                className="absolute bottom-0 left-0 right-0 h-16 z-50 md:hidden"
                style={{ 
                  background: 'transparent',
                  pointerEvents: 'none',
                }}
              />
              </main>
      </div>

      {/* Modals */}
      {isAISettingsOpen && <AISettingsModal darkMode={darkMode} />}
      {isLinkParseOpen && <LinkParseModal darkMode={darkMode} />}
      {isPasswordChangeOpen && <PasswordChangeModal darkMode={darkMode} isOpen={isPasswordChangeOpen} onClose={() => setPasswordChangeOpen(false)} />}
      <AIAssistantPanel darkMode={darkMode} />
      <AuthModal
        darkMode={darkMode}
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={async (email, password) => {
          setIsLoggedIn(true);
          setShowAuthModal(false);
        }}
        onRegister={async (email, password, username) => {
          setIsLoggedIn(true);
          setShowAuthModal(false);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <NoteProvider>
      <AppContent />
    </NoteProvider>
  );
}
