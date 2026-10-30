import React from 'react';
import { RaceEvent } from '../types';
import { CATEGORY_LABELS, ELEMENT_BADGES, ENTRY_STATUS_CONFIG } from '../utils/helpers';
import {
  Globe,
  FileEdit,
  MessageSquare,
  Share2,
  Star,
  ChevronRight,
  TrendingUp,
  MapPin,
  Bookmark,
  CheckCircle2,
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
              <th className="py-3.5 px-3 w-[135px]">開催日 / 締切</th>
              <th className="py-3.5 px-3 w-[155px]">スポーツ種別</th>
              <th className="py-3.5 px-4">大会名 / 開催都道府県 / 競技エレメント</th>
              <th className="py-3.5 px-3 w-[130px] text-right">距離 / 累積標高</th>
              <th className="py-3.5 px-3 w-[145px] text-center">受付状況</th>
              <th className="py-3.5 px-2 w-[88px] text-center">口コミ</th>
              <th className="py-3.5 px-3 w-[236px] text-center">申込・公式・レポ・SNS</th>
              <th className="py-3.5 px-2 w-[36px] text-center">詳細</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {events.map((event) => {
              const cat = CATEGORY_LABELS[event.category];
              const status = ENTRY_STATUS_CONFIG[event.entry_status];
              const isFav = favoriteIds.includes(event.id);
              const checkedGearCount = getGearProgress(event);
              const totalGearCount = event.mandatory_gear.length;
              const canEntry = !!event.links.entry && event.entry_status !== 'closed';

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

                  {/* 2. 開催日 / 締切 */}
                  <td className="py-4 px-3 font-mono align-middle whitespace-nowrap">
                    <div className="text-sm font-black text-slate-950 dark:text-slate-100">
                      {event.date}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 font-bold mt-0.5">
                      締切: {event.entry_deadline || '未定'}
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

                  {/* 6. 受付状況（固定幅ピル） */}
                  <td className="py-4 px-3 text-center align-middle whitespace-nowrap">
                    <span
                      className={`inline-flex items-center justify-center gap-1.5 w-[124px] py-1 rounded-full text-xs border ${
                        status.badge
                      } ${status.pulse ? 'animate-pulse' : ''}`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${status.dot}`} />
                      <span>{status.label}</span>
                    </span>
                  </td>

                  {/* 7. 口コミ評価 */}
                  <td className="py-4 px-2 text-center align-middle whitespace-nowrap">
                    {event.review ? (
                      <div className="inline-flex items-center justify-center gap-1 w-[68px] py-1 bg-amber-50 dark:bg-slate-800 rounded-lg border border-amber-300 dark:border-slate-700">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        <span className="font-black text-amber-950 dark:text-amber-300 text-xs sm:text-sm font-mono">
                          {event.review.rating.toFixed(1)}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-block w-[68px] py-1 text-slate-500 text-xs font-bold">
                        —
                      </span>
                    )}
                  </td>

                  {/* 8. 右端アクション列（4つの固定スロットに完全整列！ガタつきゼロ） */}
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
                          className="w-[72px] h-8 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-extrabold flex items-center justify-center gap-1 transition-colors shadow-2xs"
                          title="エントリー申込ページを開く"
                        >
                          <FileEdit className="w-3.5 h-3.5 shrink-0" />
                          <span>申込</span>
                        </a>
                      ) : (
                        <span
                          className="w-[72px] h-8 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 text-xs font-bold flex items-center justify-center select-none"
                          title={
                            event.entry_status === 'closed' ? 'エントリー受付終了' : '申込開始前'
                          }
                        >
                          {event.entry_status === 'closed' ? '終了' : '準備中'}
                        </span>
                      )}

                      {/* スロット2: 公式サイトボタン (幅64px固定) */}
                      {event.links.official ? (
                        <a
                          href={event.links.official}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-[64px] h-8 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-extrabold flex items-center justify-center gap-1 transition-colors shadow-2xs"
                          title="大会公式サイトを開く"
                        >
                          <Globe className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
                          <span>公式</span>
                        </a>
                      ) : (
                        <span className="w-[64px] h-8 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 border border-slate-200 dark:border-slate-800 text-xs font-bold flex items-center justify-center select-none">
                          —
                        </span>
                      )}

                      {/* スロット3: 口コミ・レポボタン (幅34px固定) */}
                      {event.links.review ? (
                        <a
                          href={event.links.review}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-[34px] h-8 rounded-lg bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center justify-center transition-colors shadow-2xs"
                          title="大会レポ・口コミを見る"
                        >
                          <MessageSquare className="w-4 h-4 text-amber-600" />
                        </a>
                      ) : (
                        <span
                          className="w-[34px] h-8 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-700 border border-slate-200 dark:border-slate-800 flex items-center justify-center select-none"
                          title="レポ未登録"
                        >
                          <MessageSquare className="w-3.5 h-3.5 opacity-40" />
                        </span>
                      )}

                      {/* スロット4: SNSボタン (幅34px固定) */}
                      {event.links.sns ? (
                        <a
                          href={event.links.sns}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-[34px] h-8 rounded-lg bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center justify-center transition-colors shadow-2xs"
                          title="公式SNSを見る"
                        >
                          <Share2 className="w-4 h-4 text-sky-600" />
                        </a>
                      ) : (
                        <span
                          className="w-[34px] h-8 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-700 border border-slate-200 dark:border-slate-800 flex items-center justify-center select-none"
                          title="SNS未登録"
                        >
                          <Share2 className="w-3.5 h-3.5 opacity-40" />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 9. 詳細モーダル矢印 */}
                  <td className="py-4 px-2 text-center align-middle text-slate-400 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                    <ChevronRight className="w-5 h-5 mx-auto" />
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
