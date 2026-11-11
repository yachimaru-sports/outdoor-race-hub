import React, { useState, useEffect, useMemo } from 'react';
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

/**
 * アップデート情報最大保持件数（最新10件を維持し、古い情報は順次自動押し出し）
 */
export const MAX_UPDATE_NEWS_COUNT = 10;

/**
 * 大会更新情報マスター（新着大会の追加情報を中心に最新10件を常時表示）
 */
export const UPDATE_NEWS_DATA: UpdateNewsItem[] = [
  {
    id: 'update-system-autosync-fix-20261111',
    date: '2026.11.11',
    time: '18:40',
    tag: 'システム最適化',
    tagStyle: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/70 dark:text-indigo-200',
    title: '毎朝8時自動更新のCI耐性強化＆最新更新日時のリアルタイム表示同期を完了！',
    description:
      'GitHub Actions環境での楽天市場WAF遮断による更新失敗を解消し、実測定価・割引率の厳格検証と毎朝8時前後の確実な自動更新・日時表示同期を実現しました。',
    targetId: 'events-section',
    targetLabel: '最新一覧を見る',
  },
  {
    id: 'update-nobeyama-fuji5-2027-20261111',
    date: '2026.11.11',
    time: '18:38',
    tag: '新着ウルトラ',
    tagStyle: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200',
    title: '八ヶ岳野辺山100km・茨城100K・チャレンジ富士五湖（二次）2027 受付最新情報反映！',
    description:
      '第33回 星の郷八ヶ岳野辺山高原100km、第9回 茨城100Kを新規登録し、本日RUNNET二次受付開始のチャレンジ富士五湖ウルトラマラソン2027を最新化しました。',
    targetId: 'events-section',
    targetLabel: 'ウルトラ大会を見る',
  },
  {
    id: 'update-cycle-chase-peaks-20261111',
    date: '2026.11.11',
    time: '18:35',
    tag: '新着サイクル',
    tagStyle: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/70 dark:text-sky-200',
    title: 'CHASE THE SUN JAPAN 2027・The PEAKS 妙高2・伊勢鳥羽志摩チャリフェス登録！',
    description:
      '日本初上陸250kmライド CHASE THE SUN JAPAN、獲得標高5,200m超 The PEAKS 妙高2、伊勢鳥羽志摩リアス式チャリフェス2027を公式検証済み登録しました。',
    targetId: 'events-section',
    targetLabel: 'サイクル大会を見る',
  },
  {
    id: 'update-trail-kakamigahara-taiki-20261111',
    date: '2026.11.11',
    time: '18:32',
    tag: '新着トレラン',
    tagStyle: 'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/70 dark:text-teal-200',
    title: '各務原アルプス・まつさか香肌峡・大紀町シーサイド・OSJ新城2027 公式最新化！',
    description:
      '本日エントリー開始の各務原アルプスパノラマ、まつさか香肌峡を新規登録し、大紀町シーサイド(2/20)・OSJ新城(3/27-28)・笠戸島(2/7重複統合)を最新化しました。',
    targetId: 'events-section',
    targetLabel: 'トレラン大会を見る',
  },
  {
    id: 'update-wake-alps-20261109',
    date: '2026.11.09',
    time: '19:40',
    tag: '新着トレラン',
    tagStyle: 'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/70 dark:text-teal-200',
    title: 'WAKE ALPS TRAIL 2027（岡山・和気町一周 50km・鏑木毅監修）公式登録！',
    description:
      '和気アルプスを舞台にした中四国の本格50km山岳レース（ITRA 3pt認定）を公式登録。モシコム・公式サイトへの直通リンクを実通検証済みです。',
    targetId: 'events-section',
    targetLabel: '和気アルプスを見る',
  },
  {
    id: 'update-kasadojima-20261109',
    date: '2026.11.09',
    time: '19:35',
    tag: '新着トレラン',
    tagStyle: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200',
    title: '第12回 くだまつ笠戸島アイランドトレイル 2027（山口・30km）公式登録！',
    description:
      '瀬戸内海の多島美を望む奥宮俊祐プロデュースの絶景アイランドトレイルを新規登録。RUNNETエントリー情報を検証完了しました。',
    targetId: 'events-section',
    targetLabel: '笠戸島トレイルを見る',
  },
  {
    id: 'update-granfondo-kumano-20261109',
    date: '2026.11.09',
    time: '19:30',
    tag: '新着サイクル',
    tagStyle: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/70 dark:text-sky-200',
    title: '第5回 グランフォンド熊野 2027（三重・世界遺産山岳 120km）公式登録！',
    description:
      '熊野古道世界遺産の山海絶景を駆け抜ける獲得標高2,300m超の過酷ロングライド大会を登録。スポエンCYCLE実通検証済み。',
    targetId: 'events-section',
    targetLabel: '熊野ライドを見る',
  },
  {
    id: 'update-totomichi-20261109',
    date: '2026.11.09',
    time: '19:25',
    tag: '新着トレラン',
    tagStyle: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200',
    title: '第1回 備中とと道トレイルラン 2027（岡山・笠岡〜吹屋 57km）登録統合！',
    description:
      '歴史古道「とと道」を駆け抜けるロングトレイル57kmレースを公式スペック・重複ゼロ統合で最新登録完了しました。',
    targetId: 'events-section',
    targetLabel: '備中とと道を見る',
  },
  {
    id: 'update-system-preflight-20261109',
    date: '2026.11.09',
    time: '19:20',
    tag: 'システム更新',
    tagStyle: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/70 dark:text-indigo-200',
    title: '全大会リンク実通検査 ＆ 更新前事前監査エンジン（防壁ゲート）を導入！',
    description:
      'リンク切れやデータ不整合を100%防止するため、公開前に全大会・全装備のHTTP疎通と重複を自動検証する事前監査エンジンを導入しました。',
    targetId: 'events-section',
    targetLabel: '大会一覧を見る',
  },
  {
    id: 'update-gears-page-20261109',
    date: '2026.11.09',
    time: '19:15',
    tag: 'おすすめギア',
    tagStyle: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200',
    title: 'おすすめ装備カタログ刷新＆INNER FACT・RUNPLUSミニバナー設置！',
    description:
      '全レース必携品カタログの画面レイアウトを左右2カラムに刷新し、提携公式ショップのミニバナーを設置しました。',
    targetId: 'gears-catalog',
    targetLabel: '専用カタログを見る',
  },
];

