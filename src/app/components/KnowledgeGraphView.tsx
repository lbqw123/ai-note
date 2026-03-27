import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ArrowRight, ArrowLeft, Link2, X, Check } from 'lucide-react';
import { useNoteStore, ConnectionType, CONNECTION_COLORS, CONNECTION_LABELS } from '../store/noteStore';
import { supabase } from '../../lib/supabase';

const TYPE_OPTIONS: { value: ConnectionType; label: string; desc: string }[] = [
  { value: 'related', label: '相关', desc: '内容相互关联' },
  { value: 'extended', label: '拓展', desc: '延伸扩展知识' },
  { value: 'contrast', label: '对比', desc: '对比比较分析' },
  { value: 'dependent', label: '依赖', desc: '依赖前置知识' },
];

interface KnowledgeGraphViewProps {
  darkMode: boolean;
}

export function KnowledgeGraphView({ darkMode }: KnowledgeGraphViewProps) {
  const {
    notes, connections, activeNoteId, setActiveNote,
    addConnection, removeConnection, folders, aiSettings
  } = useNoteStore();

  const note = notes.find(n => n.id === activeNoteId);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [selectedType, setSelectedType] = useState<ConnectionType>('related');
  const [label, setLabel] = useState('');
  const [direction, setDirection] = useState<'from' | 'to'>('from');
  const [cancelHovered, setCancelHovered] = useState(false);
  const [saveHovered, setSaveHovered] = useState(false);
  const [removeHovered, setRemoveHovered] = useState(false);
  const [noteHovered, setNoteHovered] = useState(false);
  
  // AI推荐连接状态
  const [recommendedConnections, setRecommendedConnections] = useState<{
    id: string;
    targetNoteId: string;
    similarity: number;
    type: ConnectionType;
    label: string;
  }[]>([]);
  const [showTypeDropdown, setShowTypeDropdown] = useState<string | null>(null);
  const [hoveredRecommendation, setHoveredRecommendation] = useState<string | null>(null);
  const [useAIRecommendation, setUseAIRecommendation] = useState(false); // 默认使用无AI模式
  const [isAILoading, setIsAILoading] = useState(false); // AI分析加载状态

  const outgoing = note ? connections.filter(c => c.fromId === note.id) : [];
  const incoming = note ? connections.filter(c => c.toId === note.id) : [];

  // 当选择笔记变化时，重新生成推荐
  useEffect(() => {
    if (note) {
      const availableNotes = notes.filter(n => n.id !== note.id);
      const recs = generateRecommendations(availableNotes);
      setRecommendedConnections(recs);
    }
  }, [note, notes, folders]);

  if (!note) {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar rounded-2xl" style={{ background: darkMode ? '#0a0c15' : '#F9F5FF' }}>
        <div className="max-w-2xl mx-auto px-6 py-8">
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ background: 'rgba(124,90,240,0.08)', border: '1px solid rgba(124,90,240,0.2)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(124,90,240,0.2)' }}
              >
                <Link2 size={18} style={{ color: '#a78bfa' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#7c5af0', marginBottom: 2, letterSpacing: '0.05em' }}>全部知识星链</div>
                <div style={{ fontSize: '1rem', color: darkMode ? '#e2e8f0' : '#1e293b', fontWeight: 600 }}>所有笔记连接</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-xl p-4" style={{ background: darkMode ? '#141828' : '#f8fafc', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
              <div style={{ fontSize: '1.5rem', color: '#22d3ee', fontWeight: 700 }}>{connections.length}</div>
              <div style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8' }}>总连接数</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: darkMode ? '#141828' : '#f8fafc', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
              <div style={{ fontSize: '1.5rem', color: '#a78bfa', fontWeight: 700 }}>{notes.length}</div>
              <div style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8' }}>笔记总数</div>
            </div>
          </div>

          <div
            className="flex items-center gap-2 mb-3"
            style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}
          >
            <Link2 size={12} /> 全部连接
          </div>

          <div className="space-y-2">
            {connections.map(conn => {
              const source = notes.find(n => n.id === conn.fromId);
              const target = notes.find(n => n.id === conn.toId);
              if (!source || !target) return null;
              return (
                <div
                  key={conn.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 group"
                  style={{ background: darkMode ? '#141828' : '#f8fafc', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }` }}
                >
                  <button
                    onClick={() => setActiveNote(source.id)}
                    onMouseEnter={() => setNoteHovered(true)}
                    onMouseLeave={() => setNoteHovered(false)}
                    className="flex-1 text-left transition-colors truncate"
                    style={{ 
                      fontSize: '0.85rem',
                      color: noteHovered ? '#a78bfa' : (darkMode ? '#e2e8f0' : '#1e293b')
                    }}
                  >
                    {source.title}
                  </button>
                  <span
                    className="shrink-0 px-2 py-0.5 rounded-full"
                    style={{
                      fontSize: '0.7rem',
                      background: `${CONNECTION_COLORS[conn.type]}15`,
                      color: CONNECTION_COLORS[conn.type],
                      border: `1px solid ${CONNECTION_COLORS[conn.type]}30`,
                    }}
                  >
                    {CONNECTION_LABELS[conn.type]}
                  </span>
                  <ArrowRight size={12} style={{ color: darkMode ? '#64748b' : '#94a3b8' }} className="shrink-0" />
                  <button
                    onClick={() => setActiveNote(target.id)}
                    onMouseEnter={() => setNoteHovered(true)}
                    onMouseLeave={() => setNoteHovered(false)}
                    className="flex-1 text-left transition-colors truncate"
                    style={{ 
                      fontSize: '0.85rem',
                      color: noteHovered ? '#a78bfa' : (darkMode ? '#e2e8f0' : '#1e293b')
                    }}
                  >
                    {target.title}
                  </button>
                  {conn.label && (
                    <span style={{ fontSize: '0.7rem', color: darkMode ? '#64748b' : '#94a3b8' }}>{conn.label}</span>
                  )}
                </div>
              );
            })}
          </div>

          {connections.length === 0 && (
            <div
              className="text-center py-12 rounded-xl"
              style={{ border: `1px dashed ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }` }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✨</div>
              <p style={{ color: darkMode ? '#64748b' : '#94a3b8', fontSize: '0.85rem' }}>还没有知识连接</p>
              <p style={{ color: darkMode ? '#64748b' : '#94a3b8', fontSize: '0.75rem', marginTop: 4 }}>选择笔记后开始构建知识网络</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const handleAdd = () => {
    if (!selectedNoteId) return;
    if (direction === 'from') {
      addConnection(note.id, selectedNoteId, selectedType, label || undefined);
    } else {
      addConnection(selectedNoteId, note.id, selectedType, label || undefined);
    }
    setShowAddForm(false);
    setSelectedNoteId('');
    setLabel('');
    setSelectedType('related');
  };

  const availableNotes = notes.filter(n => n.id !== note.id);

  // 调用后端API进行AI推荐分析
  const fetchAIRecommendations = async (currentNote: typeof note, candidateNotes: typeof notes) => {
    try {
      setIsAILoading(true);

      // 获取用户session token
      const { data: { session } } = await supabase.auth.getSession();
      
      // 构建请求头
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (session?.access_token) {
        // 已登录：传递Authorization token
        headers['Authorization'] = `Bearer ${session.access_token}`;
      } else {
        // 未登录：从localStorage读取AI设置
        const aiSettingsStr = localStorage.getItem('ai-settings');
        const localAiSettings = aiSettingsStr ? JSON.parse(aiSettingsStr) : null;
        
        if (!localAiSettings?.apiKey) {
          return null;
        }
        
        headers['X-API-Key'] = localAiSettings.apiKey;
        headers['X-AI-Platform'] = localAiSettings.platform || 'siliconflow';
        headers['X-AI-Model'] = localAiSettings.model || '';
      }

      // 准备请求数据
      const requestData = {
        current_note: {
          id: currentNote.id,
          title: currentNote.title,
          content: currentNote.content || '',
          tags: currentNote.tags || [],
          folderId: currentNote.folderId
        },
        candidate_notes: candidateNotes.map(n => ({
          id: n.id,
          title: n.title,
          content: n.content || '',
          tags: n.tags || [],
          folderId: n.folderId
        })),
        folders: folders.map(f => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId
        }))
      };

      // 发送请求到后端
      const API_BASE_URL = '/api';
      const response = await fetch(`${API_BASE_URL}/ai-recommend-notes`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.recommendations) {
        // 将AI返回的推荐转换为组件需要的格式
        return result.recommendations.map((rec: any) => ({
          id: `rec-ai-${rec.note_id}`,
          targetNoteId: rec.note_id,
          similarity: rec.similarity,
          type: rec.connection_type as ConnectionType,
          label: rec.reason || 'AI推荐',
          source: 'ai'
        }));
      }

      return null;
    } catch (error) {
      console.error('AI推荐分析失败:', error);
      return null;
    } finally {
      setIsAILoading(false);
    }
  };

  // 处理AI分析按钮点击
  const handleAIAnalysis = async () => {
    if (!note) return;

    // 切换AI模式状态
    const newUseAI = !useAIRecommendation;
    setUseAIRecommendation(newUseAI);

    if (newUseAI) {
      // 获取已存在的连接
      const existingConnectionNoteIds = new Set<string>();
      connections.forEach(conn => {
        if (conn.fromId === note.id) {
          existingConnectionNoteIds.add(conn.toId);
        } else if (conn.toId === note.id) {
          existingConnectionNoteIds.add(conn.fromId);
        }
      });

      // 过滤掉已经存在连接的笔记
      const filteredNotes = availableNotes.filter(n => !existingConnectionNoteIds.has(n.id));

      if (filteredNotes.length === 0) {
        setRecommendedConnections([]);
        return;
      }

      // 调用AI API获取推荐
      const aiRecs = await fetchAIRecommendations(note, filteredNotes);

      if (aiRecs && aiRecs.length > 0) {
        setRecommendedConnections(aiRecs);
      } else {
        // 如果AI调用失败，回退到本地计算
        const localRecs = generateRecommendations(availableNotes);
        setRecommendedConnections(localRecs);
      }
    } else {
      // 切换回本地推荐模式
      const localRecs = generateRecommendations(availableNotes);
      setRecommendedConnections(localRecs);
    }
  };

  // 辅助函数：获取文件夹的所有父文件夹ID
  const getFolderAncestors = (folderId: string | null): string[] => {
    const ancestors: string[] = [];
    let currentId = folderId;
    
    while (currentId) {
      const folder = folders.find(f => f.id === currentId);
      if (!folder) break;
      ancestors.push(currentId);
      currentId = folder.parentId;
    }
    
    return ancestors;
  };
  
  // 辅助函数：判断文件夹是否是另一个文件夹的子文件夹
  const isSubFolder = (childFolderId: string | null, parentFolderId: string | null): boolean => {
    if (!childFolderId || !parentFolderId) return false;
    const ancestors = getFolderAncestors(childFolderId);
    return ancestors.includes(parentFolderId);
  };

  // 辅助函数：获取最高级文件夹ID（一级文件夹）
  const getTopLevelFolderId = (folderId: string | null): string | null => {
    if (!folderId) return null;
    
    let currentId = folderId;
    let topLevelId = folderId;
    
    while (currentId) {
      const folder = folders.find(f => f.id === currentId);
      if (!folder) break;
      topLevelId = currentId;
      currentId = folder.parentId;
    }
    
    return topLevelId;
  };
  
  // 生成AI推荐连接
  const generateRecommendations = (availableNotes: typeof notes) => {
    if (!note || availableNotes.length === 0) return [];
    
    // 获取已存在的连接（包括当前笔记作为起点或终点的连接）
    const existingConnectionNoteIds = new Set<string>();
    connections.forEach(conn => {
      if (conn.fromId === note.id) {
        existingConnectionNoteIds.add(conn.toId);
      } else if (conn.toId === note.id) {
        existingConnectionNoteIds.add(conn.fromId);
      }
    });
    
    // 过滤掉已经存在连接的笔记
    const filteredNotes = availableNotes.filter(n => !existingConnectionNoteIds.has(n.id));
    
    if (filteredNotes.length === 0) return [];
    
    // 根据useAIRecommendation状态决定使用哪种模式
    if (useAIRecommendation) {
      // AI模式：不进行本地计算，通过fetchAIRecommendations调用后端API
      return [];
    } else {
      // 无AI模式：基于TF-IDF和权重打分的相似度计算
      const recommendations = [];
      
      // 计算所有笔记的TF-IDF
      const allContents = [note, ...filteredNotes].map(n => 
        `${n.title} ${n.content || ''} ${n.tags?.join(' ') || ''}`
      );
      const idfMap = calculateIDF(allContents);
      
      // 计算当前笔记的TF-IDF向量
      const currentVector = calculateTFIDF(
        `${note.title} ${note.content || ''} ${note.tags?.join(' ') || ''}`,
        idfMap
      );
      
      // 获取当前笔记的最高级文件夹ID
      const currentTopLevelFolderId = getTopLevelFolderId(note.folderId);
      
      filteredNotes.forEach(otherNote => {
        // 获取目标笔记的最高级文件夹ID
        const otherTopLevelFolderId = getTopLevelFolderId(otherNote.folderId);
        
        // 1. 基础TF-IDF相似度计算
        const otherVector = calculateTFIDF(
          `${otherNote.title} ${otherNote.content || ''} ${otherNote.tags?.join(' ') || ''}`,
          idfMap
        );
        
        // 计算交集相似度 = (A ∩ B) / (A ∪ B)
        const intersection = new Set([...currentVector.keys()].filter(x => otherVector.has(x)));
        const union = new Set([...currentVector.keys(), ...otherVector.keys()]);
        let baseSimilarity = union.size > 0 ? intersection.size / union.size : 0;
        
        // 2. 权重打分优化
        let weightedScore = baseSimilarity * 100; // 基础分 0-100
        
        // 标题匹配：权重 5
        const currentTitleWords = note.title.toLowerCase().split(/\s+/);
        const otherTitleWords = otherNote.title.toLowerCase().split(/\s+/);
        const titleMatches = currentTitleWords.filter(w => otherTitleWords.includes(w)).length;
        weightedScore += titleMatches * 5;
        
        // 标签匹配：权重 3
        if (note.tags && otherNote.tags) {
          const commonTags = note.tags.filter(tag => otherNote.tags!.includes(tag));
          weightedScore += commonTags.length * 3;
        }
        
        // 文件夹距离：同一文件夹基础分 +20%
        if (note.folderId && otherNote.folderId === note.folderId) {
          weightedScore += 20;
        }
        
        // 引用回溯：额外加分
        if (otherNote.content && otherNote.content.includes(note.title)) {
          weightedScore += 15;
        }
        
        // 将总分映射到 0-100% 之间
        const finalSimilarity = Math.min(Math.round(weightedScore * 10) / 10, 100);
        
        // 3. 跨文件夹相似度阈值判断
        // 如果不在同一个最高级文件夹，且相似度低于20%，则跳过
        const isSameTopLevelFolder = currentTopLevelFolderId === otherTopLevelFolderId;
        if (!isSameTopLevelFolder && finalSimilarity < 20) {
          return; // 跳过这个笔记
        }
        
        // 连接关系判断
        let connectionType: ConnectionType = 'related';
        
        // 1. 对比 (Contrast)：标题出现 vs、不同、区别 等关键词
        if (
          (note.title.toLowerCase().includes('vs') || 
           note.title.toLowerCase().includes('不同') || 
           note.title.toLowerCase().includes('区别')) &&
          otherNote.title.toLowerCase().includes(note.title.toLowerCase().split('vs')[0])
        ) {
          connectionType = 'contrast';
        }
        // 2. 依赖 (Depends)：父子关系
        else if (isSubFolder(note.folderId, otherNote.folderId)) {
          connectionType = 'dependent';
        }
        // 3. 拓展 (Extend)：子孙关系
        else if (isSubFolder(otherNote.folderId, note.folderId) || otherNote.title.includes(note.title)) {
          connectionType = 'extended';
        }
        
        // 生成推荐标签
        let label = '';
        if (note.folderId && otherNote.folderId === note.folderId) {
          label = '同文件夹';
        } else if (note.tags && otherNote.tags) {
          const commonTags = note.tags.filter(tag => otherNote.tags!.includes(tag));
          if (commonTags.length > 0) {
            label = `共同标签: ${commonTags[0]}`;
          }
        } else if (otherNote.content && otherNote.content.includes(note.title)) {
          label = '引用提及';
        } else {
          label = '内容相关';
        }
        
        recommendations.push({
          id: `rec-local-${otherNote.id}`,
          targetNoteId: otherNote.id,
          similarity: finalSimilarity,
          type: connectionType,
          label,
          source: 'local'
        });
      });
      
      // 按相似度排序并返回前3个
      return recommendations
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3);
    }
  };
  
  // 辅助函数：计算IDF（逆文档频率）
  const calculateIDF = (documents: string[]): Map<string, number> => {
    const idfMap = new Map<string, number>();
    const totalDocs = documents.length;
    
    // 统计每个词出现在多少文档中
    const wordDocCount = new Map<string, number>();
    
    documents.forEach(doc => {
      const words = new Set(doc.toLowerCase().split(/\s+/).filter(w => w.length > 1));
      words.forEach(word => {
        wordDocCount.set(word, (wordDocCount.get(word) || 0) + 1);
      });
    });
    
    // 计算IDF
    wordDocCount.forEach((count, word) => {
      const idf = Math.log(totalDocs / (count + 1)) + 1;
      idfMap.set(word, idf);
    });
    
    return idfMap;
  };
  
  // 辅助函数：计算TF-IDF向量
  const calculateTFIDF = (text: string, idfMap: Map<string, number>): Map<string, number> => {
    const tfidfVector = new Map<string, number>();
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    const wordCount = new Map<string, number>();
    
    // 计算词频
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });
    
    // 计算TF-IDF
    const totalWords = words.length;
    wordCount.forEach((count, word) => {
      const tf = count / totalWords;
      const idf = idfMap.get(word) || 1;
      tfidfVector.set(word, tf * idf);
    });
    
    return tfidfVector;
  };
  
  // 辅助函数：计算余弦相似度
  const calculateCosineSimilarity = (vec1: Map<string, number>, vec2: Map<string, number>): number => {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    // 计算点积
    vec1.forEach((value, key) => {
      if (vec2.has(key)) {
        dotProduct += value * vec2.get(key)!;
      }
      norm1 += value * value;
    });
    
    vec2.forEach((value) => {
      norm2 += value * value;
    });
    
    // 计算余弦相似度
    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  };
  
  // 辅助函数：AI连接关系判断
  const determineAIConnectionType = (note1: any, note2: any): ConnectionType => {
    const content1 = (note1.content || '').toLowerCase();
    const content2 = (note2.content || '').toLowerCase();
    const title1 = (note1.title || '').toLowerCase();
    const title2 = (note2.title || '').toLowerCase();
    
    // 1. 对比 (Contrast)：同类并列
    if (
      (title1.includes('vs') || title1.includes('对比') || title1.includes('区别')) ||
      (title2.includes('vs') || title2.includes('对比') || title2.includes('区别')) ||
      (content1.includes('对比') && content2.includes('对比'))
    ) {
      return 'contrast';
    }
    
    // 2. 依赖 (Depends)：A基于B的原理
    if (
      content1.includes('基于') && content1.includes(note2.title.toLowerCase()) ||
      content1.includes('根据') && content1.includes(note2.title.toLowerCase()) ||
      content2.includes('基础') && content2.includes(note1.title.toLowerCase())
    ) {
      return 'dependent';
    }
    
    // 3. 拓展 (Extend)：B提供A的细节
    if (
      content2.includes('详细') && content2.includes(note1.title.toLowerCase()) ||
      content2.includes('实操') && content2.includes(note1.title.toLowerCase()) ||
      content2.includes('案例') && content2.includes(note1.title.toLowerCase())
    ) {
      return 'extended';
    }
    
    // 4. 相关 (Related)：默认
    return 'related';
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar rounded-2xl" style={{ background: darkMode ? '#0a0c15' : '#F9F5FF' }}>
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Current note */}
        <div
          className="rounded-2xl p-5 mb-8"
          style={{ background: 'rgba(124,90,240,0.08)', border: '1px solid rgba(124,90,240,0.2)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(124,90,240,0.2)' }}
            >
              <Link2 size={18} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#7c5af0', marginBottom: 2, letterSpacing: '0.05em' }}>当前笔记</div>
              <div style={{ fontSize: '1rem', color: darkMode ? '#e2e8f0' : '#1e293b', fontWeight: 600 }}>{note.title}</div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-xl p-4" style={{ background: darkMode ? '#141828' : '#f8fafc', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
            <div style={{ fontSize: '1.5rem', color: '#22d3ee', fontWeight: 700 }}>{outgoing.length}</div>
            <div style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8' }}>向外连接</div>
          </div>
          <div className="rounded-xl p-4" style={{ background: darkMode ? '#141828' : '#f8fafc', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
            <div style={{ fontSize: '1.5rem', color: '#a78bfa', fontWeight: 700 }}>{incoming.length}</div>
            <div style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8' }}>向内引用</div>
          </div>
        </div>

        {/* AI推荐连接 */}
        {note && recommendedConnections.length > 0 && (
          <div className="mb-6">
            <div
              className="flex items-center justify-between mb-3"
              style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}
            >
              <div className="flex items-center gap-2">
                <span className="emoji emoji2747">❇️</span> 灵感发现 ({useAIRecommendation ? 'AI分析' : '本地推荐'})
              </div>
              <button
                onClick={handleAIAnalysis}
                disabled={isAILoading}
                className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all"
                style={{
                  background: useAIRecommendation ? 'rgba(124,90,240,0.2)' : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                  color: useAIRecommendation ? '#a78bfa' : (darkMode ? '#64748b' : '#94a3b8'),
                  border: `1px solid ${useAIRecommendation ? 'rgba(124,90,240,0.4)' : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  opacity: isAILoading ? 0.6 : 1,
                  cursor: isAILoading ? 'not-allowed' : 'pointer'
                }}
              >
                {isAILoading ? '⏳ 分析中...' : (useAIRecommendation ? '🤖 AI分析中' : '✨ AI分析')}
              </button>
            </div>
            <div className="space-y-3">
              {recommendedConnections.map(rec => {
                const targetNote = notes.find(n => n.id === rec.targetNoteId);
                if (!targetNote) return null;
                
                return (
                  <div
                    key={rec.id}
                    className="rounded-xl p-4 transition-all"
                    style={{
                      background: darkMode ? '#141828' : '#f8fafc',
                      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* 左侧：目标笔记标题 + 相似度 */}
                      <div className="flex-1">
                        <div style={{ fontSize: '0.85rem', color: darkMode ? '#e2e8f0' : '#1e293b', fontWeight: 500, marginBottom: 2 }}>
                          {targetNote.title}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: darkMode ? '#64748b' : '#94a3b8' }}>
                          相似度: {rec.similarity}%
                        </div>
                      </div>
                      
                      {/* 中间：连接类型 */}
                      <div className="relative">
                        <button
                          onClick={() => setShowTypeDropdown(showTypeDropdown === rec.id ? null : rec.id)}
                          className="px-3 py-1.5 rounded-lg transition-all"
                          style={{
                            background: `${CONNECTION_COLORS[rec.type]}15`,
                            color: CONNECTION_COLORS[rec.type],
                            border: `1px solid ${CONNECTION_COLORS[rec.type]}30`,
                            fontSize: '0.75rem',
                            fontWeight: 500
                          }}
                        >
                          {CONNECTION_LABELS[rec.type]}
                        </button>
                        
                        {/* 类型选择下拉框 */}
                        {showTypeDropdown === rec.id && (
                          <div
                            className="absolute top-full right-0 mt-1 z-10 rounded-lg shadow-lg"
                            style={{
                              background: darkMode ? '#1a1e30' : '#ffffff',
                              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                              minWidth: '120px'
                            }}
                          >
                            {TYPE_OPTIONS.map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => {
                                  setRecommendedConnections(prev => prev.map(r => 
                                    r.id === rec.id ? { ...r, type: opt.value } : r
                                  ));
                                  setShowTypeDropdown(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm transition-colors"
                                style={{
                                  color: rec.type === opt.value ? CONNECTION_COLORS[rec.type] : (darkMode ? '#e2e8f0' : '#1e293b'),
                                  background: rec.type === opt.value ? `${CONNECTION_COLORS[rec.type]}15` : 'transparent'
                                }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* 右侧：操作区 */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            addConnection(note.id, rec.targetNoteId, rec.type, rec.label);
                            setRecommendedConnections(prev => prev.filter(r => r.id !== rec.id));
                          }}
                          className="p-1.5 rounded-lg transition-all"
                          style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setRecommendedConnections(prev => prev.filter(r => r.id !== rec.id));
                          }}
                          className="p-1.5 rounded-lg transition-all"
                          style={{
                            background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                            color: darkMode ? '#64748b' : '#94a3b8',
                            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add connection button */}
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all mb-6"
            style={{
              background: 'rgba(124,90,240,0.08)',
              border: '1px dashed rgba(124,90,240,0.3)',
              color: '#7c5af0',
              fontSize: '0.85rem',
            }}
          >
            <Plus size={15} /> 添加知识连接
          </button>
        ) : (
          <div
            className="rounded-xl p-5 mb-6"
            style={{ background: darkMode ? '#141828' : '#f8fafc', border: '1px solid rgba(124,90,240,0.25)' }}
          >
            <div style={{ fontSize: '0.8rem', color: darkMode ? '#94a3b8' : '#64748b', marginBottom: 16, fontWeight: 500 }}>新建知识连接</div>

            {/* Direction toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setDirection('from')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all"
                style={{
                  fontSize: '0.75rem',
                  background: direction === 'from' ? 'rgba(124,90,240,0.2)' : (darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                  color: direction === 'from' ? '#a78bfa' : (darkMode ? '#64748b' : '#94a3b8'),
                  border: `1px solid ${direction === 'from' ? 'rgba(124,90,240,0.4)' : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                }}
              >
                <ArrowRight size={12} /> 当前 → 目标
              </button>
              <button
                onClick={() => setDirection('to')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all"
                style={{
                  fontSize: '0.75rem',
                  background: direction === 'to' ? 'rgba(124,90,240,0.2)' : (darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                  color: direction === 'to' ? '#a78bfa' : (darkMode ? '#64748b' : '#94a3b8'),
                  border: `1px solid ${direction === 'to' ? 'rgba(124,90,240,0.4)' : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                }}
              >
                <ArrowLeft size={12} /> 源头 → 当前
              </button>
            </div>

            {/* Target note select */}
            <div className="mb-3">
              <div style={{ fontSize: '0.7rem', color: darkMode ? '#64748b' : '#94a3b8', marginBottom: 6 }}>目标笔记</div>
              <select
                value={selectedNoteId}
                onChange={e => setSelectedNoteId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg outline-none appearance-none"
                style={{
                  background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  color: selectedNoteId ? (darkMode ? '#e2e8f0' : '#1e293b') : (darkMode ? '#64748b' : '#94a3b8'),
                  fontSize: '0.8rem',
                }}
              >
                <option value="">选择笔记...</option>
                {availableNotes.map(n => (
                  <option key={n.id} value={n.id} style={{ background: darkMode ? '#1a1e30' : '#f5f5f5' }}>{n.title}</option>
                ))}
              </select>
            </div>

            {/* Connection type */}
            <div className="mb-3">
              <div style={{ fontSize: '0.7rem', color: darkMode ? '#64748b' : '#94a3b8', marginBottom: 6 }}>连接类型</div>
              <div className="grid grid-cols-2 gap-2">
                {TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedType(opt.value)}
                    className="px-3 py-2 rounded-lg text-left transition-all"
                    style={{
                      background: selectedType === opt.value ? `${CONNECTION_COLORS[opt.value]}15` : (darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                      border: `1px solid ${selectedType === opt.value ? CONNECTION_COLORS[opt.value] + '50' : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: selectedType === opt.value ? CONNECTION_COLORS[opt.value] : (darkMode ? '#64748b' : '#64748b'), fontWeight: 500 }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: darkMode ? '#64748b' : '#94a3b8' }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Label */}
            <div className="mb-4">
              <div style={{ fontSize: '0.7rem', color: darkMode ? '#64748b' : '#94a3b8', marginBottom: 6 }}>关系描述（可选）</div>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="描述这条连接的关系..."
                className="w-full px-3 py-2 rounded-lg outline-none"
                style={{
                  background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  color: darkMode ? '#e2e8f0' : '#1e293b',
                  fontSize: '0.8rem'
                }}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!selectedNoteId}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all"
                style={{
                  background: selectedNoteId ? 'rgba(124,90,240,0.3)' : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                  color: selectedNoteId ? '#a78bfa' : (darkMode ? '#64748b' : '#94a3b8'),
                  border: `1px solid ${selectedNoteId ? 'rgba(124,90,240,0.4)' : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                  fontSize: '0.8rem',
                }}
              >
                <Check size={13} /> 确认添加
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                onMouseEnter={() => setCancelHovered(true)}
                onMouseLeave={() => setCancelHovered(false)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all"
                style={{
                  fontSize: '0.8rem',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  color: cancelHovered ? (darkMode ? '#e2e8f0' : '#334155') : (darkMode ? '#64748b' : '#94a3b8'),
                  background: cancelHovered ? (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : 'transparent'
                }}
              >
                <X size={13} /> 取消
              </button>
            </div>
          </div>
        )}

        {/* Outgoing connections */}
        {outgoing.length > 0 && (
          <div className="mb-6">
            <div
              className="flex items-center gap-2 mb-3"
              style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}
            >
              <ArrowRight size={12} /> 向外连接
            </div>
            <div className="space-y-2">
              {outgoing.map(conn => {
                const target = notes.find(n => n.id === conn.toId);
                if (!target) return null;
                return (
                  <div
                    key={conn.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 group"
                    style={{ background: darkMode ? '#141828' : '#f8fafc', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }` }}
                  >
                    <span
                      className="shrink-0 px-2 py-0.5 rounded-full"
                      style={{
                        fontSize: '0.7rem',
                        background: `${CONNECTION_COLORS[conn.type]}15`,
                        color: CONNECTION_COLORS[conn.type],
                        border: `1px solid ${CONNECTION_COLORS[conn.type]}30`,
                      }}
                    >
                      {CONNECTION_LABELS[conn.type]}
                    </span>
                    <ArrowRight size={12} style={{ color: darkMode ? '#64748b' : '#94a3b8' }} className="shrink-0" />
                    <button
                      onClick={() => setActiveNote(target.id)}
                      onMouseEnter={() => setNoteHovered(true)}
                      onMouseLeave={() => setNoteHovered(false)}
                      className="flex-1 text-left transition-colors truncate"
                      style={{ 
                        fontSize: '0.85rem',
                        color: noteHovered ? '#a78bfa' : (darkMode ? '#e2e8f0' : '#1e293b')
                      }}
                    >
                      {target.title}
                    </button>
                    {conn.label && (
                      <span style={{ fontSize: '0.7rem', color: darkMode ? '#64748b' : '#94a3b8' }}>{conn.label}</span>
                    )}
                    <button
                      onClick={() => removeConnection(conn.id)}
                      onMouseEnter={() => setRemoveHovered(true)}
                      onMouseLeave={() => setRemoveHovered(false)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                      style={{
                        color: removeHovered ? '#ef4444' : (darkMode ? '#64748b' : '#94a3b8')
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Incoming connections */}
        {incoming.length > 0 && (
          <div>
            <div
              className="flex items-center gap-2 mb-3"
              style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}
            >
              <ArrowLeft size={12} /> 被引用
            </div>
            <div className="space-y-2">
              {incoming.map(conn => {
                const source = notes.find(n => n.id === conn.fromId);
                if (!source) return null;
                return (
                  <div
                    key={conn.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 group"
                    style={{ background: darkMode ? '#141828' : '#f8fafc', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }` }}
                  >
                    <button
                      onClick={() => setActiveNote(source.id)}
                      onMouseEnter={() => setNoteHovered(true)}
                      onMouseLeave={() => setNoteHovered(false)}
                      className="flex-1 text-left transition-colors truncate"
                      style={{ 
                        fontSize: '0.85rem',
                        color: noteHovered ? '#a78bfa' : (darkMode ? '#e2e8f0' : '#1e293b')
                      }}
                    >
                      {source.title}
                    </button>
                    <ArrowRight size={12} style={{ color: darkMode ? '#64748b' : '#94a3b8' }} className="shrink-0" />
                    <span
                      className="shrink-0 px-2 py-0.5 rounded-full"
                      style={{
                        fontSize: '0.7rem',
                        background: `${CONNECTION_COLORS[conn.type]}15`,
                        color: CONNECTION_COLORS[conn.type],
                        border: `1px solid ${CONNECTION_COLORS[conn.type]}30`,
                      }}
                    >
                      {CONNECTION_LABELS[conn.type]}
                    </span>
                    {conn.label && (
                      <span style={{ fontSize: '0.7rem', color: darkMode ? '#64748b' : '#94a3b8' }}>{conn.label}</span>
                    )}
                    <button
                      onClick={() => removeConnection(conn.id)}
                      onMouseEnter={() => setRemoveHovered(true)}
                      onMouseLeave={() => setRemoveHovered(false)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                      style={{
                        color: removeHovered ? '#ef4444' : (darkMode ? '#64748b' : '#94a3b8')
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {outgoing.length === 0 && incoming.length === 0 && !showAddForm && (
          <div
            className="text-center py-12 rounded-xl"
            style={{ border: `1px dashed ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }` }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✨</div>
            <p style={{ color: darkMode ? '#64748b' : '#94a3b8', fontSize: '0.85rem' }}>还没有知识连接</p>
            <p style={{ color: darkMode ? '#64748b' : '#94a3b8', fontSize: '0.75rem', marginTop: 4 }}>点击上方按钮开始构建知识网络</p>
          </div>
        )}
      </div>
    </div>
  );
}