import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Download, Plus, Sparkles, Loader2, Trash2 } from 'lucide-react';
import { useNoteStore } from '../store/noteStore';

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

interface TreeNode {
  id: string;
  label: string;
  level: number;
  children: TreeNode[];
  color: string;
  x?: number;
  y?: number;
  width?: number;
}

const NODE_H = 36;
const NODE_MIN_W = [0, 120, 110, 100, 90];
const NODE_PADDING_X = 24;
const H_GAP = 80;
const V_GAP = 10;
const FONT_SIZE = [14, 13, 12, 11];

function calculateTextWidth(text: string, fontSize: number): number {
  const chineseCharWidth = fontSize * 1.1;
  const englishCharWidth = fontSize * 0.6;
  
  let width = 0;
  for (const char of text) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      width += chineseCharWidth;
    } else {
      width += englishCharWidth;
    }
  }
  return width;
}

function countLeaves(node: TreeNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

function calculateNodeWidth(node: TreeNode): number {
  const fontSize = FONT_SIZE[node.level] || 11;
  const textWidth = calculateTextWidth(node.label, fontSize);
  return Math.max(NODE_MIN_W[node.level] || 90, textWidth + NODE_PADDING_X);
}

function assignPositions(node: TreeNode, startY: number, depth: number): { endY: number } {
  const leafCount = countLeaves(node);
  const totalHeight = leafCount * (NODE_H + V_GAP) - V_GAP;
  
  node.width = calculateNodeWidth(node);
  node.x = depth === 0 ? 20 : (depth * (200 + H_GAP) + 20);
  node.y = startY + totalHeight / 2 - NODE_H / 2;

  if (node.children.length > 0) {
    let currentY = startY;
    node.children.forEach(child => {
      const childLeaves = countLeaves(child);
      const childHeight = childLeaves * (NODE_H + V_GAP) - V_GAP;
      assignPositions(child, currentY, depth + 1);
      currentY += childHeight + V_GAP;
    });
  }
  return { endY: startY + totalHeight };
}

function collectNodes(node: TreeNode, result: TreeNode[] = []): TreeNode[] {
  result.push(node);
  node.children.forEach(c => collectNodes(c, result));
  return result;
}

function collectEdges(node: TreeNode, result: Array<[TreeNode, TreeNode]> = []): Array<[TreeNode, TreeNode]> {
  node.children.forEach(c => {
    result.push([node, c]);
    collectEdges(c, result);
  });
  return result;
}

function findParent(root: TreeNode, targetId: string): TreeNode | null {
  for (const child of root.children) {
    if (child.id === targetId) return root;
    const found = findParent(child, targetId);
    if (found) return found;
  }
  return null;
}

function removeNodeFromTree(root: TreeNode, targetId: string): boolean {
  // 在根节点的直接子节点中查找
  const index = root.children.findIndex(c => c.id === targetId);
  if (index !== -1) {
    root.children.splice(index, 1);
    return true;
  }
  // 递归在子节点的子节点中查找
  for (const child of root.children) {
    if (removeNodeFromTree(child, targetId)) return true;
  }
  return false;
}

function updateNodeLabel(root: TreeNode, targetId: string, newLabel: string): boolean {
  if (root.id === targetId) {
    root.label = newLabel;
    return true;
  }
  for (const child of root.children) {
    if (updateNodeLabel(child, targetId, newLabel)) return true;
  }
  return false;
}

function addChildNode(root: TreeNode, parentId: string, newNode: TreeNode): boolean {
  if (root.id === parentId) {
    root.children.push(newNode);
    return true;
  }
  for (const child of root.children) {
    if (addChildNode(child, parentId, newNode)) return true;
  }
  return false;
}

interface NodeRectProps {
  node: TreeNode;
  isHighlighted: boolean;
  darkMode: boolean;
  isEditing: boolean;
  editValue: string;
  onEditChange: (value: string) => void;
  onEditSubmit: () => void;
  onEditCancel: () => void;
  onStartEdit: () => void;
  onAddChild: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

function NodeRect({ 
  node, isHighlighted, darkMode, 
  isEditing, editValue, onEditChange, onEditSubmit, onEditCancel,
  onStartEdit, onAddChild, onDelete, canDelete
}: NodeRectProps) {
  const w = node.width || calculateNodeWidth(node);
  const cx = node.x! + w / 2;
  const cy = node.y! + NODE_H / 2;
  const [showActions, setShowActions] = useState(false);

  // 计算按钮区域的范围
  // 按钮分布在：右侧 (+按钮)、左上 (编辑)、左下 (删除)
  const buttonArea = {
    minX: node.x! - 22,  // 左侧按钮中心 - 半径
    maxX: node.x! + w + 22,  // 右侧按钮中心 + 半径
    minY: cy - 22,  // 上方按钮中心 - 半径
    maxY: cy + 22,  // 下方按钮中心 + 半径
  };

  const handleMouseEnter = () => setShowActions(true);
  const handleMouseLeave = () => setShowActions(false);

  return (
    <g>
      {/* 扩展的悬停检测区域 - 覆盖节点和按钮 */}
      <rect
        x={buttonArea.minX}
        y={buttonArea.minY}
        width={buttonArea.maxX - buttonArea.minX}
        height={buttonArea.maxY - buttonArea.minY}
        fill="transparent"
        style={{ cursor: 'default' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />

      {/* 节点主体 */}
      <rect
        x={node.x}
        y={node.y}
        width={w}
        height={NODE_H}
        rx={node.level === 0 ? 12 : 8}
        fill={isHighlighted ? node.color + '30' : (darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)')}
        stroke={node.color}
        strokeWidth={node.level === 0 ? 2 : 1.5}
        style={{ filter: isHighlighted ? `drop-shadow(0 0 8px ${node.color}80)` : undefined, pointerEvents: 'none' }}
      />
      
      {isEditing ? (
        <foreignObject
          x={node.x}
          y={node.y}
          width={w}
          height={NODE_H}
        >
          <div className="w-full h-full flex items-center justify-center px-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEditSubmit();
                if (e.key === 'Escape') onEditCancel();
              }}
              onBlur={onEditSubmit}
              autoFocus
              className="w-full px-2 py-1 text-xs rounded border-2 outline-none"
              style={{
                background: darkMode ? '#1e293b' : '#fff',
                borderColor: node.color,
                color: darkMode ? '#e2e8f0' : '#1e293b',
              }}
            />
          </div>
        </foreignObject>
      ) : (
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={isHighlighted ? node.color : (darkMode ? '#94a3b8' : '#475569')}
          fontSize={FONT_SIZE[node.level] || 11}
          fontWeight={node.level === 0 ? 600 : node.level === 1 ? 500 : 400}
          style={{ fontFamily: 'system-ui, sans-serif', userSelect: 'none', pointerEvents: 'none' }}
        >
          {node.label}
        </text>
      )}

      {/* 操作按钮 - 添加独立的悬停事件 */}
      {showActions && !isEditing && (
        <g>
          {/* 添加子节点按钮 */}
          <g
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <circle
              cx={node.x! + w + 12}
              cy={cy}
              r={10}
              fill={node.color}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                onAddChild();
              }}
            />
            <text
              x={node.x! + w + 12}
              y={cy + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fff"
              fontSize={12}
              style={{ cursor: 'pointer', pointerEvents: 'none' }}
            >
              +
            </text>
          </g>

          {/* 编辑按钮 */}
          <g
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <circle
              cx={node.x! - 12}
              cy={cy - 12}
              r={8}
              fill={darkMode ? '#475569' : '#94a3b8'}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit();
              }}
            />
            <text
              x={node.x! - 12}
              y={cy - 11}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fff"
              fontSize={8}
              style={{ cursor: 'pointer', pointerEvents: 'none' }}
            >
              ✎
            </text>
          </g>

          {/* 删除按钮 */}
          {canDelete && (
            <g
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <circle
                cx={node.x! - 12}
                cy={cy + 12}
                r={8}
                fill="#ef4444"
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              />
              <text
                x={node.x! - 12}
                y={cy + 13}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                fontSize={8}
                style={{ cursor: 'pointer', pointerEvents: 'none' }}
              >
                ×
              </text>
            </g>
          )}
        </g>
      )}
    </g>
  );
}

