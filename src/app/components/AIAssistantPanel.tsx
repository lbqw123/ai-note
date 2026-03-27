import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Brain, Loader2, MessageCircle, Zap, BookOpen, TrendingUp, Copy, Check } from 'lucide-react';
import { useNoteStore } from '../store/noteStore';
import { supabase } from '../../lib/supabase';
import { encryptApiKey } from '../utils/aiService';

const API_BASE_URL = '/api';

// 当前范围信息组件
function ScopeInfo({ darkMode }: { darkMode: boolean }) {
  const { notes, folders, activeNoteId, activeFolderId } = useNoteStore();

  const getFolderPath = (folderId: string | null): string => {
    if (!folderId) return '根目录';
    const path: string[] = [];
    let currentId: string | null = folderId;
    while (currentId) {
      const folder = folders.find(f => f.id === currentId);
      if (!folder) break;
      path.unshift(folder.name);
      currentId = folder.parentId;
    }
    return path.join(' → ');
  };

  // 获取复习提醒
  const getReviewReminders = () => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;

    const needsReview: { note: any; daysSince: number }[] = [];

    notes.forEach(note => {
      const lastReviewed = note.metadata?.lastReviewedAt;
      if (lastReviewed) {
        const daysSince = Math.floor((now - new Date(lastReviewed).getTime()) / dayMs);
        if (daysSince >= 7) {
          needsReview.push({ note, daysSince });
        }
      } else {
        const createdAt = new Date(note.createdAt).getTime();
        const daysSince = Math.floor((now - createdAt) / dayMs);
        if (daysSince >= 7) {
          needsReview.push({ note, daysSince });
        }
      }
    });

    return needsReview.sort((a, b) => b.daysSince - a.daysSince).slice(0, 3);
  };

  // 获取当前范围的笔记数量
  const getScopeInfo = () => {
    if (activeNoteId) {
      const note = notes.find(n => n.id === activeNoteId);
      if (note) {
        return {
          type: 'note',
          name: note.title,
          count: 1,
          path: getFolderPath(note.folderId),
        };
      }
    }

    if (activeFolderId) {
      const folder = folders.find(f => f.id === activeFolderId);
      if (folder) {
        const folderNotes = notes.filter(n => {
          if (n.folderId === activeFolderId) return true;
          let parent = folders.find(f => f.id === n.folderId);
          while (parent) {
            if (parent.id === activeFolderId) return true;
            parent = folders.find(f => f.id === parent?.parentId);
          }
          return false;
        });
        return {
          type: 'folder',
          name: folder.name,
          count: folderNotes.length,
          path: getFolderPath(activeFolderId),
        };
      }
    }

    return {
      type: 'all',
      name: '全部笔记',
      count: notes.length,
      path: '所有文件夹',
    };
  };

  const scope = getScopeInfo();
  const icon = scope.type === 'note' ? '📄' : scope.type === 'folder' ? '📁' : '📚';
  const reviewReminders = getReviewReminders();

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="text-sm font-medium" style={{ color: darkMode ? '#e2e8f0' : '#1e293b' }}>
          {scope.name}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{
            background: darkMode ? 'rgba(124,90,240,0.2)' : 'rgba(124,90,240,0.1)',
            color: '#7c5af0',
          }}
        >
          {scope.count} 篇
        </span>
      </div>
      <p className="text-xs truncate" style={{ color: darkMode ? '#64748b' : '#94a3b8' }}>
        {scope.path}
      </p>

      {reviewReminders.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}` }}>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs" style={{ color: '#f59e0b' }}>⏰</span>
            <span className="text-xs font-medium" style={{ color: darkMode ? '#f59e0b' : '#d97706' }}>
              复习提醒
            </span>
          </div>
          <div className="space-y-1.5">
            {reviewReminders.map(({ note, daysSince }) => (
              <div
                key={note.id}
                className="flex items-center justify-between text-xs px-2 py-1 rounded"
                style={{ background: darkMode ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)' }}
              >
                <span className="truncate flex-1" style={{ color: darkMode ? '#fcd34d' : '#92400e' }}>
                  {note.title}
                </span>
                <span className="text-xs ml-2" style={{ color: darkMode ? '#fbbf24' : '#b45309' }}>
                  {daysSince}天未复习
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Markdown 渲染组件
function MarkdownRenderer({ content, darkMode }: { content: string; darkMode: boolean }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let listItems: string[] = [];
  let tableRows: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${i}`} className="mb-3 ml-4 space-y-1">
          {listItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2" style={{ color: darkMode ? '#cbd5e1' : '#475569' }}>
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
              <span>{renderInlineMarkdown(item, darkMode)}</span>
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const flushTable = () => {
    if (tableRows.length >= 2) {
      const headers = tableRows[0].split('|').map(h => h.trim()).filter(Boolean);
      const dataRows = tableRows.slice(2).filter(row => row.includes('|'));
      
      elements.push(
        <div key={`table-${i}`} className="mb-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse" style={{ border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}` }}>
            <thead>
              <tr style={{ background: darkMode ? 'rgba(124,90,240,0.15)' : 'rgba(124,90,240,0.08)' }}>
                {headers.map((h, idx) => (
                  <th key={idx} className="px-3 py-2 text-left font-semibold" style={{ border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, color: darkMode ? '#e2e8f0' : '#1e293b' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rowIdx) => {
                const cells = row.split('|').map(c => c.trim()).filter(Boolean);
                return (
                  <tr key={rowIdx} style={{ background: rowIdx % 2 === 0 ? (darkMode ? 'transparent' : '#ffffff') : (darkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc') }}>
                    {cells.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-3 py-2" style={{ border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, color: darkMode ? '#cbd5e1' : '#475569' }}>
                        {renderInlineMarkdown(cell, darkMode)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 表格处理
    if (trimmed.startsWith('|')) {
      tableRows.push(trimmed);
      i++;
      continue;
    } else if (tableRows.length > 0) {
      flushTable();
    }

    // 列表处理
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || /^\d+\.\s/.test(trimmed)) {
      const item = trimmed.replace(/^[-•]\s+|^\d+\.\s+/, '');
      listItems.push(item);
      i++;
      continue;
    } else if (listItems.length > 0) {
      flushList();
    }

    // 标题
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-xl font-bold mb-4 mt-2" style={{ color: darkMode ? '#e2e8f0' : '#1e293b' }}>
          {renderInlineMarkdown(trimmed.slice(2), darkMode)}
        </h1>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-lg font-semibold mb-3 mt-4" style={{ color: darkMode ? '#e2e8f0' : '#1e293b' }}>
          {renderInlineMarkdown(trimmed.slice(3), darkMode)}
        </h2>
      );
    } else if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-base font-medium mb-2 mt-3" style={{ color: darkMode ? '#e2e8f0' : '#1e293b' }}>
          {renderInlineMarkdown(trimmed.slice(4), darkMode)}
        </h3>
      );
    } else if (trimmed === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      // 普通段落
      elements.push(
        <p key={i} className="mb-3 leading-relaxed" style={{ color: darkMode ? '#cbd5e1' : '#475569' }}>
          {renderInlineMarkdown(trimmed, darkMode)}
        </p>
      );
    }
    i++;
  }

  flushList();
  flushTable();

  return <div className="markdown-content">{elements}</div>;
}

// 行内 Markdown 渲染（粗体、斜体、代码等）
function renderInlineMarkdown(text: string, darkMode: boolean): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  // 匹配 **粗体**、*斜体*、`代码`、[链接](url)
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // 添加匹配前的文本
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    const matched = match[0];
    
    if (matched.startsWith('**') && matched.endsWith('**')) {
      // 粗体
      parts.push(
        <strong key={match.index} style={{ color: darkMode ? '#e2e8f0' : '#1e293b', fontWeight: 600 }}>
          {matched.slice(2, -2)}
        </strong>
      );
    } else if (matched.startsWith('*') && matched.endsWith('*') && !matched.startsWith('**')) {
      // 斜体
      parts.push(
        <em key={match.index} style={{ color: darkMode ? '#a78bfa' : '#7c5af0' }}>
          {matched.slice(1, -1)}
        </em>
      );
    } else if (matched.startsWith('`') && matched.endsWith('`')) {
      // 行内代码
      parts.push(
        <code key={match.index} className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: darkMode ? 'rgba(124,90,240,0.2)' : 'rgba(124,90,240,0.1)', color: '#7c5af0' }}>
          {matched.slice(1, -1)}
        </code>
      );
    } else if (matched.startsWith('[')) {
      // 链接 [text](url)
      const linkMatch = matched.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        parts.push(
          <a key={match.index} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="underline hover:text-purple-400 transition-colors" style={{ color: '#7c5af0' }}>
            {linkMatch[1]}
          </a>
        );
      }
    }
    
    lastIndex = regex.lastIndex;
  }
  
  // 添加剩余文本
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
  sources?: { id: string; title: string }[];
}

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { icon: <MessageCircle className="w-3.5 h-3.5" />, label: '知识问答', prompt: '请基于我的笔记内容回答：' },
  { icon: <Zap className="w-3.5 h-3.5" />, label: '学习推荐', prompt: '根据我的笔记内容，推荐前置补充知识和进阶学习方向' },
  { icon: <TrendingUp className="w-3.5 h-3.5" />, label: '进度总结', prompt: '分析我的学习进度，基于文件夹和标签统计，给出薄弱点建议' },
];

const SYSTEM_PROMPT = `【角色】你是用户的AI学习规划专家和知识助手

【核心能力】
1. 知识问答：基于用户笔记准确回答，结合AI预训练知识补充
2. 学习推荐：分析知识结构，推荐前置补充和进阶方向
3. 进度总结：评估学习状态，识别薄弱点和提升建议

═══════════════════════════════════════════
【功能一：知识问答】
═══════════════════════════════════════════
当用户提问时：
1. 首先基于笔记内容回答（如果笔记覆盖了该知识点）
2. 利用AI预训练知识补充完善答案
3. 如果笔记信息不足，明确指出缺失部分
4. 在答案中标注参考来源

回答格式：
## 💡 回答

【基于笔记的回答...】

【AI知识补充...】

📚 参考笔记：
• [笔记标题] - 相关内容

═══════════════════════════════════════════
【功能二：学习推荐（核心功能）】
═══════════════════════════════════════════
分析用户当前学习内容，结合AI预训练知识推荐：

## 📖 前置知识补充（学习当前内容前）

| 补充知识 | 重要性 | 已有笔记 | 说明 |
|---------|-------|---------|------|
| xxx | ⭐⭐⭐ | ✅有/❌无 | 为什么需要 |

## 🚀 进阶学习方向（当前内容掌握后）

| 进阶方向 | 难度 | 已有笔记 | 价值 |
|---------|-----|---------|-----|
| xxx | 中/高 | ✅有/❌无 | 应用场景 |

推荐理由：基于AI预训练的标准学习路径 + 你的笔记结构

═══════════════════════════════════════════
【功能三：进度总结】
═══════════════════════════════════════════
分析用户在各领域的学习状态：

## 📊 学习进度总览

基于文件夹和标签分组统计：

| 分类 | 笔记数 | 主要内容 |
|-----|-------|---------|
| 📁 AI/机器学习 | 5篇 | GPT、深度学习、Transformer |
| 📁 编程开发 | 3篇 | Python、Web开发 |

## 🎯 薄弱点与建议
- 某个文件夹下的知识点较少，建议补充
- 某个文件夹笔记关联较少，可加强连接

## 📚 后续建议
1. 优先补充【空缺较大的分类】
2. 加强【已有笔记】的关联连接
3. 深化【高频访问】的主题

═══════════════════════════════════════════
【通用规则】
═══════════════════════════════════════════
- 用简洁专业的中文回答
- 结合笔记内容 + AI预训练知识
- 适当使用emoji（📚💡⚡✅📖🚀🎯📊🟢🟡🔴）
- 绝对禁止返回JSON格式

❌ 错误格式（禁止使用）：
\`\`\`json
{ "answer": "...", "recommendations": [...] }
\`\`\`
{ "answer": "..." }
任何 JSON 格式都是错误的！

【⚠️ 强制输出格式 - 必须遵守】
你的回答必须是纯 Markdown 文本，绝对禁止返回 JSON 或代码块！
✅ 正确格式（直接输出 Markdown）

【笔记信息说明】
笔记摘要包含：title（标题）、content（内容摘要）、tags（标签）、folderPath（文件夹路径，反映知识分类）`;

export function AIAssistantPanel({ darkMode }: { darkMode: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [latestAIMessage, setLatestAIMessage] = useState<Message | null>(null);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { notes, folders, activeNoteId, activeFolderId } = useNoteStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getFolderPath = (folderId: string | null): string => {
    if (!folderId) return '根目录';
    const buildPath = (id: string, path: string[] = []): string[] => {
      const folder = folders.find(f => f.id === id);
      if (!folder) return path;
      path.unshift(folder.name);
      if (folder.parentId) {
        return buildPath(folder.parentId, path);
      }
      return path;
    };
    return buildPath(folderId).join(' → ');
  };

  const getCurrentScope = (): { scope: 'all' | 'note' | 'folder'; notes: any[]; scopeName: string } => {
    if (activeFolderId) {
      const folder = folders.find(f => f.id === activeFolderId);
      if (folder) {
        const folderNotes = notes.filter(n => {
          const noteFolderId = n.folderId;
          if (noteFolderId === activeFolderId) return true;
          let parent = folders.find(f => f.id === noteFolderId);
          while (parent) {
            if (parent.id === activeFolderId) return true;
            parent = folders.find(f => f.id === parent?.parentId);
          }
          return false;
        }).map(note => ({
          ...note,
          folderPath: getFolderPath(note.folderId),
          content: (note.content || '').slice(0, 300) || '（无内容）',
          difficulty: (note as any).metadata?.difficulty || 1,
          status: (note as any).metadata?.learningStatus || 'new',
          summary: (note as any).metadata?.summary || '',
        }));

        return {
          scope: 'folder',
          notes: folderNotes,
          scopeName: folder.name,
        };
      }
    }

    if (activeNoteId) {
      const note = notes.find(n => n.id === activeNoteId);
      if (note) {
        const noteContent = note.content?.trim() || '';
        const noteData = {
          ...note,
          folderPath: getFolderPath(note.folderId),
          content: noteContent.slice(0, 500) || '（笔记暂无正文内容）',
          difficulty: (note as any).metadata?.difficulty || 1,
          status: (note as any).metadata?.learningStatus || 'new',
          summary: (note as any).metadata?.summary || '',
        };

        return {
          scope: 'note',
          notes: [noteData],
          scopeName: note.title,
        };
      }
    }

    if (activeFolderId) {
      const folder = folders.find(f => f.id === activeFolderId);
      if (folder) {
        const folderNotes = notes.filter(n => {
          const noteFolderId = n.folderId;
          if (noteFolderId === activeFolderId) return true;
          let parent = folders.find(f => f.id === noteFolderId);
          while (parent) {
            if (parent.id === activeFolderId) return true;
            parent = folders.find(f => f.id === parent?.parentId);
          }
          return false;
        }).map(note => ({
          ...note,
          folderPath: getFolderPath(note.folderId),
          content: (note.content || '').slice(0, 300) || '（无内容）',
          difficulty: (note as any).metadata?.difficulty || 1,
          status: (note as any).metadata?.learningStatus || 'new',
          summary: (note as any).metadata?.summary || '',
        }));

        if (folderNotes.length > 0) {
          return {
            scope: 'folder',
            notes: folderNotes,
            scopeName: folder.name,
          };
        }
      }
    }

    return {
      scope: 'all',
      notes: notes.map(note => ({
        ...note,
        folderPath: getFolderPath(note.folderId),
        content: (note.content || '').slice(0, 200) || '（无内容）',
        difficulty: (note as any).metadata?.difficulty || 1,
        status: (note as any).metadata?.learningStatus || 'new',
        summary: (note as any).metadata?.summary || '',
      })),
      scopeName: '全部笔记',
    };
  };

  const getNotesContext = (userQuery: string = '') => {
    if (notes.length === 0) {
      return '用户还没有创建任何笔记。快去创建你的第一篇笔记吧！';
    }

    const { scope, notes: scopeNotes, scopeName } = getCurrentScope();

    const contextScope = userQuery
      ? filterNotesByQuery(scopeNotes, userQuery)
      : scopeNotes;

    const scopeLabel = scope === 'note' ? '📄 单篇笔记' : scope === 'folder' ? '📁 文件夹' : '📚 全部笔记';
    const noteCount = contextScope.length;
    const useSummaryMode = noteCount > 10;

    let notesDetail = '';
    
    if (useSummaryMode) {
      // 摘要模式：超过 10 篇笔记
      notesDetail = contextScope.map((n, i) => {
        const summary = n.summary || n.content.slice(0, 100);
        return `${i + 1}. 【${n.title}】${n.summary ? '' : '（内容截取）'}
   📊 难度：${'⭐'.repeat(n.difficulty)}${'☆'.repeat(5 - n.difficulty)} | 状态：${getStatusLabel(n.status)}
   📝 ${summary}${summary.length >= 100 ? '...' : ''}`;
      }).join('\n');
    } else {
      // 详细模式：10 篇及以下
      notesDetail = contextScope.map((n, i) => `
${i + 1}. 【${n.title}】
   📁 位置：${n.folderPath}
   📊 难度：${'⭐'.repeat(n.difficulty)}${'☆'.repeat(5 - n.difficulty)}
   📈 状态：${getStatusLabel(n.status)}
   🏷️ 标签：${n.tags.join(', ') || '无'}
   ${n.summary ? `📝 摘要：${n.summary}` : `📝 内容：${n.content}${n.content.length >= 300 ? '...' : ''}`}
`).join('\n');
    }

    // 生成文件夹汇总（仅文件夹/全部模式且笔记多时）
    let folderSummary = '';
    if (scope !== 'note' && noteCount > 10) {
      const folderGroups = new Map<string, any[]>();
      contextScope.forEach(n => {
        const path = n.folderPath || '未分类';
        if (!folderGroups.has(path)) folderGroups.set(path, []);
        folderGroups.get(path)!.push(n);
      });
      
      folderSummary = '\n【文件夹汇总】\n' + Array.from(folderGroups.entries()).map(([path, notes]) => {
        const avgDifficulty = (notes.reduce((sum, n) => sum + n.difficulty, 0) / notes.length).toFixed(1);
        const statusCount = { new: 0, learning: 0, mastered: 0 };
        notes.forEach(n => statusCount[n.status as keyof typeof statusCount]++);
        return `📁 ${path}（${notes.length}篇）
   平均难度：${avgDifficulty} | 进度：🆕${statusCount.new} 📖${statusCount.learning} ✅${statusCount.mastered}`;
      }).join('\n');
    }

    const context = `
【当前问答范围】${scopeLabel}：${scopeName}
（共 ${noteCount} 篇笔记${useSummaryMode ? '，使用摘要模式' : ''}）

【笔记详情】${userQuery ? `（检索到 ${contextScope.length} 篇相关）` : ''}
${notesDetail || '（无相关笔记）'}
${folderSummary}

${userQuery ? `【基于以上笔记回答用户问题】` : ''}
`;
    return context;
  };

  const filterNotesByQuery = (notes: any[], query: string): any[] => {
    if (!query || query.trim().length === 0) return notes;

    const keywords = extractKeywords(query);
    if (keywords.length === 0) return notes;

    const scored = notes.map(note => {
      let score = 0;
      const text = `${note.title} ${note.content} ${note.tags.join(' ')} ${note.summary}`.toLowerCase();

      keywords.forEach(keyword => {
        const kw = keyword.toLowerCase();
        if (note.title.toLowerCase().includes(kw)) score += 3;
        if (note.tags.some((t: string) => t.toLowerCase().includes(kw))) score += 2;
        if (note.summary?.toLowerCase().includes(kw)) score += 1;
        if (text.includes(kw)) score += 0.5;
      });

      return { ...note, score };
    });

    const filtered = scored.filter(n => n.score > 0);
    if (filtered.length === 0) return notes;

    return filtered
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  };

  const extractKeywords = (text: string): string[] => {
    const stopWords = ['的', '了', '是', '在', '和', '与', '或', '一个', '什么', '怎么', '如何', '为什么', '吗', '呢', '吧', '啊', '请', '帮我', '给我', '我想', '你能', '可以', '有没有'];
    const words = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').split(/\s+/);
    return words.filter(w => w.length > 1 && !stopWords.includes(w)).slice(0, 10);
  };

  const getStatusLabel = (status: string): string => {
    const map: Record<string, string> = { new: '🆕 新学', learning: '📖 进行中', mastered: '✅ 已掌握' };
    return map[status] || status;
  };

  const handleSend = async (customPrompt?: string) => {
    const prompt = customPrompt || input.trim();
    if (!prompt || isLoading) return;

    const userMessage: Message = { role: 'user', content: prompt };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const notesContext = getNotesContext(prompt);

      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const savedAISettings = localStorage.getItem('ai_settings_v2');
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

      const response = await fetch(`${API_BASE_URL}/ai/knowledge-chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'system', content: `【用户笔记库】\n${notesContext}` },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // 解析后端返回的JSON格式，提取可读的content
        let displayContent = data.response;
        try {
          const parsed = JSON.parse(data.response);
          if (parsed.content_markdown) {
            displayContent = parsed.content_markdown;
          } else if (parsed.answer) {
            displayContent = parsed.answer;
          } else if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
            // 处理推荐数组格式
            displayContent = parsed.recommendations.map((rec: any, idx: number) => {
              return `## ${idx + 1}. ${rec.topic}\n\n${rec.detail}\n\n**原因：** ${rec.reason}${rec.tags ? `\n\n*标签：${rec.tags.join('、')}*` : ''}`;
            }).join('\n\n---\n\n');
          }
        } catch (e) {
          // 不是JSON格式，直接使用原文
        }
        const aiMessage: Message = {
          role: 'ai',
          content: displayContent,
          sources: data.sources,
        };
        setMessages(prev => [...prev, aiMessage]);
        setLatestAIMessage(aiMessage);
        setShowDetailModal(true);
      } else {
        throw new Error('AI响应失败');
      }
    } catch (error) {
      const errorMessage: Message = {
        role: 'ai',
        content: '抱歉，AI助手暂时无法回答。请稍后再试。',
      };
      setMessages(prev => [...prev, errorMessage]);
      setLatestAIMessage(errorMessage);
      setShowDetailModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    handleSend(prompt);
  };

  const handleCopy = async () => {
    if (latestAIMessage?.content) {
      await navigator.clipboard.writeText(latestAIMessage.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-all z-50"
        style={{ 
          background: 'linear-gradient(135deg, #7c5af0, #22d3ee)',
          boxShadow: '0 4px 20px rgba(124, 90, 240, 0.4)'
        }}
        title="打开 AI 知识助手"
      >
        <Brain className="w-5 h-5 text-white" />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 w-80 rounded-2xl shadow-2xl overflow-hidden z-50 transition-all"
      style={{
        backgroundColor: darkMode ? '#1a1b2e' : '#ffffff',
        border: `1px solid ${darkMode ? 'rgba(124, 90, 240, 0.3)' : 'rgba(124, 90, 240, 0.2)'}`,
        height: isMinimized ? '56px' : '460px',
        maxHeight: '80vh',
      }}
    >
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-4 h-14"
        style={{ background: 'linear-gradient(135deg, rgba(124, 90, 240, 0.15), rgba(34, 211, 238, 0.1))' }}
      >
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7c5af0, #22d3ee)' }}
          >
            <Brain className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm" style={{ color: darkMode ? '#e2e8f0' : '#1e293b' }}>
            AI 知识助手
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: darkMode ? '#94a3b8' : '#64748b' }}
          >
            {isMinimized ? '▢' : '▬'}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg transition-colors hover:bg-black/10"
            style={{ color: darkMode ? '#94a3b8' : '#64748b' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* 快捷功能 */}
          <div className="px-3 py-2 border-b flex gap-2 overflow-x-auto" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9' }}>
            {QUICK_ACTIONS.map((action, index) => (
              <button
                key={index}
                onClick={() => handleQuickAction(action.prompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all hover:scale-105"
                style={{
                  background: darkMode ? 'rgba(124, 90, 240, 0.2)' : 'rgba(124, 90, 240, 0.1)',
                  color: '#7c5af0',
                }}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>

          {/* 内容区域 - 只显示当前范围和快捷提示 */}
          <div 
            className="flex-1 overflow-y-auto p-3 h-72"
            style={{ backgroundColor: darkMode ? '#12131a' : '#f8fafc' }}
          >
            {/* 当前范围 */}
            <div 
              className="rounded-xl p-3 mb-4"
              style={{ 
                background: darkMode ? 'rgba(124, 90, 240, 0.1)' : 'rgba(124, 90, 240, 0.05)',
                border: `1px solid ${darkMode ? 'rgba(124, 90, 240, 0.2)' : 'rgba(124, 90, 240, 0.15)'}`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4" style={{ color: '#7c5af0' }} />
                <span className="text-xs font-medium" style={{ color: darkMode ? '#a78bfa' : '#7c5af0' }}>
                  当前知识范围
                </span>
              </div>
              <ScopeInfo darkMode={darkMode} />
            </div>

            {/* 快捷提示 */}
            <div>
              <p className="text-xs mb-3" style={{ color: darkMode ? '#64748b' : '#94a3b8' }}>
                💡 你可以这样问我：
              </p>
              <div className="space-y-2">
                {[
                  '总结这个文件夹的学习进度',
                  '这些笔记有什么关联',
                  '推荐下一步学什么',
                  '帮我梳理知识框架',
                ].map((tip, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(tip)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all hover:scale-[1.02]"
                    style={{
                      background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      color: darkMode ? '#94a3b8' : '#64748b',
                      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                    }}
                  >
                    {tip}
                  </button>
                ))}
              </div>
            </div>

            {/* 加载状态 */}
            {isLoading && (
              <div className="mt-4 flex items-center gap-2 text-sm" style={{ color: darkMode ? '#94a3b8' : '#64748b' }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI 思考中...</span>
              </div>
            )}
          </div>

          {/* 输入框 */}
          <div
            className="p-3 border-t flex gap-2"
            style={{ borderColor: darkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9' }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="输入问题..."
              className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
              style={{
                backgroundColor: darkMode ? '#12131a' : '#f1f5f9',
                color: darkMode ? '#e2e8f0' : '#1e293b',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7c5af0, #22d3ee)' }}
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </>
      )}

      {/* AI 详细回答弹窗 */}
      {showDetailModal && latestAIMessage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{
              backgroundColor: darkMode ? '#1a1b2e' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(124, 90, 240, 0.3)' : 'rgba(124, 90, 240, 0.2)'}`,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ background: 'linear-gradient(135deg, rgba(124, 90, 240, 0.15), rgba(34, 211, 238, 0.1))' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #7c5af0, #22d3ee)' }}
                >
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="font-semibold text-sm" style={{ color: darkMode ? '#e2e8f0' : '#1e293b' }}>
                    AI 知识助手
                  </span>
                  <p className="text-xs" style={{ color: darkMode ? '#64748b' : '#94a3b8' }}>
                    基于你的笔记智能分析
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(124, 90, 240, 0.15)',
                    color: copied ? '#10b981' : '#7c5af0',
                  }}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? '已复制' : '复制'}
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 rounded-lg transition-colors hover:bg-black/10"
                  style={{ color: darkMode ? '#94a3b8' : '#64748b' }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 弹窗内容 */}
            <div
              className="flex-1 overflow-y-auto p-6"
              style={{ backgroundColor: darkMode ? '#12131a' : '#f8fafc', maxHeight: '60vh' }}
            >
              <MarkdownRenderer content={latestAIMessage.content} darkMode={darkMode} />

              {latestAIMessage.sources && latestAIMessage.sources.length > 0 && (
                <div className="mt-6 pt-4 border-t" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: darkMode ? '#64748b' : '#94a3b8' }}>
                    📚 参考笔记
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {latestAIMessage.sources.map((source, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 rounded-lg text-xs"
                        style={{
                          background: darkMode ? 'rgba(124, 90, 240, 0.15)' : 'rgba(124, 90, 240, 0.1)',
                          color: '#7c5af0',
                        }}
                      >
                        {source.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 弹窗底部 */}
            <div
              className="px-5 py-3 border-t flex justify-between items-center"
              style={{ borderColor: darkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9' }}
            >
              <span className="text-xs" style={{ color: darkMode ? '#64748b' : '#94a3b8' }}>
                内容由 AI 基于你的笔记生成
              </span>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: 'linear-gradient(135deg, #7c5af0, #22d3ee)',
                  color: '#ffffff',
                }}
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
