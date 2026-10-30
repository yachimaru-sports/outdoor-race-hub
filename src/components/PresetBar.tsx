import React, { useState } from 'react';
import { Preset, FilterState } from '../types';
import { Bookmark, Plus, X, RotateCcw, Check } from 'lucide-react';

interface PresetBarProps {
  presets: Preset[];
  activePresetId: string | null;
  onSelectPreset: (preset: Preset) => void;
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
  onResetFilters: () => void;
  currentFilters: FilterState;
}

export const PresetBar: React.FC<PresetBarProps> = ({
  presets,
  activePresetId,
  onSelectPreset,
  onSavePreset,
  onDeletePreset,
  onResetFilters,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    onSavePreset(newPresetName.trim());
    setNewPresetName('');
    setIsAdding(false);
  };

  return (
    <div className="bg-white/90 dark:bg-slate-900/80 border-b border-slate-300 dark:border-slate-800 py-3 transition-colors backdrop-blur-xs">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          {/* 左側：プリセットタグ一覧 */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 py-0.5">
            <span className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200 shrink-0 pr-1">
              <Bookmark className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <span>ワンクリック検索:</span>
            </span>

            {presets.map((preset) => {
              const isActive = activePresetId === preset.id;
              return (
                <div
                  key={preset.id}
                  className={`group inline-flex items-center rounded-full text-xs sm:text-[13px] font-bold transition-all shrink-0 border ${
                    isActive
                      ? 'bg-slate-900 dark:bg-teal-700 text-white border-slate-900 dark:border-teal-700 shadow-sm font-extrabold'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-teal-600 dark:hover:border-slate-500 shadow-2xs hover:bg-slate-50'
                  }`}
                >
                  <button
                    onClick={() => onSelectPreset(preset)}
                    className="px-3.5 py-1.5 flex items-center gap-1.5 focus:outline-none cursor-pointer"
                  >
                    <span>{preset.name}</span>
                  </button>
                  {/* 削除ボタン（デフォルト以外） */}
                  {!preset.isDefault && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePreset(preset.id);
                      }}
                      className={`pr-2.5 pl-1 py-1.5 focus:outline-none transition-colors cursor-pointer ${
                        isActive
                          ? 'text-slate-300 hover:text-rose-300'
                          : 'text-slate-500 hover:text-rose-600'
                      }`}
                      title="このプリセットを削除"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* 右側：プリセット追加＆リセットボタン */}
          <div className="flex items-center gap-2 shrink-0">
            {isAdding ? (
              <form onSubmit={handleAddSubmit} className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="プリセット名..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  autoFocus
                  className="bg-white dark:bg-slate-800 border-2 border-teal-600 rounded-full px-3.5 py-1 text-xs sm:text-sm text-slate-950 dark:text-white placeholder-slate-500 focus:outline-none w-36 sm:w-44 shadow-2xs font-bold"
                />
                <button
                  type="submit"
                  className="p-1.5 rounded-full bg-teal-700 hover:bg-teal-800 text-white text-xs transition-colors shadow-2xs cursor-pointer"
                  title="保存"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs transition-colors cursor-pointer"
                  title="キャンセル"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs sm:text-[13px] font-bold transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                <span>条件を保存</span>
              </button>
            )}

            <button
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs sm:text-[13px] font-bold transition-colors cursor-pointer"
              title="条件をクリア"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">リセット</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
