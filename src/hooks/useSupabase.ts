import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// 类型定义
export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  is_expanded: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folder_id: string | null;
  tags: string[];
  source_url?: string;
  source_platform?: string;
  mindmap?: any;
  mindmap_markdown?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Connection {
  id: string;
  from_id: string;
  to_id: string;
  type: 'related' | 'extended' | 'contrast' | 'dependent';
  label?: string;
  user_id: string;
  created_at: string;
}

export interface AISettings {
  id: number;
  platform: 'openrouter' | 'siliconflow' | 'zhipuai';
  model: string;
  api_key?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// Folders Hook
export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFolders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      setFolders(data || []);
      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取文件夹失败';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createFolder = useCallback(async (folder: Omit<Folder, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('folders')
        .insert(folder)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setFolders(prev => [...prev, data]);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '创建文件夹失败';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateFolder = useCallback(async (id: string, updates: Partial<Folder>) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('folders')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setFolders(prev => prev.map(f => f.id === id ? data! : f));
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新文件夹失败';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteFolder = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      setFolders(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除文件夹失败';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    folders,
    loading,
    error,
    fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder
  };
}

// Notes Hook
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async (folderId?: string) => {
    try {
      setLoading(true);
      setError(null);
      let query = supabase
        .from('notes')
        .select('*')
        .order('updated_at', { ascending: false });

      if (folderId) {
        query = query.eq('folder_id', folderId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setNotes(data || []);
      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取笔记失败';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createNote = useCallback(async (note: Omit<Note, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('notes')
        .insert(note)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setNotes(prev => [data, ...prev]);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '创建笔记失败';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('notes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setNotes(prev => prev.map(n => n.id === id ? data! : n));
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新笔记失败';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除笔记失败';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    notes,
    loading,
    error,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote
  };
}

// Connections Hook
export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('connections')
        .select('*');

      if (error) {
        throw error;
      }

      setConnections(data || []);
      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取连接失败';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createConnection = useCallback(async (connection: Omit<Connection, 'id' | 'created_at'>) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('connections')
        .insert(connection)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setConnections(prev => [...prev, data]);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '创建连接失败';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteConnection = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase
        .from('connections')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      setConnections(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除连接失败';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    connections,
    loading,
    error,
    fetchConnections,
    createConnection,
    deleteConnection
  };
}

// AI Settings Hook
export function useAISettings() {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // 没有找到记录
          setSettings(null);
          return null;
        }
        throw error;
      }

      setSettings(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取AI设置失败';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (settingsData: Omit<AISettings, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setLoading(true);
      setError(null);

      // 检查是否已存在设置
      const { data: existingSettings } = await supabase
        .from('ai_settings')
        .select('id')
        .single();

      let data;
      if (existingSettings) {
        // 更新现有设置
        const { data: updatedData, error } = await supabase
          .from('ai_settings')
          .update({ ...settingsData, updated_at: new Date().toISOString() })
          .eq('id', existingSettings.id)
          .select()
          .single();

        if (error) {
          throw error;
        }
        data = updatedData;
      } else {
        // 创建新设置
        const { data: newData, error } = await supabase
          .from('ai_settings')
          .insert(settingsData)
          .select()
          .single();

        if (error) {
          throw error;
        }
        data = newData;
      }

      setSettings(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新AI设置失败';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    settings,
    loading,
    error,
    fetchSettings,
    updateSettings
  };
}
