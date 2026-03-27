import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { generateNoteSummary } from '../utils/aiService';

export type NoteView = 'note' | 'mindmap' | 'starchain' | 'graph';
export type ConnectionType = 'related' | 'extended' | 'contrast' | 'dependent';
export type AIPlatform = 'openrouter' | 'siliconflow' | 'zhipuai' | 'modelscope';

export interface NoteMetadata {
  subject?: string;
  difficulty?: 1 | 2 | 3 | 4 | 5;
  learningStatus?: 'new' | 'learning' | 'mastered';
  summary?: string;
  prerequisites?: string[];
  keyConcepts?: string[];
  firstLearnedAt?: string;
  lastReviewedAt?: string;
  reviewCount?: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  sourceUrl?: string;
  sourcePlatform?: string;
  mindmap?: any;
  mindmapMarkdown?: string;
  metadata?: NoteMetadata;
}

export interface MindmapNode {
  id: string;
  label: string;
  parent: string | null;
}

export interface MindmapLink {
  source: string;
  target: string;
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
  type: ConnectionType;
  label?: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  isExpanded: boolean;
}

export interface AISettings {
  platform: AIPlatform;
  model: string;
  apiKey: string;
  selectedApi?: AIPlatform;
  keyTokens?: Record<string, string>;
  selectedModels?: Record<string, string>;
}

// 使用localStorage存储数据
const STORAGE_KEYS = {
  FOLDERS: 'ai-notes-folders',
  NOTES: 'ai-notes-notes',
  CONNECTIONS: 'ai-notes-connections',
  AI_SETTINGS: 'ai-notes-ai-settings',
};

// 初始数据（仅在API不可用时使用）
const initialFolders: Folder[] = [
  { id: 'f1', name: 'AI技术研究', parentId: null, isExpanded: true },
  { id: 'f2', name: '机器学习', parentId: 'f1', isExpanded: true },
  { id: 'f3', name: '提示工程', parentId: 'f1', isExpanded: true },
  { id: 'f4', name: '阅读笔记', parentId: null, isExpanded: true },
  { id: 'f5', name: '技术书籍', parentId: 'f4', isExpanded: false },
  { id: 'f6', name: '项目规划', parentId: null, isExpanded: false },
];

const initialNotes: Note[] = [
  {
    id: 'n1',
    title: 'GPT-4 技术解析',
    content: `# GPT-4 技术解析\n\n## 模型概述\nGPT-4是OpenAI发布的多模态大型语言模型，具有出色的推理和生成能力，在众多基准测试中超越前代模型。\n\n## 核心技术\n\n### Transformer架构\nGPT-4基于改进的Transformer架构，采用多头自注意力机制处理长序列。模型参数量虽未公开，但估计在万亿级别。\n\n### RLHF训练流程\n使用来自人类反馈的强化学习进行价值对齐，确保输出安全、无害、真实。\n\n## 主要特性\n- **多模态输入**: 支持文本和图像输入\n- **超长上下文**: 支持128K token上下文窗口\n- **多语言能力**: 支持50+种语言\n\n## 性能表现\n> GPT-4在律师资格考试中达到前10%水平，在多项专业认证考试中超越平均人类水平。\n\n## 代码示例\n\`\`\`python\nimport openai\n\nresponse = openai.chat.completions.create(\n    model="gpt-4-turbo",\n    messages=[{"role": "user", "content": "分析量子计算的发展趋势"}]\n)\nprint(response.choices[0].message.content)\n\`\`\``,
    folderId: 'f2',
    tags: ['GPT', 'OpenAI', '大模型'],
    createdAt: '2025-01-15T08:30:00Z',
    updatedAt: '2025-01-20T14:22:00Z',
    sourcePlatform: '通义千问',
  },
  {
    id: 'n2',
    title: 'Transformer架构详解',
    content: `# Transformer架构详解\n\n## 背景\nTransformer架构由Vaswani等人在2017年的论文"Attention Is All You Need"中提出，彻底改变了NLP领域。\n\n## 核心组件\n\n### 自注意力机制\n自注意力机制允许模型在处理每个词时考虑整个序列：\n\n**Attention(Q, K, V) = softmax(QKᵀ/√dₖ)V**\n\n### 多头注意力\n多头注意力将输入投影到多个子空间，捕获不同位置和类型的关系。\n\n### 位置编码\n- 正弦/余弦位置编码\n- 可学习位置编码（GPT使用）\n\n## 编码器-解码器结构\n- **编码器**: 处理输入序列，生成上下文表示\n- **解码器**: 使用编码器输出自回归生成目标序列\n\n## 主要变体\n- **BERT**: 双向编码器，适合理解任务\n- **GPT系列**: 自回归解码器，适合生成任务\n- **T5**: 编码器-解码器，通用文本到文本框架`,
    folderId: 'f2',
    tags: ['Transformer', '注意力机制', '深度学习'],
    createdAt: '2025-01-10T10:00:00Z',
    updatedAt: '2025-01-18T16:45:00Z',
  },
  {
    id: 'n3',
    title: 'Chain-of-Thought 提示技巧',
    content: `# Chain-of-Thought 提示技巧\n\n## 概念\nChain-of-Thought (CoT) 是一种提示工程技术，通过引导模型展示推理过程来提升复杂问题解决能力。\n\n## 工作原理\nCoT提示让模型在给出最终答案之前，先"思考"中间步骤，从而显著提升准确率。\n\n## 类型\n\n### 少样本CoT\n在提示中提供"问题+推理过程+答案"的示例：\n\`\`\`\nQ: 如果有5个苹果，吃掉2个，再买3个，剩几个？\nA: 开始有5个，吃掉2个剩3个，再买3个，3+3=6个\n   答案: 6个\n\`\`\`\n\n### 零样本CoT\n添加魔法语句触发推理：\n\n> "Let's think step by step"\n\n## 适用场景\n- 数学推理问题\n- 逻辑推断任务\n- 多步骤规划\n- 代码调试分析`,
    folderId: 'f3',
    tags: ['CoT', '提示工程', '推理'],
    createdAt: '2025-01-12T09:15:00Z',
    updatedAt: '2025-01-22T11:30:00Z',
    sourcePlatform: 'Kimi',
  },
  {
    id: 'n4',
    title: '零样本提示工程实践',
    content: `# 零样本提示工程实践\n\n## 什么是零样本提示\n零样本提示（Zero-shot Prompting）是指不提供任何示例，直接向模型描述任务，让其完成。\n\n## 基础技巧\n\n### 角色扮演\n\`\`\`\n你是一位资深的Python开发工程师，请帮我审查以下代码...\n\`\`\`\n\n### 格式指定\n\`\`\`\n请以JSON格式返回结果，包含字段: name, age, skills\n\`\`\`\n\n### 思维框架\n- **STAR框架**: Situation, Task, Action, Result\n- **5W1H**: Who, What, When, Where, Why, How\n\n## 提升技巧\n1. **清晰明确**: 避免模糊表述\n2. **分步骤**: 将复杂任务拆解\n3. **约束条件**: 明确输出格式和长度限制\n4. **上下文设置**: 提供充分的背景信息`,
    folderId: 'f3',
    tags: ['零样本', '提示工程', '实践'],
    createdAt: '2025-01-14T13:00:00Z',
    updatedAt: '2025-01-21T10:15:00Z',
  },
  {
    id: 'n5',
    title: '深度学习实战笔记',
    content: `# 深度学习实战笔记\n\n## 参考资料\n《Deep Learning》- Goodfellow et al.\n\n## 神经网络基础\n\n### 激活函数对比\n- **ReLU**: f(x) = max(0, x)，训练快，可能Dead Neuron\n- **Sigmoid**: f(x) = 1/(1+e^-x)，梯度消失问题\n- **Tanh**: 输出中心化，(-1,1)范围\n\n## CNN架构演进\n\n### 经典架构路线\nLeNet → AlexNet → VGG → ResNet → EfficientNet\n\n### ResNet关键创新\n跳跃连接（Skip Connection）解决梯度消失：\n**H(x) = F(x) + x**\n\n## 训练技巧\n- 批归一化 (Batch Normalization)\n- Dropout 正则化 (p=0.5)\n- 余弦退火学习率调度\n- Mixup/CutMix 数据增强`,
    folderId: 'f5',
    tags: ['深度学习', '实战', 'CNN'],
    createdAt: '2025-01-08T14:00:00Z',
    updatedAt: '2025-01-19T09:30:00Z',
  },
  {
    id: 'n6',
    title: '2025年AI项目规划',
    content: `# 2025年AI项目规划\n\n## 年度目标\n构建基于大语言模型的智能知识管理系统，实现个人知识的自动化沉淀与智能检索。\n\n## Q1计划 (1-3月)\n\n### 技术选型\n- [ ] 评估主流LLM API (GPT-4, Claude, Gemini)\n- [ ] 确定向量数据库方案 (Pinecone/Weaviate)\n- [ ] 搭建基础RAG框架\n\n### 原型开发\n- [ ] 完成文档解析模块\n- [ ] 实现语义搜索功能\n- [ ] 基础UI界面\n\n## Q2计划 (4-6月)\n- [ ] 知识图谱构建\n- [ ] 多模态支持\n- [ ] 用户反馈闭环\n\n## 技术栈\n| 层次 | 技术选择 |\n|------|----------|\n| 前端 | React + TypeScript |\n| 后端 | FastAPI + Python |\n| AI | LangChain + OpenAI |\n| 数据库 | PostgreSQL + Pinecone |`,
    folderId: 'f6',
    tags: ['规划', 'AI', '项目管理'],
    createdAt: '2025-01-02T09:00:00Z',
    updatedAt: '2025-01-23T15:00:00Z',
  },
  {
    id: 'n7',
    title: '知识图谱构建方法',
    content: `# 知识图谱构建方法\n\n## 什么是知识图谱\n知识图谱是一种结构化的知识表示形式，以图的形式存储实体及其关系，支持语义推理。\n\n## 核心概念\n- **实体 (Entity)**: 图中的节点，代表现实世界的对象\n- **关系 (Relation)**: 连接实体的有向边\n- **属性 (Attribute)**: 实体的特征描述\n\n## 构建流程\n\n### 1. 知识抽取\n- 命名实体识别 (NER)\n- 关系抽取\n- 事件抽取\n\n### 2. 知识融合\n- 实体链接与对齐\n- 共指消解\n\n### 3. 知识存储\n- **Neo4j**: 最流行的图数据库\n- **Amazon Neptune**: 云原生解决方案\n\n### 4. 知识推理\n- 基于规则的推理\n- 嵌入推理 (TransE, RotatE)`,
    folderId: 'f4',
    tags: ['知识图谱', 'NLP', '图数据库'],
    createdAt: '2025-01-11T11:00:00Z',
    updatedAt: '2025-01-20T13:45:00Z',
    sourcePlatform: '豆包',
  },
];

