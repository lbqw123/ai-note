import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Lightbulb, LayoutGrid, Sparkles } from 'lucide-react';
import { useNoteStore, CONNECTION_COLORS, ConnectionType } from '../store/noteStore';

interface NodePos {
  id: string;
  x: number;
  y: number;
  r: number;
  color: string;
  title: string;
  folderId: string | null;
  connectionCount: number;
}

const FOLDER_COLORS = [
  '#7c5af0', '#22d3ee', '#f59e0b', '#34d399', '#f87171', '#a78bfa', '#60a5fa',
];

function useForceLayout(nodes: NodePos[], edges: Array<{from: string; to: string}>, width: number, height: number) {
  const [positions, setPositions] = useState<Record<string, {x: number; y: number}>>({});
  const animRef = useRef<number>(undefined);
  const posRef = useRef<Record<string, {x: number; y: number; vx: number; vy: number}>>({});

  useEffect(() => {
    if (!nodes.length) return;

    posRef.current = {};
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.3;
      posRef.current[node.id] = {
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
      };
    });

    let iteration = 0;
    const MAX_ITER = 100;

    const simulate = () => {
      if (iteration >= MAX_ITER) {
        setPositions(Object.fromEntries(
          Object.entries(posRef.current).map(([id, p]) => [id, { x: p.x, y: p.y }])
        ));
        return;
      }

      const alpha = Math.max(0.01, 1 - iteration / MAX_ITER);
      const pos = posRef.current;

      Object.values(pos).forEach(p => { p.vx = 0; p.vy = 0; });

      nodes.forEach((n1, i) => {
        nodes.forEach((n2, j) => {
          if (i >= j) return;
          const dx = pos[n1.id].x - pos[n2.id].x;
          const dy = pos[n1.id].y - pos[n2.id].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 4000 / (dist * dist);
          const fx = (dx / dist) * force * alpha;
          const fy = (dy / dist) * force * alpha;
          pos[n1.id].vx += fx;
          pos[n1.id].vy += fy;
          pos[n2.id].vx -= fx;
          pos[n2.id].vy -= fy;
        });
      });

      edges.forEach(edge => {
        const p1 = pos[edge.from];
        const p2 = pos[edge.to];
        if (!p1 || !p2) return;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const target = 180;
        const force = (dist - target) * 0.04 * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        p1.vx += fx;
        p1.vy += fy;
        p2.vx -= fx;
        p2.vy -= fy;
      });

      nodes.forEach(n => {
        const dx = width / 2 - pos[n.id].x;
        const dy = height / 2 - pos[n.id].y;
        pos[n.id].vx += dx * 0.01 * alpha;
        pos[n.id].vy += dy * 0.01 * alpha;
      });

      nodes.forEach(n => {
        pos[n.id].x += pos[n.id].vx * 0.8;
        pos[n.id].y += pos[n.id].vy * 0.8;
        pos[n.id].x = Math.max(60, Math.min(width - 60, pos[n.id].x));
        pos[n.id].y = Math.max(60, Math.min(height - 60, pos[n.id].y));
      });

      iteration++;
      if (iteration % 5 === 0 || iteration === MAX_ITER) {
        setPositions(Object.fromEntries(
          Object.entries(pos).map(([id, p]) => [id, { x: p.x, y: p.y }])
        ));
      }
      animRef.current = requestAnimationFrame(simulate);
    };

    animRef.current = requestAnimationFrame(simulate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [nodes.length, edges.length, width, height]);

  return positions;
}

interface KnowledgeStarchainViewProps {
  darkMode: boolean;
}

