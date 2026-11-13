import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  History,
  X,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import changelogData from '../data/changelog.json';

export interface ChangelogEntry {
  id: string;
  date: string;
  time: string;
  type: 'event_added' | 'event_updated' | 'event_archived' | 'link_fixed' | 'deal_added' | 'price_drop' | 'system';
  title: string;
  detail: string;
  eventId?: string;
  gearId?: string;
}

export interface UpdateNewsItem {
  id: string;
  date: string;
  time: string;
  tag: string;
  tagStyle: string;
  title: string;
  description: string;
  targetId: string;
  targetLabel: string;
  eventId?: string;
  gearId?: string;
}

export const MAX_UPDATE_NEWS_COUNT = 10;

const TYPE_META: Record<ChangelogEntry['type'], { tag: string; style: string; targetId: string; label: string }> = {
  event_added: {
    tag: '新着大会',
    style: 'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/70 dark:text-teal-200',
    targetId: 'events-section',
    label: '大会を見る',
  },
  event_updated: {
    tag: '日程・更新',
    style: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/70 dark:text-sky-200',
    targetId: 'events-section',
    label: '最新一覧を見る',
  },
  event_archived: {
    tag: '開催終了整理',
    style: 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
    targetId: 'events-section',
    label: '開催予定を見る',
  },
  link_fixed: {
    tag: 'リンク修復',
    style: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200',
    targetId: 'events-section',
    label: '大会を確認',
  },
  deal_added: {
    tag: '新着特価ギア',
    style: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200',
    targetId: 'gears-catalog',
    label: 'ギアを見る',
  },
  price_drop: {
    tag: '値下げ速報',
    style: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200',
    targetId: 'gears-catalog',
    label: '値下げ品を見る',
  },
  system: {
    tag: 'システム更新',
    style: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/70 dark:text-indigo-200',
    targetId: 'events-section',
    label: '一覧を見る',
  },
};

export const UPDATE_NEWS_DATA: UpdateNewsItem[] = (changelogData as ChangelogEntry[]).map((c) => {
  const meta = TYPE_META[c.type] || TYPE_META.system;
  return {
    id: c.id,
    date: (c.date || '').replace(/-/g, '.'),
    time: c.time || '08:00',
    tag: meta.tag,
    tagStyle: meta.style,
    title: c.title,
    description: c.detail || '',
    targetId: meta.targetId,
    targetLabel: meta.label,
    eventId: c.eventId,
    gearId: c.gearId,
  };
});

interface UpdateTickerProps {
  onJumpToTarget?: (targetId: string) => void;
  onOpenEvent?: (eventId: string) => void;
}

export const UpdateTicker: React.FC<UpdateTickerProps> = ({ onJumpToTarget, onOpenEvent }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const items = useMemo(() => UPDATE_NEWS_DATA.slice(0, MAX_UPDATE_NEWS_COUNT), []);
  const allHistory = useMemo(() => UPDATE_NEWS_DATA.slice(0, 30), []);
  const currentItem = items[currentIndex];

  useEffect(() => {
    if (isPaused || items.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isPaused, items.length]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const handleItemClick = (item: UpdateNewsItem) => {
    if (item.eventId && onOpenEvent) {
      onOpenEvent(item.eventId);
      return;
    }
    if (onJumpToTarget) {
      onJumpToTarget(item.targetId);
    } else {
      const element = document.getElementById(item.targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  if (!currentItem) return null;

  return (
    <>
      <div
        className="w-full bg-slate-900/95 dark:bg-[#070b14]/95 border-b border-slate-800 text-xs text-slate-300 py-1 px-3 sm:px-4 backdrop-blur-xs select-none transition-colors"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-950/80 border border-teal-500/40 text-[11px] font-bold text-teal-300 shadow-xs">
              <Bell className="w-3 h-3 text-teal-400 shrink-0 animate-pulse" />
              <span>自動更新ログ</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              ({currentIndex + 1}/{items.length})
            </span>
          </div>

          <div
            className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer group hover:text-white transition-colors"
            onClick={() => handleItemClick(currentItem)}
          >
            <span className="text-[11px] font-mono text-slate-400 shrink-0 hidden md:inline">
              {currentItem.date}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${currentItem.tagStyle}`}>
              {currentItem.tag}
            </span>
            <p className="text-[11px] sm:text-xs font-medium truncate text-slate-200 group-hover:text-teal-300 transition-colors">
              {currentItem.title}
            </p>
            <span className="hidden lg:inline-flex items-center gap-0.5 text-[10px] text-teal-400 font-bold shrink-0 bg-teal-950/50 px-2 py-0.5 rounded border border-teal-800/60 hover:bg-teal-900 transition-colors">
              <span>{currentItem.targetLabel}</span>
              <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handlePrev}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="前のアップデート"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleNext}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="次のアップデート"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-1 px-1.5 py-0.5 ml-1 rounded bg-slate-800/80 hover:bg-slate-700 text-[10px] text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              title="過去のアップデート履歴をすべて見る"
            >
              <History className="w-3 h-3 text-slate-400" />
              <span className="hidden sm:inline">全履歴</span>
            </button>
          </div>
        </div>
      </div>

      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-white">自動更新ログ履歴（最新{allHistory.length}件）</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-800/60">
              {allHistory.map((news, idx) => (
                <div
                  key={news.id}
                  className={`pt-3 first:pt-0 group cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-colors ${
                    idx === currentIndex ? 'bg-teal-950/30 border border-teal-800/40' : ''
                  }`}
                  onClick={() => {
                    setShowHistoryModal(false);
                    handleItemClick(news);
                  }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400">
                        {news.date} {news.time}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${news.tagStyle}`}>
                        {news.tag}
                      </span>
                    </div>
                    <span className="text-[10px] text-teal-400 font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      <span>{news.targetLabel}</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-white mb-1 group-hover:text-teal-300 transition-colors">
                    {news.title}
                  </h4>
                  {news.description && (
                    <p className="text-[11px] text-slate-400 leading-relaxed">{news.description}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
              <span>※毎朝8時に大会情報・ギア特価を自動検証して記録しています</span>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
