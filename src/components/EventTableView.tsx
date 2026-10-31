import React, { useState } from 'react';
import { RaceEvent, DealItem, SortOption } from '../types';
import {
  CATEGORY_LABELS,
  ELEMENT_BADGES,
  ENTRY_STATUS_CONFIG,
  buildRakutenSearchAffiliateUrl,
  getGoogleMapsUrl,
  formatPrice,
} from '../utils/helpers';
import { LinkButton } from './LinkButton';
import {
  Globe,
  FileEdit,
  TrendingUp,
  MapPin,
  Bookmark,
  Calendar,
  Clock,
  Coins,
  Backpack,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  ExternalLink,
  CheckSquare,
  Square,
  Sparkles,
  X,
  ArrowUpDown,
} from 'lucide-react';

interface EventTableViewProps {
  events: RaceEvent[];
  deals?: DealItem[];
  favoriteIds: string[];
  sortBy?: SortOption;
  onSortChange?: (newSort: SortOption) => void;
  onToggleFavorite: (id: string) => void;
  onSelectEvent?: (event: RaceEvent) => void;
}

export const EventTableView: React.FC<EventTableViewProps> = ({
  events,
  deals = [],
  favoriteIds,
  sortBy,
  onSortChange,
  onToggleFavorite,
}) => {
  // 必携品アコーディオン展開中の大会ID
  const [expandedGearEventId, setExpandedGearEventId] = useState<string | null>(null);

  // チェック済み必携品（localStorage連動）
  const [checkedGears, setCheckedGears] = useState<Record<string, Record<string, boolean>>>(() => {
    try {
      const result: Record<string, Record<string, boolean>> = {};
      events.forEach((ev) => {
        const saved = localStorage.getItem(`gear_check_${ev.id}`);
        if (saved) {
          result[ev.id] = JSON.parse(saved);
        }
      });
      return result;
    } catch {
      return {};
    }
  });

  const toggleGearCheck = (eventId: string, gearName: string) => {
    setCheckedGears((prev) => {
      const eventChecks = { ...(prev[eventId] || {}) };
      eventChecks[gearName] = !eventChecks[gearName];
      const updated = { ...prev, [eventId]: eventChecks };
      try {
        localStorage.setItem(`gear_check_${eventId}`, JSON.stringify(eventChecks));
      } catch {}
      return updated;
    });
  };

  const getGearProgress = (event: RaceEvent) => {
    const eventChecks = checkedGears[event.id] || {};
    return (event.mandatory_gear || []).filter((g) => eventChecks[g.name]).length;
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
      {/* テーブルコンテナ：二重スクロールを排除し、ページ全体と自然に連動 */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse table-fixed min-w-[1100px]">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr className="text-slate-800 dark:text-slate-200 border-b-2 border-slate-300 dark:border-slate-700 text-xs font-extrabold tracking-wide">
              {/* 1. 保存 */}
              <th className="py-3 pl-3 pr-1 w-[46px] text-center" title="参戦予定ブックマーク">
                保存
              </th>
              {/* 2. 開催日 / 締切（クリックでソート） */}
              <th
                className={`py-3 px-3 w-[145px] transition-colors select-none ${
                  onSortChange ? 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-750' : ''
                }`}
                onClick={() => {
                  if (onSortChange) {
                    onSortChange(sortBy === 'date-asc' ? 'date-desc' : 'date-asc');
                  }
                }}
                title="クリックで開催日順（昇順/降順）に並び替え"
              >
                <div className="flex items-center gap-1 text-teal-800 dark:text-teal-300">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>開催日 / 締切</span>
                  <ArrowUpDown className={`w-3 h-3 ${sortBy?.startsWith('date') ? 'text-teal-600 font-black' : 'text-slate-400'}`} />
                </div>
              </th>
              {/* 3. 種別（★クリックで種別ソート） */}
              <th
                className={`py-3 px-2.5 w-[130px] transition-colors select-none ${
                  onSortChange ? 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-750' : ''
                }`}
                onClick={() => {
                  if (onSortChange) {
                    onSortChange(sortBy === 'category-asc' ? 'date-asc' : 'category-asc');
                  }
                }}
                title="クリックで種別順（トレイル→マラソン→サイクル→読図）に並び替え"
              >
                <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200">
                  <span>種別</span>
                  <ArrowUpDown className={`w-3 h-3 ${sortBy === 'category-asc' ? 'text-teal-600 dark:text-teal-400 font-black' : 'text-slate-400'}`} />
                  {sortBy === 'category-asc' && (
                    <span className="text-[10px] bg-teal-600 text-white px-1 rounded font-bold">順</span>
                  )}
                </div>
              </th>
              {/* 4. 大会名 / エリア / 競技特徴 */}
              <th className="py-3 px-3">大会名 / エリア / 競技特徴</th>
              {/* 5. 主な必携品（★赤色で目立たせる） */}
              <th className="py-3 px-2 w-[105px] text-center">
                <div className="flex items-center justify-center gap-1 text-red-700 dark:text-red-400 font-black">
                  <Backpack className="w-3.5 h-3.5" />
                  <span>主な必携品</span>
                </div>
              </th>
              {/* 6. 距離 / 標高（クリックでソート） */}
              <th
                className={`py-3 px-2.5 w-[120px] text-right transition-colors select-none ${
                  onSortChange ? 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-750' : ''
                }`}
                onClick={() => {
                  if (onSortChange) {
                    onSortChange(sortBy === 'distance-desc' ? 'distance-asc' : 'distance-desc');
                  }
                }}
                title="クリックで距離順（長い順/短い順）に並び替え"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>距離 / 標高</span>
                  <ArrowUpDown className={`w-3 h-3 ${sortBy?.startsWith('distance') ? 'text-teal-600 font-black' : 'text-slate-400'}`} />
                </div>
              </th>
              {/* 7. 参加費 */}
              <th className="py-3 px-2.5 w-[95px] text-right">
                <div className="flex items-center justify-end gap-1 text-amber-800 dark:text-amber-300">
                  <Coins className="w-3.5 h-3.5" />
                  <span>参加費</span>
                </div>
              </th>
              {/* 8. 受付状況 */}
              <th className="py-3 px-2.5 w-[115px] text-center">受付状況</th>
              {/* 9. 申込・公式 */}
              <th className="py-3 px-2.5 w-[140px] text-center">申込・公式</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs sm:text-sm">
            {events.map((event) => {
              const cat = CATEGORY_LABELS[event.category];
              const now = new Date();
              const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              const isPastRace = event.date < todayStr;
              const status = ENTRY_STATUS_CONFIG[event.entry_status];
              const statusLabel = isPastRace ? '開催終了' : status.label;
              const isFav = favoriteIds.includes(event.id);
              const totalGearCount = event.mandatory_gear?.length || 0;
              const checkedGearCount = getGearProgress(event);
              const canEntry = !!event.links.entry && event.entry_status !== 'closed' && !isPastRace;
              const isClosingSoon = event.entry_status === 'closing_soon';
              const isOpen = event.entry_status === 'open';
              const isGearExpanded = expandedGearEventId === event.id;

              // この大会に関連する特価ギア
              const eventGearCats = new Set((event.mandatory_gear || []).map((g) => g.category));
              const matchedDeals = deals.filter((d) => eventGearCats.has(d.category));
              const displayDeals = matchedDeals.length > 0 ? matchedDeals.slice(0, 3) : deals.slice(0, 3);

              return (
                <React.Fragment key={event.id}>
                  {/* メインレース行 */}
                  <tr
                    className={`transition-colors ${
                      isFav
                        ? 'bg-rose-50/40 dark:bg-rose-950/20'
                        : isGearExpanded
                        ? 'bg-teal-50/50 dark:bg-slate-800'
                        : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {/* 1. 参戦予定ブックマークボタン */}
                    <td className="py-2.5 pl-3 pr-1 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(event.id)}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          isFav
                            ? 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 border border-rose-300'
                            : 'text-slate-400 dark:text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                        }`}
                        title={isFav ? '参戦予定リストから外す' : '参戦予定リストに登録する'}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                      </button>
                    </td>

                    {/* 2. 開催日 / 締切（2行でスッキリ整列） */}
                    <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                      <div className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
                        <span className="text-sm font-black text-slate-950 dark:text-white tracking-tight">
                          {event.date}
                        </span>
                      </div>

                      {/* 締切日表示 */}
                      <div className="mt-0.5">
                        {isClosingSoon ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[11px] font-extrabold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-300 animate-pulse font-mono">
                            <Clock className="w-2.5 h-2.5 text-red-600" />
                            締切:{event.entry_deadline ? event.entry_deadline.slice(5) : '間近'}
                          </span>
                        ) : isOpen ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[11px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-300 font-mono">
                            <Clock className="w-2.5 h-2.5 text-amber-600" />
                            締切:{event.entry_deadline ? event.entry_deadline.slice(5) : '受付中'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-bold font-mono pl-0.5">
                            締切:{event.entry_deadline ? event.entry_deadline.slice(5) : '終了'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. スポーツ種別 & サブカテゴリ（ホバー時に吹き出し全文ポップアップ表示） */}
                    <td className="py-2.5 px-2.5 align-middle">
                      <div className="relative group/category">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-extrabold border ${cat.badgeBg} cursor-help`}
                        >
                          {cat.shortLabel}
                        </span>
                        {event.subCategory && (
                          <div
                            className="text-[11px] text-slate-700 dark:text-slate-300 font-bold truncate max-w-[125px] mt-0.5 cursor-help"
                          >
                            {event.subCategory}
                          </div>
                        )}

                        {/* マウスを当てると全文と詳細が浮き出る吹き出しポップアップ */}
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover/category:block z-50 bg-slate-950/95 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-2xl border border-teal-500/50 min-w-[180px] max-w-[240px] pointer-events-none whitespace-normal leading-relaxed backdrop-blur-xs">
                          <div className="text-[10px] text-teal-300 font-black mb-0.5">種別・カテゴリー詳細:</div>
                          <div className="text-white font-extrabold">{cat.label}</div>
                          {event.subCategory && (
                            <div className="text-teal-200 font-bold mt-1 text-[11px] border-t border-slate-700/80 pt-1">
                              サブ種目: {event.subCategory}
                            </div>
                          )}
                          {cat.desc && (
                            <div className="text-slate-400 text-[10px] mt-0.5 font-medium">
                              {cat.desc}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 4. 大会名 / エリア / 競技特徴（★ホバーポップアップ復活 ＆ 必携バッジは次列へ移動） */}
                    <td className="py-2.5 px-3 align-middle">
                      {/* 大会タイトル（画面幅で見切れてもホバーで全文確認可能） */}
                      <div className="relative group/title">
                        <div
                          className="font-black text-slate-950 dark:text-white text-sm leading-snug line-clamp-2 select-text cursor-default"
                        >
                          {event.title}
                        </div>

                        {/* ホバー時に大会名全文が浮き出るポップアップ */}
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover/title:block z-50 bg-slate-950/95 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg shadow-xl border border-teal-500/50 max-w-md pointer-events-none whitespace-normal leading-relaxed backdrop-blur-xs">
                          <div className="text-[10px] text-teal-300 font-bold mb-0.5">大会名（全文）:</div>
                          {event.title}
                        </div>
                      </div>

                      {/* 開催都道府県（クリックでGoogleマップの集合場所へ直行） ＋ 特徴短縮バッジ */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs">
                        <a
                          href={getGoogleMapsUrl(event)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-black text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 px-2 py-0.5 rounded-md border border-teal-300 dark:border-teal-700 shrink-0 transition-all hover:scale-105 shadow-2xs group/map cursor-pointer"
                          title={`クリックでGoogleマップを開き、「${event.prefecture}」の大会会場・集合場所を表示します`}
                        >
                          <MapPin className="w-3 h-3 text-teal-600 dark:text-teal-400 group-hover/map:text-red-500 transition-colors shrink-0" />
                          <span>{event.prefecture}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-teal-500/70 group-hover/map:text-teal-600 shrink-0" />
                        </a>

                        {/* 短縮された競技特徴バッジ（読図、MTB、山岳、ロゲ、1日等） */}
                        {(event.elements || []).map((el) => {
                          const badge = ELEMENT_BADGES[el];
                          if (!badge) return null;
                          return (
                            <span
                              key={el}
                              className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${badge.style}`}
                              title={badge.desc || badge.label}
                            >
                              <span>{badge.icon}</span>
                              <span>{badge.label}</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* 5. 必携品ボタン（★赤色でしっかり目立たせる＆シンプルに「○点」表記） */}
                    <td className="py-2.5 px-2 text-center align-middle whitespace-nowrap">
                      {totalGearCount > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedGearEventId(isGearExpanded ? null : event.id)
                          }
                          className={`inline-flex items-center justify-center gap-1 min-w-[88px] px-2 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shadow-xs select-none ${
                            isGearExpanded
                              ? 'bg-red-800 text-white ring-2 ring-red-400'
                              : 'bg-red-600 hover:bg-red-700 text-white hover:scale-105'
                          }`}
                          title="クリックで主な必携品リストと楽天購入リンクを開閉"
                        >
                          <Backpack className="w-3.5 h-3.5 shrink-0" />
                          <span>{totalGearCount}アイテム</span>
                          {isGearExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs font-bold">—</span>
                      )}
                    </td>

                    {/* 6. 距離 / 標高（文字サイズ大きく視認性抜群） */}
                    <td className="py-2.5 px-2.5 text-right align-middle whitespace-nowrap font-mono">
                      <div className="font-black text-slate-950 dark:text-white text-base sm:text-lg tracking-tight">
                        {event.distance_km}{' '}
                        <span className="text-xs font-black text-slate-600 dark:text-slate-400">
                          km
                        </span>
                      </div>
                      {event.elevation_m > 0 ? (
                        <div className="text-xs sm:text-sm text-amber-800 dark:text-amber-400 font-black flex items-center justify-end gap-0.5 mt-0.5">
                          <TrendingUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>+{event.elevation_m.toLocaleString()}m</span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 font-bold mt-0.5">平坦</div>
                      )}
                    </td>

                    {/* 7. エントリー費用（参加費） */}
                    <td className="py-2.5 px-2.5 text-right align-middle whitespace-nowrap font-mono">
                      <span className="text-xs font-black text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                        {event.entry_fee || '—'}
                      </span>
                    </td>

                    {/* 8. 受付状況 */}
                    <td className="py-2.5 px-2.5 text-center align-middle whitespace-nowrap">
                      <span
                        className={`inline-flex items-center justify-center gap-1 w-[100px] py-0.5 rounded-full text-xs border ${
                          status.badge
                        } ${status.pulse ? 'animate-pulse' : ''}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.dot}`} />
                        <span>{statusLabel}</span>
                      </span>
                    </td>

                    {/* 9. 申込・公式（ホバーで直リンクURLポップアップ＆リンク切れ取り消し線対応） */}
                    <td className="py-2.5 px-2.5 align-middle whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <LinkButton
                          type="entry"
                          url={event.links.entry}
                          canEntry={canEntry}
                          isBroken={false}
                          eventTitle={event.title}
                        />
                        <LinkButton
                          type="official"
                          url={event.links.official}
                          isBroken={false}
                          eventTitle={event.title}
                        />
                      </div>
                    </td>
                  </tr>

                  {/* 必携品の具体的な情報 ＆ 楽天市場アフィリエイト購入パネル（インライン展開） */}
                  {isGearExpanded && (
                    <tr className="bg-gradient-to-b from-teal-50/60 to-slate-50/80 dark:from-slate-850 dark:to-slate-900 border-b-2 border-teal-600/30">
                      <td colSpan={9} className="p-4 sm:p-5">
                        <div className="max-w-5xl mx-auto space-y-4">
                          {/* ヘッダー情報バー */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-teal-200 dark:border-slate-700 pb-3">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-red-600 text-white">
                                <Backpack className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="font-black text-slate-950 dark:text-white text-sm sm:text-base flex items-center gap-2">
                                  <span>【{event.title}】の主な必携装備リスト（参考）</span>
                                  <span className="text-xs font-bold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/70 px-2 py-0.5 rounded-full border border-red-300 dark:border-red-700">
                                    主要{totalGearCount}アイテム抜粋
                                  </span>
                                </h4>
                                <p className="text-xs text-red-700 dark:text-red-400 font-bold mt-0.5">
                                  ※ 大会の必携装備ルールは天候や年度・主催者の指示により変更される場合があります。エントリーおよび出走前には必ず各大会公式サイトの最新レギュレーションをご確認ください。
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setExpandedGearEventId(null)}
                                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-150 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 cursor-pointer flex items-center gap-1 text-xs font-bold"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>閉じる</span>
                              </button>
                            </div>
                          </div>

                          {/* 必携品アイテムリスト ＆ 楽天購入ボタン */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {event.mandatory_gear.map((gear) => {
                              const isChecked = !!(checkedGears[event.id] || {})[gear.name];
                              const rakutenSearchUrl = buildRakutenSearchAffiliateUrl(gear.name);

                              return (
                                <div
                                  key={gear.name}
                                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                                    isChecked
                                      ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/50'
                                      : 'bg-white dark:bg-slate-800 border-slate-250 dark:border-slate-700 hover:border-teal-400'
                                  }`}
                                >
                                  {/* チェックボタン ＆ アイテム名 */}
                                  <div
                                    className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer select-none"
                                    onClick={() => toggleGearCheck(event.id, gear.name)}
                                  >
                                    <button
                                      type="button"
                                      className="shrink-0 text-teal-700 dark:text-teal-400"
                                      aria-label={isChecked ? '準備済み' : '未準備'}
                                    >
                                      {isChecked ? (
                                        <CheckSquare className="w-5 h-5 fill-teal-700 text-white dark:text-slate-900" />
                                      ) : (
                                        <Square className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                      )}
                                    </button>
                                    <div className="min-w-0 flex-1">
                                      <div
                                        className={`text-xs sm:text-sm font-black truncate ${
                                          isChecked
                                            ? 'line-through text-slate-500 dark:text-slate-400'
                                            : 'text-slate-900 dark:text-slate-100'
                                        }`}
                                        title={gear.name}
                                      >
                                        {gear.name}
                                      </div>
                                      <span className="inline-block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-750 px-1.5 py-0.2 rounded mt-0.5">
                                        区分: {gear.category}
                                      </span>
                                    </div>
                                  </div>

                                  {/* 楽天市場での購入ボタン（アフィリエイト付き） */}
                                  <a
                                    href={rakutenSearchUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white text-xs font-black shadow-xs hover:shadow transition-all cursor-pointer select-none group"
                                    title={`楽天市場で「${gear.name}」のセール・特価商品を検索する`}
                                  >
                                    <ShoppingCart className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                    <span>楽天で探す</span>
                                    <ExternalLink className="w-3 h-3 opacity-80" />
                                  </a>
                                </div>
                              );
                            })}
                          </div>

                          {/* 楽天市場 特価セールギアの連動レコメンド（deals.json） */}
                          {displayDeals.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                                  <Sparkles className="w-4 h-4 text-amber-500" />
                                  <span>この大会におすすめの楽天市場 特価セールギア（15%〜53%OFF）</span>
                                </div>
                                <span className="text-[10px] font-extrabold text-red-600 dark:text-red-400">
                                  🔥 特価厳選
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                {displayDeals.map((deal) => {
                                  const savedYen = deal.original_price - deal.price;
                                  return (
                                    <a
                                      key={deal.id}
                                      href={deal.affiliate_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-250 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-400 transition-all shadow-2xs group"
                                    >
                                      <img
                                        src={deal.image_url}
                                        alt={deal.title}
                                        className="w-14 h-14 object-cover rounded-lg bg-slate-100 dark:bg-slate-900 shrink-0 border border-slate-200 dark:border-slate-700"
                                      />
                                      <div className="min-w-0 flex-1 flex flex-col justify-between">
                                        <div>
                                          <div className="flex items-center gap-1">
                                            <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-red-600 text-white">
                                              {deal.discount_rate}%OFF
                                            </span>
                                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                              (¥{savedYen.toLocaleString()}引)
                                            </span>
                                          </div>
                                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1 group-hover:text-teal-700 dark:group-hover:text-teal-300 mt-0.5">
                                            {deal.title}
                                          </p>
                                        </div>
                                        <div className="flex items-center justify-between text-xs mt-1">
                                          <span className="font-mono font-black text-amber-800 dark:text-amber-300">
                                            {formatPrice(deal.price)}
                                          </span>
                                          <span className="text-[10px] text-teal-700 dark:text-teal-400 font-extrabold flex items-center gap-0.5">
                                            楽天で購入 →
                                          </span>
                                        </div>
                                      </div>
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
