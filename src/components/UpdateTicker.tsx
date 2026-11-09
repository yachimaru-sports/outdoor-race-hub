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
    id: 'update-wake-alps-20261109',
    date: '2026.11.09',
    time: '19:15',
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
    time: '19:10',
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
    time: '19:05',
    tag: '新着サイクル',
    tagStyle: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/70 dark:text-sky-200',
    title: '第5回 グランフォンド熊野 2027（三重・世界遺産山岳 120km）公式登録！',
    description:
      '熊野古道世界遺産の山海絶景を駆け抜ける獲得標高2,300m超の過酷ロングライド大会を登録。スポエンCYCLE実通検証済み。',
    targetId: 'events-section',
    targetLabel: '熊野ライドを見る',
  },
  {
    id: 'update-gears-page-20261106',
    date: '2026.11.06',
    time: '13:45',
    tag: '新機能・専用ページ',
    tagStyle: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200',
    title: 'おすすめ商品・必須装備品専用カタログページをOPEN！＆全大会リンク点検完了',
    description:
      'トレイル・サイクル・アドベンチャー・ウルトラ別の装備品28選を比較できる専用ページを開設。全大会のリンク死活監視も完了しました。',
    targetId: 'gears-catalog',
    targetLabel: '専用カタログを見る',
  },
  {
    id: 'update-shimanto-ar-20261101',
    date: '2026.11.01',
    time: '20:50',
    tag: '新着アドベンチャー',
    tagStyle: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200',
    title: '四万十清流アドベンチャーレース 2026（高知・四万十川 42km）公式登録！',
    description:
      '日本最後の清流・四万十川を舞台にしたパックラフト＆MTB＆トレッキング＆ナビゲーションレースの詳細スペック・直通リンクを登録しました。',
    targetId: 'events-section',
    targetLabel: '四万十ARを見る',
  },
  {
    id: 'update-yamanami-kaido-20261101',
    date: '2026.11.01',
    time: '20:45',
    tag: '新着サイクル',
    tagStyle: 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950/70 dark:text-cyan-200',
    title: 'やまなみ街道チャレンジライド 2027（尾道〜松江 縦断140km）公式登録！',
    description:
      '瀬戸内・尾道から山陰・松江まで中国山地を一気に駆け抜ける大人気縦断ロングライドイベントを収録しました。',
    targetId: 'events-section',
    targetLabel: 'やまなみ街道を見る',
  },
  {
    id: 'update-osj-shinshiro-20261101',
    date: '2026.11.01',
    time: '20:40',
    tag: '新着トレラン',
    tagStyle: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200',
    title: 'OSJ新城トレイル 32K / ダブル64K 2027（愛知県民の森）公式登録！',
    description:
      '屈指の岩稜と激坂で知られるOSJシリーズ開幕戦、32kmおよび過酷なダブル64kmレースの詳細情報を掲載しました。',
    targetId: 'events-section',
    targetLabel: '新城トレイルを見る',
  },
  {
    id: 'update-inachiku-longride-20261101',
    date: '2026.11.01',
    time: '20:35',
    tag: '新着サイクル',
    tagStyle: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/70 dark:text-blue-200',
    title: '因幡街道・千種川ロングライド in 佐用 2026（兵庫・岡山 92km）公式登録！',
    description:
      '宿場町情緒と清流千種川の自然美を駆け抜ける晩秋の92kmサイクリング大会を追加しました。',
    targetId: 'events-section',
    targetLabel: '千種川ライドを見る',
  },
  {
    id: 'update-taiki-seaside-20261101',
    date: '2026.11.01',
    time: '20:30',
    tag: '新着トレラン',
    tagStyle: 'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/70 dark:text-teal-200',
    title: '大紀町シーサイドトレイル 2027（三重・熊野灘 23km/14km）公式登録！',
    description:
      '熊野灘のオーシャンビューとテクニカルな海岸シングルトラックが魅力の早春大会を追加しました。',
    targetId: 'events-section',
    targetLabel: '大紀町トレイルを見る',
  },
  {
    id: 'update-mariko-alps-20261101',
    date: '2026.11.01',
    time: '20:25',
    tag: '新着トレラン',
    tagStyle: 'bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950/70 dark:text-violet-200',
    title: '丸子アルプストレイルラン 2027（静岡・宿場町 22km）公式登録！',
    description:
      '東海道の歴史ある宿場町・丸子宿から稜線の絶景パノラマを走る22kmレースを新規収録しました。',
    targetId: 'events-section',
    targetLabel: '丸子アルプスを見る',
  },
  {
    id: 'update-hiroshima-wangan-trail-20261031',
    date: '2026.10.31',
    time: '22:05',
    tag: '公式大会追加',
    tagStyle: 'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/70 dark:text-teal-200',
    title: '「広島湾岸TRAILRUN / Hiroshima Ultra-Trail by UTMB®」最新情報を完全登録！',
    description:
      '広島デルタと瀬戸内海を巡る「広島湾岸トレイル」100K/50K/25K公式大会の詳細スペック・必携装備・直通エントリーリンクを完全網羅しました。',
    targetId: 'events-section',
    targetLabel: '広島湾岸トレイルを見る',
  },
  {
    id: 'update-entry-links-20261031',
    date: '2026.10.31',
    time: '10:30',
    tag: 'リンク直通化',
    tagStyle: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200',
    title: '全大会の申込直通URL＆公式情報源を全面刷新！',
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
    title: '大会必携装備リスト ＆ 必携品直通検索機能を新設！',
    description:
      '大会名横の「必携○点」ボタンから、公式必携品リスト（チェック機能付き）と必携ギア検索を即座に利用できます。',
    targetId: 'events-section',
    targetLabel: '必携品機能へジャンプ',
  },
  {
    id: 'update-events-expand-20261031',
    date: '2026.10.31',
    time: '10:05',
    tag: 'データ拡充',
    tagStyle: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/70 dark:text-purple-200',
    title: '全国のアドベンチャー/ロゲ/100マイル＆中四国サイクルなど全157大会へ拡大！',
    description:
      'ニセコAR・屋久島AR・彩の国100mileや、しまなみ・とびしま・石鎚山など注目大会を追加収録しました。',
    targetId: 'events-section',
    targetLabel: '大会一覧へジャンプ',
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
