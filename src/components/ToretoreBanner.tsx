import React from 'react';
import { Compass, ExternalLink, Bike, ArrowRight, Mountain, Sparkles, Crown, Check, X, Globe } from 'lucide-react';
import { FilterState } from '../types';

interface ToretoreBannerProps {
  filters?: FilterState;
  onFilterAdventure: () => void;
  onFilterFeature?: (category: string, featureTag: string, region?: string) => void;
}

export const ToretoreBanner: React.FC<ToretoreBannerProps> = ({
  filters,
  onFilterAdventure,
  onFilterFeature,
}) => {
  // 4つのカードの適用状態判定（オン・オフ）
  const isAdventureActive =
    filters?.category === 'adventure' &&
    (filters?.featureTag === 'toretore' || filters?.featureTag === 'nav');

  const is100MileActive = filters?.featureTag === '100mile';

  const isChugokuActive = filters?.region === '中国';
  const isShikokuActive = filters?.region === '四国';
  const isRegionCardActive = isChugokuActive || isShikokuActive;

  const isArwsActive = filters?.featureTag === 'arws';

  return (
    <div className="space-y-4">
      {/* セクション見出し */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-6 rounded-full bg-teal-700 dark:bg-teal-400" />
          <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-950 dark:text-white">
            注目の競技カテゴリー・主要大会クイック抽出
          </h2>
          <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hidden sm:inline">
            — 国内外主要アドベンチャー・100マイル・中四国エリア（※再度押すと解除）
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-xs font-black text-slate-500 dark:text-slate-400 shrink-0 mr-0.5">
            情報元・ポータル:
          </span>

          <a
            href="https://arworldseries.com/races"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-black text-indigo-900 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full border border-indigo-300 dark:border-indigo-700 shadow-2xs hover:bg-indigo-100 transition-all shrink-0"
            title="ARWS (Adventure Racing World Series) 公式"
          >
            <Globe className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            <span>ARWS公式</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </a>

          <a
            href="https://runnet.jp/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-black text-blue-900 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-300 dark:border-blue-700 shadow-2xs hover:bg-blue-100 transition-all shrink-0"
            title="RUNNET（ランネット）"
          >
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>RUNNET</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </a>

          <a
            href="https://moshicom.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-black text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-700 shadow-2xs hover:bg-emerald-100 transition-all shrink-0"
            title="e-moshicom（モシコム）"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>モシコム</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </a>

          <a
            href="https://www.sportsentry.ne.jp/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-black text-orange-900 dark:text-orange-200 bg-orange-50 dark:bg-orange-950/60 px-2.5 py-1 rounded-full border border-orange-300 dark:border-orange-700 shadow-2xs hover:bg-orange-100 transition-all shrink-0"
            title="スポーツエントリー"
          >
            <span className="w-2 h-2 rounded-full bg-orange-600" />
            <span>スポエン</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </a>

          <a
            href="https://cycle.spoen.jp/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-black text-sky-900 dark:text-sky-200 bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 rounded-full border border-sky-300 dark:border-sky-700 shadow-2xs hover:bg-sky-100 transition-all shrink-0"
            title="スポエンCYCLE（サイクル専門）"
          >
            <Bike className="w-3 h-3 text-sky-600 dark:text-sky-400" />
            <span>スポエンCYCLE</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </a>

          <a
            href="http://toretore.web.fc2.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-black text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-300 dark:border-amber-700 shadow-2xs hover:bg-amber-200 transition-all shrink-0"
            title="とれとれバイク関西 公式HP"
          >
            <Compass className="w-3 h-3 text-amber-700" />
            <span>とれとれバイク</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </a>

          <a
            href="https://kochi-navigms.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-black text-teal-900 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 px-2.5 py-1 rounded-full border border-teal-300 dark:border-teal-800 shadow-2xs hover:bg-teal-100 transition-all shrink-0"
            title="ナビゲーションゲーム（kochi-navigms.com）"
          >
            <Compass className="w-3 h-3 text-teal-700" />
            <span>ナビゲーム</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </a>
        </div>
      </div>

      {/* スマホ専用：4つのボタン（縦並び） */}
      <div className="flex flex-col gap-2.5 lg:hidden w-full">
        {/* 黄色: とれとれバイク・読図・AR */}
        <button
          type="button"
          onClick={onFilterAdventure}
          className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border-2 flex items-center justify-between text-left transition-all cursor-pointer select-none ${
            isAdventureActive
              ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-md ring-2 ring-amber-400/50 font-black'
              : 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800 hover:bg-amber-100 font-bold'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <div className="leading-snug">
              <span className="font-black text-xs sm:text-sm">とれとれバイク・読図・AR</span>
              <span className="text-[11px] opacity-80 ml-2">（2.5万図必携・アドベンチャー）</span>
            </div>
          </div>
          {isAdventureActive ? (
            <span className="text-[10px] font-black bg-slate-950 text-white px-2 py-0.5 rounded-full shrink-0">
              適用中 ✕
            </span>
          ) : (
            <span className="text-xs font-mono font-black opacity-70 shrink-0">抽出 ➔</span>
          )}
        </button>

        {/* 赤色: 国内100マイルレース一覧 */}
        <button
          type="button"
          onClick={() => onFilterFeature && onFilterFeature('all', '100mile')}
          className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border-2 flex items-center justify-between text-left transition-all cursor-pointer select-none ${
            is100MileActive
              ? 'bg-rose-500 text-white border-rose-600 shadow-md ring-2 ring-rose-400/50 font-black'
              : 'bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800 hover:bg-rose-100 font-bold'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <div className="leading-snug">
              <span className="font-black text-xs sm:text-sm">国内100マイルレース一覧</span>
              <span className="text-[11px] opacity-80 ml-2">（160km級・UTMB等）</span>
            </div>
          </div>
          {is100MileActive ? (
            <span className="text-[10px] font-black bg-white text-rose-700 px-2 py-0.5 rounded-full shrink-0">
              適用中 ✕
            </span>
          ) : (
            <span className="text-xs font-mono font-black opacity-70 shrink-0">抽出 ➔</span>
          )}
        </button>

        {/* 緑色: 中国5県 ＆ 四国4県 地域別一覧 */}
        <button
          type="button"
          onClick={() => onFilterFeature && onFilterFeature('all', 'all', '中国')}
          className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border-2 flex items-center justify-between text-left transition-all cursor-pointer select-none ${
            isRegionCardActive
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/50 font-black'
              : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 font-bold'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <div className="leading-snug">
              <span className="font-black text-xs sm:text-sm">中国5県 ＆ 四国4県 地域別一覧</span>
              <span className="text-[11px] opacity-80 ml-2">（地元密着・中四国大会）</span>
            </div>
          </div>
          {isRegionCardActive ? (
            <span className="text-[10px] font-black bg-white text-emerald-800 px-2 py-0.5 rounded-full shrink-0">
              適用中 ✕
            </span>
          ) : (
            <span className="text-xs font-mono font-black opacity-70 shrink-0">抽出 ➔</span>
          )}
        </button>

        {/* 藍色: ARWS & ARWC 世界のアドベンチャーレース（4日以上） */}
        <button
          type="button"
          onClick={() => onFilterFeature && onFilterFeature('adventure', 'arws')}
          className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border-2 flex items-center justify-between text-left transition-all cursor-pointer select-none ${
            isArwsActive
              ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400/50 font-black'
              : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800 hover:bg-indigo-100 font-bold'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
            <div className="leading-snug">
              <span className="font-black text-xs sm:text-sm">🌍 ARWS・ARWC 世界最高峰レース</span>
              <span className="text-[11px] opacity-80 ml-2">（4日以上・500km〜遠征型）</span>
            </div>
          </div>
          {isArwsActive ? (
            <span className="text-[10px] font-black bg-white text-indigo-800 px-2 py-0.5 rounded-full shrink-0">
              適用中 ✕
            </span>
          ) : (
            <span className="text-xs font-mono font-black opacity-70 shrink-0">抽出 ➔</span>
          )}
        </button>
      </div>

      {/* PC表示：4連ビジュアルピックアップカード */}
      <div className="hidden lg:grid grid-cols-4 gap-4">
        {/* カード1: とれとれバイク＆AR関西・全国アドベンチャー特集 */}
        <div
          onClick={onFilterAdventure}
          className={`group relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer bg-gradient-to-br from-slate-900 via-slate-850 to-amber-950 text-white p-5 flex flex-col justify-between min-h-[225px] select-none ${
            isAdventureActive
              ? 'border-amber-400 ring-4 ring-amber-500/40 shadow-xl scale-[1.01]'
              : 'border-slate-800 shadow-sm hover:shadow-md hover:border-slate-700'
          }`}
          title={isAdventureActive ? 'クリックでアドベンチャー絞り込みを解除' : 'クリックでアドベンチャー＆読図大会を抽出'}
        >
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />

          <div>
            <div className="flex items-center justify-between gap-1.5 mb-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black transition-colors ${
                  isAdventureActive ? 'bg-amber-300 text-slate-950 shadow-xs' : 'bg-amber-400 text-slate-950'
                }`}
              >
                {isAdventureActive ? <Check className="w-3 h-3 stroke-[3]" /> : <Sparkles className="w-3 h-3 fill-current" />}
                とれとれ・AR
              </span>

              {isAdventureActive ? (
                <span className="text-[10px] font-black bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs animate-pulse">
                  <span>適用中</span>
                  <X className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              ) : (
                <span className="text-[11px] font-mono text-amber-300 font-extrabold">2.5万図必携</span>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-black text-white group-hover:text-amber-300 transition-colors leading-snug">
              2.5万分の1地形図で挑む！<br />アドベンチャー＆ロゲイニング
            </h3>

            <p className="text-[12px] text-slate-200 font-medium mt-1.5 line-clamp-2 leading-relaxed">
              上山棚田・保津峡・奈良吉野川・富栖・レイドオブシディアン・まんのう等を完全網羅。
            </p>
          </div>

          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/15">
            <span
              className={`text-xs font-extrabold flex items-center gap-1 transition-colors ${
                isAdventureActive ? 'text-white bg-amber-600/60 px-2 py-0.5 rounded-lg border border-amber-400/60' : 'text-amber-300'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>{isAdventureActive ? '解除' : '一覧へ'}</span>
              {isAdventureActive ? (
                <X className="w-3 h-3 ml-0.5" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              )}
            </span>

            <a
              href="http://toretore.web.fc2.com/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] font-extrabold px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 text-white flex items-center gap-0.5 transition-colors"
            >
              <span>公式HP</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* カード2: 国内100マイル（160km）レース完全網羅 */}
        <div
          onClick={() => onFilterFeature && onFilterFeature('all', '100mile')}
          className={`group relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer bg-gradient-to-br from-rose-950 via-slate-900 to-amber-950 text-white p-5 flex flex-col justify-between min-h-[225px] select-none ${
            is100MileActive
              ? 'border-rose-400 ring-4 ring-rose-500/40 shadow-xl scale-[1.01]'
              : 'border-slate-800 shadow-sm hover:shadow-md hover:border-slate-700'
          }`}
          title={is100MileActive ? 'クリックで100マイル絞り込みを解除' : 'クリックで国内100マイルレースを抽出'}
        >
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-rose-500/20 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />

          <div>
            <div className="flex items-center justify-between gap-1.5 mb-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black transition-colors ${
                  is100MileActive ? 'bg-rose-300 text-slate-950 shadow-xs' : 'bg-rose-400 text-slate-950'
                }`}
              >
                {is100MileActive ? <Check className="w-3 h-3 stroke-[3]" /> : <Crown className="w-3 h-3 fill-current" />}
                国内100マイル一覧
              </span>

              {is100MileActive ? (
                <span className="text-[10px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs animate-pulse">
                  <span>適用中</span>
                  <X className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              ) : (
                <span className="text-[11px] font-mono text-rose-300 font-extrabold">160km級</span>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-black text-white group-hover:text-rose-300 transition-colors leading-snug">
              Mt.FUJI 100・Hiroshima UTMB・信越五岳・FTR ほか
            </h3>

            <p className="text-[12px] text-slate-200 font-medium mt-1.5 line-clamp-2 leading-relaxed">
              全国の主要100マイラー憧れの舞台から、彩の国・KOUMI100・DEEP JAPANまで完全収録！
            </p>
          </div>

          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/15">
            <span
              className={`text-xs font-extrabold flex items-center gap-1 transition-colors ${
                is100MileActive ? 'text-white bg-rose-600/60 px-2 py-0.5 rounded-lg border border-rose-400/60' : 'text-rose-300'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>{is100MileActive ? '解除' : '100マイル表示'}</span>
              {is100MileActive ? (
                <X className="w-3 h-3 ml-0.5" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              )}
            </span>
          </div>
        </div>

        {/* カード3: 中国地方＆四国地方 徹底網羅 */}
        <div
          onClick={() => onFilterFeature && onFilterFeature('all', 'all', '中国')}
          className={`group relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer bg-gradient-to-br from-teal-950 via-slate-900 to-sky-950 text-white p-5 flex flex-col justify-between min-h-[225px] select-none ${
            isRegionCardActive
              ? 'border-emerald-400 ring-4 ring-emerald-500/40 shadow-xl scale-[1.01]'
              : 'border-slate-800 shadow-sm hover:shadow-md hover:border-slate-700'
          }`}
          title="クリックで中国地方または四国地方を抽出（再度クリックで解除）"
        >
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-teal-500/20 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />

          <div>
            <div className="flex items-center justify-between gap-1.5 mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-emerald-400 text-slate-950">
                ⛰️ 中国＆四国
              </span>

              {isChugokuActive ? (
                <span className="text-[10px] font-black bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs animate-pulse">
                  <span>中国中</span>
                  <X className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              ) : isShikokuActive ? (
                <span className="text-[10px] font-black bg-sky-400 text-slate-950 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs animate-pulse">
                  <span>四国中</span>
                  <X className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              ) : (
                <span className="text-[11px] font-mono text-emerald-300 font-extrabold">中四国密着</span>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-black text-white group-hover:text-emerald-300 transition-colors leading-snug">
              中国5県 ＆ 四国4県<br />地域別主要大会一覧
            </h3>

            <p className="text-[12px] text-slate-200 font-medium mt-1.5 line-clamp-2 leading-relaxed">
              恐羅漢・比婆山・もみじ・那岐・秋吉台・石鎚山・千羽海崖・四万十川などを網羅。
            </p>
          </div>

          <div className="flex items-center justify-between gap-1.5 mt-3 pt-2.5 border-t border-white/15">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFilterFeature && onFilterFeature('all', 'all', '中国');
              }}
              className={`text-[11px] font-extrabold px-2 py-1 rounded flex items-center gap-0.5 transition-all cursor-pointer ${
                isChugokuActive
                  ? 'bg-white text-emerald-950 font-black ring-2 ring-emerald-400 shadow-sm'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              {isChugokuActive ? <Check className="w-3 h-3 stroke-[3]" /> : <Mountain className="w-3 h-3" />}
              <span>{isChugokuActive ? '中国解除' : '中国地方'}</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFilterFeature && onFilterFeature('all', 'all', '四国');
              }}
              className={`text-[11px] font-extrabold px-2 py-1 rounded flex items-center gap-0.5 transition-all cursor-pointer ${
                isShikokuActive
                  ? 'bg-white text-sky-950 font-black ring-2 ring-sky-400 shadow-sm'
                  : 'bg-sky-400 hover:bg-sky-300 text-slate-950'
              }`}
            >
              {isShikokuActive ? <Check className="w-3 h-3 stroke-[3]" /> : <Mountain className="w-3 h-3" />}
              <span>{isShikokuActive ? '四国解除' : '四国地方'}</span>
            </button>
          </div>
        </div>

        {/* カード4: ARWS & ARWC 世界のアドベンチャーレース（4日以上・世界選手権予選＆世界選手権） */}
        <div
          onClick={() => onFilterFeature && onFilterFeature('adventure', 'arws')}
          className={`group relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 text-white p-5 flex flex-col justify-between min-h-[225px] select-none ${
            isArwsActive
              ? 'border-indigo-400 ring-4 ring-indigo-500/40 shadow-xl scale-[1.01]'
              : 'border-slate-800 shadow-sm hover:shadow-md hover:border-slate-700'
          }`}
          title={isArwsActive ? 'クリックでARWS/ARWC絞り込みを解除' : 'クリックでARWS/ARWC 4日以上の世界最高峰レースを抽出'}
        >
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />

          <div>
            <div className="flex items-center justify-between gap-1.5 mb-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black transition-colors ${
                  isArwsActive ? 'bg-indigo-300 text-slate-950 shadow-xs' : 'bg-indigo-400 text-slate-950'
                }`}
              >
                <Globe className="w-3 h-3" />
                ARWS & ARWC
              </span>

              {isArwsActive ? (
                <span className="text-[10px] font-black bg-indigo-500 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs animate-pulse">
                  <span>適用中</span>
                  <X className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              ) : (
                <span className="text-[11px] font-mono text-indigo-300 font-extrabold">4日以上・世界戦</span>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-black text-white group-hover:text-indigo-300 transition-colors leading-snug">
              世界最高峰アドベンチャー！<br />ワールドシリーズ＆世界選手権
            </h3>

            <p className="text-[12px] text-slate-200 font-medium mt-1.5 line-clamp-2 leading-relaxed">
              MAGNIficent(NZ)・パタゴニア・クロアチア世界選手権など4日以上の極限遠征レース！
            </p>
          </div>

          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/15">
            <span
              className={`text-xs font-extrabold flex items-center gap-1 transition-colors ${
                isArwsActive ? 'text-white bg-indigo-600/60 px-2 py-0.5 rounded-lg border border-indigo-400/60' : 'text-indigo-300'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{isArwsActive ? '解除' : 'ARWS一覧へ'}</span>
              {isArwsActive ? (
                <X className="w-3 h-3 ml-0.5" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              )}
            </span>

            <a
              href="https://arworldseries.com/races"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] font-extrabold px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 text-white flex items-center gap-0.5 transition-colors"
            >
              <span>公式HP</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