const initialConnections: Connection[] = [
  { id: 'c1', fromId: 'n1', toId: 'n2', type: 'related', label: '技术基础' },
  { id: 'c2', fromId: 'n1', toId: 'n3', type: 'extended', label: '应用方向' },
  { id: 'c3', fromId: 'n3', toId: 'n4', type: 'related', label: '进阶学习' },
  { id: 'c4', fromId: 'n5', toId: 'n2', type: 'dependent', label: '参考资料' },
  { id: 'c5', fromId: 'n7', toId: 'n1', type: 'extended', label: '知识扩展' },
  { id: 'c6', fromId: 'n6', toId: 'n1', type: 'related', label: '项目参考' },
];

const initialAISettings: AISettings = {
  platform: 'openrouter',
  model: 'anthropic/claude-3.5-sonnet',
  apiKey: '',
};

interface NoteContextType {
  folders: Folder[];
  notes: Note[];
  connections: Connection[];
  activeNoteId: string | null;
  activeFolderId: string | null;
  activeView: NoteView;
  searchQuery: string;
  isSearchOpen: boolean;
  isAISettingsOpen: boolean;
  isLinkParseOpen: boolean;
  isPasswordChangeOpen: boolean;
  aiSettings: AISettings;
  sidebarCollapsed: boolean;
  userId: string | null;

  setActiveNote: (id: string | null) => void;
  setActiveFolder: (id: string | null) => void;
  setActiveView: (view: NoteView) => void;
  setSearchQuery: (q: string) => void;
  setSearchOpen: (open: boolean) => void;
  setAISettingsOpen: (open: boolean) => void;
  setLinkParseOpen: (open: boolean) => void;
  setPasswordChangeOpen: (open: boolean) => void;
  setSidebarCollapsed: (v: boolean) => void;
  setNotes: (notes: Note[]) => void;
  setActiveNoteId: (id: string | null) => void;
  setUserId: (userId: string | null) => void;

  createFolder: (name: string, parentId?: string | null) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  toggleFolderExpand: (id: string) => Promise<void>;
  moveFolder: (folderId: string, parentId: string | null) => Promise<void>;
  createFolderStructure: (categoryPath: string) => Promise<string | null>;

  createNote: (title: string, folderId?: string | null) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  moveNoteToFolder: (noteId: string, folderId: string | null) => Promise<void>;

  addConnection: (fromId: string, toId: string, type: ConnectionType, label?: string) => Promise<void>;
  removeConnection: (id: string) => Promise<void>;
  updateAISettings: (settings: Partial<AISettings>) => Promise<void>;
  importNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Note>;
  parseLink: (url: string, categoryPath?: string) => Promise<{ success: boolean; note?: Note; error?: string }>;
  testAPIConnection: (platform: string, apiKey: string) => Promise<boolean>;
  loadData: () => Promise<void>;
  saveData: () => void;
}

const NoteContext = createContext<NoteContextType | null>(null);

