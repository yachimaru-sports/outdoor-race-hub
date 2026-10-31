import React from 'react';
import { Compass, ExternalLink, Bike, ArrowRight, Mountain, Sparkles, Crown } from 'lucide-react';

interface ToretoreBannerProps {
  onFilterAdventure: () => void;
  onFilterFeature?: (category: string, featureTag: string, region?: string) => void;
}

export const ToretoreBanner: React.FC<ToretoreBannerProps> = ({
  onFilterAdventure,
  onFilterFeature,
}) => {
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
            — アドベンチャー・国内100マイル・中国＆四国エリア完全網羅
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-xs font-black text-slate-500 dark:text-slate-400 mr-0.5">
            情報元・検索ポータル:
          </span>

          <a
            href="https://runnet.jp/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-black text-blue-900 dark:text-blue-200 hover:underline bg-blue-50 dark:bg-blue-950/60 px-3 py-1.5 rounded-full border border-blue-300 dark:border-blue-700 shadow-2xs transition-all hover:bg-blue-100 dark:hover:bg-blue-900/60"
            title="日本最大のランニング・トレイルラン総合ポータル RUNNET"
          >
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>RUNNET (ランネット)</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <a
            href="https://moshicom.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-900 dark:text-emerald-200 hover:underline bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-full border border-emerald-300 dark:border-emerald-700 shadow-2xs transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
            title="イベント・練習会・エントリー募集サイト e-moshicom（イー・モシコム）"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>e-moshicom (モシコム)</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <a
            href="https://www.sportsentry.ne.jp/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-black text-orange-900 dark:text-orange-200 hover:underline bg-orange-50 dark:bg-orange-950/60 px-3 py-1.5 rounded-full border border-orange-300 dark:border-orange-700 shadow-2xs transition-all hover:bg-orange-100 dark:hover:bg-orange-900/60"
            title="サイクリング・アドベンチャー・マラソンエントリー SPORTS ENTRY"
          >
            <span className="w-2 h-2 rounded-full bg-orange-600" />
            <span>スポーツエントリー</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <a
            href="http://toretore.web.fc2.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-900 dark:text-amber-300 hover:underline bg-amber-100 dark:bg-amber-950/60 px-3 py-1.5 rounded-full border border-amber-300 dark:border-amber-700 shadow-2xs transition-all hover:bg-amber-200 dark:hover:bg-amber-900/60"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>とれとれバイク関西 公式HP</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <a
            href="https://kochi-navigms.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-900 dark:text-teal-300 hover:underline bg-teal-50 dark:bg-teal-950/50 px-3 py-1.5 rounded-full border border-teal-300 dark:border-teal-800 shadow-2xs transition-all hover:bg-teal-100 dark:hover:bg-teal-900/60"
            title="ナビゲーションゲーム（kochi-navigms.com）"
          >
            <Compass className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
            <span>ナビゲーションゲーム</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* 3連ビジュアルピックアップカード */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* カード1: とれとれバイク＆AR関西・全国アドベンチャー特集 */}
        <div
          onClick={onFilterAdventure}
          className="group relative rounded-2xl overflow-hidden border-2 border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer bg-gradient-to-br from-slate-900 via-slate-850 to-amber-950 text-white p-5 sm:p-6 flex flex-col justify-between min-h-[205px]"
        >
          <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-amber-500/20 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />

          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950">
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                とれとれバイク・読図・AR
              </span>
              <span className="text-xs font-mono text-amber-300 font-extrabold">2.5万図必携</span>
            </div>

            <h3 className="text-base sm:text-lg font-black text-white group-hover:text-amber-300 transition-colors leading-snug">
              2.5万分の1地形図で挑む！<br />アドベンチャー＆ロゲイニング・OMM
            </h3>

            <p className="text-xs sm:text-[13px] text-slate-200 font-medium mt-2 line-clamp-2 leading-relaxed">
              上山棚田・保津峡・奈良吉野川・富栖・レイドオブシディアン・岩村ラリー・神鍋高原・まんのう・OMM JAPAN等を完全網羅。
            </p>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/15">
            <span className="text-xs sm:text-sm font-extrabold text-amber-300 flex items-center gap-1">
              <Bike className="w-4 h-4" />
              アドベンチャー・読図一覧へ
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>

            <a
              href="http://toretore.web.fc2.com/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-extrabold px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center gap-1 transition-colors"
            >
              <span>公式HP</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* カード2: 国内100マイル（160km）レース完全網羅 */}
        <div
          onClick={() => onFilterFeature && onFilterFeature('all', '100mile')}
          className="group relative rounded-2xl overflow-hidden border-2 border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer bg-gradient-to-br from-rose-950 via-slate-900 to-amber-950 text-white p-5 sm:p-6 flex flex-col justify-between min-h-[205px]"
        >
          <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-rose-500/20 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />

          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-400 text-slate-950">
                <Crown className="w-3.5 h-3.5 fill-current" />
                国内100マイルレース一覧
              </span>
              <span className="text-xs font-mono text-rose-300 font-extrabold">160km級 網羅</span>
            </div>

            <h3 className="text-base sm:text-lg font-black text-white group-hover:text-rose-300 transition-colors leading-snug">
              Mt.FUJI 100・Hiroshima UTMB・信越五岳・GGR石切場・球磨川・FTR ほか
            </h3>

            <p className="text-xs sm:text-[13px] text-slate-200 font-medium mt-2 line-clamp-2 leading-relaxed">
              全国の主要100マイラー憧れの舞台から、彩の国・KOUMI100・DEEP JAPAN・OSJ ONTAKE100まで国内100マイル戦を完全収録！
            </p>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/15">
            <span className="text-xs sm:text-sm font-extrabold text-rose-300 flex items-center gap-1">
              <Crown className="w-4 h-4" />
              「100マイルレース」をすべて表示
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </div>
        </div>

        {/* カード3: 中国地方＆四国地方 徹底網羅 */}
        <div
          onClick={() => onFilterFeature && onFilterFeature('all', 'all', '中国')}
          className="group relative rounded-2xl overflow-hidden border-2 border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer bg-gradient-to-br from-teal-950 via-slate-900 to-sky-950 text-white p-5 sm:p-6 flex flex-col justify-between min-h-[205px]"
        >
          <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-teal-500/20 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />

          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-400 text-slate-950">
                ⛰️ 中国5県 ＆ 四国4県 地域別一覧
              </span>
              <span className="text-xs font-mono text-emerald-300 font-extrabold">地元密着</span>
            </div>

            <h3 className="text-base sm:text-lg font-black text-white group-hover:text-emerald-300 transition-colors leading-snug">
              中国地方（広島・岡山・山口・島根・鳥取）＆ 四国（愛媛・香川・徳島・高知）
            </h3>

            <p className="text-xs sm:text-[13px] text-slate-200 font-medium mt-2 line-clamp-2 leading-relaxed">
              恐羅漢・比婆山・もみじ・那岐・摩利支天・秋吉台・剣山・石鎚山・千羽海崖・四万十川・しまなみ海道など中四国の名大会を網羅。
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-white/15">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFilterFeature && onFilterFeature('all', 'all', '中国');
              }}
              className="text-xs font-extrabold px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Mountain className="w-3.5 h-3.5" />
              <span>中国地方を見る</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFilterFeature && onFilterFeature('all', 'all', '四国');
              }}
              className="text-xs font-extrabold px-3 py-1.5 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Mountain className="w-3.5 h-3.5" />
              <span>四国地方を見る</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