interface UpdateTickerProps {
  onJumpToTarget?: (targetId: string) => void;
}

export const UpdateTicker: React.FC<UpdateTickerProps> = ({ onJumpToTarget }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // 常に最新10件のみを保証（古い情報は順次自動押し出し）
  const items = useMemo(() => UPDATE_NEWS_DATA.slice(0, MAX_UPDATE_NEWS_COUNT), []);
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
        }, 2000);
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
          {/* 左側：ベルアイコン ＆ 「アップデート情報」バッジ ＆ 件数インジケーター */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-950/80 border border-teal-500/40 text-[11px] font-bold text-teal-300 shadow-xs">
              <Bell className="w-3 h-3 text-teal-400 shrink-0 animate-pulse" />
              <span>アップデート情報</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              ({currentIndex + 1}/{items.length})
            </span>
          </div>

          {/* 中央：最新更新ニュース内容（スライド表示） */}
          <div
            className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer group hover:text-white transition-colors"
            onClick={() => handleItemClick(currentItem.targetId)}
          >
            <span className="text-[11px] font-mono text-slate-400 shrink-0 hidden md:inline">
              {currentItem.date}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${currentItem.tagStyle}`}
            >
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

          {/* 右側：前へ・次へコントロール ＆ 全履歴モーダル呼び出しボタン */}
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

      {/* 全履歴閲覧モーダル（最大最新10件のアーカイブを一覧表示） */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-white">大会アップデート履歴（最新10件）</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* モーダル一覧リスト */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-800/60">
              {items.map((news, idx) => (
                <div
                  key={news.id}
                  className={`pt-3 first:pt-0 group cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-colors ${
                    idx === currentIndex ? 'bg-teal-950/30 border border-teal-800/40' : ''
                  }`}
                  onClick={() => {
                    setShowHistoryModal(false);
                    handleItemClick(news.targetId);
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
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {news.description}
                  </p>
                </div>
              ))}
            </div>

            {/* モーダルフッター */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
              <span>※最新の大会追加情報を常時最新10件まで保持しています</span>
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
