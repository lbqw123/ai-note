import React, { useState } from 'react';
import { X, User, Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNoteStore } from '../store/noteStore';

interface AuthModalProps {
  darkMode: boolean;
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => void;
  onRegister: (email: string, password: string, username: string) => void;
}

export function AuthModal({ darkMode, isOpen, onClose, onLogin, onRegister }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (activeTab === 'login') {
        // 使用Supabase登录
        const { error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password
        });
        
        if (error) {
          throw error;
        }
        
        await onLogin(email, password);
      } else {
        // 使用Supabase注册
        const { error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              username: username
            }
          }
        });
        
        if (error) {
          throw error;
        }
        
        await onRegister(email, password, username);
      }
      // 成功后清空表单
      setEmail('');
      setPassword('');
      setUsername('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setResetSent(false);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        throw error;
      }

      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送重置邮件失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ 
        background: 'rgba(0,0,0,0.7)', 
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{ 
          background: darkMode ? '#111628' : '#F9F5FF', 
          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, 
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          zIndex: 1001,
          transform: 'translateY(0)',
          marginTop: '0px'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(124,90,240,0.4), rgba(34,211,238,0.3))' }}
            >
              <User size={15} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '0.95rem', color: darkMode ? '#e2e8f0' : '#1e293b', fontWeight: 600 }}>
                {activeTab === 'login' ? '欢迎回来' : '创建账号'}
              </h2>
              <p style={{ fontSize: '0.7rem', color: darkMode ? '#64748b' : '#94a3b8' }}>
                {activeTab === 'login' ? '登录以同步您的笔记' : '注册开始您的笔记之旅'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/10 dark:hover:bg-black/10"
            style={{ color: darkMode ? '#64748b' : '#94a3b8' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        {activeTab !== 'forgot' && (
          <div className="px-6 pt-4">
            <div
              className="flex rounded-xl p-1"
              style={{
                background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              }}
            >
              <button
                onClick={() => setActiveTab('login')}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: activeTab === 'login'
                    ? (darkMode ? 'rgba(124,90,240,0.3)' : 'rgba(124,90,240,0.15)')
                    : 'transparent',
                  color: activeTab === 'login'
                    ? '#a78bfa'
                    : (darkMode ? '#94a3b8' : '#64748b'),
                }}
              >
                登录
              </button>
              <button
                onClick={() => setActiveTab('register')}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: activeTab === 'register'
                    ? (darkMode ? 'rgba(124,90,240,0.3)' : 'rgba(124,90,240,0.15)')
                    : 'transparent',
                  color: activeTab === 'register'
                    ? '#a78bfa'
                    : (darkMode ? '#94a3b8' : '#64748b'),
                }}
              >
                注册
              </button>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={activeTab === 'forgot' ? handleForgotPassword : handleSubmit} className="p-6 space-y-4">
          {activeTab === 'register' && (
            <div>
              <label 
                style={{ 
                  fontSize: '0.75rem', 
                  color: darkMode ? '#94a3b8' : '#64748b', 
                  fontWeight: 500, 
                  display: 'block', 
                  marginBottom: 6 
                }}
              >
                用户名
              </label>
              <div className="relative">
                <User 
                  size={14} 
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: darkMode ? '#64748b' : '#94a3b8' }}
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl outline-none transition-all"
                  style={{
                    background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    color: darkMode ? '#e2e8f0' : '#1e293b',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label 
              style={{ 
                fontSize: '0.75rem', 
                color: darkMode ? '#94a3b8' : '#64748b', 
                fontWeight: 500, 
                display: 'block', 
                marginBottom: 6 
              }}
            >
              邮箱
            </label>
            <div className="relative">
              <Mail 
                size={14} 
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: darkMode ? '#64748b' : '#94a3b8' }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱地址"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl outline-none transition-all"
                style={{
                  background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  color: darkMode ? '#e2e8f0' : '#1e293b',
                  fontSize: '0.875rem',
                }}
              />
            </div>
          </div>

          <div>
            <label 
              style={{ 
                fontSize: '0.75rem', 
                color: darkMode ? '#94a3b8' : '#64748b', 
                fontWeight: 500, 
                display: 'block', 
                marginBottom: 6 
              }}
            >
              密码
            </label>
            <div className="relative">
              <Lock 
                size={14} 
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: darkMode ? '#64748b' : '#94a3b8' }}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
                minLength={6}
                className="w-full pl-10 pr-10 py-3 rounded-xl outline-none transition-all"
                style={{
                  background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  color: darkMode ? '#e2e8f0' : '#1e293b',
                  fontSize: '0.875rem',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
                style={{ color: darkMode ? '#64748b' : '#94a3b8' }}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <div 
              className="px-4 py-3 rounded-xl text-sm"
              style={{ 
                background: 'rgba(239,68,68,0.1)', 
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.2)'
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #7c5af0, #22d3ee)',
              color: '#ffffff',
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? (
              <div 
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
              />
            ) : (
              <>
                <Sparkles size={14} />
                {activeTab === 'login' ? '登录' : '注册'}
              </>
            )}
          </button>

          <div className="text-center pt-2">
            <span style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8' }}>
              {activeTab === 'login' ? '还没有账号？' : '已有账号？'}
            </span>
            <button
              type="button"
              onClick={() => {
                setActiveTab(activeTab === 'login' ? 'register' : 'login');
                setError('');
              }}
              className="ml-1 text-sm font-medium transition-colors"
              style={{ color: '#a78bfa' }}
            >
              {activeTab === 'login' ? '立即注册' : '立即登录'}
            </button>
            {activeTab === 'login' && (
              <>
                <span style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8' }} className="mx-1">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('forgot');
                    setError('');
                    setResetSent(false);
                  }}
                  className="text-sm font-medium transition-colors"
                  style={{ color: '#a78bfa' }}
                >
                  忘记密码
                </button>
              </>
            )}
          </div>
        </form>

        {activeTab === 'forgot' && (
          <div className="px-6 pb-6">
            <div className="text-center mb-4">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: darkMode ? '#e2e8f0' : '#1e293b', marginBottom: 8 }}>
                重置密码
              </h3>
              <p style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8' }}>
                输入您的注册邮箱，我们将发送重置链接
              </p>
            </div>

            {resetSent && (
              <div
                className="mb-4 p-4 rounded-xl text-sm text-center"
                style={{
                  background: 'rgba(34,197,94,0.1)',
                  color: '#22c55e',
                  border: '1px solid rgba(34,197,94,0.2)'
                }}
              >
                重置邮件已发送！请查收邮件并点击链接重置密码。
              </div>
            )}

            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: darkMode ? '#94a3b8' : '#64748b',
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: 6
                }}
              >
                邮箱
              </label>
              <div className="relative">
                <Mail
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: darkMode ? '#64748b' : '#94a3af' }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="请输入注册邮箱"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl outline-none transition-all"
                  style={{
                    background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    color: darkMode ? '#e2e8f0' : '#1e293b',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={isLoading}
              className="w-full mt-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #7c5af0, #22d3ee)',
                color: '#ffffff',
                opacity: isLoading ? 0.7 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                '发送重置链接'
              )}
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setError('');
                  setResetSent(false);
                }}
                className="text-sm font-medium transition-colors"
                style={{ color: '#a78bfa' }}
              >
                返回登录
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