export function NoteProvider({ children }: { children: ReactNode }) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<NoteView>('note');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isAISettingsOpen, setAISettingsOpen] = useState(false);
  const [isLinkParseOpen, setLinkParseOpen] = useState(false);
  const [isPasswordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [aiSettings, setAISettings] = useState<AISettings>(initialAISettings);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // 检查认证状态
  useEffect(() => {
    const checkAuthStatus = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('获取认证状态失败:', error);
      }
      if (session) {
        setUserId(session.user.id);
      } else {
        setUserId(null);
      }
    };

    checkAuthStatus();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUserId(session.user.id);
        // 登录时先清空 localStorage，避免加载默认笔记
        localStorage.removeItem(STORAGE_KEYS.FOLDERS);
        localStorage.removeItem(STORAGE_KEYS.NOTES);
        localStorage.removeItem(STORAGE_KEYS.CONNECTIONS);
        // 延迟加载，确保 userId 已更新
        setTimeout(() => {
          loadData();
        }, 100);
      } else {
        setUserId(null);
        // 登出后清空数据，不显示用户笔记
        setFolders(initialFolders);
        setNotes(initialNotes);
        setConnections(initialConnections);
        setAISettings(initialAISettings);
        // 清空localStorage
        localStorage.removeItem(STORAGE_KEYS.FOLDERS);
        localStorage.removeItem(STORAGE_KEYS.NOTES);
        localStorage.removeItem(STORAGE_KEYS.CONNECTIONS);
        localStorage.removeItem(STORAGE_KEYS.AI_SETTINGS);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 从localStorage加载数据
  const loadLocalData = useCallback(async () => {
    try {
      // 加载文件夹
      const storedFolders = localStorage.getItem(STORAGE_KEYS.FOLDERS);
      if (storedFolders) {
        setFolders(JSON.parse(storedFolders));
      }

      // 加载笔记
      const storedNotes = localStorage.getItem(STORAGE_KEYS.NOTES);
      if (storedNotes) {
        const loadedNotes = JSON.parse(storedNotes);
        setNotes(loadedNotes);
      }

      // 加载连接
      const storedConnections = localStorage.getItem(STORAGE_KEYS.CONNECTIONS);
      if (storedConnections) {
        setConnections(JSON.parse(storedConnections));
      }

      // 加载AI设置
      const storedAISettings = localStorage.getItem(STORAGE_KEYS.AI_SETTINGS);
      if (storedAISettings) {
        setAISettings(JSON.parse(storedAISettings));
      }
    } catch (error) {
      console.error('加载本地数据失败:', error);
      // 使用初始数据作为后备
    }
  }, []);

  // 从数据库或localStorage加载数据
  const loadData = useCallback(async () => {
    try {
      if (userId) {
        // 登录状态，从数据库加载
        
        // 先清空默认数据，避免显示示例笔记
        setFolders([]);
        setNotes([]);
        setConnections([]);
        
        // 先尝试从localStorage加载，确保用户能立即看到数据
        const localFolders = localStorage.getItem(STORAGE_KEYS.FOLDERS);
        const localNotes = localStorage.getItem(STORAGE_KEYS.NOTES);
        
        if (localFolders) {
          try {
            const parsed = JSON.parse(localFolders);
            setFolders(parsed);
            console.log('>>> [DEBUG] 从localStorage加载文件夹成功');
          } catch (e) {
            console.error('解析本地文件夹失败:', e);
          }
        }
        
        if (localNotes) {
          try {
            const parsed = JSON.parse(localNotes);
            setNotes(parsed);
            console.log('>>> [DEBUG] 从localStorage加载笔记成功');
          } catch (e) {
            console.error('解析本地笔记失败:', e);
          }
        }
        
        // 然后从云端同步（后台静默执行）
        try {
          // 加载文件夹
          const { data: foldersData, error: foldersError } = await supabase
            .from('folders')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });
          
          if (foldersError) {
            console.error('加载文件夹失败:', foldersError);
          } else if (foldersData) {
            // 转换数据格式
            const formattedFolders = foldersData.map(f => ({
              id: f.id,
              name: f.name,
              parentId: f.parent_id,
              isExpanded: f.is_expanded
            }));
            setFolders(formattedFolders);
            // 缓存到localStorage
            localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(formattedFolders));
            console.log('>>> [DEBUG] 从云端同步文件夹成功');
          }
        } catch (e) {
          console.log('>>> [DEBUG] 云端同步文件夹失败，使用本地数据:', e);
        }

        // 加载笔记
        const { data: notesData, error: notesError } = await supabase
          .from('notes')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });
        
        if (notesError) {
          console.error('加载笔记失败:', notesError);
        } else if (notesData) {
          // 转换云端数据格式
          const cloudNotes = notesData.map(n => {
            // 转换mindmap格式：旧格式 { links, nodes } -> 新格式 { nodes }
            let mindmap = n.mindmap;
            if (mindmap && mindmap.links && mindmap.nodes) {
              // 旧格式，只保留nodes
              mindmap = { nodes: mindmap.nodes };
              console.log('>>> [DEBUG] 转换mindmap格式:', n.id, '从旧格式到新格式，节点数:', mindmap.nodes.length);
            }
            console.log('>>> [DEBUG] 云端笔记:', n.id, 'folder_id:', n.folder_id, 'updated_at:', n.updated_at);
            return {
              id: n.id,
              title: n.title,
              content: n.content,
              folderId: n.folder_id,
              tags: n.tags || [],
              createdAt: n.created_at,
              updatedAt: n.updated_at,
              sourceUrl: n.source_url,
              sourcePlatform: n.source_platform,
              mindmap: mindmap,
              mindmapMarkdown: n.mindmap_markdown,
              metadata: n.metadata || {}
            };
          });
          
          // 获取已删除的笔记ID列表
          const deletedIdsStr = localStorage.getItem('deleted_note_ids');
          const deletedIds = deletedIdsStr ? JSON.parse(deletedIdsStr).map((d: any) => d.id) : [];
          console.log('>>> [DEBUG] 已删除的笔记ID:', deletedIds);
          
          // 过滤掉已删除的云端笔记
          const filteredCloudNotes = cloudNotes.filter(n => !deletedIds.includes(n.id));
          console.log('>>> [DEBUG] 过滤后云端笔记:', filteredCloudNotes.length, '原云端笔记:', cloudNotes.length);
          
          // 获取本地笔记
          const localNotesStr = localStorage.getItem(STORAGE_KEYS.NOTES);
          let localNotes: Note[] = [];
          try {
            if (localNotesStr) {
              localNotes = JSON.parse(localNotesStr);
              console.log('>>> [DEBUG] 从localStorage读取笔记:', localNotes.length);
              // 打印第一条笔记的mindmap信息
              if (localNotes.length > 0) {
                const firstNote = localNotes[0];
                console.log('>>> [DEBUG] 第一条笔记:', firstNote.id, '更新时间:', firstNote.updatedAt, 'mindmap节点数:', firstNote.mindmap?.nodes?.length || 0);
              }
            } else {
              console.log('>>> [DEBUG] localStorage中没有笔记数据');
            }
          } catch (e) {
            console.error('解析本地笔记失败:', e);
          }
          
          // 云端为主策略：优先使用云端数据
          // 但检测本地是否有未同步的更新（本地时间比云端新超过5秒）
          const SYNC_THRESHOLD = 5000; // 5秒阈值
          const notesToSync: Note[] = []; // 需要同步到云端的笔记
          
          // 辅助函数：统一解析时间戳（确保按UTC处理）
          const parseTimestamp = (timeStr: string): number => {
            // 标准化时间字符串
            let normalized = timeStr.trim();
            
            // 如果末尾没有Z且没有时区偏移，添加Z表示UTC
            if (!normalized.endsWith('Z') && !normalized.match(/[+-]\d{2}:\d{2}$/)) {
              normalized = normalized + 'Z';
            }
            
            // 使用 Date.parse 或 new Date 解析，确保统一按UTC处理
            const timestamp = Date.parse(normalized);
            
            // 如果解析失败，尝试直接作为时间戳处理
            if (isNaN(timestamp)) {
              console.warn('>>> [DEBUG] 时间解析失败:', timeStr);
              return 0;
            }
            
            return timestamp;
          };
          
          const mergedNotes = filteredCloudNotes.map(cloudNote => {
            const localNote = localNotes.find(n => n.id === cloudNote.id);
            if (localNote) {
              const cloudTime = parseTimestamp(cloudNote.updatedAt);
              const localTime = parseTimestamp(localNote.updatedAt);
              const timeDiff = localTime - cloudTime;
              
              // 调试：打印时间比较详情
              console.log('>>> [DEBUG] 时间比较:', {
                id: localNote.id,
                cloudTime: cloudNote.updatedAt,
                localTime: localNote.updatedAt,
                cloudTimestamp: cloudTime,
                localTimestamp: localTime,
                timeDiff: timeDiff + 'ms',
                cloudMindmapNodes: cloudNote.mindmap?.nodes?.length || 0,
                localMindmapNodes: localNote.mindmap?.nodes?.length || 0
              });
              
              // 如果本地时间比云端新超过5秒，说明有未同步的本地更新
              if (timeDiff > SYNC_THRESHOLD) {
                console.log('>>> [DEBUG] 本地有未同步更新:', localNote.id, '时间差:', timeDiff, 'ms');
                notesToSync.push(localNote);
                return localNote; // 暂时使用本地数据
              } else if (timeDiff < -SYNC_THRESHOLD) {
                // 云端明显更新，使用云端数据
                console.log('>>> [DEBUG] 使用云端数据:', cloudNote.id, 'folderId:', cloudNote.folderId);
                return cloudNote;
              } else {
                // 时间差在阈值内，合并数据：使用云端基础数据，但保留本地mindmap（如果本地有而云端没有）
                console.log('>>> [DEBUG] 合并数据:', localNote.id);
                const mergedNote = { ...cloudNote };
                // 如果本地有mindmap但云端没有，保留本地mindmap
                if (localNote.mindmap?.nodes?.length > 0 && !cloudNote.mindmap?.nodes?.length) {
                  mergedNote.mindmap = localNote.mindmap;
                  mergedNote.mindmapMarkdown = localNote.mindmapMarkdown;
                  console.log('>>> [DEBUG] 保留本地mindmap:', localNote.id, '节点数:', localNote.mindmap.nodes.length);
                }
                return mergedNote;
              }
            }
            return cloudNote;
          });
          
          // 添加本地有但云端没有的笔记（新建的内容）
          const cloudIds = new Set(filteredCloudNotes.map(n => n.id));
          const localOnlyNotes = localNotes.filter(n => !cloudIds.has(n.id));
          notesToSync.push(...localOnlyNotes);
          
          const finalNotes = [...mergedNotes, ...localOnlyNotes];
          
          setNotes(finalNotes);
          // 保存到localStorage
          localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(finalNotes));
          console.log('>>> [DEBUG] 从云端同步完成:', finalNotes.length, '需要同步到云端:', notesToSync.length);
          
          // 将未同步的本地更新推送到云端
          if (notesToSync.length > 0) {
            console.log('>>> [DEBUG] 开始将本地更新同步到云端...');
            for (const note of notesToSync) {
              try {
                const { error } = await supabase
                  .from('notes')
                  .upsert({
                    id: note.id,
                    user_id: userId,
                    title: note.title,
                    content: note.content,
                    folder_id: note.folderId,
                    tags: note.tags,
                    updated_at: note.updatedAt,
                    mindmap: note.mindmap,
                    mindmap_markdown: note.mindmapMarkdown
                  });
                if (error) {
                  console.error('同步笔记到云端失败:', note.id, error);
                } else {
                  console.log('>>> [DEBUG] 本地更新已同步到云端:', note.id);
                }
              } catch (e) {
                console.error('同步笔记异常:', note.id, e);
              }
            }
          }
        }

        // 加载连接
        const { data: connectionsData, error: connectionsError } = await supabase
          .from('connections')
          .select('*')
          .eq('user_id', userId);
        
        if (connectionsError) {
          console.error('加载连接失败:', connectionsError);
        } else if (connectionsData) {
          // 转换数据格式
          const formattedConnections = connectionsData.map(c => ({
            id: c.id,
            fromId: c.from_id,
            toId: c.to_id,
            type: c.type as ConnectionType,
            label: c.label
          }));
          // 获取有效的笔记ID列表（用于过滤无效的connections）
          const validNoteIds = new Set(finalNotes.map(n => n.id));
          // 过滤掉引用了不存在笔记的connections
          const validConnections = formattedConnections.filter(
            c => validNoteIds.has(c.fromId) && validNoteIds.has(c.toId)
          );
          console.log('>>> [DEBUG] 加载connections:', formattedConnections.length, '过滤后:', validConnections.length);
          setConnections(validConnections);
        }

        // 加载AI设置
        const { data: aiSettingsData, error: aiSettingsError } = await supabase
          .from('ai_settings')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (aiSettingsError) {
          if (aiSettingsError.code !== 'PGRST116') { // 没有找到记录
            console.error('加载AI设置失败:', aiSettingsError);
          }
        } else if (aiSettingsData) {
          // 转换数据格式
          let formattedAISettings: AISettings = { ...initialAISettings };
          
          if (aiSettingsData.settings_json) {
            // 使用新的settings_json格式
            try {
              const settingsJson = typeof aiSettingsData.settings_json === 'string' 
                ? JSON.parse(aiSettingsData.settings_json) 
                : aiSettingsData.settings_json;
              formattedAISettings = {
                platform: aiSettingsData.platform as AIPlatform,
                model: aiSettingsData.model,
                apiKey: aiSettingsData.api_key || '',
                selectedApi: settingsJson.selectedApi || aiSettingsData.platform,
                keyTokens: settingsJson.keyTokens || {},
                selectedModels: settingsJson.selectedModels || { [aiSettingsData.platform]: aiSettingsData.model }
              };
            } catch (e) {
              console.error('解析settings_json失败:', e);
              // 降级到旧格式
              formattedAISettings = {
                platform: aiSettingsData.platform as AIPlatform,
                model: aiSettingsData.model,
                apiKey: aiSettingsData.api_key || ''
              };
            }
          } else {
            // 使用旧格式
            formattedAISettings = {
              platform: aiSettingsData.platform as AIPlatform,
              model: aiSettingsData.model,
              apiKey: aiSettingsData.api_key || ''
            };
          }
          
          setAISettings(formattedAISettings);
          // 保存到localStorage（仅存储keyTokens）
          if (formattedAISettings.selectedApi) {
            localStorage.setItem(STORAGE_KEYS.AI_SETTINGS, JSON.stringify(formattedAISettings));
          }
        }
      } else {
        // 未登录状态，从localStorage加载
        await loadLocalData();
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      // 失败时从localStorage加载
      await loadLocalData();
    }
  }, [userId, loadLocalData]);

  // 初始化加载数据
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 保存数据到localStorage（仅用于未登录状态或作为本地缓存）
  const saveData = useCallback(async () => {
    try {
      // 保存到localStorage（作为本地缓存）
      localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders));
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
      localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(connections));
      localStorage.setItem(STORAGE_KEYS.AI_SETTINGS, JSON.stringify(aiSettings));
    } catch (error) {
      console.error('保存数据失败:', error);
    }
  }, [folders, notes, connections, aiSettings]);

  // 文件夹操作
  const createFolder = useCallback(async (name: string, parentId: string | null = null): Promise<Folder> => {
    try {
      // 本地创建文件夹
      const folder: Folder = { id: `f${Date.now()}`, name, parentId, isExpanded: true };
      setFolders(prev => [...prev, folder]);
      // 保存数据
      await saveData();
      
      // 如果登录状态，同步到数据库
      if (userId) {
        const { error } = await supabase
          .from('folders')
          .insert({
            id: folder.id,
            name: folder.name,
            parent_id: folder.parentId,
            is_expanded: folder.isExpanded,
            user_id: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        if (error) {
          console.error('同步新文件夹到数据库失败:', error);
        }
      }
      
      return folder;
    } catch (error) {
      console.error('创建文件夹失败:', error);
      // 本地创建作为后备
      const folder: Folder = { id: `f${Date.now()}`, name, parentId, isExpanded: true };
      setFolders(prev => [...prev, folder]);
      await saveData();
      return folder;
    }
  }, [saveData, userId]);

  const renameFolder = useCallback(async (id: string, name: string) => {
    try {
      // 本地更新文件夹
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
      // 保存数据
      await saveData();
      
      // 如果登录状态，同步到数据库
      if (userId) {
        const { error } = await supabase
          .from('folders')
          .update({
            name: name,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .eq('user_id', userId);
        if (error) {
          console.error('同步文件夹重命名到数据库失败:', error);
        }
      }
    } catch (error) {
      console.error('重命名文件夹失败:', error);
      // 本地更新作为后备
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
      await saveData();
    }
  }, [saveData, userId]);

  const deleteFolder = useCallback(async (id: string) => {
    try {
      // 递归获取所有子文件夹ID
      const getDescendantIds = (folderId: string, allFolders: Folder[]): string[] => {
        const children = allFolders.filter(f => f.parentId === folderId);
        return [folderId, ...children.flatMap(c => getDescendantIds(c.id, allFolders))];
      };
      
      // 先计算要删除的文件夹ID
      const toDelete = getDescendantIds(id, folders);
      
      // 计算更新后的数据
      const updatedFolders = folders.filter(f => !toDelete.includes(f.id));
      const updatedNotes = notes.filter(n => !toDelete.includes(n.folderId || ''));
      const updatedConnections = connections.filter(c => !toDelete.includes(c.fromId) && !toDelete.includes(c.toId));
      
      // 更新状态
      setFolders(updatedFolders);
      setNotes(updatedNotes);
      setConnections(updatedConnections);
      
      // 直接保存更新后的数据到 localStorage（不依赖 saveData 的闭包状态）
      if (!userId) {
        localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(updatedFolders));
        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(updatedNotes));
        localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(updatedConnections));
        localStorage.setItem(STORAGE_KEYS.AI_SETTINGS, JSON.stringify(aiSettings));
      } else {
        // 如果登录状态，从数据库中删除
        for (const folderId of toDelete) {
          const { error } = await supabase
            .from('folders')
            .delete()
            .eq('id', folderId)
            .eq('user_id', userId);
          if (error) {
            console.error('从数据库删除文件夹失败:', error);
          }
        }
        // 同时更新 localStorage 作为本地缓存
        localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(updatedFolders));
        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(updatedNotes));
        localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(updatedConnections));
      }
    } catch (error) {
      console.error('删除文件夹失败:', error);
    }
  }, [userId, folders, notes, connections, aiSettings]);

  const toggleFolderExpand = useCallback(async (id: string) => {
    try {
      // 获取当前展开状态
      const currentFolder = folders.find(f => f.id === id);
      const newExpandedState = !currentFolder?.isExpanded;
      
      // 本地更新文件夹展开状态
      setFolders(prev => {
        const folder = prev.find(f => f.id === id);
        if (!folder) return prev;
        return prev.map(f => f.id === id ? { ...f, isExpanded: !f.isExpanded } : f);
      });
      // 保存数据
      await saveData();
      
      // 如果登录状态，同步到数据库
      if (userId) {
        const { error } = await supabase
          .from('folders')
          .update({
            is_expanded: newExpandedState,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .eq('user_id', userId);
        if (error) {
          console.error('同步文件夹展开状态到数据库失败:', error);
        }
      }
    } catch (error) {
      console.error('切换文件夹展开状态失败:', error);
      // 本地更新作为后备
      setFolders(prev => prev.map(f => f.id === id ? { ...f, isExpanded: !f.isExpanded } : f));
      await saveData();
    }
  }, [saveData, userId, folders]);

  // 笔记操作
  const createNote = useCallback(async (title: string, folderId: string | null = null): Promise<Note> => {
    try {
      // 本地创建笔记
      const now = new Date().toISOString();
      const note: Note = {
        id: `n${Date.now()}`,
        title,
        content: `# ${title}\n\n在这里开始写作...`,
        folderId,
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
      setNotes(prev => [...prev, note]);
      setActiveNoteId(note.id);
      
      // 保存到localStorage
      await saveData();
      
      // 如果登录状态，同步到数据库
      if (userId) {
        const { error, data } = await supabase
          .from('notes')
          .insert({
            id: note.id,
            title: note.title,
            content: note.content,
            folder_id: note.folderId,
            tags: note.tags,
            user_id: userId,
            created_at: note.createdAt,
            updated_at: note.updatedAt
          });
        if (error) {
          console.error('同步新笔记到数据库失败:', error);
        }
      }
      
      return note;
    } catch (error) {
      console.error('创建笔记失败:', error);
      // 本地创建作为后备
      const now = new Date().toISOString();
      const note: Note = {
        id: `n${Date.now()}`,
        title,
        content: `# ${title}\n\n在这里开始写作...`,
        folderId,
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
      setNotes(prev => [...prev, note]);
      setActiveNoteId(note.id);
      await saveData();
      return note;
    }
  }, [saveData, userId]);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    try {
      console.log('>>> [DEBUG] updateNote 开始:', id, 'updates:', Object.keys(updates));
      // 本地更新笔记
      const updatedNote = { ...updates, updatedAt: new Date().toISOString() };
      let updatedNotes: Note[] = [];
      setNotes(prev => {
        updatedNotes = prev.map(n => n.id === id ? { ...n, ...updatedNote } : n);
        // 立即保存到localStorage（在回调内确保数据已更新）
        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(updatedNotes));
        const savedNote = updatedNotes.find(n => n.id === id);
        console.log('>>> [DEBUG] 已保存到localStorage:', id, 'mindmap节点数:', savedNote?.mindmap?.nodes?.length || 0);
        return updatedNotes;
      });
      
      // 如果登录状态，同步到数据库
      if (userId) {
        const { error } = await supabase
          .from('notes')
          .update({
            title: updates.title,
            content: updates.content,
            folder_id: updates.folderId,
            tags: updates.tags,
            source_url: updates.sourceUrl,
            source_platform: updates.sourcePlatform,
            mindmap: updates.mindmap,
            mindmap_markdown: updates.mindmapMarkdown,
            metadata: updates.metadata,
            updated_at: updatedNote.updatedAt
          })
          .eq('id', id);
        if (error) {
          console.error('同步笔记更新到数据库失败:', error);
        }
      }
    } catch (error) {
      console.error('更新笔记失败:', error);
      // 本地更新作为后备
      setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
      await saveData();
    }
  }, [saveData, userId]);

  const deleteNote = useCallback(async (id: string) => {
    try {
      // 计算新的笔记列表
      const updatedNotes = notes.filter(n => n.id !== id);
      const updatedConnections = connections.filter(c => c.fromId !== id && c.toId !== id);
      
      // 如果登录状态，先从数据库中删除
      if (userId) {
        // 删除相关连接
        const { error: connectionError } = await supabase
          .from('connections')
          .delete()
          .or(`from_id.eq.${id},to_id.eq.${id}`)
          .eq('user_id', userId);
        if (connectionError) {
          console.error('从数据库删除连接失败:', connectionError);
        }
        
        // 删除笔记
        const { error: noteError } = await supabase
          .from('notes')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);
        if (noteError) {
          console.error('从数据库删除笔记失败:', noteError);
          // 如果云端删除失败，不要继续本地删除，避免数据不一致
          throw new Error('云端删除失败');
        }
      }
      
      // 更新本地状态
      setNotes(updatedNotes);
      setConnections(updatedConnections);
      setActiveNoteId(prev => prev === id ? null : prev);
      
      // 保存到localStorage（无论是否登录都要保存）
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(updatedNotes));
      localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(updatedConnections));
      
      // 记录已删除的笔记ID，用于后续同步时识别
      const deletedIds = JSON.parse(localStorage.getItem('deleted_note_ids') || '[]');
      deletedIds.push({ id, deletedAt: new Date().toISOString() });
      localStorage.setItem('deleted_note_ids', JSON.stringify(deletedIds));
      
    } catch (error) {
      console.error('删除笔记失败:', error);
      // 本地删除作为后备
      const updatedNotes = notes.filter(n => n.id !== id);
      const updatedConnections = connections.filter(c => c.fromId !== id && c.toId !== id);
      
      setNotes(updatedNotes);
      setConnections(updatedConnections);
      setActiveNoteId(prev => prev === id ? null : prev);
      
      // 保存数据到localStorage
      try {
        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(updatedNotes));
        localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(updatedConnections));
      } catch (saveError) {
        console.error('保存数据失败:', saveError);
      }
    }
  }, [notes, connections, userId]);

  // 移动笔记到文件夹并更新分类
  const moveNoteToFolder = useCallback(async (noteId: string, folderId: string | null) => {
    try {
      // 获取目标文件夹的分类路径
      const getFolderPath = (fid: string | null): string => {
        if (!fid) return '未分类';
        const folder = folders.find(f => f.id === fid);
        if (!folder) return '未分类';
        
        const parentPath = folder.parentId ? getFolderPath(folder.parentId) : '';
        return parentPath ? `${parentPath}/${folder.name}` : folder.name;
      };
      
      const newCategoryPath = getFolderPath(folderId);
      const updateTime = new Date().toISOString();
      
      // 先获取当前笔记并创建更新后的版本
      const currentNote = notes.find(n => n.id === noteId);
      if (!currentNote) return;
      
      console.log('>>> [DEBUG] moveNoteToFolder:', { noteId, currentNoteFolderId: currentNote.folderId, targetFolderId: folderId });
      
      const updatedNote = { ...currentNote, folderId, updatedAt: updateTime };
      
      console.log('>>> [DEBUG] updatedNote:', { folderId: updatedNote.folderId, updatedAt: updatedNote.updatedAt });
      
      // 先计算更新后的笔记数组
      const updatedNotes = notes.map(n => n.id === noteId ? updatedNote : n);
      
      console.log('>>> [DEBUG] updatedNotes[0]:', updatedNotes[0]?.folderId, updatedNotes[0]?.updatedAt);
      
      // 本地更新笔记状态
      setNotes(updatedNotes);
      
      // 直接保存到localStorage（使用更新后的数据）
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(updatedNotes));
      console.log('>>> [DEBUG] 保存到localStorage完成');
      
      // 如果登录状态，同步到数据库
      if (userId) {
        console.log('>>> [DEBUG] 开始更新数据库:', noteId, 'folder_id:', folderId, 'updated_at:', updateTime);
        const { error, data } = await supabase
          .from('notes')
          .update({
            folder_id: folderId,
            updated_at: updateTime
          })
          .eq('id', noteId)
          .eq('user_id', userId)
          .select();
          
        if (error) {
          console.error('同步笔记移动到数据库失败:', error);
        } else {
          console.log('>>> [DEBUG] 笔记移动成功，分类路径:', newCategoryPath);
          // 同步成功后，立即更新本地存储的时间戳为最新
          const savedNotesStr = localStorage.getItem(STORAGE_KEYS.NOTES);
          if (savedNotesStr) {
            const savedNotes = JSON.parse(savedNotesStr);
            const updatedSavedNotes = savedNotes.map((n: Note) => 
              n.id === noteId ? { ...n, updatedAt: updateTime } : n
            );
            localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(updatedSavedNotes));
            console.log('>>> [DEBUG] 更新本地时间戳为最新:', updateTime);
          }
        }
      }
    } catch (error) {
      console.error('移动笔记失败:', error);
    }
  }, [folders, notes, userId]);

  // 连接操作
  const addConnection = useCallback(async (fromId: string, toId: string, type: ConnectionType, label?: string) => {
    try {
      // 本地添加连接
      const conn: Connection = { id: `c${Date.now()}`, fromId, toId, type, label };
      setConnections(prev => [...prev, conn]);
      // 保存数据
      await saveData();
      
      // 如果登录状态，同步到数据库
      if (userId) {
        const { error } = await supabase
          .from('connections')
          .insert({
            id: conn.id,
            from_id: conn.fromId,
            to_id: conn.toId,
            type: conn.type,
            label: conn.label,
            user_id: userId,
            created_at: new Date().toISOString()
          });
        if (error) {
          console.error('同步新连接到数据库失败:', error);
        }
      }
    } catch (error) {
      console.error('添加连接失败:', error);
      // 本地添加作为后备
      const conn: Connection = { id: `c${Date.now()}`, fromId, toId, type, label };
      setConnections(prev => [...prev, conn]);
      await saveData();
    }
  }, [saveData, userId]);

  const removeConnection = useCallback(async (id: string) => {
    try {
      // 本地删除连接
      setConnections(prev => prev.filter(c => c.id !== id));
      // 保存数据
      await saveData();
      
      // 如果登录状态，从数据库中删除
      if (userId) {
        const { error } = await supabase
          .from('connections')
          .delete()
          .eq('id', id);
        if (error) {
          console.error('从数据库删除连接失败:', error);
        }
      }
    } catch (error) {
      console.error('删除连接失败:', error);
      // 本地删除作为后备
      setConnections(prev => prev.filter(c => c.id !== id));
      await saveData();
    }
  }, [saveData, userId]);

  // AI设置操作
  const updateAISettings = useCallback(async (settings: Partial<AISettings>) => {
    try {
      // 本地更新AI设置
      const newSettings = {
        ...aiSettings,
        ...settings
      };
      setAISettings(newSettings);
      // 保存数据
      await saveData();
      
      // 如果登录状态，同步到数据库
      if (userId) {
        const settingsJson = JSON.stringify({
          selectedApi: newSettings.platform,
          apiKeys: { [newSettings.platform]: newSettings.apiKey },
          selectedModels: { [newSettings.platform]: newSettings.model }
        });
        
        // 尝试更新现有设置
        const { data: updateData, error: updateError } = await supabase
          .from('ai_settings')
          .update({
            settings_json: settingsJson,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();
        
        // 如果更新失败（没有找到记录），则创建新设置
        if (updateError || !updateData) {
          await supabase
            .from('ai_settings')
            .insert({
              user_id: userId,
              settings_json: settingsJson,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
        }
      }
    } catch (error) {
      console.error('更新AI设置失败:', error);
      // 本地更新作为后备
      setAISettings(prev => {
        const newSettings = { ...prev, ...settings };
        return newSettings;
      });
      await saveData();
    }
  }, [saveData, userId, aiSettings]);

  // 导入笔记
  const importNote = useCallback(async (noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> => {
    try {
      const now = new Date().toISOString();
      const note: Note = { ...noteData, id: `n${Date.now()}`, createdAt: now, updatedAt: now };
      setNotes(prev => [...prev, note]);
      setActiveNoteId(note.id);
      await saveData();
      
      if (userId) {
        const { error } = await supabase
          .from('notes')
          .insert({
            id: note.id,
            title: note.title,
            content: note.content,
            folder_id: note.folderId,
            tags: note.tags,
            source_url: note.sourceUrl,
            source_platform: note.sourcePlatform,
            mindmap: note.mindmap,
            mindmap_markdown: note.mindmapMarkdown,
            metadata: note.metadata,
            user_id: userId,
            created_at: note.createdAt,
            updated_at: note.updatedAt
          });
        if (error) {
          console.error('同步导入笔记到数据库失败:', error);
        }
      }

      // 如果没有摘要且内容超过 100 字，延迟生成摘要
      if (!note.metadata?.summary && note.content && note.content.length > 100) {
        setTimeout(async () => {
          const summary = await generateNoteSummary(note.id, note.title, note.content);
          if (summary) {
            const updatedNote = { ...note, metadata: { ...note.metadata, summary } };
            setNotes(prev => prev.map(n => n.id === note.id ? updatedNote : n));
            
            if (userId) {
              await supabase
                .from('notes')
                .update({ metadata: updatedNote.metadata, updated_at: new Date().toISOString() })
                .eq('id', note.id);
            }
          }
        }, 2000);
      }
      
      return note;
    } catch (error) {
      console.error('导入笔记失败:', error);
      const now = new Date().toISOString();
      const note: Note = { ...noteData, id: `n${Date.now()}`, createdAt: now, updatedAt: now };
      setNotes(prev => [...prev, note]);
      setActiveNoteId(note.id);
      await saveData();
      return note;
    }
  }, [saveData, userId]);

  // 基于内容提取核心主题标签
  const extractTagsFromContent = (content: string): string[] => {
    // 提取标题和关键内容
    const lines = content.split('\n');
    const keywords = new Set<string>();
    
    // 提取标题中的关键词
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('#')) {
        const title = trimmedLine.replace(/^#+/, '').trim();
        // 分割标题中的关键词
        const titleWords = title.split(/[\s，,]+/).filter(word => word.length > 2);
        titleWords.forEach(word => keywords.add(word));
      }
    });
    
    // 提取内容中的关键短语
    const contentText = content.replace(/^#+.+/gm, '').trim();
    const keyPhrases = [
      '言语理解', '解题方法', '万能公式', '判断法', '错误选项', '极简口诀',
      '阅读技巧', '写作方法', '学习策略', '思维方法', '考试技巧',
      '知识点', '方法论', '步骤', '技巧', '策略', '方法'
    ];
    
    keyPhrases.forEach(phrase => {
      if (contentText.includes(phrase)) {
        keywords.add(phrase);
      }
    });
    
    // 过滤掉不需要的标签
    const filteredKeywords = Array.from(keywords).filter(keyword => {
      const forbiddenTags = ['豆包', 'AI', '对话', '系统', '工具', '平台'];
      return !forbiddenTags.some(tag => keyword.includes(tag));
    });
    
    // 取前3个核心标签
    return filteredKeywords.slice(0, 3);
  };

  // 创建文件夹结构
  const createFolderStructure = useCallback(async (categoryPath: string) => {
    if (!categoryPath || categoryPath === '未分类') {
      return null;
    }
    
    const pathParts = categoryPath.split('/').filter(part => part.trim() !== '');
    
    // 先同步计算最终的文件夹ID和需要创建的新文件夹
    let currentParentId: string | null = null;
    const newFolders: Folder[] = [];
      pathParts.forEach((folderName, index) => {
      // 在当前状态和正在创建的文件夹中查找同名文件夹
      const existingFolder = [
        ...folders,
        ...newFolders
      ].find(f => f.name === folderName && f.parentId === currentParentId);
      
      if (existingFolder) {
        // 文件夹已存在，直接使用其ID
        // 不管文件夹里有什么（空的、有笔记、有子文件夹），都直接使用
        currentParentId = existingFolder.id;
      } else {
        // 文件夹不存在，准备创建新文件夹
        const newFolderId = `f${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
        const newFolder: Folder = {
          id: newFolderId,
          name: folderName,
          parentId: currentParentId,
          isExpanded: true
        };
        newFolders.push(newFolder);
        currentParentId = newFolderId;
      }
    });
    
    // 如果有新文件夹需要创建，使用函数式更新
    if (newFolders.length > 0) {
      setFolders(prev => [...prev, ...newFolders]);
      
      // 如果登录状态，同步文件夹到数据库
      if (userId) {
        for (const folder of newFolders) {
          const { error } = await supabase
            .from('folders')
            .insert({
              id: folder.id,
              name: folder.name,
              parent_id: folder.parentId,
              is_expanded: folder.isExpanded,
              user_id: userId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          if (error) {
            console.error('同步文件夹到数据库失败:', error);
          }
        }
      }
    }
    
    // 返回最终的文件夹ID（同步返回，确保正确）
    return currentParentId;
  }, [folders, userId]);

  // 移动文件夹到新的父文件夹
  const moveFolder = useCallback(async (folderId: string, newParentId: string | null) => {
    try {
      // 本地更新文件夹
      setFolders(prev => prev.map(f => 
        f.id === folderId 
          ? { ...f, parentId: newParentId }
          : f
      ));
      
      // 保存到localStorage
      await saveData();
      
      // 如果登录状态，同步到数据库
      if (userId) {
        const { error } = await supabase
          .from('folders')
          .update({
            parent_id: newParentId,
            updated_at: new Date().toISOString()
          })
          .eq('id', folderId)
          .eq('user_id', userId);
          
        if (error) {
          console.error('同步文件夹移动到数据库失败:', error);
        } else {
          console.log('>>> [DEBUG] 文件夹移动成功');
        }
      }
    } catch (error) {
      console.error('移动文件夹失败:', error);
    }
  }, [saveData, userId]);

  // 解析链接
  const parseLink = useCallback(async (url: string, categoryPath?: string) => {
    try {
      const now = new Date().toISOString();
      
      // 构建请求头
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // 添加AI设置
      if (aiSettings && aiSettings.apiKey) {
        headers['X-API-Key'] = aiSettings.apiKey;
        headers['X-AI-Platform'] = aiSettings.platform;
        headers['X-AI-Model'] = aiSettings.model;
      }
      
      // 调用后端API解析链接
      const API_BASE_URL = '/api';
      const response = await fetch(`${API_BASE_URL}/parse-link-new`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }
      
      const parseResult = await response.json();
      
      if (!parseResult.success || !parseResult.note) {
        throw new Error(parseResult.error || '解析失败，请检查链接是否有效');
      }
      
      // 提取核心主题标签
      const tags = parseResult.note.tags || [];
      
      // 创建文件夹结构（现在需要await，因为函数是异步的）
      const folderId = await createFolderStructure(categoryPath || parseResult.category_path || '');
      
      const noteWithMindmap: Note = {
        id: `n${Date.now()}`,
        title: parseResult.note.title,
        content: parseResult.note.content,
        folderId: folderId,
        tags: tags.length > 0 ? tags : ['未分类'],
        createdAt: now,
        updatedAt: now,
        sourceUrl: url,
        sourcePlatform: parseResult.note.sourcePlatform || '未知',
        mindmap: parseResult.mindmap,
        mindmapMarkdown: parseResult.mindmap_markdown
      };
      
      // 保存到本地状态
      setNotes(prev => [...prev, noteWithMindmap]);
      setActiveNoteId(noteWithMindmap.id);
      // 保存到localStorage
      saveData();
      
      // 如果登录状态，同步到数据库
      if (userId) {
        
        const { error, data } = await supabase
          .from('notes')
          .insert({
            id: noteWithMindmap.id,
            title: noteWithMindmap.title,
            content: noteWithMindmap.content,
            folder_id: noteWithMindmap.folderId,
            tags: noteWithMindmap.tags,
            source_url: noteWithMindmap.sourceUrl,
            source_platform: noteWithMindmap.sourcePlatform,
            mindmap: noteWithMindmap.mindmap,
            mindmap_markdown: noteWithMindmap.mindmapMarkdown,
            user_id: userId,
            created_at: noteWithMindmap.createdAt,
            updated_at: noteWithMindmap.updatedAt
          });
        if (error) {
          console.error('同步AI分类笔记到数据库失败:', error);
        }
      }
      
      // 返回解析结果
      return {
        success: true,
        note: noteWithMindmap,
        mindmap: noteWithMindmap.mindmap,
        mindmap_markdown: noteWithMindmap.mindmapMarkdown
      };
    } catch (error) {
      console.error('解析链接失败:', error);
      return { success: false, error: String(error) };
    }
  }, [saveData, createFolderStructure, userId]);

  // 测试API连接
  const testAPIConnection = useCallback(async (platform: string, apiKey: string) => {
    try {
      // 模拟API连接测试
      // 简单逻辑：如果apiKey不为空，返回成功
      return apiKey.trim() !== '';
    } catch (error) {
      console.error('测试API连接失败:', error);
      return false;
    }
  }, []);

  return (
    <NoteContext.Provider value={{
      folders, notes, connections,
      activeNoteId, activeFolderId, activeView,
      searchQuery, isSearchOpen, isAISettingsOpen, isLinkParseOpen, isPasswordChangeOpen,
      aiSettings, sidebarCollapsed, userId,
      setActiveNote: setActiveNoteId,
      setActiveFolder: setActiveFolderId,
      setActiveView,
      setSearchQuery,
      setSearchOpen,
      setAISettingsOpen,
      setLinkParseOpen,
      setPasswordChangeOpen,
      setSidebarCollapsed,
      setNotes,
      setActiveNoteId,
      setUserId,
      createFolder, renameFolder, deleteFolder, toggleFolderExpand, moveFolder,
      createFolderStructure,
      createNote, updateNote, deleteNote, moveNoteToFolder,
      addConnection, removeConnection,
      updateAISettings,
      importNote,
      parseLink,
      testAPIConnection,
      loadData,
      saveData,
    }}>
      {children}
    </NoteContext.Provider>
  );
}

export function useNoteStore() {
  const ctx = useContext(NoteContext);
  if (!ctx) throw new Error('useNoteStore must be used within NoteProvider');
  return ctx;
}

export const CONNECTION_COLORS: Record<ConnectionType, string> = {
  related: '#22d3ee',
  extended: '#a78bfa',
  contrast: '#f87171',
  dependent: '#34d399',
};

export const CONNECTION_LABELS: Record<ConnectionType, string> = {
  related: '相关',
  extended: '拓展',
  contrast: '对比',
  dependent: '依赖',
};
