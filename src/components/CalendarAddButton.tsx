import React, { useState, useRef, useEffect } from 'react';
import { CalendarPlus, ChevronDown, Download, ExternalLink, Clock, Flag } from 'lucide-react';
import { RaceEvent } from '../types';
import {
  getGoogleCalendarUrl,
  getGoogleCalendarEntryStartUrl,
  getGoogleCalendarDeadlineUrl,
  downloadEventIcs,
} from '../utils/helpers';
import { trackEvent } from '../utils/analytics';

interface CalendarAddButtonProps {
  event: RaceEvent;
  /** 'button': ラベル付きボタン（詳細モーダル等）, 'icon': コンパクトアイコン（カード・テーブル用）, 'mobile': モバイル下部ボタン用 */
  variant?: 'button' | 'icon' | 'mobile';
  /** メニューの展開方向 */
  menuPlacement?: 'top-right' | 'bottom-right' | 'bottom-left';
}

export const CalendarAddButton: React.FC<CalendarAddButtonProps> = ({
  event,
  variant = 'icon',
  menuPlacement = 'bottom-right',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const raceUrl = getGoogleCalendarUrl(event);
  const entryStartUrl = getGoogleCalendarEntryStartUrl(event);
  const deadlineUrl = getGoogleCalendarDeadlineUrl(event);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!raceUrl) return null;

  const handleTrack = (kind: string) => {
    trackEvent('calendar_add', {
      event_id: event.id,
      event_title: event.title,
      calendar_kind: kind,
    });
    setOpen(false);
  };

  const placementClass =
    menuPlacement === 'top-right'
      ? 'right-0 bottom-full mb-1.5'
      : menuPlacement === 'bottom-left'
      ? 'left-0 top-full mt-1.5'
      : 'right-0 top-full mt-1.5';

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onClick={(e) => e.stopPropagation()}
    >
      {variant === 'button' ? (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="py-3 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 text-sm font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          aria-expanded={open}
          aria-haspopup="menu"
          title="自分のGoogleカレンダーやiPhoneカレンダーに予定を追加"
        >
          <CalendarPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>カレンダーに追加</span>
          <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : variant === 'mobile' ? (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="min-h-[48px] min-w-[48px] px-3 inline-flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs rounded-xl border border-emerald-300 dark:border-emerald-700 shrink-0 select-none cursor-pointer"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="カレンダーに予定を追加"
          title="カレンダーに予定を追加"
        >
          <CalendarPlus className="w-5 h-5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/80 transition-colors cursor-pointer flex items-center gap-1"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="カレンダーに予定を追加"
          title="自分のGoogleカレンダー等に予定を追加"
        >
          <CalendarPlus className="w-4 h-4" />
        </button>
      )}

      {open && (
        <div
          role="menu"
          className={`absolute ${placementClass} z-50 w-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-1.5 text-left animate-fadeIn`}
        >
          <div className="px-2.5 py-1.5 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
            自分のカレンダーに予定を追加
          </div>

          <a
            role="menuitem"
            href={raceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleTrack('google_race_date')}
            className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Flag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>大会開催日を登録（Google）</span>
            </span>
            <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
          </a>

          {entryStartUrl && (
            <a
              role="menuitem"
              href={entryStartUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleTrack('google_entry_start')}
              className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-800 dark:hover:text-sky-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>申込開始日を登録（Google）</span>
              </span>
              <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
            </a>
          )}

          {deadlineUrl && (
            <a
              role="menuitem"
              href={deadlineUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleTrack('google_entry_deadline')}
              className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>申込締切日を登録（Google）</span>
              </span>
              <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
            </a>
          )}

          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              downloadEventIcs(event);
              handleTrack('ics_download');
            }}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>.ics保存（iPhone / Outlook等）</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
