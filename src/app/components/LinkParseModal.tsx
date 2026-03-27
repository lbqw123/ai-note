import { useState, useRef, useEffect } from 'react';
import { X, Link2, Loader2, Check, Sparkles, Folder, FileText, Tag, AlertCircle } from 'lucide-react';
import { useNoteStore } from '../store/noteStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '../../lib/supabase';

const API_BASE_URL = '/api';

// 加密API密钥（用于未登录用户）
const encryptApiKey = (apiKey: string): { encrypted: string; iv: string } | null => {
  try {
    // 使用简单的XOR加密 + Base64编码
    // 注意：这不是强加密，只是为了防止明文存储和传输
    const key = 'AI_Notes_Secret_Key_2024!@#';
    const iv = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    let encrypted = '';
    for (let i = 0; i < apiKey.length; i++) {
      const charCode = apiKey.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      encrypted += String.fromCharCode(charCode);
    }
    
    return {
      encrypted: btoa(encrypted),
      iv: iv
    };
  } catch (e) {
    console.error('加密API密钥失败:', e);
    return null;
  }
};

const PLATFORMS = [
  { name: '豆包', pattern: /doubao\.com|doubao/, color: '#f59e0b' },
  { name: 'Kimi', pattern: /kimi\.ai|moonshot/, color: '#22d3ee' },
  { name: '通义千问', pattern: /qianwen|tongyi|dashscope/, color: '#a78bfa' },
];

type ParseStep = {
  id: string;
  label: string;
  detail: string;
  status: 'pending' | 'running' | 'done';
};

type ParseResult = {
  title: string;
  content: string;
  tags: string[];
  sourcePlatform: string;
  folder?: string;
  categoryPath?: string;
  isLocalParse?: boolean;
  mindmap?: any;
  mindmapMarkdown?: string;
  summary?: string;
};

function detectPlatform(url: string): string {
  for (const p of PLATFORMS) {
    if (p.pattern.test(url.toLowerCase())) return p.name;
  }
  if (url.includes('chat') || url.includes('ai')) return '通义千问';
  return '豆包';
}

