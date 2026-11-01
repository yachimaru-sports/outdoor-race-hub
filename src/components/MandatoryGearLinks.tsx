import React from 'react';
import { GearItem } from '../types';
import { ExternalLink, Bookmark, Flame } from 'lucide-react';

interface MandatoryGearLinksProps {
  gear: GearItem | null;
  size?: 'sm' | 'md';
  showDetailOnHover?: boolean;
}

export const MandatoryGearLinks: React.FC<MandatoryGearLinksProps> = ({
  gear,
  size = 'sm',
}) => {
  if (!gear) return null;

  const hasSpecialDeal = Boolean(
    gear.discountRate && gear.discountRate >= 20 && gear.dealUrl
  );

  const isSmall = size === 'sm';

  return (
    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
      {/* 定番・名作モデルリンク */}
      {gear.standardUrl && (
        <a
          href={gear.standardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 font-bold rounded-lg border transition-all cursor-pointer select-none group shadow-2xs ${
            isSmall
              ? 'text-[11px] px-2 py-0.5 bg-slate-100 hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 hover:text-teal-800 dark:text-slate-300 dark:hover:text-teal-300 border-slate-300 dark:border-slate-700'
              : 'text-xs px-2.5 py-1 bg-white hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 hover:text-teal-800 dark:text-slate-200 dark:hover:text-teal-300 border-slate-300 dark:border-slate-650'
          }`}
          title={`【定番おすすめ】${gear.title}\n${gear.standardTitle || ''}`}
        >
          <Bookmark className={`${isSmall ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-teal-600 dark:text-teal-400`} />
          <span>定番</span>
          <ExternalLink className={`${isSmall ? 'w-2.5 h-2.5' : 'w-3 h-3'} opacity-60 group-hover:opacity-100 transition-opacity`} />
        </a>
      )}

      {/* 楽天市場 特価セールリンク（割引率20%以上の場合のみ表示） */}
      {hasSpecialDeal && gear.dealUrl && (
        <a
          href={gear.dealUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 font-black rounded-lg text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 transition-all shadow-xs hover:shadow cursor-pointer select-none border border-red-500/40 ${
            isSmall
              ? 'text-[11px] px-2 py-0.5'
              : 'text-xs px-2.5 py-1'
          }`}
          title={`【楽天市場 特価最安値】${gear.title}\n割引率: ${gear.discountRate}%OFF`}
        >
          <Flame className={`${isSmall ? 'w-2.5 h-2.5' : 'w-3 h-3'} fill-white text-white shrink-0`} />
          <span>{gear.discountRate}%OFF</span>
          <ExternalLink className={`${isSmall ? 'w-2.5 h-2.5' : 'w-3 h-3'} opacity-80`} />
        </a>
      )}
    </div>
  );
};
