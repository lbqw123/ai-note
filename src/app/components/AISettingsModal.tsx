import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, Eye, EyeOff, Cpu, Key, Zap, ExternalLink, Shield, Database } from 'lucide-react';
import { useNoteStore, AIPlatform } from '../store/noteStore';
import { supabase } from '../../lib/supabase';

const API_BASE_URL = '/api';

type ApiType = 'siliconflow' | 'openrouter' | 'zhipuai' | 'modelscope';

interface ApiConfig {
  name: string;
  desc: string;
  url: string;
  signupUrl: string;
  defaultModel: string;
  models: { id: string; name: string; free?: boolean }[];
}

const API_CONFIGS: Record<ApiType, ApiConfig> = {
  siliconflow: {
    name: '硅基流动',
    desc: '国内高速AI平台',
    url: 'https://api.siliconflow.cn/v1/chat/completions',
    signupUrl: 'https://cloud.siliconflow.cn/i/W4tN0X1R',
    defaultModel: 'deepseek-ai/DeepSeek-V3',
    models: [
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3', free: true },
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek-R1', free: true },
      { id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B', name: 'DeepSeek-R1-Distill-Qwen-7B', free: true },
      { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen2.5-7B', free: true },
      { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5-72B', free: true },
      { id: 'Qwen/Qwen3-8B', name: 'Qwen3-8B', free: true },
      { id: 'THUDM/glm-4-9b-0414', name: 'GLM-4-9B', free: true },
      { id: 'THUDM/glm-4-9b-chat', name: 'GLM-4-9B-Chat', free: true },
      { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama-3.1-8B', free: true },
      { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama-3.3-70B', free: true },
    ],
  },
  openrouter: {
    name: 'OpenRouter',
    desc: '聚合多家AI提供商',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    signupUrl: 'https://openrouter.ai/',
    defaultModel: 'deepseek/deepseek-chat-v3-0324:free',
    models: [
      { id: 'stepfun/step-3.5-flash:free', name: 'Step-3.5-Flash (免费)', free: true },
      { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron-3-Super (免费)', free: true },
      { id: 'openrouter/hunter-alpha', name: 'Hunter-Alpha' },
      { id: 'arcee-ai/trinity-large-preview:free', name: 'Trinity-Large (免费)', free: true },
      { id: 'minimax/minimax-m2.5:free', name: 'MiniMax-M2.5 (免费)', free: true },
      { id: 'nvidia/nemotron-nano-12b-v2-vl:free', name: 'Nemotron-Nano-VL (免费)', free: true },
      { id: 'nvidia/llama-nemotron-embed-vl-1b-v2:free', name: 'Nemotron-Embed-VL (免费)', free: true },
      { id: 'liquid/lfm-2.5-1.2b-thinking:free', name: 'LFM-2.5-Thinking (免费)', free: true },
      { id: 'arcee-ai/trinity-mini:free', name: 'Trinity-Mini (免费)', free: true },
      { id: 'z-ai/glm-4.5-air:free', name: 'GLM-4.5-Air (免费)', free: true },
    ],
  },
  zhipuai: {
    name: '智谱GLM',
    desc: 'GLM系列大模型',
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    signupUrl: 'https://open.bigmodel.cn/',
    defaultModel: 'glm-4.7-Flash',
    models: [
      { id: 'glm-4.7-Flash', name: 'GLM-4.7-Flash', free: true },
      { id: 'glm-4.6V-Flash', name: 'GLM-4.6V-Flash', free: true },
      { id: 'glm-4.1V-Thinking-Flash', name: 'GLM-4.1V-Thinking-Flash', free: true },
      { id: 'glm-4-Flash-250414', name: 'GLM-4-Flash-250414' },
      { id: 'glm-4V-Flash', name: 'GLM-4V-Flash', free: true },
      { id: 'glm-4-flash', name: 'GLM-4-Flash', free: true },
    ],
  },
  modelscope: {
    name: '魔塔ModelScope',
    desc: '阿里云模型平台',
    url: 'https://api-inference.modelscope.cn/v1/chat/completions',
    signupUrl: 'https://modelscope.cn/',
    defaultModel: 'moonshotai/Kimi-K2.5',
    models: [
      { id: 'moonshotai/Kimi-K2.5', name: 'Kimi-K2.5', free: true },
      { id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B', name: 'DeepSeek-R1-Distill-Qwen-32B', free: true },
      { id: 'ZhipuAI/GLM-5', name: 'GLM-5', free: true },
      { id: 'ZhipuAI/GLM-4.6', name: 'GLM-4.6', free: true },
      { id: 'deepseek-ai/DeepSeek-V3.2', name: 'DeepSeek-V3.2', free: true },
      { id: 'MiniMax/M2.5-12B-Instruct', name: 'MiniMax-M2.5-12B', free: true },
    ],
  },
};

const LOCAL_STORAGE_KEY = 'ai_settings_v2';

// App启动时自动调用：只同步配置到localStorage，不保存实际密钥
export async function syncAISettingsToLocalStorage(accessToken: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${API_BASE_URL}/ai/settings/load`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.settings) {
        const parsed = data.settings;

        // 获取当前本地设置
        const currentSaved = localStorage.getItem(LOCAL_STORAGE_KEY);
        const currentParsed = currentSaved ? JSON.parse(currentSaved) : {};

        // 【重要】只同步配置信息，不保存实际密钥到localStorage
        // 密钥通过keyToken在请求时由后端使用，不暴露给前端
        const merged = {
          ...currentParsed,
          selectedApi: parsed.selectedApi || currentParsed.selectedApi,
          keyTokens: parsed.keyTokens || currentParsed.keyTokens, // 只保存keyToken
          selectedModels: parsed.selectedModels || currentParsed.selectedModels,
          cacheLocally: true,
          isLoggedIn: true,
          // 不保存 apiKeys - 登录用户使用keyToken机制
        };

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
        console.log('>>> [DEBUG] App启动：云端AI配置已同步到localStorage（密钥通过keyToken在后端使用）');
      }
    }
  } catch (e) {
    console.log('>>> [DEBUG] App启动：云端AI设置同步失败', e);
  }
}

interface AISettingsModalProps {
  darkMode: boolean;
}

export function AISettingsModal({ darkMode }: AISettingsModalProps) {
  const { setAISettingsOpen } = useNoteStore();
  const [selectedApi, setSelectedApi] = useState<ApiType>('siliconflow');
  const [apiKeys, setApiKeys] = useState<Record<ApiType, string>>({
    siliconflow: '',
    openrouter: '',
    zhipuai: '',
    modelscope: '',
  });
  const [selectedModels, setSelectedModels] = useState<Record<ApiType, string>>({
    siliconflow: API_CONFIGS.siliconflow.defaultModel,
    openrouter: API_CONFIGS.openrouter.defaultModel,
    zhipuai: API_CONFIGS.zhipuai.defaultModel,
    modelscope: API_CONFIGS.modelscope.defaultModel,
  });
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [cacheLocally, setCacheLocally] = useState(true); // 是否本地缓存密钥

  useEffect(() => {
    let isMounted = true;
    
    const loadSettings = async () => {
      // 先读取本地缓存设置偏好
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      let shouldCacheLocally = true;
      
      if (saved && isMounted) {
        try {
          const parsed = JSON.parse(saved);
          // 读取用户缓存偏好（默认true）
          if (parsed.cacheLocally !== undefined) {
            shouldCacheLocally = parsed.cacheLocally;
            setCacheLocally(shouldCacheLocally);
          }
          
          // 【本地优先策略】如果用户选择本地缓存，先从localStorage加载
          if (shouldCacheLocally) {
            if (parsed.selectedApi) setSelectedApi(parsed.selectedApi);
            if (parsed.apiKeys) setApiKeys(prev => ({ ...prev, ...parsed.apiKeys }));
            if (parsed.selectedModels) setSelectedModels(prev => ({ ...prev, ...parsed.selectedModels }));
            console.log('>>> [DEBUG] 从localStorage加载设置成功（本地优先）');
          }
        } catch (e) {
          console.error('解析localStorage失败:', e);
        }
      }
      
      // 如果用户已登录，在后台静默同步云端设置（不阻塞UI）
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && isMounted) {
        syncFromCloud(session.access_token, shouldCacheLocally);
      }
    };

    loadSettings();
  }, []);
  
  // 从云端同步设置（后台静默执行）
  const syncFromCloud = async (accessToken: string, shouldCacheLocally: boolean) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

      const response = await fetch(`${API_BASE_URL}/ai/settings/load`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          const parsed = data.settings;

          // 获取本地缓存（用于对比）
          const currentSaved = localStorage.getItem(LOCAL_STORAGE_KEY);
          const currentParsed = currentSaved ? JSON.parse(currentSaved) : {};

          if (shouldCacheLocally) {
            // 本地缓存模式：合并云端和本地设置
            // 【重要】云端优先，但如果云端返回空值，保留本地有效值
            setSelectedApi(prev => parsed.selectedApi || prev);
            setSelectedModels(prev => ({ ...prev, ...parsed.selectedModels }));

            // 只有云端返回了有效的 apiKeys 才覆盖本地
            const cloudHasApiKeys = parsed.apiKeys && Object.values(parsed.apiKeys).some(v => v && v.trim());
            if (cloudHasApiKeys) {
              setApiKeys(prev => ({ ...prev, ...parsed.apiKeys }));
            }

            // 更新localStorage缓存（云端优先，但保留本地 keyTokens）
            const merged = {
              ...currentParsed,
              selectedApi: parsed.selectedApi || currentParsed.selectedApi,
              apiKeys: cloudHasApiKeys ? parsed.apiKeys : (currentParsed.apiKeys || {}),
              keyTokens: parsed.keyTokens || currentParsed.keyTokens || {},
              selectedModels: { ...currentParsed.selectedModels, ...parsed.selectedModels },
              cacheLocally: true,
              isLoggedIn: true,
            };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
            console.log('>>> [DEBUG] 云端设置同步完成，已更新localStorage（保留本地keyTokens）');
          } else {
            // 仅云端模式：直接使用云端设置
            if (parsed.selectedApi) setSelectedApi(parsed.selectedApi);
            if (parsed.apiKeys) setApiKeys(parsed.apiKeys);
            if (parsed.selectedModels) setSelectedModels(parsed.selectedModels);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
              selectedApi: parsed.selectedApi,
              selectedModels: parsed.selectedModels,
              cacheLocally: false
            }));
          }
          console.log('>>> [DEBUG] 云端设置同步完成');
        }
      }
    } catch (e) {
      // 静默失败，不影响用户使用
      console.log('>>> [DEBUG] 云端同步失败（使用本地设置）:', e);
    }
  };

  const handlePlatformChange = (api: ApiType) => {
    setSelectedApi(api);
    setTestResult(null);
    setTestMessage('');
  };

  const handleModelChange = (model: string) => {
    setSelectedModels(prev => ({ ...prev, [selectedApi]: model }));
  };

  const handleApiKeyChange = (key: string) => {
    setApiKeys(prev => ({ ...prev, [selectedApi]: key }));
    setTestResult(null);
    setTestMessage('');
  };

  const handleTest = async () => {
    const apiKey = apiKeys[selectedApi];
    const model = selectedModels[selectedApi];
    
    if (!apiKey.trim()) {
      setTestResult('error');
      setTestMessage('请输入API密钥');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setTestMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/test-api-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: selectedApi,
          api_key: apiKey.trim(),
          model: model,
        }),
      });
      const data = await response.json();
      
      if (data.success) {
        setTestResult('success');
        setTestMessage('连接成功！API密钥有效');
      } else {
        setTestResult('error');
        setTestMessage(data.error || '连接失败，请检查API密钥');
      }
    } catch (error: any) {
      console.error('测试连接失败:', error);
      setTestResult('error');
      setTestMessage(error.message || '网络错误，请检查后端服务');
    }
    
    setTesting(false);
    setTimeout(() => {
      setTestResult(null);
      setTestMessage('');
    }, 2000);
  };

  const handleSave = async () => {
    console.log('>>> [DEBUG] 开始保存AI设置');
    const startTime = Date.now();
    
    // 获取用户session
    const { data: { session } } = await supabase.auth.getSession();
    
    // 准备保存的设置
    const keyTokens: Record<ApiType, string> = { siliconflow: '', openrouter: '', zhipuai: '', modelscope: '' };
    
    // 如果用户已登录，保存API密钥到后端
    if (session?.user) {
      try {
        // 并行保存所有平台的API密钥（带超时）
        const saveKeyPromises = Object.entries(apiKeys)
          .filter(([_, apiKey]) => apiKey.trim())
          .map(async ([platform, apiKey]) => {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时
              
              const response = await fetch(`${API_BASE_URL}/ai/key/save`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                  platform,
                  api_key: apiKey,
                  model: selectedModels[platform as ApiType]
                }),
                signal: controller.signal
              });
              
              clearTimeout(timeoutId);
              
              if (response.ok) {
                const data = await response.json();
                return { platform, token: data.key_token };
              } else {
                console.error(`保存${platform} API密钥失败:`, await response.text());
                return null;
              }
            } catch (error) {
              console.error(`保存${platform} API密钥出错:`, error);
              return null;
            }
          });
        
        // 等待所有密钥保存完成
        const results = await Promise.all(saveKeyPromises);
        results.forEach(result => {
          if (result) {
            keyTokens[result.platform as ApiType] = result.token;
          }
        });
        
        console.log('>>> [DEBUG] API密钥保存完成，耗时:', Date.now() - startTime, 'ms');
        
        // 构建设置对象（包含apiKeys，用于本地和云端同步）
        const settingsToSave = {
          selectedApi,
          keyTokens,
          selectedModels,
        };
        
        // 【安全修复】根据用户登录状态决定存储方式
        if (session?.user) {
          // 登录用户：优先保存到云端，但如果云端保存失败（keyTokens为空），则保存到localStorage作为备用
          // 这样可以确保即使云端同步失败，用户仍然可以使用API密钥
          const hasKeyTokens = Object.values(keyTokens).some(t => t && t.trim());
          
          if (hasKeyTokens) {
            // 云端保存成功：只保存配置到localStorage（不保存实际密钥）
            const localStorageSettings = {
              selectedApi,
              apiKeys: { siliconflow: '', openrouter: '', zhipuai: '', modelscope: '' },
              keyTokens,
              selectedModels,
              cacheLocally: true,
              isLoggedIn: true,
            };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localStorageSettings));
            console.log('>>> [DEBUG] 已保存到localStorage（云端同步成功，keyTokens已保存）');
          } else {
            // 云端保存失败（keyTokens为空）：保存到localStorage作为备用
            // 【安全提醒】这是备用方案，密钥会保存在本地
            const localStorageSettings = {
              selectedApi,
              apiKeys, // 使用实际密钥
              keyTokens: {},
              selectedModels,
              cacheLocally: true,
              isLoggedIn: true,
              keySaveFailed: true, // 标记云端保存失败
            };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localStorageSettings));
            console.log('>>> [DEBUG] 已保存到localStorage（云端同步失败，使用本地备用）');
          }
        } else {
          // 未登录用户：保存在localStorage（加密）
          const localStorageSettings = {
            selectedApi,
            apiKeys, // 包含实际API密钥（未登录用户只能用这个）
            keyTokens: {},
            selectedModels,
            cacheLocally: true,
            isLoggedIn: false,
          };
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localStorageSettings));
          console.log('>>> [DEBUG] 已保存到localStorage（未登录用户，密钥本地存储）');
        }
        
        // 同步到Supabase（仅存储配置信息，不包含apiKeys）- 使用upsert优化
        try {
          const settingsJson = JSON.stringify(settingsToSave);
          console.log('>>> [DEBUG] 准备同步到Supabase');
          
          // 使用upsert：存在则更新，不存在则插入（单次操作）
          const { error: upsertError } = await supabase
            .from('ai_settings')
            .upsert({
              user_id: session.user.id,
              settings_json: settingsJson,
              platform: settingsToSave.selectedApi,
              model: settingsToSave.selectedModels[settingsToSave.selectedApi],
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            });
          
          if (upsertError) {
            console.error('Supabase upsert失败:', upsertError);
          } else {
            console.log('>>> [DEBUG] Supabase同步成功');
          }
        } catch (error) {
          console.error('同步AI设置到Supabase失败:', error);
        }
      } catch (error) {
        console.error('保存API密钥失败:', error);
      }
    } else {
      // 未登录用户，保存到localStorage（包含apiKeys）
      const localStorageSettings = {
        selectedApi,
        apiKeys,
        keyTokens: {},
        selectedModels,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localStorageSettings));
      console.log('>>> [DEBUG] 用户未登录，使用旧的存储方式');
    }
    
    setTestResult('success');
    setTestMessage('设置已保存！');
    setTimeout(() => {
      setAISettingsOpen(false);
    }, 800);
  };

  const currentConfig = API_CONFIGS[selectedApi];
  const currentKey = apiKeys[selectedApi];
  const currentModel = selectedModels[selectedApi];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) setAISettingsOpen(false); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{ 
          background: darkMode ? '#111628' : '#F9F5FF', 
          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, 
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)'
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
              <Cpu size={15} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '0.95rem', color: darkMode ? '#e2e8f0' : '#1e293b', fontWeight: 600 }}>AI 模型设置</h2>
              <p style={{ fontSize: '0.7rem', color: darkMode ? '#64748b' : '#94a3b8' }}>配置AI解析和分类功能</p>
            </div>
          </div>
          <button
            onClick={() => setAISettingsOpen(false)}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/10 dark:hover:bg-black/10"
            style={{ color: darkMode ? '#64748b' : '#94a3b8' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Platform selection */}
          <div>
            <label style={{ fontSize: '0.75rem', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 500, display: 'block', marginBottom: 10 }}>
              AI 平台
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.entries(API_CONFIGS) as [ApiType, ApiConfig][]).map(([api, config]) => (
                <button
                  key={api}
                  onClick={() => handlePlatformChange(api)}
                  className="p-3 rounded-xl text-left transition-all"
                  style={{
                    background: selectedApi === api
                      ? 'rgba(124,90,240,0.15)'
                      : (darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'),
                    border: `1px solid ${selectedApi === api
                      ? 'rgba(124,90,240,0.4)'
                      : (darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)')}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: '0.8rem', color: selectedApi === api ? '#a78bfa' : (darkMode ? '#94a3b8' : '#64748b'), fontWeight: 500, wordBreak: 'break-word' }}>
                      {config.name}
                    </span>
                    {apiKeys[api] && (
                      <Check size={12} style={{ color: '#34d399', flexShrink: 0 }} />
                    )}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: darkMode ? '#64748b' : '#94a3b8', marginTop: 2, wordBreak: 'break-word' }}>{config.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Model selection */}
          <div>
            <label style={{ fontSize: '0.75rem', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 500, display: 'block', marginBottom: 8 }}>
              模型选择
            </label>
            <select
              value={currentModel}
              onChange={e => handleModelChange(e.target.value)}
              className="w-full px-4 py-3 rounded-xl outline-none appearance-none cursor-pointer"
              style={{
                background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                color: darkMode ? '#e2e8f0' : '#1e293b',
                fontSize: '0.85rem',
              }}
            >
              {currentConfig.models.map(model => (
                <option key={model.id} value={model.id} style={{ background: darkMode ? '#1a1e30' : '#f5f5f5' }}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label style={{ fontSize: '0.75rem', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 500 }}>
                API 密钥
              </label>
              <a
                href={currentConfig.signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs hover:underline"
                style={{ color: '#a78bfa' }}
              >
                获取密钥 <ExternalLink size={10} />
              </a>
            </div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Key size={14} style={{ color: darkMode ? '#64748b' : '#94a3b8' }} />
              </div>
              <input
                type={showKey ? 'text' : 'password'}
                value={currentKey}
                onChange={e => handleApiKeyChange(e.target.value)}
                placeholder={`输入 ${currentConfig.name} API 密钥...`}
                className="w-full pl-9 pr-10 py-3 rounded-xl outline-none"
                style={{
                  background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  color: darkMode ? '#e2e8f0' : '#1e293b',
                  fontSize: '0.85rem',
                }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:opacity-70"
                style={{ color: darkMode ? '#64748b' : '#94a3b8' }}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p style={{ fontSize: '0.7rem', color: darkMode ? '#64748b' : '#94a3b8', marginTop: 6 }}>
              密钥仅存储在本地浏览器，不会上传至服务器
            </p>
          </div>

          {/* Test result */}
          {testResult && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl"
              style={{
                background: testResult === 'success' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                border: `1px solid ${testResult === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
              }}
            >
              {testResult === 'success'
                ? <Check size={14} style={{ color: '#34d399' }} />
                : <X size={14} style={{ color: '#f87171' }} />
              }
              <span style={{ fontSize: '0.8rem', color: testResult === 'success' ? '#34d399' : '#f87171' }}>
                {testMessage}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        {/* 本地缓存选项 */}
        <div
          className="flex items-center justify-between px-6 py-3"
          style={{ 
            borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
            background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'
          }}
        >
          <div className="flex items-center gap-2">
            {cacheLocally ? (
              <Database size={14} style={{ color: '#22d3ee' }} />
            ) : (
              <Shield size={14} style={{ color: '#f472b6' }} />
            )}
            <span style={{ fontSize: '0.75rem', color: darkMode ? '#94a3b8' : '#64748b' }}>
              {cacheLocally ? '本地+云端同步' : '仅云端存储'}
            </span>
          </div>
          <button
            onClick={() => setCacheLocally(!cacheLocally)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: cacheLocally 
                ? 'rgba(34,211,238,0.15)' 
                : 'rgba(244,114,182,0.15)',
              border: `1px solid ${cacheLocally ? 'rgba(34,211,238,0.3)' : 'rgba(244,114,182,0.3)'}`,
              color: cacheLocally ? '#22d3ee' : '#f472b6',
              fontSize: '0.7rem',
            }}
            title={cacheLocally ? 'API密钥将保存在本地浏览器，加载更快' : 'API密钥仅保存在云端，更安全'}
          >
            {cacheLocally ? '本地缓存: 开' : '本地缓存: 关'}
          </button>
        </div>
        
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}` }}
        >
          <button
            onClick={handleTest}
            disabled={testing || !currentKey.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
            style={{
              background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              color: !currentKey.trim() ? (darkMode ? '#64748b' : '#94a3b8') : (darkMode ? '#94a3b8' : '#64748b'),
              fontSize: '0.8rem',
              cursor: !currentKey.trim() ? 'not-allowed' : 'pointer',
              opacity: !currentKey.trim() ? 0.5 : 1,
            }}
          >
            {testing ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            测试连接
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl transition-all hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, rgba(124,90,240,0.4), rgba(34,211,238,0.2))',
              border: '1px solid rgba(124,90,240,0.4)',
              color: '#c4b5fd',
              fontSize: '0.85rem',
            }}
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}

export function getAISettingsFromStorage() {
  const saved = localStorage.getItem('ai_settings_v2');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  return null;
}
