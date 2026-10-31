import React from 'react';
import { Mountain, ShieldCheck, Compass, ExternalLink } from 'lucide-react';
import { AccessCounter } from './AccessCounter';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-20 border-t border-slate-300 dark:border-slate-800 bg-white dark:bg-[#090d16] text-slate-600 dark:text-slate-400 text-xs py-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-800 text-white flex items-center justify-center shadow-2xs shrink-0">
              <Mountain className="w-4.5 h-4.5 stroke-[2.2]" />
            </div>
            <div>
              <span className="font-black text-sm text-slate-950 dark:text-white tracking-wider">
                OUTDOOR RACE HUB
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                アウトドア・エンデュランス競技情報 ＆ 楽天特価ギア速報ポータル
              </p>
            </div>
          </div>

          {/* 関連コミュニティ・活動紹介リンク（控えめで上品な配置） */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-bold">関連コミュニティ・活動リンク:</span>
            <a
              href="https://kochi-navigms.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-slate-800 dark:text-slate-200 hover:text-teal-800 dark:hover:text-teal-300 border border-slate-300 dark:border-slate-700 font-bold transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
              <span>ナビゲーションゲーム (kochi-navigms.com)</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            <a
              href="http://toretore.web.fc2.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-800 dark:text-slate-200 hover:text-amber-800 dark:hover:text-amber-300 border border-slate-300 dark:border-slate-700 font-bold transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>とれとれバイク関西 (AR関西)</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800/80 pt-6 text-xs text-slate-600 dark:text-slate-400 leading-relaxed space-y-2">
          <p>
            【免責事項・アフィリエイトについて】
            当サイトに掲載されている大会日程、エントリー期間、必携装備等の情報は変更される場合があります。必ず各大会の公式サイトおよびRUNNET・スポーツエントリー・e-moshicom等の公式受付ページにて最新情報をご確認ください。また、当サイトは楽天アフィリエイトプログラム等のアフィリエイト広告を利用しておすすめのギアを紹介しています。
          </p>
          {/* リアルタイム累計アクセスカウンター（中央配置） */}
          <div className="py-2 flex justify-center">
            <AccessCounter variant="footer" />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-slate-250 dark:border-slate-800">
            <div className="font-semibold">
              © {new Date().getFullYear()} OUTDOOR RACE HUB. All rights reserved.
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
              <span>GitHub Pages 完全無料ホスティング (SPA静的構成)</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
