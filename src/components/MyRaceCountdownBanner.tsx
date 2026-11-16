import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, ChevronRight, Flag, Backpack } from 'lucide-react';
import { RaceEvent } from '../types';

interface MyRaceCountdownBannerProps {
  events: RaceEvent[];
  favoriteIds: string[];
  onSelectEvent: (event: RaceEvent) => void;
}

/**
 * お気に入り登録（マイ参戦予定）された直近の出場予定大会までのカウントダウンと、
 * 必携装備の準備率プログレスバーを表示するコンパクトバナー
 */
export const MyRaceCountdownBanner: React.FC<MyRaceCountdownBannerProps> = ({
  events,
  favoriteIds,
  onSelectEvent,
}) => {
  // EventDetailModal でのチェック変更をリアルタイム反映するためのバージョン管理
  const [gearVersion, setGearVersion] = useState(0);

  useEffect(() => {
    const handleGearUpdate = () => setGearVersion((v) => v + 1);
    window.addEventListener('gear-check-updated', handleGearUpdate);
    window.addEventListener('storage', handleGearUpdate);
    return () => {
      window.removeEventListener('gear-check-updated', handleGearUpdate);
      window.removeEventListener('storage', handleGearUpdate);
    };
  }, []);

  // 今日以降の開催日で、お気に入り登録されている大会を開催日順に取得
  const upcomingFavorites = useMemo(() => {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return events
      .filter((ev) => favoriteIds.includes(ev.id))
      .map((ev) => {
        const baseDateStr = ev.date.split(/[~～]/)[0].trim();
        const [y, m, d] = baseDateStr.split('-').map(Number);
        const eventTime = y && m && d ? new Date(y, m - 1, d).getTime() : NaN;
        const diffDays = Number.isNaN(eventTime)
          ? null
          : Math.round((eventTime - todayMidnight) / (1000 * 60 * 60 * 24));
        return { event: ev, baseDateStr, diffDays };
      })
      .filter((item) => item.diffDays !== null && item.diffDays >= 0)
      .sort((a, b) => (a.diffDays ?? 9999) - (b.diffDays ?? 9999));
  }, [events, favoriteIds]);

  const nextTarget = upcomingFavorites[0];

  // 直近大会の必携品チェック状態を localStorage から集計
  const gearProgress = useMemo(() => {
    if (!nextTarget) return { total: 0, completed: 0, percent: 0 };
    const mandatory = nextTarget.event.mandatory_gear || [];
    const total = mandatory.length;
    if (total === 0) return { total: 0, completed: 0, percent: 0 };

    try {
      const saved = localStorage.getItem(`gear_check_${nextTarget.event.id}`);
      const checkedMap: Record<string, boolean> = saved ? JSON.parse(saved) : {};
      const completed = mandatory.filter((g) => checkedMap[g.name]).length;
      const percent = Math.round((completed / total) * 100);
      return { total, completed, percent };
    } catch {
      return { total, completed: 0, percent: 0 };
    }
  }, [nextTarget, gearVersion]);

  if (!nextTarget) return null;

  const { event, diffDays } = nextTarget;
  const isUrgent = (diffDays ?? 99) <= 14;
  const otherCount = upcomingFavorites.length - 1;

  return (
    <div
      onClick={() => onSelectEvent(event)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectEvent(event);
        }
      }}
      className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 p-3.5 sm:p-4 shadow-sm hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer select-none"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* 左側: カウントダウン＆大会名 */}
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={`shrink-0 flex flex-col items-center justify-center px-3 py-1.5 rounded-xl font-black border ${
              isUrgent
                ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            <span className="text-[10px] leading-none opacity-80">開催まで</span>
            <span className="text-base sm:text-lg leading-tight mt-0.5 whitespace-nowrap">
              {diffDays === 0 ? '本日!' : `あと${diffDays}日`}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                <Flag className="w-3 h-3" />
                マイ参戦予定
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <Calendar className="w-3 h-3" />
                {event.date}（{event.prefecture}）
              </span>
              {otherCount > 0 && (
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  他 {otherCount}件予定
                </span>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 truncate mt-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {event.title}
            </h3>
          </div>
        </div>

        {/* 右側: 必携装備の準備率プログレスバー＆詳細導線 */}
        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
          {gearProgress.total > 0 ? (
            <div className="w-44 sm:w-52">
              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                  <Backpack className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  必携装備の準備率
                </span>
                <span
                  className={
                    gearProgress.percent === 100
                      ? 'text-emerald-600 dark:text-emerald-400 font-black'
                      : 'text-slate-700 dark:text-slate-200'
                  }
                >
                  {gearProgress.completed}/{gearProgress.total}個 ({gearProgress.percent}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    gearProgress.percent === 100
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  }`}
                  style={{ width: `${gearProgress.percent}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>必携品・詳細を確認</span>
            </div>
          )}

          <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-600 group-hover:text-white text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors whitespace-nowrap">
            <span className="hidden sm:inline">装備チェック</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
};
