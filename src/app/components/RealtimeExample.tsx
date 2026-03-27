import React, { useState, useEffect } from 'react';
import { useRealtimeNotes, useRealtimeFolders, useRealtimeConnections } from '../../hooks/useRealtime';
import { useNotes, useFolders, useConnections } from '../../hooks/useSupabase';

interface RealtimeExampleProps {
  darkMode: boolean;
}

export function RealtimeExample({ darkMode }: RealtimeExampleProps) {
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [updateType, setUpdateType] = useState<string>('');
  const [updateTable, setUpdateTable] = useState<string>('');
  
  const { notes, fetchNotes } = useNotes();
  const { folders, fetchFolders } = useFolders();
  const { connections, fetchConnections } = useConnections();

  // 初始化数据
  useEffect(() => {
    fetchNotes();
    fetchFolders();
    fetchConnections();
  }, [fetchNotes, fetchFolders, fetchConnections]);

  // 订阅笔记实时更新
  useRealtimeNotes((payload) => {
    setLastUpdate(new Date().toLocaleTimeString());
    setUpdateType(payload.eventType);
    setUpdateTable('notes');
    fetchNotes();
  });

  // 订阅文件夹实时更新
  useRealtimeFolders((payload) => {
    setLastUpdate(new Date().toLocaleTimeString());
    setUpdateType(payload.eventType);
    setUpdateTable('folders');
    fetchFolders();
  });

  // 订阅连接实时更新
  useRealtimeConnections((payload) => {
    setLastUpdate(new Date().toLocaleTimeString());
    setUpdateType(payload.eventType);
    setUpdateTable('connections');
    fetchConnections();
  });

  return (
    <div 
      className="p-4 rounded-xl" 
      style={{
        background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
      }}
    >
      <h3 style={{ color: darkMode ? '#e2e8f0' : '#1e293b', marginBottom: '16px' }}>
        实时数据同步示例
      </h3>
      
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '8px' }}>
          最近更新
        </h4>
        <div 
          className="p-3 rounded-lg" 
          style={{
            background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
          }}
        >
          <p style={{ color: darkMode ? '#e2e8f0' : '#1e293b', margin: 0 }}>
            {lastUpdate ? (
              `时间: ${lastUpdate} | 类型: ${updateType} | 表: ${updateTable}`
            ) : (
              '暂无更新'
            )}
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '8px' }}>
          数据统计
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <div 
            className="p-3 rounded-lg text-center" 
            style={{
              background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
            }}
          >
            <p style={{ color: darkMode ? '#94a3b8' : '#64748b', margin: 0, fontSize: '14px' }}>
              笔记
            </p>
            <p style={{ color: darkMode ? '#e2e8f0' : '#1e293b', margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold' }}>
              {notes.length}
            </p>
          </div>
          <div 
            className="p-3 rounded-lg text-center" 
            style={{
              background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
            }}
          >
            <p style={{ color: darkMode ? '#94a3b8' : '#64748b', margin: 0, fontSize: '14px' }}>
              文件夹
            </p>
            <p style={{ color: darkMode ? '#e2e8f0' : '#1e293b', margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold' }}>
              {folders.length}
            </p>
          </div>
          <div 
            className="p-3 rounded-lg text-center" 
            style={{
              background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
            }}
          >
            <p style={{ color: darkMode ? '#94a3b8' : '#64748b', margin: 0, fontSize: '14px' }}>
              连接
            </p>
            <p style={{ color: darkMode ? '#e2e8f0' : '#1e293b', margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold' }}>
              {connections.length}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h4 style={{ color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '8px' }}>
          说明
        </h4>
        <ul style={{ color: darkMode ? '#e2e8f0' : '#1e293b', margin: 0, paddingLeft: '20px' }}>
          <li style={{ marginBottom: '4px' }}>此组件展示了实时数据同步功能</li>
          <li style={{ marginBottom: '4px' }}>当数据发生变化时，会自动更新显示</li>
          <li style={{ marginBottom: '4px' }}>支持笔记、文件夹和连接的实时更新</li>
          <li>更新类型包括：INSERT、UPDATE、DELETE</li>
        </ul>
      </div>
    </div>
  );
}