function formatUrl(url: string): string {
  url = url.trim();
  if (!url) return url;
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  return url;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

interface LinkParseModalProps {
  darkMode: boolean;
}

export function LinkParseModal({ darkMode }: LinkParseModalProps) {
  const { setLinkParseOpen, createFolderStructure, importNote, notes, aiSettings } = useNoteStore();
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<'input' | 'parsing' | 'done' | 'error'>('input');
  const [steps, setSteps] = useState<ParseStep[]>([]);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [editedCategoryPath, setEditedCategoryPath] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 组件卸载时中止请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const PARSE_STEPS: ParseStep[] = [
    { id: 's1', label: '解析链接内容', detail: '获取页面对话数据...', status: 'pending' },
    { id: 's2', label: 'AI 分析内容', detail: '识别主题和知识类型...', status: 'pending' },
    { id: 's3', label: '智能分类', detail: '匹配最优知识分类...', status: 'pending' },
    { id: 's4', label: '创建文件夹', detail: '构建目录结构...', status: 'pending' },
    { id: 's5', label: '生成笔记', detail: '格式化内容并保存...', status: 'pending' },
  ];

  const handleParse = async () => {
    if (!url.trim()) return;
    
    const formattedUrl = formatUrl(url);
    
    if (!isValidUrl(formattedUrl)) {
      setError('请输入有效的URL地址');
      setPhase('error');
      return;
    }
    
    setPhase('parsing');
    setError(null);

    const stepsCopy = PARSE_STEPS.map(s => ({ ...s }));
    setSteps(stepsCopy);

    try {
      // 获取用户session token
      const { data: { session } } = await supabase.auth.getSession();
      
      // 构建请求头
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (session?.access_token) {
        // 已登录：传递Authorization token
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      // 从localStorage读取AI设置
      const savedAISettings = localStorage.getItem('ai_settings_v2');
      if (savedAISettings) {
        try {
          const settings = JSON.parse(savedAISettings);
          const selectedApi = settings.selectedApi || 'siliconflow';
          const keyToken = settings.keyTokens?.[selectedApi];
          const apiKey = settings.apiKeys?.[selectedApi];
          const model = settings.selectedModels?.[selectedApi];
          
          // 优先使用keyToken（登录用户从数据库获取）
          if (keyToken && session?.access_token) {
            headers['X-Key-Token'] = keyToken;
            headers['X-AI-Platform'] = selectedApi;
            headers['X-AI-Model'] = model || '';
            console.log('>>> [DEBUG] 使用keyToken（已登录用户）');
          }
          // 备选：使用apiKey（未登录用户 或 已登录但keyToken未保存）
          else if (apiKey) {
            const encrypted = encryptApiKey(apiKey);
            if (encrypted) {
              headers['X-Encrypted-API-Key'] = encrypted.encrypted;
              headers['X-API-Key-IV'] = encrypted.iv;
              headers['X-AI-Platform'] = selectedApi;
              headers['X-AI-Model'] = model || '';
              console.log('>>> [DEBUG] 使用加密API密钥（未登录或keyToken不存在）');
            }
          } else {
            console.log('>>> [DEBUG] 未配置AI设置，无法使用AI解析');
          }
        } catch (e) {
          console.error('解析localStorage AI设置失败:', e);
        }
      } else {
        console.log('>>> [DEBUG] localStorage中没有AI设置');
      }
      
      // 步骤1: 解析链接内容 - 调用后端接口
      stepsCopy[0].status = 'running';
      stepsCopy[0].detail = '正在获取页面内容...';
      setSteps([...stepsCopy]);
      
      // 调用后端API（使用新的解析接口，已扩展返回思维导图）
      abortControllerRef.current = new AbortController();
      const timeoutId = setTimeout(() => abortControllerRef.current?.abort(), 120000);
      
      const response = await fetch(`${API_BASE_URL}/parse-link-new`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: formattedUrl }),
        signal: abortControllerRef.current.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }
      
      const parseResult = await response.json();
      
      if (!parseResult.success || !parseResult.note) {
        setError(parseResult.error || '解析失败，请检查链接是否有效');
        setPhase('error');
        return;
      }
      
      stepsCopy[0].status = 'done';
      stepsCopy[0].detail = '链接内容解析完成';
      setSteps([...stepsCopy]);
      
      // 步骤2: AI分析内容
      stepsCopy[1].status = 'running';
      stepsCopy[1].detail = 'AI正在分析内容...';
      setSteps([...stepsCopy]);
      
      // 模拟AI分析过程
      await new Promise(r => setTimeout(r, 1000));
      
      stepsCopy[1].status = 'done';
      stepsCopy[1].detail = '内容分析完成';
      setSteps([...stepsCopy]);
      
      // 步骤3: 智能分类
      stepsCopy[2].status = 'running';
      stepsCopy[2].detail = '正在进行智能分类...';
      setSteps([...stepsCopy]);
      
      await new Promise(r => setTimeout(r, 600));
      
      stepsCopy[2].status = 'done';
      stepsCopy[2].detail = '分类完成';
      setSteps([...stepsCopy]);
      
      // 步骤4: 创建文件夹
      stepsCopy[3].status = 'running';
      stepsCopy[3].detail = '正在创建文件夹...';
      setSteps([...stepsCopy]);
      
      await new Promise(r => setTimeout(r, 400));
      
      stepsCopy[3].status = 'done';
      stepsCopy[3].detail = '文件夹创建完成';
      setSteps([...stepsCopy]);
      
      // 步骤5: 生成笔记
      stepsCopy[4].status = 'running';
      stepsCopy[4].detail = '正在生成笔记...';
      setSteps([...stepsCopy]);
      
      await new Promise(r => setTimeout(r, 500));
      
      stepsCopy[4].status = 'done';
      stepsCopy[4].detail = '笔记生成完成';
      setSteps([...stepsCopy]);
      
      // 更新状态
      setResult({
        title: parseResult.note.title,
        content: parseResult.note.content,
        tags: parseResult.note.tags,
        sourcePlatform: parseResult.note.sourcePlatform || detectPlatform(formattedUrl),
        folder: `AI笔记/${parseResult.note.sourcePlatform || detectPlatform(formattedUrl)}`,
        categoryPath: parseResult.category_path || '未分类',
        isLocalParse: parseResult.is_local_parse,
        mindmap: parseResult.mindmap,
        mindmapMarkdown: parseResult.mindmap_markdown,
        summary: parseResult.note.summary || ''
      });
      
      // 跳过直接添加，等待用户确认分类
      setPhase('done');
    } catch (err: any) {
      console.error('解析错误:', err);
      
      // 处理不同类型的错误
      let errorMessage = err.message || String(err);
      if (err.name === 'AbortError' || errorMessage.includes('aborted')) {
        errorMessage = '请求超时，请稍后重试。如果问题持续存在，请检查网络连接或更换AI模型。';
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage = '网络错误，请检查后端服务是否正常运行。';
      }
      
      setError(`解析失败: ${errorMessage}`);
      setPhase('error');
    }
  };

  const handleImport = () => {
    if (!result) return;
    setLinkParseOpen(false);
  };

  const platformColor = url ? PLATFORMS.find(p => p.pattern.test(url.toLowerCase()))?.color || '#7c5af0' : '#7c5af0';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) setLinkParseOpen(false); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ 
          background: darkMode ? '#111628' : '#f5f5f5', 
          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, 
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)'
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(124,90,240,0.4), rgba(34,211,238,0.3))' }}
            >
              <Link2 size={15} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '0.95rem', color: darkMode ? '#e2e8f0' : '#1e293b', fontWeight: 600 }}>AI 链接解析</h2>
              <p style={{ fontSize: '0.7rem', color: darkMode ? '#64748b' : '#94a3b8' }}>支持豆包、Kimi、通义千问等平台</p>
            </div>
          </div>
          <button
            onClick={() => setLinkParseOpen(false)}
            className="p-1.5 rounded-lg transition-colors hover:bg-opacity-8 hover:text-opacity-100"
            style={{
              color: darkMode ? '#64748b' : '#94a3b8',
              backgroundColor: 'transparent'
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          {phase === 'input' && (
            <div>
              <div className="relative mb-4">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Link2 size={15} style={{ color: darkMode ? '#64748b' : '#94a3b8' }} />
                </div>
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleParse(); }}
                  placeholder="粘贴 AI 对话分享链接..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl outline-none"
                  style={{
                    background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    color: darkMode ? '#e2e8f0' : '#1e293b',
                    fontSize: '0.85rem'
                  }} onFocus={(e) => {
                    e.target.style.color = darkMode ? '#e2e8f0' : '#1e293b';
                  }} onBlur={(e) => {
                    if (!e.target.value) {
                      e.target.style.color = darkMode ? '#64748b' : '#94a3b8';
                    }
                  }}
                />
              </div>

              <div className="flex gap-2 mb-6">
                {PLATFORMS.map(p => (
                  <div
                    key={p.name}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                    style={{ background: `${p.color}10`, border: `1px solid ${p.color}25` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                    <span style={{ fontSize: '0.7rem', color: p.color }}>{p.name}</span>
                  </div>
                ))}
              </div>

              <div
                className="px-4 py-3 rounded-xl mb-4"
                style={{ background: 'rgba(124,90,240,0.06)', border: '1px solid rgba(124,90,240,0.15)' }}
              >
                <div className="flex items-start gap-2">
                  <Sparkles size={13} style={{ color: '#7c5af0', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#a78bfa', fontWeight: 500, marginBottom: 4 }}>使用提示</div>
                    <div style={{ fontSize: '0.7rem', color: darkMode ? '#64748b' : '#94a3b8', lineHeight: 1.6 }}>
                      支持 http:// 或 https:// 开头的完整链接，也可以直接粘贴域名链接（自动添加 https://）
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleParse}
                disabled={!url.trim()}
                className="w-full py-3 rounded-xl transition-all"
                style={{
                  background: url.trim()
                    ? 'linear-gradient(135deg, rgba(124,90,240,0.4), rgba(34,211,238,0.2))'
                    : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                  border: `1px solid ${url.trim() ? 'rgba(124,90,240,0.4)' : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                  color: url.trim() ? '#c4b5fd' : (darkMode ? '#64748b' : '#94a3b8'),
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: !url.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                开始解析
              </button>
            </div>
          )}

          {(phase === 'parsing' || phase === 'done' || phase === 'error') && (
            <div>
              {phase !== 'done' && (
                <div className="space-y-3 mb-6">
                  {steps.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all"
                        style={{
                          background: step.status === 'done'
                            ? 'rgba(52,211,153,0.2)'
                            : step.status === 'running'
                            ? 'rgba(124,90,240,0.2)'
                            : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                          border: `1px solid ${step.status === 'done' ? 'rgba(52,211,153,0.4)' : step.status === 'running' ? 'rgba(124,90,240,0.4)' : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                        }}
                      >
                        {step.status === 'done' ? (
                          <Check size={12} style={{ color: '#34d399' }} />
                        ) : step.status === 'running' ? (
                          <Loader2 size={12} style={{ color: '#a78bfa' }} className="animate-spin" />
                        ) : (
                          <div className="w-2 h-2 rounded-full" style={{ background: darkMode ? '#2d3748' : '#e2e8f0' }} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div style={{
                          fontSize: '0.8rem',
                          color: step.status === 'done' ? (darkMode ? '#94a3b8' : '#64748b') : step.status === 'running' ? (darkMode ? '#e2e8f0' : '#1e293b') : (darkMode ? '#64748b' : '#94a3b8'),
                          fontWeight: step.status === 'running' ? 500 : 400,
                        }}>
                          {step.label}
                        </div>
                        {step.status === 'running' && (
                          <div style={{ fontSize: '0.7rem', color: '#7c5af0' }}>{step.detail}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {phase === 'done' && result && (
                <div className="space-y-4">
                  <div
                    className="rounded-xl p-4"
                    style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.2)' }}
                  >
                    <div style={{ fontSize: '0.7rem', color: '#34d399', marginBottom: 10, fontWeight: 500, letterSpacing: '0.05em' }}>
                      ✓ 解析完成
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText size={12} style={{ color: darkMode ? '#64748b' : '#94a3b8' }} className="shrink-0" />
                        <span style={{ fontSize: '0.8rem', color: darkMode ? '#e2e8f0' : '#1e293b', fontWeight: 500 }}>{result.title}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Tag size={12} style={{ color: darkMode ? '#64748b' : '#94a3b8' }} className="shrink-0" />
                        {result.tags.map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full"
                            style={{ fontSize: '0.65rem', background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)' }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div
                    className="rounded-xl p-4"
                    style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)' }}
                  >
                    <div style={{ fontSize: '0.7rem', color: '#a78bfa', marginBottom: 8, fontWeight: 500, letterSpacing: '0.05em' }}>
                      AI 推荐分类
                    </div>
                    {isEditingCategory ? (
                      <input
                        autoFocus
                        value={editedCategoryPath}
                        onChange={(e) => setEditedCategoryPath(e.target.value)}
                        placeholder="输入分类路径，如：公考/行测/言语理解/片段阅读"
                        className="w-full p-3 rounded-lg outline-none"
                        style={{
                          background: 'rgba(167,139,250,0.1)',
                          color: '#a78bfa',
                          fontSize: '0.85rem',
                          fontWeight: 500,
                          border: '1px solid rgba(167,139,250,0.3)',
                        }}
                      />
                    ) : (
                      <div className="p-3 rounded-lg" style={{ background: 'rgba(167,139,250,0.1)' }}>
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: '0.85rem', color: '#a78bfa', fontWeight: 500 }}>{result.categoryPath || '未分类'}</span>
                          {result.isLocalParse && (
                            <span 
                              className="px-1.5 py-0.5 rounded text-xs"
                              style={{ 
                                background: 'rgba(148, 163, 184, 0.1)', 
                                color: darkMode ? '#94a3b8' : '#64748b',
                                fontSize: '0.65rem',
                                border: `1px solid ${darkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)'}`
                              }}
                              title="使用本地关键词匹配识别"
                            >
                              本地识别
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {phase === 'error' && error && (
                <div
                  className="rounded-xl p-4 mb-4"
                  style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.2)' }}
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} style={{ color: '#f87171', marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#f87171', marginBottom: 4, fontWeight: 500 }}>解析失败</div>
                      <div style={{ fontSize: '0.7rem', color: darkMode ? '#64748b' : '#94a3b8', lineHeight: 1.6 }}>{error}</div>
                    </div>
                  </div>
                </div>
              )}

              {(phase === 'done' || phase === 'error') && (
                <div className="space-y-3">
                  {phase === 'done' && (
                    <>
                      <button
                        onClick={async () => {
                          if (isImporting || !result) return;
                          setIsImporting(true);
                          
                          // 接受分类（使用编辑后的路径或原始路径）
                          const finalCategoryPath = isEditingCategory ? editedCategoryPath : result.categoryPath;
                          
                          // 先关闭弹窗，防止重复点击
                          setLinkParseOpen(false);
                          
                          // 创建文件夹结构（需要await）
                          const folderId = await createFolderStructure(finalCategoryPath || '');
                          
                          // 使用importNote函数导入笔记（会自动同步到Supabase）
                          await importNote({
                            title: result.title,
                            content: result.content,
                            folderId: folderId,
                            tags: result.tags.length > 0 ? result.tags : ['未分类'],
                            sourceUrl: url,
                            sourcePlatform: result.sourcePlatform,
                            mindmap: result.mindmap || [],
                            mindmapMarkdown: result.mindmapMarkdown || result.content,
                            metadata: result.summary ? { summary: result.summary } : undefined
                          });
                        }}
                        disabled={isImporting}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all"
                        style={{
                          background: 'linear-gradient(135deg, rgba(124,90,240,0.4), rgba(34,211,238,0.2))',
                          border: '1px solid rgba(124,90,240,0.4)',
                          color: '#c4b5fd',
                          fontSize: '0.9rem',
                          fontWeight: 500,
                          opacity: isImporting ? 0.6 : 1,
                          cursor: isImporting ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <Check size={15} /> {isImporting ? '导入中...' : '接受分类'}
                      </button>
                      
                      <button
                        onClick={async () => {
                          if (isImporting || !result) return;
                          
                          // 手动修改分类
                          if (!isEditingCategory) {
                            // 切换到编辑模式
                            setEditedCategoryPath(result.categoryPath || '');
                            setIsEditingCategory(true);
                          } else {
                            // 已经在编辑模式，点击后接受编辑
                            setIsImporting(true);
                            
                            // 先关闭弹窗，防止重复点击
                            setLinkParseOpen(false);
                            
                            // 创建文件夹结构（需要await）
                            const folderId = await createFolderStructure(editedCategoryPath || '');
                            
                            // 使用importNote函数导入笔记（会自动同步到Supabase）
                            await importNote({
                              title: result.title,
                              content: result.content,
                              folderId: folderId,
                              tags: result.tags.length > 0 ? result.tags : ['未分类'],
                              sourceUrl: url,
                              sourcePlatform: result.sourcePlatform,
                              mindmap: result.mindmap || [],
                              mindmapMarkdown: result.mindmapMarkdown || result.content
                            });
                          }
                        }}
                        disabled={isImporting}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all"
                        style={{
                          background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                          color: darkMode ? '#e2e8f0' : '#1e293b',
                          fontSize: '0.9rem',
                          fontWeight: 500,
                          opacity: isImporting ? 0.6 : 1,
                          cursor: isImporting ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <Folder size={15} /> {isEditingCategory ? (isImporting ? '导入中...' : '确认修改') : '手动修改分类'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => { setPhase('input'); setUrl(''); setSteps([]); setError(null); }}
                    className="w-full py-3 rounded-xl transition-all"
                    style={{
                      background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                      color: darkMode ? '#64748b' : '#94a3b8',
                      fontSize: '0.85rem'
                    }}
                  >
                    重新解析
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}