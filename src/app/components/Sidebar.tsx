import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen,
  FileText, Plus, MoreHorizontal, Trash2, Edit2,
  FolderPlus, Check, X, Tag, Sparkles
} from 'lucide-react';
import { useNoteStore, Note, Folder as FolderType } from '../store/noteStore';

const PLATFORM_COLORS: Record<string, string> = {
  '豆包': '#f59e0b',
  'Kimi': '#22d3ee',
  '通义千问': '#a78bfa',
};

function NoteItem({ note, isActive, onClick, onDelete, darkMode }: {
  note: Note;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  darkMode: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData('noteId', note.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      draggable
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowMenu(false); }}
      onClick={onClick}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className="relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all group ml-2"
      style={{
        background: isActive ? 'rgba(124,90,240,0.15)' : hovered ? (darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)') : 'transparent',
        border: isActive ? '1px solid rgba(124,90,240,0.25)' : '1px solid transparent',
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <FileText size={13} style={{ color: isActive ? '#a78bfa' : (darkMode ? '#475569' : '#64748b'), flexShrink: 0 }} />
      <span
        className="flex-1 truncate"
        style={{ fontSize: '0.8rem', color: isActive ? '#a78bfa' : (darkMode ? '#94a3b8' : '#475569'), fontWeight: isActive ? 500 : 400 }}
      >
        {note.title}
      </span>
      {(hovered || showMenu) && (
        <button
          onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="p-0.5 rounded transition-colors"
          style={{
            color: darkMode ? '#64748b' : '#94a3b8',
            background: hovered ? (darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') : 'transparent',
          }}
        >
          <MoreHorizontal size={12} />
        </button>
      )}
      {showMenu && (
        <div
          className="absolute right-0 top-8 z-50 rounded-lg overflow-hidden"
          style={{ 
            background: darkMode ? '#1a1e30' : '#D3C9E9', 
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, 
            boxShadow: darkMode ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.1)', 
            minWidth: 120
          }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={async () => { await onDelete(); setShowMenu(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 transition-colors"
            style={{ 
              fontSize: '0.8rem',
              color: '#ef4444',
              background: hovered ? 'rgba(239,68,68,0.1)' : 'transparent'
            }}
          >
            <Trash2 size={12} /> 删除笔记
          </button>
        </div>
      )}
    </div>
  );
}

function FolderItem({
  folder, depth, notes, darkMode,
}: {
  folder: FolderType;
  depth: number;
  notes: Note[];
  darkMode: boolean;
}) {
  const {
    toggleFolderExpand, renameFolder, deleteFolder,
    createNote, createFolder, activeNoteId, setActiveNote, deleteNote,
    setActiveFolder, setActiveNoteId, updateNote, moveNoteToFolder, moveFolder, folders,
  } = useNoteStore();
  const [hovered, setHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState(folder.name);
  const [addingNote, setAddingNote] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');
  
  // 直接从 store 获取子文件夹，确保实时更新
  const subFolders = folders.filter(f => f.parentId === folder.id);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const folderNotes = notes.filter(n => n.folderId === folder.id);

  // 文件夹拖拽开始
  const handleFolderDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('folderId', folder.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 检查是否是子文件夹
  const isSubFolder = (parentId: string, childId: string): boolean => {
    const child = folders.find(f => f.id === childId);
    if (!child) return false;
    if (child.parentId === parentId) return true;
    if (child.parentId) return isSubFolder(parentId, child.parentId);
    return false;
  };

  const handleRename = async () => {
    if (renameName.trim()) await renameFolder(folder.id, renameName.trim());
    setRenaming(false);
  };

  const handleAddNote = async () => {
    if (newNoteName.trim()) {
      await createNote(newNoteName.trim(), folder.id);
      if (!folder.isExpanded) await toggleFolderExpand(folder.id);
    }
    setAddingNote(false);
    setNewNoteName('');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    // 检查是否真的离开了当前元素（而不是进入了子元素）
    const currentTarget = e.currentTarget as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // 阻止事件冒泡到根目录
    setIsDragOver(false);
    
    const noteId = e.dataTransfer.getData('noteId');
    const draggedFolderId = e.dataTransfer.getData('folderId');
    
    if (noteId) {
      // 移动笔记到文件夹
      await moveNoteToFolder(noteId, folder.id);
      if (!folder.isExpanded) {
        await toggleFolderExpand(folder.id);
      }
    } else if (draggedFolderId && draggedFolderId !== folder.id && !isSubFolder(folder.id, draggedFolderId)) {
      // 移动文件夹到目标文件夹
      await moveFolder(draggedFolderId, folder.id);
      if (!folder.isExpanded) {
        await toggleFolderExpand(folder.id);
      }
    }
  };

  return (
    <div style={{ paddingLeft: depth * 2 }}>
      {/* Folder row */}
      <div
        data-folder-item="true"
        draggable
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setShowMenu(false); }}
        onDragStart={handleFolderDragStart}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all relative"
        style={{ 
          background: isDragOver ? 'rgba(124,90,240,0.2)' : hovered ? (darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)') : 'transparent',
          border: isDragOver ? '1px solid rgba(124,90,240,0.4)' : '1px solid transparent'
        }}
        onClick={async () => { if (!renaming) { await toggleFolderExpand(folder.id); setActiveFolder(folder.id); } }}
      >
        <span style={{ color: darkMode ? '#64748b' : '#94a3b8', flexShrink: 0 }}>
          {folder.isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span style={{ color: '#7c5af0', flexShrink: 0 }}>
          {folder.isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
        </span>

        {renaming ? (
          <input
            autoFocus
            value={renameName}
            onChange={e => setRenameName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
            onBlur={handleRename}
            onClick={e => e.stopPropagation()}
            className="flex-1 bg-transparent outline-none border-b border-violet-400"
            style={{ 
              fontSize: '0.8rem',
              color: darkMode ? '#e2e8f0' : '#1e293b'
            }}
          />
        ) : (
          <span className="flex-1 truncate" style={{ fontSize: '0.8rem', color: darkMode ? '#94a3b8' : '#475569', fontWeight: 500 }}>
            {folder.name}
          </span>
        )}

        <span style={{ fontSize: '0.7rem', color: darkMode ? '#64748b' : '#94a3b8' }}>
          {folderNotes.length > 0 && folderNotes.length}
        </span>

        {(hovered || showMenu) && !renaming && (
          <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
            <button
              onClick={async () => { setAddingNote(true); if (!folder.isExpanded) await toggleFolderExpand(folder.id); }}
              title="新建笔记"
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              className="p-0.5 rounded transition-colors"
              style={{
                color: darkMode ? '#64748b' : '#94a3b8',
                background: hovered ? (darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') : 'transparent',
              }}
            >
              <Plus size={11} />
            </button>
            <button
              onClick={() => setShowMenu(!showMenu)}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              className="p-0.5 rounded transition-colors"
              style={{
                color: darkMode ? '#64748b' : '#94a3b8',
                background: hovered ? (darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') : 'transparent',
              }}
            >
              <MoreHorizontal size={11} />
            </button>
          </div>
        )}

        {showMenu && (
          <div
            className="absolute right-0 top-8 z-50 rounded-lg overflow-hidden"
            style={{ 
              background: darkMode ? '#1a1e30' : '#D3C9E9', 
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, 
              boxShadow: darkMode ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.1)', 
              minWidth: 140
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => { setRenaming(true); setRenameName(folder.name); setShowMenu(false); }}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              className="w-full flex items-center gap-2 px-3 py-2 transition-colors"
              style={{ 
                fontSize: '0.8rem',
                color: darkMode ? '#e2e8f0' : '#1e293b',
                background: hovered ? (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : 'transparent'
              }}
            >
              <Edit2 size={12} /> 重命名
            </button>
            <button
              onClick={async () => { await createFolder('新建子文件夹', folder.id); setShowMenu(false); if (!folder.isExpanded) await toggleFolderExpand(folder.id); }}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              className="w-full flex items-center gap-2 px-3 py-2 transition-colors"
              style={{
                fontSize: '0.8rem',
                color: darkMode ? '#e2e8f0' : '#1e293b',
                background: hovered ? (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : 'transparent'
              }}
            >
              <FolderPlus size={12} /> 新建子文件夹
            </button>
            <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }} />
            <button
              onClick={() => {
                setActiveNoteId(null);
                setActiveFolder(folder.id);
                setShowMenu(false);
              }}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              className="w-full flex items-center gap-2 px-3 py-2 transition-colors"
              style={{
                fontSize: '0.8rem',
                color: '#7c5af0',
                background: hovered ? 'rgba(124,90,240,0.1)' : 'transparent'
              }}
            >
              <Sparkles size={12} /> 询问 AI
            </button>
            <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }} />
            <button
              onClick={async () => { await deleteFolder(folder.id); setShowMenu(false); }}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              className="w-full flex items-center gap-2 px-3 py-2 transition-colors"
              style={{ 
                fontSize: '0.8rem',
                color: '#ef4444',
                background: hovered ? 'rgba(239,68,68,0.1)' : 'transparent'
              }}
            >
              <Trash2 size={12} /> 删除文件夹
            </button>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {folder.isExpanded && (
        <div>
          {/* Sub-folders */}
          {subFolders.map(sf => (
            <FolderItemWrapper key={sf.id} folderId={sf.id} depth={depth + 1} darkMode={darkMode} />
          ))}

          {/* Notes */}
          {folderNotes.map(note => (
            <NoteItem
              key={note.id}
              note={note}
              isActive={activeNoteId === note.id}
              onClick={() => setActiveNote(note.id)}
              onDelete={async () => await deleteNote(note.id)}
              darkMode={darkMode}
            />
          ))}

          {/* Add note input */}
          {addingNote && (
            <div className="flex items-center gap-2 px-3 py-1.5 ml-2" onClick={e => e.stopPropagation()}>
              <FileText size={13} style={{ color: darkMode ? '#64748b' : '#94a3b8', flexShrink: 0 }} />
              <input
                autoFocus
                value={newNoteName}
                onChange={e => setNewNoteName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); if (e.key === 'Escape') { setAddingNote(false); setNewNoteName(''); } }}
                onBlur={() => { if (newNoteName.trim()) handleAddNote(); else { setAddingNote(false); setNewNoteName(''); } }}
                placeholder="笔记标题..."
                className="flex-1 bg-transparent outline-none border-b border-violet-500/50"
                style={{ 
                  fontSize: '0.8rem',
                  color: darkMode ? '#e2e8f0' : '#1e293b'
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FolderItemWrapper({ folderId, depth, darkMode }: { folderId: string; depth: number; darkMode: boolean }) {
  const { folders, notes } = useNoteStore();
  // 从 store 获取最新的 folder 对象，确保实时更新
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return null;
  return <FolderItem folder={folder} depth={depth} notes={notes} darkMode={darkMode} />;
}

interface SidebarProps {
  darkMode: boolean;
}

export function Sidebar({ darkMode }: SidebarProps) {
  const {
    folders, notes, createFolder, createNote, sidebarCollapsed, setSidebarCollapsed,
    activeNoteId, setActiveNote, deleteNote, moveNoteToFolder, moveFolder,
  } = useNoteStore();
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [hovered, setHovered] = useState(false);
  const [isRootDragOver, setIsRootDragOver] = useState(false);
  
  // 移动端左滑关闭
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - touchStartYRef.current;
    
    // 左滑关闭（水平滑动距离大于50，且水平滑动大于垂直滑动）
    if (deltaX < -50 && Math.abs(deltaX) > Math.abs(deltaY)) {
      setSidebarCollapsed(true);
    }
  };

  // 监听全局拖拽结束事件，重置根目录悬停状态
  useEffect(() => {
    const handleDragEnd = () => {
      setIsRootDragOver(false);
    };
    document.addEventListener('dragend', handleDragEnd);
    return () => document.removeEventListener('dragend', handleDragEnd);
  }, []);

  const rootFolders = folders.filter(f => f.parentId === null);
  const rootNotes = notes.filter(n => n.folderId === null);

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleRootDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    // 检查目标是否是文件夹（如果是，不要设置根目录拖拽状态）
    const target = e.target as HTMLElement;
    const isOverFolder = target.closest('[data-folder-item]') !== null;
    if (isOverFolder) {
      setIsRootDragOver(false);
    } else if (!isRootDragOver) {
      setIsRootDragOver(true);
    }
  };

  const handleRootDragLeave = (e: React.DragEvent) => {
    // 不在这里重置状态，让 dragend 来处理
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRootDragOver(false);
    
    const noteId = e.dataTransfer.getData('noteId');
    const folderId = e.dataTransfer.getData('folderId');
    
    if (noteId) {
      // 移动笔记到根目录（folderId设为null）
      await moveNoteToFolder(noteId, null);
    } else if (folderId) {
      // 移动文件夹到根目录（parentId设为null）
      await moveFolder(folderId, null);
    }
  };

  const handleAddFolder = () => {
    if (newFolderName.trim()) createFolder(newFolderName.trim());
    setAddingFolder(false);
    setNewFolderName('');
  };

  if (sidebarCollapsed) return null;

  return (
    <div
      className="h-full flex flex-col shrink-0 overflow-hidden rounded-2xl"
      style={{
        width: 240,
        background: darkMode ? '#0e1120' : '#D3C9E9',
        borderRight: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: darkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}
      >
        <span style={{ fontSize: '0.7rem', color: darkMode ? '#475569' : '#64748b', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          知识库
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAddingFolder(true)}
            title="新建文件夹"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="p-1 rounded transition-colors"
            style={{
              color: darkMode ? '#64748b' : '#94a3b8',
              background: hovered ? (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)') : 'transparent',
            }}
          >
            <FolderPlus size={13} />
          </button>
          <button
            onClick={() => createNote('新笔记', null)}
            title="新建笔记"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="p-1 rounded transition-colors"
            style={{
              color: darkMode ? '#64748b' : '#94a3b8',
              background: hovered ? (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)') : 'transparent',
            }}
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Folder tree */}
      <div 
        className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 custom-scrollbar"
        onDragOver={handleRootDragOver}
        onDragEnter={handleRootDragEnter}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
      >

        {/* New folder input */}
        {addingFolder && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ border: '1px solid rgba(124,90,240,0.3)', background: 'rgba(124,90,240,0.05)' }}>
            <Folder size={14} className="text-violet-400" />
            <input
              autoFocus
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddFolder(); if (e.key === 'Escape') { setAddingFolder(false); setNewFolderName(''); } }}
              onBlur={() => { if (newFolderName.trim()) handleAddFolder(); else { setAddingFolder(false); setNewFolderName(''); } }}
              placeholder="文件夹名称..."
              className="flex-1 bg-transparent outline-none"
              style={{ 
                fontSize: '0.8rem',
                color: darkMode ? '#e2e8f0' : '#1e293b'
              }}
            />
          </div>
        )}

        {/* Root folders */}
        {rootFolders.map(folder => (
          <FolderItemWrapper key={folder.id} folderId={folder.id} depth={0} darkMode={darkMode} />
        ))}

        {/* Root notes (no folder) */}
        {rootNotes.length > 0 && (
          <div>
            <div className="px-2 py-1" style={{ fontSize: '0.7rem', color: darkMode ? '#374151' : '#64748b', letterSpacing: '0.05em' }}>未归类</div>
            {rootNotes.map(note => (
              <NoteItem
                key={note.id}
                note={note}
                isActive={activeNoteId === note.id}
                onClick={() => setActiveNote(note.id)}
                onDelete={async () => await deleteNote(note.id)}
                darkMode={darkMode}
              />
            ))}
          </div>
        )}

        {rootFolders.length === 0 && rootNotes.length === 0 && !addingFolder && (
          <div className="text-center py-8 px-4">
            <div style={{ fontSize: '0.8rem', color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '0.5rem' }}>还没有笔记</div>
            <button
              onClick={() => setAddingFolder(true)}
              className="text-violet-500 hover:text-violet-400 transition-colors"
              style={{ fontSize: '0.75rem' }}
            >
              创建第一个文件夹
            </button>
          </div>
        )}
      </div>

      {/* Bottom stats */}
      <div
        className="px-4 py-3 flex items-center justify-between shrink-0"
        style={{ borderTop: darkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center gap-1">
          <Tag size={11} style={{ color: darkMode ? '#475569' : '#64748b' }} />
          <span style={{ fontSize: '0.7rem', color: darkMode ? '#475569' : '#64748b' }}>{notes.length} 篇笔记</span>
        </div>
        <span style={{ fontSize: '0.7rem', color: darkMode ? '#374151' : '#64748b' }}>{folders.length} 文件夹</span>
      </div>
    </div>
  );
}
