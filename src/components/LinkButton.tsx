import React from 'react';
import { Globe, FileEdit, ExternalLink, AlertTriangle } from 'lucide-react';
import { trackEvent } from '../utils/analytics';

interface LinkButtonProps {
  type: 'entry' | 'official';
  url?: string | null;
  isBroken?: boolean;
  canEntry?: boolean;
  eventTitle?: string;
}

export const LinkButton: React.FC<LinkButtonProps> = ({
  type,
  url,
  isBroken = false,
  canEntry = true,
  eventTitle = '',
}) => {
  // 申込ボタンでそもそも受付不可の場合
  if (type === 'entry' && !canEntry) {
    return (
      <div
        className="w-[68px] py-1 rounded-lg bg-slate-150 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 text-xs font-bold text-center border border-slate-250 dark:border-slate-800 select-none cursor-not-allowed"
        title="現在エントリーは受け付けていません"
      >
        受付無
      </div>
    );
  }

  // URLが存在しない場合
  if (!url || url === '#' || url.trim() === '') {
    return (
      <div className="relative group/link inline-block">
        <button
          disabled
          className="w-[58px] py-1 rounded-lg bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-600 text-xs font-bold text-center border border-slate-200 dark:border-slate-800 select-none line-through cursor-not-allowed flex items-center justify-center gap-1"
          title="URL未設定（準備中）"
        >
          {type === 'entry' ? (
            <>
              <FileEdit className="w-3 h-3 opacity-40 shrink-0" />
              <span>申込</span>
            </>
          ) : (
            <>
              <Globe className="w-3 h-3 opacity-40 shrink-0" />
              <span>公式</span>
            </>
          )}
        </button>
        {/* ホバーポップアップ */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/link:flex flex-col items-center z-50 pointer-events-none w-max max-w-xs">
          <div className="bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg shadow-xl border border-rose-500/60 leading-tight text-center">
            <span className="text-rose-400 flex items-center justify-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              URL未登録（準備中）
            </span>
          </div>
          <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-rose-500/60" />
        </div>
      </div>
    );
  }

  // リンク先の種類を判定
  let providerLabel = '公式サイト直通';
  if (url.includes('moshicom.com')) {
    providerLabel = 'モシコム（公式検索）';
  } else if (url.includes('runnet.jp')) {
    providerLabel = 'RUNNET（直通）';
  } else if (url.includes('sportsentry.ne.jp')) {
    providerLabel = 'スポーツエントリー';
  } else if (url.includes('google.com')) {
    providerLabel = 'Google検索（大会情報）';
  }

  // リンク切れ判定時のスタイル
  if (isBroken) {
    return (
      <div className="relative group/link inline-block">
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(eventTitle + ' 大会 申込')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-[62px] py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 text-xs font-bold flex items-center justify-center gap-1 line-through hover:opacity-90 shadow-2xs cursor-pointer select-none"
          title="リンク切れ（クリックでGoogle検索で探す）"
        >
          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
          <span>{type === 'entry' ? '申込' : '公式'}</span>
        </a>

        {/* ホバー時の直リンクURLポップアップ（右端見切れ防止） */}
        <div className="absolute bottom-full right-0 mb-2 hidden group-hover/link:flex flex-col items-end z-50 pointer-events-none w-72 sm:w-80">
          <div className="w-full bg-slate-900 text-white text-[11px] font-mono px-3 py-2 rounded-lg shadow-2xl border border-rose-500 leading-tight text-left">
            <div className="flex items-center gap-1 text-rose-400 font-extrabold mb-1 font-sans">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>リンク先アクセス不可（取り消し線）</span>
            </div>
            <div className="text-slate-300 break-all text-[10px] bg-slate-950 p-1 rounded border border-slate-800">
              {url}
            </div>
            <div className="text-amber-300 text-[10px] mt-1 font-sans font-bold">
              ※クリックでGoogle検索へ代替誘導します
            </div>
          </div>
          <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 mr-5 border-r border-b border-rose-500" />
        </div>
      </div>
    );
  }

  // 正常稼働リンク
  return (
    <div className="relative group/link inline-block">
      {type === 'entry' ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent('entry_click', { event_title: eventTitle, target_url: url })}
          className="w-[68px] py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-extrabold flex items-center justify-center gap-1 transition-all shadow-2xs hover:shadow-xs hover:scale-105 cursor-pointer select-none"
        >
          <FileEdit className="w-3 h-3 shrink-0" />
          <span>申込</span>
        </a>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent('official_click', { event_title: eventTitle, target_url: url })}
          className="w-[58px] py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-extrabold flex items-center justify-center gap-1 transition-all shadow-2xs hover:shadow-xs hover:scale-105 cursor-pointer select-none"
        >
          <Globe className="w-3 h-3 text-teal-700 dark:text-teal-400 shrink-0" />
          <span>公式</span>
        </a>
      )}

      {/* マウスホバーで直リンクURLを分かりやすくポップアップ表示（右端で見切れないよう right-0 配置） */}
      <div className="absolute bottom-full right-0 mb-2 hidden group-hover/link:flex flex-col items-end z-50 pointer-events-none w-72 sm:w-80">
        <div className="w-full bg-slate-950 text-white text-[11px] font-mono px-3 py-2 rounded-xl shadow-2xl border border-teal-500/70 leading-relaxed text-left">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1 mb-1 font-sans">
            <span className="text-teal-300 font-extrabold flex items-center gap-1">
              <ExternalLink className="w-3 h-3 shrink-0" />
              {type === 'entry' ? '申込・エントリー先' : '大会公式情報'}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-900/60 text-teal-200 border border-teal-700 font-bold whitespace-nowrap">
              {providerLabel}
            </span>
          </div>
          <div className="text-emerald-400 font-mono text-[10px] break-all leading-normal select-all bg-slate-900/80 p-1 rounded border border-slate-800">
            {url}
          </div>
        </div>
        <div className="w-2.5 h-2.5 bg-slate-950 rotate-45 -mt-1.5 mr-5 border-r border-b border-teal-500/70" />
      </div>
    </div>
  );
};
