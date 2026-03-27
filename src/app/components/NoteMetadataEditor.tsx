import React from 'react';
import { Clock, Target, Zap } from 'lucide-react';

interface NoteMetadataEditorProps {
  metadata: {
    difficulty?: 1 | 2 | 3 | 4 | 5;
    learningStatus?: 'new' | 'learning' | 'mastered';
  };
  onChange: (metadata: any) => void;
  darkMode: boolean;
}

const STATUS_OPTIONS = [
  { value: 'new', label: '🆕 新学', color: '#64748b' },
  { value: 'learning', label: '📖 进行中', color: '#f59e0b' },
  { value: 'mastered', label: '✅ 已掌握', color: '#10b981' },
];

const DIFFICULTY_COLORS = ['#10b981', '#84cc16', '#eab308', '#f97316', '#ef4444'];

export function NoteMetadataEditor({ metadata, onChange, darkMode }: NoteMetadataEditorProps) {
  const handleDifficultyChange = (difficulty: 1 | 2 | 3 | 4 | 5) => {
    onChange({ ...metadata, difficulty });
  };

  const handleStatusChange = (learningStatus: 'new' | 'learning' | 'mastered') => {
    onChange({ ...metadata, learningStatus });
  };

  return (
    <div
      className="rounded-xl p-4 space-y-4"
      style={{
        backgroundColor: darkMode ? 'rgba(124, 90, 240, 0.1)' : 'rgba(124, 90, 240, 0.05)',
        border: `1px solid ${darkMode ? 'rgba(124, 90, 240, 0.2)' : 'rgba(124, 90, 240, 0.15)'}`
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-medium" style={{ color: darkMode ? '#e2e8f0' : '#1e293b' }}>
          学习属性
        </span>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs" style={{ color: darkMode ? '#94a3b8' : '#64748b' }}>
          <Clock className="w-3.5 h-3.5" />
          学习状态
        </label>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => handleStatusChange(option.value as 'new' | 'learning' | 'mastered')}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: metadata.learningStatus === option.value
                  ? option.color
                  : darkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                color: metadata.learningStatus === option.value
                  ? '#ffffff'
                  : (darkMode ? '#94a3b8' : '#64748b'),
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs" style={{ color: darkMode ? '#94a3b8' : '#64748b' }}>
          <Zap className="w-3.5 h-3.5" />
          难度等级
        </label>
        <div className="flex gap-2">
          {([1, 2, 3, 4, 5] as const).map(level => (
            <button
              key={level}
              onClick={() => handleDifficultyChange(level)}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: metadata.difficulty === level
                  ? DIFFICULTY_COLORS[level - 1]
                  : darkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                color: metadata.difficulty === level
                  ? '#ffffff'
                  : (darkMode ? '#94a3b8' : '#64748b'),
              }}
            >
              {level}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs px-0.5" style={{ color: darkMode ? '#64748b' : '#94a3b8' }}>
          <span>入门</span>
          <span>进阶</span>
          <span>专家</span>
        </div>
      </div>
    </div>
  );
}