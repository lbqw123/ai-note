import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react';
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

  const handleMouseDown = (e: React.MouseEvent<SVGElement>) => {
    if ((e.target as Element).closest('.graph-node')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);
  const handleMouseUp = () => setIsPanning(false);

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
    if (e.touches.length === 2 && isTouchScaling) {
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
  }, [isTouchScaling, isPanning, lastTouchDistance, initialPinchZoom, touchPanStart]);

  const handleTouchEnd = useCallback(() => {
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
            {edgeData.map(edge => {
              const p1 = positions[edge.from];
              const p2 = positions[edge.to];
              if (!p1 || !p2) return null;
              const n1 = nodeData.find(n => n.id === edge.from);
              const n2 = nodeData.find(n => n.id === edge.to);
              if (!n1 || !n2) return null;

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

            {nodeData.map(node => {
              const pos = positions[node.id];
              if (!pos) return null;
              const isSelected = selectedId === node.id;
              const isHovered = hoveredId === node.id;
              const isRelated = relatedConnections.some(c => c.fromId === node.id || c.toId === node.id);
              const dimmed = selectedId && !isSelected && !isRelated;

              return (
                <g
                  key={node.id}
                  className="graph-node"
                  style={{ cursor: 'pointer' }}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => setSelectedId(node.id)}
                  onDoubleClick={() => setActiveNote(node.id)}
                >
                  {(isSelected || isHovered) && (
                    <circle
                      r={node.r + 12}
                      fill={node.color}
                      opacity={0.12}
                    />
                  )}
                  {isSelected && (
                    <circle
                      r={node.r + 5}
                      fill="none"
                      stroke={node.color}
                      strokeWidth={2}
                      strokeOpacity={0.6}
                      strokeDasharray="4 2"
                    />
                  )}
                  <circle
                    r={node.r}
                    fill={`${node.color}${dimmed ? '20' : isSelected ? '30' : '15'}`}
                    stroke={node.color}
                    strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
                    strokeOpacity={dimmed ? 0.2 : 1}
                    style={{ transition: 'all 0.2s', filter: isSelected ? `drop-shadow(0 0 10px ${node.color}80)` : undefined }}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={dimmed ? (darkMode ? '#1e293b' : '#f8fafc') : (darkMode ? '#e2e8f0' : '#1e293b')}
                    fontSize={node.r > 28 ? 11 : 9.5}
                    fontWeight={isSelected ? 600 : 400}
                    style={{ userSelect: 'none', pointerEvents: 'none', fontFamily: 'system-ui, sans-serif' }}
                  >
                    {node.title.length > (node.r > 28 ? 8 : 6) ? node.title.slice(0, node.r > 28 ? 6 : 5) + '…' : node.title}
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
          <button
            onClick={() => setActiveNote(selectedNode.id)}
            className="p-1.5 rounded-lg transition-all mb-2"
            style={{
              background: 'rgba(124,90,240,0.15)',
              border: '1px solid rgba(124,90,240,0.25)',
              color: '#a78bfa',
            }}
            title="打开笔记"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M14 10 21 3"/><path d="M10 21H3v-6"/><path d="M10 14 3 21"/></svg>
          </button>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6 6 6"/><path d="M21 3H3"/><path d="M18 6 6 6 6 6"/><path d="M3 21h18"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6-6 6"/><path d="M21 3H3"/><path d="M18 6 6 6 6 6"/><path d="M3 21h18"/></svg>
          )}
        </button>
      )}

      {!selectedId && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ 
              background: darkMode ? 'rgba(20,24,40,0.9)' : 'rgba(234,227,245,0.9)', 
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, 
              backdropFilter: 'blur(10px)'
            }}
        >
          <Info size={12} style={{ color: darkMode ? '#64748b' : '#94a3b8' }} />
          <span style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8' }}>点击节点查看详情，双击打开笔记</span>
        </div>
      )}
    </div>
  );
}