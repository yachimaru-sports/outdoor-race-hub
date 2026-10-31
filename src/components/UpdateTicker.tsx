import React, { useState, useEffect } from 'react';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  History,
  X,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

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
}

export const UPDATE_NEWS_DATA: UpdateNewsItem[] = [
  {
    id: 'update-entry-links-20261031',
    date: '2026.10.31',
    time: '10:30',
    tag: 'リンク直通化',
    tagStyle: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200',
    title: '全158大会の申込直通URL＆公式情報源を全面刷新！',
    description:
      'ポータルトップではなく、該当大会の申込・検索画面へワンクリックで直行できるよう全リンクを精査・直通化しました。',
    targetId: 'events-section',
    targetLabel: '大会一覧へジャンプ',
  },
  {
    id: 'update-mandatory-gear-20261031',
    date: '2026.10.31',
    time: '10:25',
    tag: '新機能',
    tagStyle: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200',
    title: '大会必携装備リスト ＆ 楽天市場アフィリエイト購入直通機能を新設！',
    description:
      '大会名横の「必携○点」ボタンから、公式必携品リスト（チェック機能付き）と楽天市場の最安・特価検索を即座に利用できます。',
    targetId: 'events-section',
    targetLabel: '必携品機能へジャンプ',
  },
  {
    id: 'update-distance-filter-20261031',
    date: '2026.10.31',
    time: '10:15',
    tag: 'UI改善',
    tagStyle: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/70 dark:text-sky-200',
    title: '距離フィルターを5段階クイック指定（全距離・0-30・30-70・70-100・100以上）に統一！',
    description:
      'レイアウトを2行に固定し、距離と累積標高の文字サイズを大型化して視認性を高めました。',
    targetId: 'filter-section',
    targetLabel: '検索フィルターへジャンプ',
  },
  {
    id: 'update-events-expand-20261031',
    date: '2026.10.31',
    time: '10:05',
    tag: 'データ拡充',
    tagStyle: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/70 dark:text-purple-200',
    title: '全国のアドベンチャー/ロゲ/100マイル＆中四国サイクルなど全158大会へ拡大！',
    description:
      'ニセコAR・屋久島AR・彩の国100mileや、しまなみ・とびしま・石鎚山など注目大会を追加収録しました。',
    targetId: 'events-section',
    targetLabel: '大会一覧へジャンプ',
  },
  {
    id: 'update-deals-sync-20261031',
    date: '2026.10.31',
    time: '09:50',
    tag: '自動更新',
    tagStyle: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200',
    title: '楽天市場のアウトドア特価ギア（15%〜53%OFF厳選）自動更新稼働中！',
    description:
      'ペツル スイフトRLやネイサン、ブラックダイヤモンドなど大会必携ギアの実在セール情報を1日3回自動更新しています。',
    targetId: 'deals-carousel',
    targetLabel: '特価カルーセルへジャンプ',
  },
];

interface UpdateTickerProps {
  onJumpToTarget?: (targetId: string) => void;
}

export const UpdateTicker: React.FC<UpdateTickerProps> = ({ onJumpToTarget }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const items = UPDATE_NEWS_DATA;
  const currentItem = items[currentIndex];

  // 自動スライド（5秒間隔、マウスホバーで停止）
  useEffect(() => {
    if (isPaused) return;
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

  const handleItemClick = (targetId: string) => {
    if (onJumpToTarget) {
      onJumpToTarget(targetId);
    } else {
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        element.classList.add('ring-4', 'ring-teal-500', 'transition-all');
        setTimeout(() => {
          element.classList.remove('ring-4', 'ring-teal-500');
        }, 2200);
      }
    }
  };

  return (
    <div
      className="bg-slate-900 text-slate-100 border-b border-slate-800 transition-colors"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="max-w-7xl mx-auto px-4 py-2 sm:py-2.5 flex items-center justify-between gap-3">
        {/* 左端バッジ */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/40 text-xs font-black tracking-wide">
            <Bell className="w-3.5 h-3.5 text-teal-400 animate-bounce" />
            <span className="hidden sm:inline">アップデート情報</span>
            <span className="sm:hidden">UPDATE</span>
          </span>
          <span className="text-[11px] font-mono text-slate-400 hidden md:inline">
            ({currentIndex + 1}/{items.length})
          </span>
        </div>

        {/* 中央スライド可能ウィンドウ（クリックで該当箇所へスクロール） */}
        <div
          onClick={() => handleItemClick(currentItem.targetId)}
          className="flex-1 min-w-0 flex items-center gap-2.5 cursor-pointer group py-0.5 select-none"
          title={`クリックすると「${currentItem.targetLabel}」`}
        >
          {/* 日時バッジ */}
          <span className="font-mono text-xs font-bold text-slate-400 shrink-0">
            {currentItem.date}
          </span>

          {/* タグ */}
          <span
            className={`text-[11px] font-black px-2 py-0.5 rounded border shrink-0 ${currentItem.tagStyle}`}
          >
            {currentItem.tag}
          </span>

          {/* タイトル（ホバーで強調） */}
          <p className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-teal-300 transition-colors truncate">
            {currentItem.title}
          </p>

          {/* 誘導矢印ピル */}
          <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-extrabold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-800/80 group-hover:bg-teal-900 transition-colors shrink-0">
            <span>{currentItem.targetLabel}</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>

        {/* 右端コントローラー（前へ・次へ・全履歴ボタン） */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handlePrev}
            className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="前のアップデート"
            title="前のアップデート"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="次のアップデート"
            title="次のアップデート"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-teal-300 text-xs font-bold transition-colors cursor-pointer border border-slate-700"
            title="全アップデート履歴一覧を見る"
          >
            <History className="w-3 h-3" />
            <span className="hidden sm:inline">全履歴</span>
          </button>
        </div>
      </div>

      {/* 全アップデート履歴モーダル */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
          <div
            className="relative bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* モーダルヘッダー */}
            <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-700 text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-950 dark:text-white text-base">
                    OUTDOOR RACE HUB アップデート履歴
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    最新のシステム改善・機能追加・大会データ更新一覧
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 履歴リスト */}
            <div className="p-6 space-y-4">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setShowHistoryModal(false);
                    handleItemClick(item.targetId);
                  }}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-400 bg-slate-50/60 dark:bg-slate-850/60 hover:bg-teal-50/40 dark:hover:bg-slate-800 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-slate-500 dark:text-slate-400">
                        {item.date} {item.time}
                      </span>
                      <span className={`text-[11px] font-black px-2 py-0.5 rounded border ${item.tagStyle}`}>
                        {item.tag}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-teal-700 dark:text-teal-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      <span>{item.targetLabel}</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>

                  <h4 className="font-black text-sm text-slate-950 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
