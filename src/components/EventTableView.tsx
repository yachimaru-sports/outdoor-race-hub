import React from 'react';
import { RaceEvent } from '../types';
import { CATEGORY_LABELS, ELEMENT_BADGES, ENTRY_STATUS_CONFIG } from '../utils/helpers';
import {
  Globe,
  FileEdit,
  MessageSquare,
  Share2,
  ChevronRight,
  TrendingUp,
  MapPin,
  Bookmark,
  CheckCircle2,
  Calendar,
  Clock,
  Coins,
} from 'lucide-react';

interface EventTableViewProps {
  events: RaceEvent[];
  favoriteIds: string[];
  onToggleFavorite: (id: string) => void;
  onSelectEvent: (event: RaceEvent) => void;
}

export const EventTableView: React.FC<EventTableViewProps> = ({
  events,
  favoriteIds,
  onToggleFavorite,
  onSelectEvent,
}) => {
  const getGearProgress = (event: RaceEvent) => {
    try {
      const saved = localStorage.getItem(`gear_check_${event.id}`);
      if (!saved) return 0;
      const parsed = JSON.parse(saved);
      return event.mandatory_gear.filter((g) => parsed[g.name]).length;
    } catch {
      return 0;
    }
  };

  if (events.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
        <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
          条件に一致する大会が見つかりませんでした
        </p>
        <p className="text-sm mt-2 text-slate-600 dark:text-slate-400 font-medium">
          上の「条件をクリア」ボタンを押すか、別のスポーツ種目・特徴タグをお試しください。
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse table-fixed min-w-[1100px]">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-850 text-slate-800 dark:text-slate-200 border-b-2 border-slate-300 dark:border-slate-700 text-xs sm:text-[13px] font-extrabold tracking-wide">
              <th className="py-3.5 pl-4 pr-2 w-[52px] text-center" title="参戦予定ブックマーク">
                保存
              </th>
              <th className="py-3.5 px-3 w-[155px]">
                <div className="flex items-center gap-1 text-teal-800 dark:text-teal-300">
                  <Calendar className="w-4 h-4" />
                  <span>開催日 / 申込締切</span>
                </div>
              </th>
              <th className="py-3.5 px-3 w-[150px]">スポーツ種別</th>
              <th className="py-3.5 px-4">大会名 / 開催都道府県 / 競技エレメント</th>
              <th className="py-3.5 px-3 w-[115px] text-right">距離 / 標高</th>
              <th className="py-3.5 px-3 w-[115px] text-right">
                <div className="flex items-center justify-end gap-1 text-amber-800 dark:text-amber-300">
                  <Coins className="w-4 h-4" />
                  <span>参加費</span>
                </div>
              </th>
              <th className="py-3.5 px-3 w-[130px] text-center">受付状況</th>
              <th className="py-3.5 px-3 w-[236px] text-center">申込・公式・レポ・SNS</th>
              <th className="py-3.5 px-2 w-[36px] text-center">詳細</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {events.map((event) => {
              const cat = CATEGORY_LABELS[event.category];
              const now = new Date();
              const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              const isPastRace = event.date < todayStr;
              const status = ENTRY_STATUS_CONFIG[event.entry_status];
              const statusLabel = isPastRace ? '開催終了' : status.label;
              const isFav = favoriteIds.includes(event.id);
              const checkedGearCount = getGearProgress(event);
              const totalGearCount = event.mandatory_gear.length;
              const canEntry = !!event.links.entry && event.entry_status !== 'closed' && !isPastRace;

              // 締切日の表示スタイル
              const isClosingSoon = event.entry_status === 'closing_soon';
              const isOpen = event.entry_status === 'open';

              return (
                <tr
                  key={event.id}
                  onClick={() => onSelectEvent(event)}
                  className={`transition-colors cursor-pointer group ${
                    isFav
                      ? 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/80 dark:hover:bg-rose-950/30'
                      : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {/* 1. 参戦予定ブックマークボタン */}
                  <td
                    className="py-4 pl-4 pr-2 text-center align-middle"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(event.id);
                    }}
                  >
                    <button
                      type="button"
                      className={`p-2 rounded-lg transition-all cursor-pointer ${
                        isFav
                          ? 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 border border-rose-300'
                          : 'text-slate-400 dark:text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                      }`}
                      title={isFav ? '参戦予定リストから外す' : '参戦予定リストに登録する'}
                    >
                      <Bookmark className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                  </td>

                  {/* 2. 開催日 / 締切（目立つデザインに大幅強化） */}
                  <td className="py-4 px-3 align-middle whitespace-nowrap">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Calendar className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                      <span className="text-[15px] font-black text-slate-950 dark:text-white tracking-tight">
                        {event.date}
                      </span>
                    </div>

                    {/* 締切日ハイライト */}
                    <div className="mt-1">
                      {isClosingSoon ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800 animate-pulse">
                          <Clock className="w-3 h-3 text-red-600" />
                          締切: {event.entry_deadline || '締切間近'}
                        </span>
                      ) : isOpen ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                          <Clock className="w-3 h-3 text-amber-600" />
                          締切: {event.entry_deadline || '受付中'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-bold pl-1">
                          締切: {event.entry_deadline || '終了'}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 3. スポーツ種別 & サブカテゴリ */}
                  <td className="py-4 px-3 align-middle whitespace-nowrap">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${cat.badgeBg}`}
                    >
                      {cat.shortLabel}
                    </span>
                    {event.subCategory && (
                      <div className="text-xs text-slate-700 dark:text-slate-300 font-bold mt-1 pl-1 truncate">
                        {event.subCategory}
                      </div>
                    )}
                  </td>

                  {/* 4. 大会名 / 競技エレメントバッジ / エリア */}
                  <td className="py-4 px-4 align-middle">
                    <div className="font-extrabold text-slate-950 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors text-[15px] sm:text-base leading-snug">
                      {event.title}
                    </div>

                    {/* エリア ＋ 競技エレメントバッジ ＋ 必携品進捗 */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-700 mr-1">
                        <MapPin className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                        {event.prefecture}
                        <span className="text-slate-600 dark:text-slate-400 font-bold">
                          ({event.region})
                        </span>
                      </span>

                      {/* 競技エレメントタグ（100マイル・読図・MTB・パドル等） */}
                      {event.elements?.map((el) => {
                        const badge = ELEMENT_BADGES[el];
                        if (!badge) return null;
                        return (
                          <span
                            key={el}
                            className={`inline-flex items-center gap-1 text-xs font-extrabold px-2 py-0.5 rounded-md border ${badge.style}`}
                          >
                            <span>{badge.icon}</span>
                            <span>{badge.label}</span>
                          </span>
                        );
                      })}

                      {/* 必携品準備バッジ */}
                      {totalGearCount > 0 && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md border ${
                            checkedGearCount > 0
                              ? 'bg-emerald-100 text-emerald-950 border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-200'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {checkedGearCount > 0 && (
                            <CheckCircle2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                          )}
                          必携品{' '}
                          {checkedGearCount > 0
                            ? `${checkedGearCount}/${totalGearCount}準備済`
                            : `${totalGearCount}点`}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 5. 距離 / 標高 */}
                  <td className="py-4 px-3 text-right align-middle whitespace-nowrap font-mono">
                    <div className="font-black text-slate-950 dark:text-white text-base">
                      {event.distance_km}{' '}
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        km
                      </span>
                    </div>
                    {event.elevation_m > 0 ? (
                      <div className="text-xs text-amber-800 dark:text-amber-400 font-extrabold flex items-center justify-end gap-0.5 mt-0.5">
                        <TrendingUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        +{event.elevation_m.toLocaleString()}m
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 font-bold mt-0.5">フラット</div>
                    )}
                  </td>

                  {/* 6. エントリー費用（参加費） */}
                  <td className="py-4 px-3 text-right align-middle whitespace-nowrap font-mono">
                    <span className="text-sm font-black text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-250 dark:border-slate-700">
                      {event.entry_fee || '—'}
                    </span>
                  </td>

                  {/* 7. 受付状況（固定幅ピル） */}
                  <td className="py-4 px-3 text-center align-middle whitespace-nowrap">
                    <span
                      className={`inline-flex items-center justify-center gap-1.5 w-[115px] py-1 rounded-full text-xs border ${
                        status.badge
                      } ${status.pulse ? 'animate-pulse' : ''}`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${status.dot}`} />
                      <span>{statusLabel}</span>
                    </span>
                  </td>

                  {/* 8. 右端アクション列（4つの固定スロットに完全整列） */}
                  <td
                    className="py-4 px-3 align-middle whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="grid grid-cols-[72px_64px_34px_34px] items-center justify-end gap-1.5">
                      {/* スロット1: 申込ボタン (幅72px固定) */}
                      {canEntry ? (
                        <a
                          href={event.links.entry!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-[72px] py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-2xs cursor-pointer select-none"
                          title="エントリー申込ページを開く"
                        >
                          <FileEdit className="w-3.5 h-3.5 shrink-0" />
                          <span>申込</span>
                        </a>
                      ) : (
                        <div
                          className="w-[72px] py-1.5 rounded-lg bg-slate-150 dark:bg-slate-800/50 text-slate-500 dark:text-slate-500 text-xs font-bold text-center border border-slate-250 dark:border-slate-800 select-none cursor-not-allowed"
                          title="現在エントリーは受け付けていません"
                        >
                          受付無
                        </div>
                      )}

                      {/* スロット2: 公式サイト (幅64px固定) */}
                      {event.links.official ? (
                        <a
                          href={event.links.official}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-[64px] py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-2xs cursor-pointer select-none"
                          title="大会公式サイトを開く"
                        >
                          <Globe className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
                          <span>公式</span>
                        </a>
                      ) : (
                        <div className="w-[64px] py-1.5 rounded-lg bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-600 text-xs font-bold text-center border border-slate-200 dark:border-slate-800 select-none">
                          —
                        </div>
                      )}

                      {/* スロット3: 大会レポ (幅34px固定) */}
                      {event.links.review ? (
                        <a
                          href={event.links.review}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-[34px] h-[29px] rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center justify-center transition-colors shadow-2xs cursor-pointer select-none"
                          title="大会レポート・口コミを見る"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        </a>
                      ) : (
                        <div className="w-[34px] h-[29px] rounded-lg bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-600 text-xs font-bold flex items-center justify-center border border-slate-200 dark:border-slate-800 select-none">
                          —
                        </div>
                      )}

                      {/* スロット4: 公式SNS (幅34px固定) */}
                      {event.links.sns ? (
                        <a
                          href={event.links.sns}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-[34px] h-[29px] rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center justify-center transition-colors shadow-2xs cursor-pointer select-none"
                          title="公式SNS・Facebookを見る"
                        >
                          <Share2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        </a>
                      ) : (
                        <div className="w-[34px] h-[29px] rounded-lg bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-600 text-xs font-bold flex items-center justify-center border border-slate-200 dark:border-slate-800 select-none">
                          —
                        </div>
                      )}
                    </div>
                  </td>

                  {/* 9. 詳細モーダル展開アイコン */}
                  <td className="py-4 px-2 text-center align-middle">
                    <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-teal-700 dark:group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