interface MindMapViewProps {
  darkMode: boolean;
}

export function MindMapView({ darkMode }: MindMapViewProps) {
  const { notes, activeNoteId, updateNote } = useNoteStore();
  const note = notes.find(n => n.id === activeNoteId);
  
  // 所有 hooks 必须在任何 return 之前调用
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 30, y: 20 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [isGeneratingMindmap, setIsGeneratingMindmap] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const getLevelColor = useCallback((level: number): string => {
    const colors = ['#7c5af0', '#22d3ee', '#a78bfa', '#34d399', '#f59e0b', '#f472b6'];
    return colors[level % colors.length];
  }, []);

  const treeToMindmapFormat = useCallback((root: TreeNode): any => {
    const nodes: any[] = [];
    const processNode = (node: TreeNode, parentId: string | null) => {
      const nodeData = { id: node.id, label: node.label, parent: parentId };
      nodes.push(nodeData);
      node.children.forEach(child => processNode(child, node.id));
    };
    processNode(root, null);
    return { nodes };
  }, []);

  const saveMindmap = useCallback((root: TreeNode) => {
    if (!note) return;
    const mindmap = treeToMindmapFormat(root);
    console.log('>>> [DEBUG] 保存思维导图:', mindmap);
    updateNote(note.id, { mindmap });
  }, [note, updateNote, treeToMindmapFormat]);

  const generateId = useCallback(() => 
    `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, 
  []);

  // 生成思维导图（本地解析）
  const handleGenerateMindmap = useCallback(async () => {
    if (!note || isGeneratingMindmap) return;
    
    const API_BASE_URL = '/api';
    setIsGeneratingMindmap(true);
    
    try {
      console.log('>>> [DEBUG] 开始生成思维导图:', note.id);
      
      const response = await fetch(`${API_BASE_URL}/generate-mindmap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: note.content,
          title: note.title
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success || !result.mindmap) {
        console.error('生成思维导图失败:', result.error);
        alert('生成思维导图失败: ' + (result.error || '未知错误'));
        return;
      }
      
      console.log('>>> [DEBUG] 生成思维导图成功，节点数:', result.mindmap.nodes?.length);
      
      // 保存生成的思维导图
      updateNote(note.id, { mindmap: result.mindmap });
      
    } catch (error) {
      console.error('生成思维导图异常:', error);
      alert('生成思维导图失败，请稍后重试');
    } finally {
      setIsGeneratingMindmap(false);
    }
  }, [note, updateNote, isGeneratingMindmap]);

  // 初始化或更新树
  useEffect(() => {
    if (!note) {
      setTree(null);
      return;
    }
    
    console.log('>>> [DEBUG] MindMapView useEffect 触发:', note.id, 'mindmap nodes:', note.mindmap?.nodes?.length || 0);
    
    let newTree: TreeNode;
    
    if (note.mindmap && note.mindmap.nodes) {
      console.log('>>> [DEBUG] MindMapView 找到 mindmap.nodes，节点数:', note.mindmap.nodes.length);
      const convertToTreeNode = (node: any, level: number): TreeNode => {
        const newNode: TreeNode = {
          id: node.id,
          label: decodeUnicode(node.label),  // 解码 Unicode 转义字符
          level,
          children: [],
          color: getLevelColor(level)
        };
        
        const children = note.mindmap.nodes.filter((n: any) => n.parent === node.id);
        for (const child of children) {
          newNode.children.push(convertToTreeNode(child, level + 1));
        }
        
        return newNode;
      };
      
      const rootNode = note.mindmap.nodes.find((n: any) => n.parent === null);
      if (rootNode) {
        newTree = convertToTreeNode(rootNode, 0);
      } else {
        // 无后端数据时只显示根节点，不使用前端解析
        newTree = { id: 'root', label: decodeUnicode(note.title), level: 0, children: [], color: '#7c5af0' };
      }
    } else {
      // 无后端数据时只显示根节点，不使用前端解析
      newTree = { id: 'root', label: decodeUnicode(note.title), level: 0, children: [], color: '#7c5af0' };
    }
    
    assignPositions(newTree, 20, 0);
    setTree(newTree);
  }, [note?.id, note?.content, note?.mindmap, getLevelColor]);

  const nodes = useMemo(() => tree ? collectNodes(tree) : [], [tree]);
  const edges = useMemo(() => tree ? collectEdges(tree) : [], [tree]);

  const handleAddChild = useCallback((parentId: string) => {
    let treeToSave: TreeNode | null = null;
    
    setTree(currentTree => {
      if (!currentTree) return null;
      
      const allNodes = collectNodes(currentTree);
      const parent = allNodes.find(n => n.id === parentId);
      if (!parent) return currentTree;
      
      const newNode: TreeNode = {
        id: generateId(),
        label: '新节点',
        level: parent.level + 1,
        children: [],
        color: getLevelColor(parent.level + 1),
      };
      
      if (addChildNode(currentTree, parentId, newNode)) {
        assignPositions(currentTree, 20, 0);
        treeToSave = currentTree;
        setEditingNodeId(newNode.id);
        setEditValue('新节点');
      }
      
      return { ...currentTree };
    });
    
    // 在 setTree 完成后再保存，避免在渲染过程中调用
    if (treeToSave) {
      setTimeout(() => saveMindmap(treeToSave!), 0);
    }
  }, [generateId, getLevelColor, saveMindmap]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    if (nodeId === 'root') return;
    
    // 直接删除，不显示确认弹窗
    let deletedTree: TreeNode | null = null;
    
    setTree(currentTree => {
      if (!currentTree) return null;
      
      console.log('>>> [DEBUG] 删除节点前:', collectNodes(currentTree).map(n => n.label));
      
      // 创建树的深拷贝，避免直接修改原树
      const treeCopy = JSON.parse(JSON.stringify(currentTree));
      
      if (removeNodeFromTree(treeCopy, nodeId)) {
        assignPositions(treeCopy, 20, 0);
        deletedTree = treeCopy;
        console.log('>>> [DEBUG] 删除节点后:', collectNodes(treeCopy).map(n => n.label));
        return treeCopy;
      }
      
      return currentTree;
    });
    
    // 使用useEffect监听tree变化来保存，或者在这里直接保存拷贝后的树
    setTimeout(() => {
      if (deletedTree) {
        console.log('>>> [DEBUG] 准备保存删除后的树');
        saveMindmap(deletedTree);
      }
    }, 0);
  }, [saveMindmap]);

  // 清空所有节点（保留根节点）
  const handleClearAllNodes = useCallback(() => {
    setTree(currentTree => {
      if (!currentTree) return null;
      
      // 创建新的树，只保留根节点，清空所有子节点
      const clearedTree: TreeNode = {
        ...currentTree,
        children: []
      };
      
      assignPositions(clearedTree, 20, 0);
      
      // 保存清空后的树
      setTimeout(() => {
        saveMindmap(clearedTree);
      }, 0);
      
      return clearedTree;
    });
  }, [saveMindmap]);

  const handleStartEdit = useCallback((nodeId: string, currentLabel: string) => {
    setEditingNodeId(nodeId);
    setEditValue(currentLabel);
  }, []);

  const handleEditSubmit = useCallback(() => {
    if (!editingNodeId) return;
    
    let treeToSave: TreeNode | null = null;
    
    setTree(currentTree => {
      if (!currentTree) return null;
      
      if (editValue.trim()) {
        if (updateNodeLabel(currentTree, editingNodeId, editValue.trim())) {
          assignPositions(currentTree, 20, 0);
          treeToSave = currentTree;
        }
      }
      
      return { ...currentTree };
    });
    
    setEditingNodeId(null);
    setEditValue('');
    
    // 在 setTree 完成后再保存，避免在渲染过程中调用
    if (treeToSave) {
      setTimeout(() => saveMindmap(treeToSave!), 0);
    }
  }, [editingNodeId, editValue, saveMindmap]);

  const handleEditCancel = useCallback(() => {
    setEditingNodeId(null);
    setEditValue('');
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan.x, pan.y]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  // 移动端触摸缩放支持
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const [isTouchScaling, setIsTouchScaling] = useState(false);
  const [touchPanStart, setTouchPanStart] = useState({ x: 0, y: 0 });
  const [initialPinchZoom, setInitialPinchZoom] = useState(1);

  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 双指缩放模式
      setIsTouchScaling(true);
      setIsPanning(false);
      setLastTouchDistance(getTouchDistance(e.touches));
      setInitialPinchZoom(zoom);
    } else if (e.touches.length === 1) {
      // 单指拖拽模式
      setIsPanning(true);
      setTouchPanStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  }, [zoom, pan.x, pan.y]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && isTouchScaling) {
      // 双指缩放
      const distance = getTouchDistance(e.touches);
      if (lastTouchDistance !== null) {
        const scale = distance / lastTouchDistance;
        const newZoom = Math.max(0.3, Math.min(2.5, initialPinchZoom * scale));
        setZoom(newZoom);
      }
      e.preventDefault();
    } else if (e.touches.length === 1 && isPanning && !isTouchScaling) {
      // 单指拖拽
      setPan({
        x: e.touches[0].clientX - touchPanStart.x,
        y: e.touches[0].clientY - touchPanStart.y
      });
      e.preventDefault();
    }
  }, [isTouchScaling, isPanning, lastTouchDistance, initialPinchZoom, touchPanStart]);

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
    setIsTouchScaling(false);
    setLastTouchDistance(null);
  }, []);

  const exportMarkdown = useCallback(() => {
    if (!note) return;
    const lines = nodes
      .filter(n => n.id !== 'root')
      .map(n => '  '.repeat(n.level - 1) + '- ' + n.label);
    const md = `# ${note.title}\n\n${lines.join('\n')}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title}-mindmap.md`;
    a.click();
  }, [note, nodes]);

  // 现在可以安全地返回条件渲染
  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: darkMode ? '#0a0c15' : '#F9F5FF' }}>
        <div className="text-center">
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🗺️</div>
          <p style={{ color: darkMode ? '#94a3b8' : '#64748b', fontSize: '0.9rem' }}>请先选择一篇笔记</p>
        </div>
      </div>
    );
  }

  if (nodes.length <= 1) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: darkMode ? '#0a0c15' : '#F9F5FF' }}>
        <div className="text-center">
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📝</div>
          <p style={{ color: darkMode ? '#64748b' : '#64748b', fontSize: '0.9rem' }}>笔记内容较少，添加标题(#)即可生成思维导图</p>
          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={() => handleAddChild('root')}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: '#7c5af0', color: '#fff' }}
            >
              <Plus size={16} className="inline mr-1" />
              添加根节点
            </button>
            <button
              onClick={handleGenerateMindmap}
              disabled={isGeneratingMindmap}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: darkMode ? 'rgba(124,90,240,0.2)' : 'rgba(124,90,240,0.1)', color: '#7c5af0', border: '1px solid rgba(124,90,240,0.3)' }}
            >
              {isGeneratingMindmap ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  生成思维导图
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const svgWidth = Math.max(...nodes.map(n => (n.x || 0) + (n.width || calculateNodeWidth(n)))) + 100;
  const svgHeight = Math.max(...nodes.map(n => (n.y || 0) + NODE_H)) + 60;

  return (
    <div className="flex-1 flex flex-col overflow-hidden rounded-2xl" style={{ background: darkMode ? '#0a0c15' : '#F9F5FF' }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-6 py-3 shrink-0"
        style={{ borderBottom: darkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setZoom(z => Math.min(z + 0.15, 2.5))}
            className="p-1.5 rounded transition-colors hover:bg-white/10 dark:hover:bg-black/10"
            style={{ color: darkMode ? '#64748b' : '#94a3b8' }}
          >
            <ZoomIn size={14} />
          </button>
          <span style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8', minWidth: 40, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button 
            onClick={() => setZoom(z => Math.max(z - 0.15, 0.3))}
            className="p-1.5 rounded transition-colors hover:bg-white/10 dark:hover:bg-black/10"
            style={{ color: darkMode ? '#64748b' : '#94a3b8' }}
          >
            <ZoomOut size={14} />
          </button>
          <button 
            onClick={() => { setZoom(1); setPan({ x: 30, y: 20 }); }}
            className="p-1.5 rounded transition-colors hover:bg-white/10 dark:hover:bg-black/10"
            style={{ color: darkMode ? '#64748b' : '#94a3b8' }}
          >
            <RotateCcw size={14} />
          </button>
        </div>
        <div style={{ width: 1, height: 16, background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
        <span style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8' }}>{nodes.length} 个节点</span>
        <div className="flex items-center gap-2 ml-4">
          <span style={{ fontSize: '0.7rem', color: darkMode ? '#64748b' : '#94a3b8' }}>
            💡 悬停节点可编辑、添加、删除
          </span>
        </div>
        <button
          onClick={handleClearAllNodes}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors hover:bg-red-500/10"
          style={{ fontSize: '0.75rem', color: '#ef4444' }}
          title="清空所有节点"
        >
          <Trash2 size={12} /> 清空
        </button>
        <button
          onClick={exportMarkdown}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors hover:bg-white/10 dark:hover:bg-black/10"
          style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8' }}
        >
          <Download size={12} /> 导出Markdown
        </button>
      </div>

      {/* SVG canvas */}
      <div
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ background: darkMode ? '#0a0c15' : '#F9F5FF' }}
        >
          <defs>
            <radialGradient id="bg-gradient" cx="50%" cy="50%">
              <stop offset="0%" stopColor={darkMode ? '#1a1040' : '#e0e7ff'} stopOpacity="0.3" />
              <stop offset="100%" stopColor={darkMode ? '#0a0c15' : '#f5f5f5'} stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#bg-gradient)" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Edges */}
            {edges.map(([parent, child], i) => {
              const pw = parent.width || calculateNodeWidth(parent);
              const x1 = parent.x! + pw;
              const y1 = parent.y! + NODE_H / 2;
              const x2 = child.x!;
              const y2 = child.y! + NODE_H / 2;
              const mx = (x1 + x2) / 2;
              const isHl = highlighted === parent.id || highlighted === child.id;
              return (
                <path
                  key={i}
                  d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke={isHl ? child.color : (darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}
                  strokeWidth={isHl ? 2 : 1}
                  style={{ transition: 'stroke 0.2s' }}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map(node => (
              <g
                key={node.id}
                onMouseEnter={() => setHighlighted(node.id)}
                onMouseLeave={() => setHighlighted(null)}
                style={{ cursor: 'pointer' }}
              >
                <NodeRect 
                  node={node} 
                  isHighlighted={highlighted === node.id} 
                  darkMode={darkMode}
                  isEditing={editingNodeId === node.id}
                  editValue={editValue}
                  onEditChange={setEditValue}
                  onEditSubmit={handleEditSubmit}
                  onEditCancel={handleEditCancel}
                  onStartEdit={() => handleStartEdit(node.id, node.label)}
                  onAddChild={() => handleAddChild(node.id)}
                  onDelete={() => handleDeleteNode(node.id)}
                  canDelete={node.id !== 'root'}
                />
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