export function KnowledgeStarchainView({ darkMode }: KnowledgeStarchainViewProps) {
  const { notes, connections, setActiveNote, activeNoteId, folders } = useNoteStore();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(activeNoteId);
  const [zoomInHovered, setZoomInHovered] = useState(false);
  const [zoomOutHovered, setZoomOutHovered] = useState(false);
  const [resetHovered, setResetHovered] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [dragOffset, setDragOffset] = useState<Record<string, {x: number; y: number}>>({});
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStartPos = useRef<{x: number; y: number} | null>(null);
  const [lightupIndex, setLightupIndex] = useState(-1);
  const [isLightupActive, setIsLightupActive] = useState(false);
  const lightupTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 整理排列状态
  const [isArranged, setIsArranged] = useState(false);
  const [arrangedPositions, setArrangedPositions] = useState<Record<string, {x: number; y: number}>>({});
  
  // 12星座布局状态
  const [zodiacIndex, setZodiacIndex] = useState(-1); // -1 表示未启用
  const ZODIAC_NAMES = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'];
  
  // 碰撞节流记录
  const collisionThrottleRef = useRef<Record<string, number>>({});
  
  // 粒子特效系统
  interface Particle {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
    createdAt: number;
  }
  const [particles, setParticles] = useState<Particle[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const particleAnimRef = useRef<number | null>(null);
  const MAX_PARTICLES = 50; // 最大粒子数量限制
  
  // 生成星星粒子（固定黄色）
  const spawnParticles = useCallback((x: number, y: number, count: number = 8) => {
    // 如果当前粒子数已达上限，不再生成
    if (particlesRef.current.length >= MAX_PARTICLES) return;
    
    const STAR_COLOR = '#fbbf24'; // 黄色星星
    const now = Date.now();
    const newParticles: Particle[] = [];
    
    // 限制生成数量，避免超过上限
    const availableSlots = MAX_PARTICLES - particlesRef.current.length;
    const actualCount = Math.min(count, availableSlots);
    
    for (let i = 0; i < actualCount; i++) {
      const angle = (Math.PI * 2 * i) / actualCount + Math.random() * 0.5;
      const speed = 1.5 + Math.random() * 2;
      newParticles.push({
        id: `p${now}_${i}_${Math.random().toString(36).substr(2, 5)}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 25 + Math.random() * 15,
        color: STAR_COLOR,
        size: 2 + Math.random() * 2,
        createdAt: now,
      });
    }
    particlesRef.current = [...particlesRef.current, ...newParticles];
    setParticles(particlesRef.current);
  }, []);
  
  // 更新粒子动画 - 使用固定时间步长
  useEffect(() => {
    let lastTime = performance.now();
    
    const updateParticles = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      // 限制最大时间步长，避免卡顿时的跳跃
      const dt = Math.min(deltaTime, 50);
      
      particlesRef.current = particlesRef.current
        .map(p => {
          // 根据实际时间计算生命衰减
          const lifeDecay = dt / (p.maxLife * 16.67); // 假设60fps，每帧约16.67ms
          return {
            ...p,
            x: p.x + p.vx * (dt / 16.67),
            y: p.y + p.vy * (dt / 16.67),
            vx: p.vx * 0.96,
            vy: p.vy * 0.96,
            life: p.life - lifeDecay,
          };
        })
        .filter(p => p.life > 0);
      
      // 如果粒子过多，强制移除最老的
      if (particlesRef.current.length > MAX_PARTICLES) {
        particlesRef.current = particlesRef.current
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, MAX_PARTICLES);
      }
      
      setParticles(particlesRef.current);
      particleAnimRef.current = requestAnimationFrame(updateParticles);
    };
    
    particleAnimRef.current = requestAnimationFrame(updateParticles);
    return () => {
      if (particleAnimRef.current) cancelAnimationFrame(particleAnimRef.current);
    };
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      const ro = new ResizeObserver(entries => {
        const entry = entries[0];
        setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      });
      ro.observe(containerRef.current);
      setSize({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight });
      return () => ro.disconnect();
    }
  }, []);

  const folderColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    folders.forEach((f, i) => { map[f.id] = FOLDER_COLORS[i % FOLDER_COLORS.length]; });
    return map;
  }, [folders]);

  const nodeData = useMemo(() => notes.map(note => {
    const connCount = connections.filter(c => c.fromId === note.id || c.toId === note.id).length;
    return {
      id: note.id,
      title: note.title,
      folderId: note.folderId,
      connectionCount: connCount,
      r: Math.max(20, Math.min(36, 18 + connCount * 4)),
      color: note.folderId ? (folderColorMap[note.folderId] || '#7c5af0') : '#64748b',
      x: 0, y: 0,
    };
  }), [notes, connections, folderColorMap]);

  const edgeData = useMemo(() => connections.map(c => ({
    from: c.fromId,
    to: c.toId,
    type: c.type,
    id: c.id,
  })), [connections]);

  const positions = useForceLayout(nodeData, edgeData, size.w, size.h);

  // 碰撞检测 useEffect - 只在拖动时检测
  useEffect(() => {
    if (!isDraggingNode || !draggingNodeId) return;
    
    // 全局碰撞节流 - 整个拖动过程中限制总碰撞次数
    let collisionCount = 0;
    const MAX_COLLISIONS_PER_DRAG = 5;
    
    const interval = setInterval(() => {
      // 如果粒子已满或碰撞次数已达上限，跳过检测
      if (particlesRef.current.length >= MAX_PARTICLES * 0.8 || collisionCount >= MAX_COLLISIONS_PER_DRAG) return;
      
      const offset = dragOffset[draggingNodeId];
      if (!offset) return;
      
      const draggedNode = nodeData.find(n => n.id === draggingNodeId);
      // 使用 getNodePosition 获取位置
      const draggedPos = zodiacIndex >= 0 ? arrangedPositions[draggingNodeId] : (isArranged ? arrangedPositions[draggingNodeId] : positions[draggingNodeId]);
      if (!draggedNode || !draggedPos) return;
      
      const actualX = draggedPos.x + offset.x;
      const actualY = draggedPos.y + offset.y;
      const draggedR = isLightupActive && lightupIndex === nodeData.findIndex(n => n.id === draggingNodeId) 
        ? draggedNode.r * 1.3 
        : draggedNode.r;
      
      nodeData.forEach((otherNode, idx) => {
        if (otherNode.id === draggingNodeId) return;
        
        const otherPos = zodiacIndex >= 0 ? arrangedPositions[otherNode.id] : (isArranged ? arrangedPositions[otherNode.id] : positions[otherNode.id]);
        if (!otherPos) return;
        
        const otherOffset = dragOffset[otherNode.id] || { x: 0, y: 0 };
        const otherX = otherPos.x + otherOffset.x;
        const otherY = otherPos.y + otherOffset.y;
        const otherR = isLightupActive && lightupIndex === idx 
          ? otherNode.r * 1.3 
          : otherNode.r;
        
        const dx = actualX - otherX;
        const dy = actualY - otherY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = draggedR + otherR;
        
        // 碰撞检测：距离小于两节点半径之和
        if (distance < minDistance && distance > minDistance * 0.3) {
          const pairId = [draggingNodeId, otherNode.id].sort().join('-');
          const now = Date.now();
          // 增加节流时间到800ms
          if (!collisionThrottleRef.current[pairId] || now - collisionThrottleRef.current[pairId] > 800) {
            collisionThrottleRef.current[pairId] = now;
            collisionCount++;
            const collisionX = (actualX + otherX) / 2;
            const collisionY = (actualY + otherY) / 2;
            // 减少每次生成的粒子数
            spawnParticles(collisionX, collisionY, 6);
          }
        }
      });
    }, 150); // 增加检测间隔到150ms
    
    return () => clearInterval(interval);
  }, [isDraggingNode, draggingNodeId, nodeData, positions, arrangedPositions, isArranged, zodiacIndex, dragOffset, isLightupActive, lightupIndex, spawnParticles]);

  // 一键整理排列
  const arrangeNodes = useCallback(() => {
    if (nodeData.length === 0) return;
    
    // 取消选中状态
    setSelectedId(null);
    setHoveredId(null);
    
    // 按连接数排序
    const sortedNodes = [...nodeData].sort((a, b) => b.connectionCount - a.connectionCount);
    
    // 分离有连接和无连接的节点
    const connectedNodes = sortedNodes.filter(n => n.connectionCount > 0);
    const isolatedNodes = sortedNodes.filter(n => n.connectionCount === 0);
    
    const centerX = size.w / 2;
    const centerY = size.h / 2;
    const newPositions: Record<string, {x: number; y: number}> = {};
    
    // 有连接的节点放在内圈（半径小）
    if (connectedNodes.length > 0) {
      const innerRadius = Math.min(size.w, size.h) * 0.2;
      connectedNodes.forEach((node, i) => {
        const angle = (i / connectedNodes.length) * 2 * Math.PI - Math.PI / 2;
        newPositions[node.id] = {
          x: centerX + innerRadius * Math.cos(angle),
          y: centerY + innerRadius * Math.sin(angle),
        };
      });
    }
    
    // 无连接的节点放在外圈（半径大）
    if (isolatedNodes.length > 0) {
      const outerRadius = Math.min(size.w, size.h) * 0.38;
      isolatedNodes.forEach((node, i) => {
        const angle = (i / isolatedNodes.length) * 2 * Math.PI - Math.PI / 2;
        newPositions[node.id] = {
          x: centerX + outerRadius * Math.cos(angle),
          y: centerY + outerRadius * Math.sin(angle),
        };
      });
    }
    
    setArrangedPositions(newPositions);
    setIsArranged(true);
    
    // 清除所有拖动偏移
    setDragOffset({});
    
    // 重置视角
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, [nodeData, size.w, size.h]);
  
  // 取消整理，回到力导向布局
  const resetArrangement = useCallback(() => {
    setIsArranged(false);
    setArrangedPositions({});
  }, []);

  // 获取节点实际位置（整理模式、星座模式或力导向模式）
  const getNodePosition = useCallback((nodeId: string) => {
    if (zodiacIndex >= 0 && arrangedPositions[nodeId]) {
      return arrangedPositions[nodeId];
    }
    if (isArranged && arrangedPositions[nodeId]) {
      return arrangedPositions[nodeId];
    }
    return positions[nodeId];
  }, [isArranged, arrangedPositions, positions, zodiacIndex]);

  // 12星座布局函数
  const applyZodiacLayout = useCallback((index: number) => {
    if (nodeData.length === 0) return;
    
    // 取消选中状态
    setSelectedId(null);
    setHoveredId(null);
    setIsArranged(false);
    
    const centerX = size.w / 2;
    const centerY = size.h / 2;
    const scale = Math.min(size.w, size.h) * 0.35;
    const newPositions: Record<string, {x: number; y: number}> = {};
    
    // 12星座形状定义（归一化坐标，范围 -1 到 1）
    const zodiacShapes: Record<number, Array<{x: number; y: number}>> = {
      // 白羊座 - 羊角形状
      0: [{x: -0.5, y: 0.8}, {x: -0.3, y: 0.3}, {x: 0, y: 0}, {x: 0.3, y: 0.3}, {x: 0.5, y: 0.8}, {x: 0, y: -0.5}],
      // 金牛座 - 牛头
      1: [{x: -0.6, y: -0.3}, {x: -0.3, y: -0.6}, {x: 0.3, y: -0.6}, {x: 0.6, y: -0.3}, {x: 0.4, y: 0.3}, {x: 0, y: 0.6}, {x: -0.4, y: 0.3}],
      // 双子座 - 双生子
      2: [{x: -0.4, y: -0.8}, {x: -0.4, y: 0}, {x: -0.4, y: 0.8}, {x: 0.4, y: -0.8}, {x: 0.4, y: 0}, {x: 0.4, y: 0.8}],
      // 巨蟹座 - 螃蟹
      3: [{x: -0.5, y: -0.4}, {x: 0, y: -0.6}, {x: 0.5, y: -0.4}, {x: 0.6, y: 0}, {x: 0.3, y: 0.4}, {x: 0, y: 0.6}, {x: -0.3, y: 0.4}, {x: -0.6, y: 0}],
      // 狮子座 - 狮子头部
      4: [{x: -0.5, y: -0.3}, {x: -0.3, y: -0.6}, {x: 0.3, y: -0.6}, {x: 0.6, y: -0.2}, {x: 0.4, y: 0.3}, {x: 0, y: 0.5}, {x: -0.4, y: 0.3}],
      // 处女座 - 少女
      5: [{x: -0.3, y: -0.8}, {x: 0, y: -0.4}, {x: 0.3, y: -0.8}, {x: 0.2, y: 0}, {x: 0.4, y: 0.4}, {x: 0, y: 0.6}, {x: -0.4, y: 0.4}],
      // 天秤座 - 天平
      6: [{x: -0.6, y: -0.2}, {x: -0.3, y: -0.2}, {x: 0, y: -0.5}, {x: 0.3, y: -0.2}, {x: 0.6, y: -0.2}, {x: 0, y: 0.5}],
      // 天蝎座 - 蝎子
      7: [{x: -0.6, y: 0.2}, {x: -0.3, y: 0}, {x: 0, y: 0}, {x: 0.3, y: 0.2}, {x: 0.5, y: 0.5}, {x: 0.3, y: -0.3}, {x: 0, y: -0.5}],
      // 射手座 - 弓箭
      8: [{x: -0.5, y: 0.5}, {x: -0.2, y: 0.2}, {x: 0.2, y: -0.2}, {x: 0.5, y: -0.5}, {x: 0.3, y: -0.3}, {x: 0, y: 0}, {x: -0.3, y: 0.3}],
      // 摩羯座 - 山羊鱼尾
      9: [{x: -0.4, y: -0.6}, {x: 0, y: -0.8}, {x: 0.4, y: -0.6}, {x: 0.5, y: -0.2}, {x: 0.3, y: 0.2}, {x: 0, y: 0.6}, {x: -0.3, y: 0.2}],
      // 水瓶座 - 水瓶倒水
      10: [{x: -0.5, y: -0.4}, {x: -0.3, y: -0.6}, {x: 0.3, y: -0.6}, {x: 0.5, y: -0.4}, {x: 0.2, y: 0}, {x: 0, y: 0.4}, {x: -0.2, y: 0}],
      // 双鱼座 - 双鱼
      11: [{x: -0.5, y: -0.3}, {x: 0, y: -0.5}, {x: 0.5, y: -0.3}, {x: 0.3, y: 0.2}, {x: 0, y: 0.5}, {x: -0.3, y: 0.2}],
    };
    
    const shape = zodiacShapes[index] || zodiacShapes[0];
    
    // 将节点分配到星座形状的位置
    nodeData.forEach((node, i) => {
      if (i < shape.length) {
        // 主要节点放在形状关键点上
        newPositions[node.id] = {
          x: centerX + shape[i].x * scale,
          y: centerY + shape[i].y * scale,
        };
      } else {
        // 多余节点围绕形状随机分布
        const angle = (i / nodeData.length) * 2 * Math.PI;
        const radius = scale * (0.8 + Math.random() * 0.4);
        newPositions[node.id] = {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        };
      }
    });
    
    setArrangedPositions(newPositions);
    setZodiacIndex(index);
    
    // 清除拖动偏移
    setDragOffset({});
    
    // 重置视角
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, [nodeData, size.w, size.h]);
  
  // 切换到下一个星座
  const nextZodiac = useCallback(() => {
    const nextIndex = (zodiacIndex + 1) % 12;
    applyZodiacLayout(nextIndex);
  }, [zodiacIndex, applyZodiacLayout]);
  
  // 关闭星座布局
  const closeZodiac = useCallback(() => {
    setZodiacIndex(-1);
    setArrangedPositions({});
  }, []);

  const startLightup = useCallback(() => {
    if (nodeData.length === 0) return;
    setIsLightupActive(true);
    setLightupIndex(0);
    let currentIndex = 0;
    if (lightupTimerRef.current) clearInterval(lightupTimerRef.current);
    lightupTimerRef.current = setInterval(() => {
      currentIndex++;
      if (currentIndex >= nodeData.length) {
        setLightupIndex(-1);
        setIsLightupActive(false);
        if (lightupTimerRef.current) clearInterval(lightupTimerRef.current);
      } else {
        setLightupIndex(currentIndex);
      }
    }, 400);
  }, [nodeData.length]);

  const handleMouseDown = (e: React.MouseEvent<SVGElement>) => {
    if ((e.target as Element).closest('.graph-node')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingNode && draggingNodeId && dragStartPos.current) {
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;
      setDragOffset(prev => ({ ...prev, [draggingNodeId]: { x: newX, y: newY } }));
    } else if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [isPanning, panStart, isDraggingNode, draggingNodeId]);

  const handleMouseUp = useCallback(() => {
    if (isDraggingNode) {
      setIsDraggingNode(false);
      setDraggingNodeId(null);
      dragStartPos.current = null;
    }
    setIsPanning(false);
  }, [isDraggingNode]);

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
    // 底部区域不处理拖拽（让底部滑动切换视图生效）
    const touchY = e.touches[0].clientY;
    const windowHeight = window.innerHeight;
    const BOTTOM_SWIPE_AREA = 100;
    const isInBottomArea = touchY > windowHeight - BOTTOM_SWIPE_AREA;
    
    if (isInBottomArea) return;
    
    if (e.touches.length === 2) {
      setIsTouchScaling(true);
      setIsPanning(false);
      setLastTouchDistance(getTouchDistance(e.touches));
      setInitialPinchZoom(zoom);
    } else if (e.touches.length === 1) {
      setIsPanning(true);
      window.dispatchEvent(new CustomEvent('graph-panning-start'));
      setTouchPanStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  }, [zoom, pan.x, pan.y]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDraggingNode && draggingNodeId && e.touches.length === 1) {
      const touch = e.touches[0];
      const startPos = dragStartPos.current;
      if (startPos) {
        const newX = touch.clientX - startPos.x;
        const newY = touch.clientY - startPos.y;
        setDragOffset(prev => ({
          ...prev,
          [draggingNodeId]: {
            x: newX,
            y: newY
          }
        }));
      }
      e.preventDefault();
    } else if (e.touches.length === 2 && isTouchScaling) {
      const distance = getTouchDistance(e.touches);
      if (lastTouchDistance !== null) {
        const scale = distance / lastTouchDistance;
        const newZoom = Math.max(0.3, Math.min(2.5, initialPinchZoom * scale));
        setZoom(newZoom);
      }
      e.preventDefault();
    } else if (e.touches.length === 1 && isPanning && !isTouchScaling) {
      setPan({
        x: e.touches[0].clientX - touchPanStart.x,
        y: e.touches[0].clientY - touchPanStart.y
      });
      e.preventDefault();
    }
  }, [isDraggingNode, draggingNodeId, isTouchScaling, isPanning, lastTouchDistance, initialPinchZoom, touchPanStart]);

  const handleTouchEnd = useCallback(() => {
    setIsDraggingNode(false);
    setDraggingNodeId(null);
    setIsPanning(false);
    setIsTouchScaling(false);
    window.dispatchEvent(new CustomEvent('graph-panning-end'));
    setLastTouchDistance(null);
  }, []);

  const selectedNode = selectedId ? notes.find(n => n.id === selectedId) : null;
  const relatedConnections = selectedId
    ? connections.filter(c => c.fromId === selectedId || c.toId === selectedId)
    : [];

  return (
    <div className="flex-1 flex overflow-hidden rounded-2xl" style={{ background: darkMode ? '#0a0c15' : '#F9F5FF' }} ref={containerRef}>
      <div className="flex-1 relative overflow-hidden">
        <div
          className="absolute top-4 left-4 z-10 flex flex-col gap-1 rounded-xl p-2"
          style={{ 
              background: darkMode ? 'rgba(20,24,40,0.9)' : 'rgba(234,227,245,0.9)', 
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, 
              backdropFilter: 'blur(10px)'
            }}
        >
          <button 
            onClick={() => setZoom(z => Math.min(z + 0.2, 3))}
            onMouseEnter={() => setZoomInHovered(true)}
            onMouseLeave={() => setZoomInHovered(false)}
            className="p-1.5 rounded transition-colors"
            style={{
              color: darkMode ? '#64748b' : '#94a3b8',
              background: zoomInHovered ? (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)') : 'transparent',
            }}
          >
            <ZoomIn size={14} />
          </button>
          <div className="text-center" style={{ fontSize: '0.65rem', color: darkMode ? '#64748b' : '#94a3b8' }}>{Math.round(zoom * 100)}%</div>
          <button 
            onClick={() => setZoom(z => Math.max(z - 0.2, 0.3))}
            onMouseEnter={() => setZoomOutHovered(true)}
            onMouseLeave={() => setZoomOutHovered(false)}
            className="p-1.5 rounded transition-colors"
            style={{
              color: darkMode ? '#64748b' : '#94a3b8',
              background: zoomOutHovered ? (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)') : 'transparent',
            }}
          >
            <ZoomOut size={14} />
          </button>
          <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '2px 0' }} />
          <button 
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            onMouseEnter={() => setResetHovered(true)}
            onMouseLeave={() => setResetHovered(false)}
            className="p-1.5 rounded transition-colors"
            style={{
              color: darkMode ? '#64748b' : '#94a3b8',
              background: resetHovered ? (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)') : 'transparent',
            }}
          >
            <RotateCcw size={14} />
          </button>
          <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '2px 0' }} />
          <button
            onClick={startLightup}
            className="p-1.5 rounded transition-colors"
            style={{
              color: isLightupActive ? '#7c5af0' : (darkMode ? '#64748b' : '#94a3b8'),
              background: isLightupActive ? 'rgba(124,90,240,0.15)' : 'transparent',
            }}
          >
            <Lightbulb size={14} />
          </button>
          <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '2px 0' }} />
          <button
            onClick={isArranged ? resetArrangement : arrangeNodes}
            className="p-1.5 rounded transition-colors"
            style={{
              color: isArranged ? '#22d3ee' : (darkMode ? '#64748b' : '#94a3b8'),
              background: isArranged ? 'rgba(34,211,238,0.15)' : 'transparent',
            }}
            title={isArranged ? '恢复力导向布局' : '整理排列'}
          >
            <LayoutGrid size={14} />
          </button>
          <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '2px 0' }} />
          <button
            onClick={zodiacIndex >= 0 ? nextZodiac : () => applyZodiacLayout(0)}
            className="p-1.5 rounded transition-colors relative"
            style={{
              color: zodiacIndex >= 0 ? '#f59e0b' : (darkMode ? '#64748b' : '#94a3b8'),
              background: zodiacIndex >= 0 ? 'rgba(245,158,11,0.15)' : 'transparent',
            }}
            title={zodiacIndex >= 0 ? `${ZODIAC_NAMES[zodiacIndex]} (点击切换)` : '星座布局'}
          >
            <Sparkles size={14} />
            {zodiacIndex >= 0 && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-amber-500 text-white text-[8px]">
                {zodiacIndex + 1}
              </span>
            )}
          </button>
          {zodiacIndex >= 0 && (
            <button
              onClick={closeZodiac}
              className="p-1 rounded transition-colors mt-1"
              style={{
                color: darkMode ? '#64748b' : '#94a3b8',
                fontSize: '10px',
              }}
              title="关闭星座"
            >
              ✕
            </button>
          )}
        </div>

        <div
          className="absolute top-4 right-4 z-10 rounded-xl p-3"
          style={{ 
              background: darkMode ? 'rgba(20,24,40,0.9)' : 'rgba(234,227,245,0.9)', 
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, 
              backdropFilter: 'blur(10px)'
            }}
        >
          <div style={{ fontSize: '0.65rem', color: darkMode ? '#64748b' : '#94a3b8', marginBottom: 6, letterSpacing: '0.05em' }}>连接类型</div>
          {Object.entries(CONNECTION_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2 mb-1">
              <div className="w-6 h-0.5 rounded" style={{ background: color }} />
              <span style={{ fontSize: '0.65rem', color: darkMode ? '#64748b' : '#94a3b8' }}>
                {type === 'related' ? '相关' : type === 'extended' ? '拓展' : type === 'contrast' ? '对比' : '依赖'}
              </span>
            </div>
          ))}
          {zodiacIndex >= 0 && (
            <>
              <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', margin: '8px 0' }} />
              <div style={{ fontSize: '0.65rem', color: '#f59e0b', marginBottom: 4, letterSpacing: '0.05em', fontWeight: 600 }}>
                ✨ {ZODIAC_NAMES[zodiacIndex]}
              </div>
            </>
          )}
        </div>

        <svg
          width="100%"
          height="100%"
          className="cursor-grab active:cursor-grabbing touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <defs>
            <radialGradient id="graph-bg" cx="50%" cy="50%">
              <stop offset="0%" stopColor={darkMode ? '#1a0d40' : '#e0e7ff'} stopOpacity="0.4" />
              <stop offset="100%" stopColor={darkMode ? '#0a0c15' : '#F9F5FF'} stopOpacity="0" />
            </radialGradient>
            {Object.entries(CONNECTION_COLORS).map(([type, color]) => (
              <marker
                key={type}
                id={`arrow-${type}`}
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L6,3 z" fill={color} opacity="0.6" />
              </marker>
            ))}
          </defs>
          <rect width="100%" height="100%" fill="url(#graph-bg)" />

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* 粒子特效层 */}
            {particles.map(p => (
              <g key={p.id} transform={`translate(${p.x},${p.y})`} opacity={p.life}>
                <polygon
                  points={`0,-${p.size} ${p.size * 0.3},-${p.size * 0.3} ${p.size},0 ${p.size * 0.3},${p.size * 0.3} 0,${p.size} -${p.size * 0.3},${p.size * 0.3} -${p.size},0 -${p.size * 0.3},-${p.size * 0.3}`}
                  fill={p.color}
                  style={{ filter: `drop-shadow(0 0 ${p.size * 2}px ${p.color})` }}
                />
              </g>
            ))}
            {edgeData.map(edge => {
              const baseP1 = getNodePosition(edge.from);
              const baseP2 = getNodePosition(edge.to);
              if (!baseP1 || !baseP2) return null;
              const n1 = nodeData.find(n => n.id === edge.from);
              const n2 = nodeData.find(n => n.id === edge.to);
              if (!n1 || !n2) return null;
              const off1 = dragOffset[edge.from] || { x: 0, y: 0 };
              const off2 = dragOffset[edge.to] || { x: 0, y: 0 };
              const p1 = { x: baseP1.x + off1.x, y: baseP1.y + off1.y };
              const p2 = { x: baseP2.x + off2.x, y: baseP2.y + off2.y };

              const isHighlighted = hoveredId === edge.from || hoveredId === edge.to ||
                selectedId === edge.from || selectedId === edge.to;
              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const x1 = p1.x + (dx / dist) * n1.r;
              const y1 = p1.y + (dy / dist) * n1.r;
              const x2 = p2.x - (dx / dist) * (n2.r + 8);
              const y2 = p2.y - (dy / dist) * (n2.r + 8);
              const color = CONNECTION_COLORS[edge.type as ConnectionType];

              return (
                <line
                  key={edge.id}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={color}
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeOpacity={isHighlighted ? 0.8 : 0.25}
                  markerEnd={`url(#arrow-${edge.type})`}
                  style={{ transition: 'stroke-opacity 0.2s, stroke-width 0.2s' }}
                />
              );
            })}

            {nodeData.map((node, idx) => {
              const pos = getNodePosition(node.id);
              if (!pos) return null;
              const isSelected = selectedId === node.id;
              const isHovered = hoveredId === node.id;
              const isRelated = relatedConnections.some(c => c.fromId === node.id || c.toId === node.id);
              const dimmed = selectedId && !isSelected && !isRelated;
              const isLightup = isLightupActive && lightupIndex === idx;
              const dimByLightup = isLightupActive && !isLightup;
              const offset = dragOffset[node.id] || { x: 0, y: 0 };
              const nodeX = pos.x + offset.x;
              const nodeY = pos.y + offset.y;
              const isBeingDragged = draggingNodeId === node.id;

              return (
                <g
                  key={node.id}
                  className="graph-node"
                  style={{ cursor: isBeingDragged ? 'grabbing' : 'grab' }}
                  transform={`translate(${nodeX}, ${nodeY})`}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={(e) => { if (!isDraggingNode) setSelectedId(node.id); e.stopPropagation(); }}
                  onDoubleClick={() => setActiveNote(node.id)}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setIsDraggingNode(true);
                    setDraggingNodeId(node.id);
                    dragStartPos.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    const touch = e.touches[0];
                    setIsDraggingNode(true);
                    setDraggingNodeId(node.id);
                    dragStartPos.current = { x: touch.clientX - offset.x, y: touch.clientY - offset.y };
                  }}
                >
                  {isLightup && (
                    <>
                      <circle
                        r={(node.r * 1.3) + 25}
                        fill={node.color}
                        opacity={0.15}
                      />
                      <circle
                        r={(node.r * 1.3) + 18}
                        fill={node.color}
                        opacity={0.2}
                      />
                      <circle
                        r={(node.r * 1.3) + 12}
                        fill={node.color}
                        opacity={0.3}
                      />
                    </>
                  )}
                  {(isSelected || isHovered) && !isLightup && (
                    <circle
                      r={node.r + 12}
                      fill={node.color}
                      opacity={0.12}
                    />
                  )}
                  {(isSelected || isLightup) && (
                    <circle
                      r={(isLightup ? node.r * 1.3 : node.r) + 5}
                      fill="none"
                      stroke={node.color}
                      strokeWidth={isLightup ? 4 : 2}
                      strokeOpacity={isLightup ? 1 : 0.6}
                      strokeDasharray="4 2"
                    />
                  )}
                  <circle
                    r={isLightup ? node.r * 1.3 : node.r}
                    fill={`${node.color}${dimmed || dimByLightup ? '15' : isSelected || isLightup ? '70' : '15'}`}
                    stroke={node.color}
                    strokeWidth={isLightup ? 6 : (isSelected ? 2.5 : isHovered ? 2 : 1.5)}
                    strokeOpacity={dimmed || dimByLightup ? 0.2 : isLightup ? 1 : 0.8}
                    style={{ transition: 'all 0.2s', filter: isLightup ? `drop-shadow(0 0 30px ${node.color}) drop-shadow(0 0 60px ${node.color})` : (isSelected ? `drop-shadow(0 0 10px ${node.color})` : undefined) }}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isLightup ? '#ffffff' : (dimmed || dimByLightup ? (darkMode ? '#1e293b' : '#f8fafc') : (darkMode ? '#e2e8f0' : '#1e293b'))}
                    fontSize={isLightup ? (node.r > 28 ? 14 : 12) : (node.r > 28 ? 11 : 9.5)}
                    fontWeight={isSelected || isLightup ? 700 : 400}
                    style={{ userSelect: 'none', pointerEvents: 'none', fontFamily: 'system-ui, sans-serif', filter: isLightup ? `drop-shadow(0 0 8px ${node.color}) drop-shadow(0 0 16px ${node.color})` : undefined }}
                  >
                    {node.title.length > ((isLightup ? node.r * 1.3 : node.r) > 28 ? 8 : 6) ? node.title.slice(0, ((isLightup ? node.r * 1.3 : node.r) > 28 ? 6 : 5)) + '…' : node.title}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {selectedNode && !sidebarCollapsed && (
        <div
          className="w-64 shrink-0 overflow-y-auto custom-scrollbar"
          style={{ 
              background: darkMode ? '#0e1120' : '#D3C9E9', 
              borderLeft: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
            }}
        >
          <div className="p-4">
            <div style={{ fontSize: '0.65rem', color: darkMode ? '#64748b' : '#94a3b8', marginBottom: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              节点详情
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `${nodeData.find(n => n.id === selectedNode.id)?.color || '#7c5af0'}20` }}
            >
              <div
                className="w-4 h-4 rounded-full"
                style={{ background: nodeData.find(n => n.id === selectedNode.id)?.color || '#7c5af0' }}
              />
            </div>
            <div style={{ fontSize: '0.9rem', color: darkMode ? '#e2e8f0' : '#1e293b', fontWeight: 600, marginBottom: 4 }}>
              {selectedNode.title}
            </div>
            <div style={{ fontSize: '0.7rem', color: darkMode ? '#64748b' : '#94a3b8', marginBottom: 16 }}>
              {relatedConnections.length} 条连接
            </div>

            <button
              onClick={() => setActiveNote(selectedNode.id)}
              className="w-full py-2 rounded-lg transition-all text-center mb-4"
              style={{
                background: 'rgba(124,90,240,0.15)',
                border: '1px solid rgba(124,90,240,0.25)',
                color: '#a78bfa',
                fontSize: '0.8rem',
              }}
            >
              打开笔记
            </button>

            {relatedConnections.length > 0 && (
              <div>
                <div style={{ fontSize: '0.65rem', color: darkMode ? '#64748b' : '#94a3b8', marginBottom: 8, letterSpacing: '0.05em' }}>关联笔记</div>
                {relatedConnections.map(conn => {
                  const otherId = conn.fromId === selectedNode.id ? conn.toId : conn.fromId;
                  const other = notes.find(n => n.id === otherId);
                  if (!other) return null;
                  const color = CONNECTION_COLORS[conn.type as ConnectionType];
                  return (
                    <button
                      key={conn.id}
                      onClick={() => { setSelectedId(other.id); }}
                      onMouseEnter={() => setButtonHovered(true)}
                      onMouseLeave={() => setButtonHovered(false)}
                      className="w-full text-left flex items-center gap-2 py-2 px-3 rounded-lg mb-1 transition-all"
                      style={{
                        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                        background: buttonHovered ? (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : 'transparent',
                      }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                      <span style={{ fontSize: '0.75rem', color: darkMode ? '#94a3b8' : '#64748b' }} className="truncate">{other.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedNode && sidebarCollapsed && (
        <div
          className="w-10 shrink-0 flex flex-col items-center py-4"
          style={{ 
              background: darkMode ? '#0e1120' : '#D3C9E9', 
              borderLeft: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
            }}
        >
          <div
            className="w-6 h-6 rounded-full mb-2"
            style={{ background: nodeData.find(n => n.id === selectedNode.id)?.color || '#7c5af0' }}
          />
          <div style={{ fontSize: '0.65rem', color: darkMode ? '#64748b' : '#94a3b8', marginBottom: 8 }}>
            {relatedConnections.length}
          </div>
        </div>
      )}

      {selectedNode && (
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full transition-all"
          style={{
            right: sidebarCollapsed ? '2.5rem' : '16rem',
            background: darkMode ? 'rgba(20,24,40,0.9)' : 'rgba(255,255,255,0.9)',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            backdropFilter: 'blur(10px)',
            color: darkMode ? '#64748b' : '#94a3b8',
          }}
          title={sidebarCollapsed ? '展开侧边栏' : '收缩侧边栏'}
        >
          {sidebarCollapsed ? (
            // 展开图标（右上箭头）
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M14 10 21 3"/><path d="M10 21H3v-6"/><path d="M10 14 3 21"/></svg>
          ) : (
            // 收缩图标（左下箭头）
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H3v-6"/><path d="M10 14 3 21"/><path d="M14 3h6v6"/><path d="M15 10 21 3"/></svg>
          )}
        </button>
      )}
    </div>
  );
}