import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bold, Italic, Code, Quote, List,
  Eye, Edit3, Clock, Hash,
  FileText, Heading1, Heading2, Heading3, Minus,
  Image as ImageIcon,
  Plus, GitBranch, ArrowUp, X, Target, ArrowLeft
} from 'lucide-react';
import { useNoteStore } from '../store/noteStore';
import { NoteMetadataEditor } from './NoteMetadataEditor';
import { generateNoteSummary } from '../utils/aiService';

// 思维导图节点接口
interface MindmapNode {
  id: string;
  label: string;
  parent: string | null;
}

interface MindmapData {
  nodes: MindmapNode[];
}

// 解码 Unicode 转义字符（如 \u2192 → →）
function decodeUnicode(str: string): string {
  if (!str) return str;
  try {
    // 只解码 \uXXXX 格式的 Unicode 转义序列，保留 Emoji 等其他字符
    return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
  } catch {
    return str;
  }
}

function renderMarkdown(text: string, darkMode: boolean): string {
  // 先解码 Unicode 转义字符
  const decodedText = decodeUnicode(text);
  
  let html = decodedText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre class="code-block" data-lang="${lang}" style="background: ${darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'}; padding: 0.75rem; border-radius: 0.5rem; overflow-x: auto; margin-bottom: 1rem;"><code style="font-family: monospace; font-size: 0.8rem;">${code.trim()}</code></pre>`
  );
  // Inline code
  html = html.replace(/`([^`]+)`/g, `<code style="background: ${darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'}; padding: 0.1rem 0.3rem; border-radius: 0.25rem; font-size: 0.8rem; color: ${darkMode ? '#22d3ee' : '#0891b2'};">$1</code>`);
  // Headings - 添加颜色样式
  html = html.replace(/^#### (.+)$/gm, `<h4 style="font-size: 1rem; font-weight: 600; color: ${darkMode ? '#22d3ee' : '#52B788'}; margin-top: 1rem; margin-bottom: 0.5rem;">$1</h4>`);
  html = html.replace(/^### (.+)$/gm, `<h3 style="font-size: 1.1rem; font-weight: 600; color: ${darkMode ? '#22d3ee' : '#BB5799'}; margin-top: 1.25rem; margin-bottom: 0.6rem;">$1</h3>`);
  html = html.replace(/^## (.+)$/gm, `<h2 style="font-size: 1.25rem; font-weight: 600; color: ${darkMode ? '#a78bfa' : '#506850'}; margin-top: 1.5rem; margin-bottom: 0.75rem; border-bottom: 1px solid ${darkMode ? 'rgba(167,139,250,0.2)' : 'rgba(124,58,237,0.2)'}; padding-bottom: 0.3rem;">$1</h2>`);
  html = html.replace(/^# (.+)$/gm, `<h1 style="font-size: 1.5rem; font-weight: 700; color: ${darkMode ? '#e2e8f0' : '#063C85'}; margin-bottom: 1rem; border-bottom: 1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}; padding-bottom: 0.5rem;">$1</h1>`);
  // Bold - 添加高亮颜色
  html = html.replace(/\*\*(.+?)\*\*/g, `<strong style="font-weight: 600; color: ${darkMode ? '#fbbf24' : '#d97706'};">$1</strong>`);
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em style="font-style: italic;">$1</em>');
  // Blockquote - 添加左边框和背景色
  html = html.replace(/^&gt; (.+)$/gm, `<blockquote style="border-left: 3px solid #a78bfa; padding-left: 0.75rem; margin-left: 0; background: ${darkMode ? 'rgba(167,139,250,0.1)' : 'rgba(167,139,250,0.05)'}; padding: 0.5rem; border-radius: 0.25rem; margin-bottom: 0.75rem; color: ${darkMode ? '#cbd5e1' : '#475569'};">$1</blockquote>`);
  // Horizontal rule
  html = html.replace(/^---$/gm, `<hr style="border: none; border-top: 1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}; margin: 1.5rem 0;" />`);
  // Unordered list
  const ulStyle = `margin-bottom: 0.25rem; line-height: 1.6; background: ${darkMode ? 'rgba(234,219,200,0.1)' : '#EADBC8'}; padding: 0.25rem 0.5rem; border-radius: 0.25rem;`;
  html = html.replace(/^- (.+)$/gm, `<li class="ul-item" style="${ulStyle}">$1</li>`);
  html = html.replace(/(<li class="ul-item"[^>]*>.*<\/li>\n?)+/g, match => `<ul style="margin-left: 1.25rem; margin-bottom: 0.75rem; list-style-type: disc; padding-left: 0;">${match}</ul>`);
  // Ordered list
  const olStyle = `margin-bottom: 0.25rem; line-height: 1.6; background: ${darkMode ? 'rgba(234,219,200,0.1)' : '#EADBC8'}; padding: 0.25rem 0.5rem; border-radius: 0.25rem;`;
  html = html.replace(/^\d+\. (.+)$/gm, `<li class="ol-item" style="${olStyle}">$1</li>`);
  html = html.replace(/(<li class="ol-item"[^>]*>.*<\/li>\n?)+/g, match => `<ol style="margin-left: 1.25rem; margin-bottom: 0.75rem; list-style-type: decimal; padding-left: 0;">${match}</ol>`);
  // Checkbox
  html = html.replace(/^- \[ \] (.+)$/gm, `<div class="checkbox-item unchecked" style="margin-bottom: 0.25rem; color: ${darkMode ? '#94a3b8' : '#64748b'};">☐ $1</div>`);
  html = html.replace(/^- \[x\] (.+)$/gm, `<div class="checkbox-item checked" style="margin-bottom: 0.25rem; color: ${darkMode ? '#34d399' : '#059669'}; text-decoration: line-through;">☑ $1</div>`);
  
  // Table - Markdown表格格式
  html = html.replace(/(\|[^\n]+\|\n\|[-:\s|]+\|\n(?:\|[^\n]+\|\n?)+)/g, (match) => {
    const lines = match.trim().split('\n');
    if (lines.length < 2) return match;
    
    // 解析表头
    const headerCells = lines[0].split('|').filter(cell => cell.trim() !== '');
    const headerHtml = headerCells.map(cell => {
      const bgColor = darkMode ? 'rgba(124,90,240,0.2)' : 'rgba(124,90,240,0.1)';
      const borderColor = darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
      return `<th style="padding: 0.5rem; text-align: left; font-weight: 600; border-bottom: 2px solid ${borderColor}; background: ${bgColor};">${cell.trim()}</th>`;
    }).join('');
    
    // 跳过分隔线（第二行），解析数据行
    let bodyHtml = '';
    for (let i = 2; i < lines.length; i++) {
      const cells = lines[i].split('|').filter(cell => cell.trim() !== '');
      if (cells.length > 0) {
        const rowHtml = cells.map(cell => {
          const borderColor = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
          return `<td style="padding: 0.5rem; border-bottom: 1px solid ${borderColor};">${cell.trim()}</td>`;
        }).join('');
        bodyHtml += `<tr>${rowHtml}</tr>`;
      }
    }
    
    return `<table style="width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.85rem;"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
  });
  
  // Paragraphs (lines not starting with html tags)
  html = html.replace(/^(?!<[houblipd]|$)(.+)$/gm, `<p style="margin-bottom: 0.6rem; line-height: 1.7; color: ${darkMode ? '#cbd5e1' : '#334155'};">$1</p>`);
  // Line breaks
  html = html.replace(/\n/g, '\n');

  return html;
}

type ToolbarAction = { icon: React.ReactNode; label: string; action: ((text: string, sel: [number, number]) => string) | string } | null;

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { icon: <Heading1 size={14} />, label: 'H1', action: (text: string, sel: [number, number]) => {
    const line = text.lastIndexOf('\n', sel[0] - 1) + 1;
    return text.slice(0, line) + '# ' + text.slice(line);
  }},
  { icon: <Heading2 size={14} />, label: 'H2', action: (text: string, sel: [number, number]) => {
    const line = text.lastIndexOf('\n', sel[0] - 1) + 1;
    return text.slice(0, line) + '## ' + text.slice(line);
  }},
  { icon: <Heading3 size={14} />, label: 'H3', action: (text: string, sel: [number, number]) => {
    const line = text.lastIndexOf('\n', sel[0] - 1) + 1;
    return text.slice(0, line) + '### ' + text.slice(line);
  }},
  null, // separator
  { icon: <Bold size={14} />, label: '粗体', action: (text: string, sel: [number, number]) => {
    const selected = text.slice(sel[0], sel[1]);
    return text.slice(0, sel[0]) + `**${selected || '粗体文字'}**` + text.slice(sel[1]);
  }},
  { icon: <Italic size={14} />, label: '斜体', action: (text: string, sel: [number, number]) => {
    const selected = text.slice(sel[0], sel[1]);
    return text.slice(0, sel[0]) + `*${selected || '斜体文字'}*` + text.slice(sel[1]);
  }},
  { icon: <Code size={14} />, label: '代码', action: (text: string, sel: [number, number]) => {
    const selected = text.slice(sel[0], sel[1]);
    return text.slice(0, sel[0]) + '`' + (selected || '代码') + '`' + text.slice(sel[1]);
  }},
  null,
  { icon: <Quote size={14} />, label: '引用', action: (text: string, sel: [number, number]) => {
    const line = text.lastIndexOf('\n', sel[0] - 1) + 1;
    return text.slice(0, line) + '> ' + text.slice(line);
  }},
  { icon: <List size={14} />, label: '列表', action: (text: string, sel: [number, number]) => {
    const line = text.lastIndexOf('\n', sel[0] - 1) + 1;
    return text.slice(0, line) + '- ' + text.slice(line);
  }},
  { icon: <Minus size={14} />, label: '分割线', action: (text: string, sel: [number, number]) => {
    return text.slice(0, sel[0]) + '\n---\n' + text.slice(sel[1]);
  }},
  null,
  { icon: <ImageIcon size={14} />, label: '上传图片', action: 'image' },
];

function formatDate(isoStr: string) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface NoteEditorProps {
  darkMode: boolean;
}

export function NoteEditor({ darkMode }: NoteEditorProps) {
  const { notes, activeNoteId, updateNote, deleteNote, folders, setActiveNoteId, setActiveView } = useNoteStore();
  const note = notes.find(n => n.id === activeNoteId);

  const [isPreview, setIsPreview] = useState(true);
  const [editTitle, setEditTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    setActiveNoteId(null);
    // 不切换视图，保持 note 视图显示空状态
  };

  // 思维导图选中文本相关状态
  const [selectedText, setSelectedText] = useState('');
  const [showMindmapPopup, setShowMindmapPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [showLevelSelector, setShowLevelSelector] = useState(false);
  const [mindmapNodes, setMindmapNodes] = useState<MindmapNode[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [addMode, setAddMode] = useState<'child' | 'sibling' | 'parent'>('child');
  const hidePopupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (note) {
      setTitleValue(note.title);
      // 加载思维导图节点，确保包含根节点
      // 支持两种格式: { nodes: [...] } 或直接 [...]
      let allNodes: MindmapNode[] = [];
      
      console.log('>>> [DEBUG] NoteEditor 加载笔记 mindmap:', note.mindmap);
      
      if (note.mindmap) {
        if (Array.isArray(note.mindmap)) {
          // 直接是数组格式
          allNodes = note.mindmap;
          console.log('>>> [DEBUG] 使用数组格式，节点数:', allNodes.length);
        } else if (note.mindmap.nodes && Array.isArray(note.mindmap.nodes)) {
          // { nodes: [...] } 格式
          allNodes = note.mindmap.nodes;
          console.log('>>> [DEBUG] 使用 { nodes: [...] } 格式，节点数:', allNodes.length);
        } else {
          console.log('>>> [DEBUG] mindmap 格式无法识别:', typeof note.mindmap, note.mindmap);
        }
      } else {
        console.log('>>> [DEBUG] 笔记没有 mindmap 数据');
      }
      
      // 只保留属于当前笔记的节点（以根节点为起点）
      // 找到根节点（parent 为 null 或 'root' id）
      const rootNode = allNodes.find((n: MindmapNode) => n.id === 'root' || n.parent === null);
      
      if (rootNode) {
        // 收集所有从根节点可达的节点
        const relevantNodeIds = new Set<string>(['root']);
        const collectChildren = (parentId: string) => {
          allNodes.forEach((n: MindmapNode) => {
            if (n.parent === parentId && !relevantNodeIds.has(n.id)) {
              relevantNodeIds.add(n.id);
              collectChildren(n.id);
            }
          });
        };
        collectChildren('root');
        
        // 过滤出相关节点
        const filteredNodes = allNodes.filter((n: MindmapNode) => relevantNodeIds.has(n.id));
        console.log('过滤后的思维导图节点:', filteredNodes.length, '原始节点:', allNodes.length);
        setMindmapNodes(filteredNodes);
      } else {
        // 没有找到根节点，初始化
        console.log('初始化思维导图根节点');
        setMindmapNodes([{ id: 'root', label: note.title, parent: null }]);
      }
    }
  }, [note?.id, note?.mindmap]);

  // 监听预览区的文本选中
  useEffect(() => {
    if (!isPreview) return;
    
    // 使用 setTimeout 确保 DOM 已经渲染
    const timer = setTimeout(() => {
      const previewElement = previewRef.current;
      if (!previewElement) return;

      const handleMouseUp = () => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();

        if (text && text.length > 0) {
          const range = selection!.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          setSelectedText(text);
          setPopupPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 10
          });
          setShowMindmapPopup(true);
        }
      };

      previewElement.addEventListener('mouseup', handleMouseUp);
      
      // 清理函数
      return () => {
        previewElement.removeEventListener('mouseup', handleMouseUp);
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [isPreview, note?.id]);

  // 隐藏悬浮框的延迟处理
  const handlePopupMouseEnter = () => {
    if (hidePopupTimer.current) {
      clearTimeout(hidePopupTimer.current);
      hidePopupTimer.current = null;
    }
  };

  const handlePopupMouseLeave = () => {
    hidePopupTimer.current = setTimeout(() => {
      setShowMindmapPopup(false);
    }, 300);
  };

  // 获取所有可选的父节点（排除根节点）
  const getAvailableParentNodes = () => {
    return mindmapNodes.filter(n => n.id !== 'root');
  };

  // 计算节点的层级
  const getNodeLevel = (nodeId: string): number => {
    let level = 0;
    let currentId = nodeId;
    while (currentId !== 'root') {
      const parent = mindmapNodes.find(n => n.id === currentId);
      if (!parent) break;
      currentId = parent.parent || 'root';
      level++;
    }
    return level;
  };

  // 生成新节点ID
  const generateNodeId = () => `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // 添加到思维导图
  const addToMindmap = (mode: 'child' | 'sibling' | 'parent') => {
    if (!note || !selectedText) return;

    setAddMode(mode);

    if (mode === 'child') {
      // 选择父节点
      setShowLevelSelector(true);
    } else if (mode === 'sibling') {
      // 选择同级节点
      setShowLevelSelector(true);
    } else if (mode === 'parent') {
      // 作为新的父节点，添加到根节点下
      const newNode: MindmapNode = {
        id: generateNodeId(),
        label: selectedText,
        parent: 'root'
      };
      
      const updatedNodes = [...mindmapNodes, newNode];
      setMindmapNodes(updatedNodes);
      updateNote(note.id, { 
        mindmap: { nodes: updatedNodes }
      });
      
      setShowMindmapPopup(false);
      setSelectedText('');
    }
  };

  // 确认添加到指定父节点下
  const confirmAddToParent = () => {
    if (!note || !selectedText || !selectedParentId) return;

    const newNode: MindmapNode = {
      id: generateNodeId(),
      label: selectedText,
      parent: selectedParentId
    };

    const updatedNodes = [...mindmapNodes, newNode];
    setMindmapNodes(updatedNodes);
    updateNote(note.id, { 
      mindmap: { nodes: updatedNodes }
    });

    setShowLevelSelector(false);
    setShowMindmapPopup(false);
    setSelectedText('');
    setSelectedParentId('');
  };

  const handleContentChange = useCallback((value: string) => {
    if (!note) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      updateNote(note.id, { content: value });

      if (value.length > 100 && (!note.metadata?.summary || note.metadata.summary.length < 10)) {
        const summary = await generateNoteSummary(note.id, note.title, value);
        if (summary) {
          updateNote(note.id, { metadata: { ...note.metadata, summary } });
        }
      }
    }, 1000);
  }, [note, updateNote]);

  const applyFormat = (actionFn: ((text: string, sel: [number, number]) => string) | string) => {
    if (typeof actionFn === 'string') {
      if (actionFn === 'link') {
        const ta = textareaRef.current;
        if (!ta || !note) return;
      } else if (actionFn === 'image') {
        fileInputRef.current?.click();
      }
      return;
    }
    
    const ta = textareaRef.current;
    if (!ta || !note) return;
    const sel: [number, number] = [ta.selectionStart, ta.selectionEnd];
    const newContent = actionFn(ta.value, sel);
    updateNote(note.id, { content: newContent });
    setTimeout(() => ta.focus(), 0);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !note) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64 && textareaRef.current) {
        const ta = textareaRef.current;
        const imageMarkdown = `![${file.name.split('.')[0] || '图片'}](${base64})`;
        const newContent = ta.value.slice(0, ta.selectionStart) + imageMarkdown + ta.value.slice(ta.selectionEnd);
        updateNote(note.id, { content: newContent });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleTitleSave = () => {
    if (note && titleValue.trim()) updateNote(note.id, { title: titleValue.trim() });
    setEditTitle(false);
  };

  const handleAddTag = () => {
    if (!note || !tagInput.trim()) return;
    const newTag = tagInput.trim().replace(/^#/, '');
    if (!note.tags.includes(newTag)) {
      updateNote(note.id, { tags: [...note.tags, newTag] });
    }
    setTagInput('');
    setShowTagInput(false);
  };

  const removeTag = (tag: string) => {
    if (!note) return;
    updateNote(note.id, { tags: note.tags.filter(t => t !== tag) });
  };

  const handleMetadataChange = (metadata: any) => {
    if (!note) return;
    updateNote(note.id, { metadata });
  };

  const folder = note ? folders.find(f => f.id === note.folderId) : null;

  // 获取完整文件夹路径
  const getFullFolderPath = (folderId: string | null): string[] => {
    if (!folderId) return [];
    const path: string[] = [];
    let currentId: string | null = folderId;
    while (currentId) {
      const f = folders.find(folder => folder.id === currentId);
      if (!f) break;
      path.unshift(f.name);
      currentId = f.parentId;
    }
    return path;
  };

  const folderPath = note ? getFullFolderPath(note.folderId) : [];

  if (!note) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ background: darkMode ? '#0a0c15' : '#F9F5FF' }}>
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
          style={{ background: 'rgba(124,90,240,0.1)', border: '1px solid rgba(124,90,240,0.2)' }}
        >
          <FileText size={36} style={{ color: '#4c3d8a' }} />
        </div>
        <p style={{ color: darkMode ? '#94a3b8' : '#64748b', fontSize: '0.9rem' }}>选择一篇笔记开始编辑</p>
        <p style={{ color: darkMode ? '#64748b' : '#94a3b8', fontSize: '0.8rem', marginTop: 8 }}>或从左侧创建新笔记</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden rounded-2xl" style={{ background: darkMode ? '#0a0c15' : '#F9F5FF' }}>
      {/* Note header */}
      <div
        className="px-8 pt-6 pb-4 shrink-0"
        style={{ borderBottom: darkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {folderPath.length > 0 ? (
            folderPath.map((name, index) => (
              <React.Fragment key={index}>
                <span style={{ fontSize: '0.75rem', color: darkMode ? '#94a3b8' : '#64748b' }}>{name}</span>
                {index < folderPath.length - 1 && (
                  <span style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8' }}>/</span>
                )}
              </React.Fragment>
            ))
          ) : (
            <span style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8' }}>根目录</span>
          )}
        </div>

        {/* Title */}
        {editTitle ? (
          <input
            autoFocus
            value={titleValue}
            onChange={e => setTitleValue(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditTitle(false); }}
            className="w-full bg-transparent outline-none border-b border-violet-500/50"
            style={{ fontSize: '1.5rem', color: darkMode ? '#e2e8f0' : '#1e293b', fontWeight: 600 }}
          />
        ) : (
          <div className="flex items-center gap-3 flex-1">
            <h1
              onClick={() => setEditTitle(true)}
              className="cursor-pointer hover:text-violet-300 transition-colors"
              style={{ fontSize: '1.5rem', color: darkMode ? '#e2e8f0' : '#1e293b', fontWeight: 600, lineHeight: 1.3 }}
            >
              {note.title}
            </h1>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="关闭笔记"
            >
              <ArrowLeft size={18} style={{ color: darkMode ? '#94a3b8' : '#64748b' }} />
            </button>
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <div className="flex items-center gap-1">
            <Clock size={11} style={{ color: darkMode ? '#64748b' : '#94a3b8' }} />
            <span style={{ fontSize: '0.7rem', color: darkMode ? '#64748b' : '#94a3b8' }}>{formatDate(note.updatedAt)}</span>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {note.tags.map(tag => (
              <span
                key={tag}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full cursor-pointer group"
                style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)', fontSize: '0.7rem', color: '#22d3ee' }}
                onClick={() => removeTag(tag)}
                title="点击删除"
              >
                <Hash size={9} />
                {tag}
              </span>
            ))}
            {showTagInput ? (
              <input
                autoFocus
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onBlur={handleAddTag}
                onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') { setShowTagInput(false); setTagInput(''); } }}
                placeholder="标签名..."
                className="px-2 py-0.5 rounded-full bg-transparent outline-none border border-cyan-500/30 text-cyan-400"
                style={{ fontSize: '0.7rem', width: 80 }}
              />
            ) : (
              <button
                onClick={() => setShowTagInput(true)}
                className="px-2 py-0.5 rounded-full border border-dashed transition-colors hover:color-opacity-100 hover:border-opacity-20"
                style={{
                  fontSize: '0.7rem',
                  borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  color: darkMode ? '#94a3b8' : '#64748b'
                }}
              >
                + 标签
              </button>
            )}
          </div>

          {/* Learning metadata button */}
          <button
            onClick={() => setShowMetadataEditor(!showMetadataEditor)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all"
            style={{
              fontSize: '0.7rem',
              borderColor: note.metadata?.subject || note.metadata?.learningStatus 
                ? 'rgba(124, 90, 240, 0.5)' 
                : (darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
              color: note.metadata?.subject || note.metadata?.learningStatus 
                ? '#7c5af0' 
                : (darkMode ? '#94a3b8' : '#64748b'),
              backgroundColor: note.metadata?.subject || note.metadata?.learningStatus 
                ? 'rgba(124, 90, 240, 0.1)' 
                : 'transparent',
            }}
            title="设置学习属性"
          >
            <Target size={10} />
            <span>{note.metadata?.subject ? note.metadata.subject.split('/')[0] : '学习属性'}</span>
          </button>

          {/* Toolbar right */}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setIsPreview(!isPreview)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all"
              style={{
                fontSize: '0.75rem',
                background: isPreview ? 'rgba(34,211,238,0.12)' : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                color: isPreview ? '#22d3ee' : (darkMode ? '#64748b' : '#64748b'),
                border: `1px solid ${isPreview ? 'rgba(34,211,238,0.3)' : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
              }}
            >
              {isPreview ? <Edit3 size={12} /> : <Eye size={12} />}
              {isPreview ? '编辑' : '预览'}
            </button>
            <button
              onClick={() => {
                if (note && window.confirm('确定要删除这篇笔记吗？')) {
                  deleteNote(note.id);
                }
              }}
              className="p-1.5 rounded-lg transition-all hover:bg-opacity-8 hover:text-opacity-100"
              style={{
                color: darkMode ? '#64748b' : '#94a3b8',
                backgroundColor: 'transparent'
              }}
              title="删除笔记"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Formatting toolbar */}
      {!isPreview && (
        <div
          className="flex items-center gap-0.5 px-8 py-2 shrink-0 overflow-x-auto custom-scrollbar"
          style={{ 
            borderBottom: darkMode ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.04)', 
            background: darkMode ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)'
          }}
        >
          {TOOLBAR_ACTIONS.map((action, i) =>
            action === null ? (
              <div key={`sep-${i}`} className="w-px h-4 mx-1" style={{ background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
            ) : (
              <button
                key={i}
                title={action.label}
                onClick={() => applyFormat(action.action)}
                className="p-1.5 rounded transition-colors shrink-0 hover:bg-opacity-8 hover:text-opacity-100"
                style={{
                  color: darkMode ? '#64748b' : '#94a3b8'
                }}
              >
                {action.icon}
              </button>
            )
          )}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden relative">
        {/* Learning metadata editor panel */}
        {showMetadataEditor && (
          <div 
            className="px-8 py-4 border-b"
            style={{ 
              borderColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              backgroundColor: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)'
            }}
          >
            <NoteMetadataEditor
              metadata={note.metadata || {}}
              onChange={handleMetadataChange}
              darkMode={darkMode}
            />
          </div>
        )}

        {isPreview ? (
          <>
            <div
              ref={previewRef}
              className="h-full overflow-y-auto px-8 py-6 prose-custom custom-scrollbar"
              style={{
                color: darkMode ? '#e2e8f0' : '#1e293b'
              }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content, darkMode) }}
            />
            
            {/* 思维导图添加悬浮框 */}
            {showMindmapPopup && (
              <div
                className="fixed z-50 flex items-center gap-1 px-2 py-1.5 rounded-lg shadow-lg"
                style={{
                  left: popupPosition.x,
                  top: popupPosition.y,
                  transform: 'translate(-50%, -100%)',
                  background: darkMode ? '#1a1d2d' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(124,90,240,0.3)' : 'rgba(124,90,240,0.2)'}`,
                }}
                onMouseEnter={handlePopupMouseEnter}
                onMouseLeave={handlePopupMouseLeave}
              >
                <button
                  onClick={() => addToMindmap('parent')}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors hover:bg-violet-500/20"
                  style={{ color: darkMode ? '#a78bfa' : '#7c3aed' }}
                  title="设为一级节点"
                >
                  <Plus size={12} />
                  <span>一级节点</span>
                </button>
                <div className="w-px h-3" style={{ background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
                <button
                  onClick={() => addToMindmap('child')}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors hover:bg-violet-500/20"
                  style={{ color: darkMode ? '#22d3ee' : '#0891b2' }}
                  title="设为子节点"
                >
                  <GitBranch size={12} />
                  <span>子节点</span>
                </button>
                <button
                  onClick={() => setShowMindmapPopup(false)}
                  className="p-1 rounded transition-colors hover:bg-red-500/20 ml-1"
                  style={{ color: darkMode ? '#94a3b8' : '#64748b' }}
                >
                  <X size={10} />
                </button>
              </div>
            )}

            {/* 层级选择器对话框 */}
            {showLevelSelector && (
              <div
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                onClick={() => setShowLevelSelector(false)}
              >
                <div
                  className="rounded-lg p-5 w-80"
                  style={{ background: darkMode ? '#1a1d2d' : '#ffffff' }}
                  onClick={e => e.stopPropagation()}
                >
                  <h3 className="text-base font-semibold mb-4" style={{ color: darkMode ? '#e2e8f0' : '#1e293b' }}>
                    选择父节点
                  </h3>
                  <p className="text-xs mb-3" style={{ color: darkMode ? '#94a3b8' : '#64748b' }}>
                    将 "{selectedText.slice(0, 20)}{selectedText.length > 20 ? '...' : ''}" 添加到：
                  </p>
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar mb-4">
                    {mindmapNodes.filter(n => n.id !== 'root').length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: darkMode ? '#64748b' : '#94a3b8' }}>
                        暂无节点，请先添加一级节点
                      </p>
                    ) : (
                      mindmapNodes
                        .filter(n => n.id !== 'root')
                        .map((node) => {
                          const level = getNodeLevel(node.id);
                          const nodeLabel = node.label || '未命名节点';
                          console.log('渲染节点:', node.id, nodeLabel, node);
                          return (
                            <button
                              key={node.id}
                              onClick={() => setSelectedParentId(node.id)}
                              className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                              style={{
                                background: selectedParentId === node.id 
                                  ? (darkMode ? 'rgba(124,90,240,0.2)' : 'rgba(124,90,240,0.1)')
                                  : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                                color: selectedParentId === node.id
                                  ? '#7c5af0'
                                  : (darkMode ? '#e2e8f0' : '#1e293b'),
                                border: selectedParentId === node.id
                                  ? '1px solid rgba(124,90,240,0.3)'
                                  : '1px solid transparent',
                                paddingLeft: `${12 + level * 16}px`,
                                minHeight: '36px'
                              }}
                            >
                              <span className="flex items-center gap-2">
                                <span 
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ 
                                    background: node.parent === 'root' ? '#7c5af0' : '#22d3ee'
                                  }}
                                />
                                <span className="truncate">{nodeLabel}</span>
                              </span>
                            </button>
                          );
                        })
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowLevelSelector(false);
                        setSelectedParentId('');
                      }}
                      className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                      style={{
                        background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                        color: darkMode ? '#94a3b8' : '#64748b'
                      }}
                    >
                      取消
                    </button>
                    <button
                      onClick={confirmAddToParent}
                      disabled={!selectedParentId}
                      className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                      style={{
                        background: selectedParentId ? '#7c3aed' : 'rgba(124,58,237,0.3)',
                        color: '#ffffff',
                        opacity: selectedParentId ? 1 : 0.5
                      }}
                    >
                      确认添加
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <textarea
            ref={textareaRef}
            defaultValue={note.content}
            key={note.id}
            onChange={e => handleContentChange(e.target.value)}
            className="w-full h-full resize-none outline-none custom-scrollbar"
            style={{
              background: 'transparent',
              color: darkMode ? '#94a3b8' : '#475569',
              fontSize: '0.875rem',
              lineHeight: 1.8,
              padding: '24px 32px',
              fontFamily: '"SF Mono", "Fira Code", Consolas, monospace'
            }} onFocus={(e) => {
              e.target.style.color = darkMode ? '#94a3b8' : '#475569';
            }} onBlur={(e) => {
              if (!e.target.value) {
                e.target.style.color = darkMode ? '#64748b' : '#94a3b8';
              }
            }}
            placeholder="开始写作..."
            spellCheck={false}
          />
        )}
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: 'none' }}
      />
    </div>
  );
}
