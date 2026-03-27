import { supabase } from '../../lib/supabase';

const API_BASE_URL = '/api';

export async function generateNoteSummary(noteId: string, title: string, content: string): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    const savedAISettings = localStorage.getItem('ai_settings_v2');
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    if (savedAISettings) {
      try {
        const settings = JSON.parse(savedAISettings);
        const selectedApi = settings.selectedApi || 'siliconflow';
        const keyToken = settings.keyTokens?.[selectedApi];
        const apiKey = settings.apiKeys?.[selectedApi];
        const model = settings.selectedModels?.[selectedApi];

        if (keyToken && session?.access_token) {
          headers['X-Key-Token'] = keyToken;
          headers['X-AI-Platform'] = selectedApi;
          headers['X-AI-Model'] = model || '';
        } else if (apiKey) {
          const encrypted = encryptApiKey(apiKey);
          if (encrypted) {
            headers['X-Encrypted-API-Key'] = encrypted.encrypted;
            headers['X-API-Key-IV'] = encrypted.iv;
            headers['X-AI-Platform'] = selectedApi;
            headers['X-AI-Model'] = model || '';
          }
        }
      } catch (e) {
        console.error('解析AI设置失败:', e);
      }
    }

    const response = await fetch(`${API_BASE_URL}/ai/note-summary`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ noteId, title, content }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return data.summary;
      }
    }
    return null;
  } catch (error) {
    console.error('生成笔记摘要失败:', error);
    return null;
  }
}

export function encryptApiKey(apiKey: string): { encrypted: string; iv: string } | null {
  try {
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
}
