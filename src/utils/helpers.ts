import { EventCategory, EntryStatus } from '../types';

export const CATEGORY_LABELS: Record<
  EventCategory,
  {
    label: string;
    shortLabel: string;
    desc: string;
    color: string;
    badgeBg: string;
    accentBg: string;
  }
> = {
  adventure: {
    label: 'アドベンチャー / 読図・ロゲ',
    shortLabel: 'アドベンチャー・読図',
    desc: 'とれとれバイク・AR関西・OMM・ロゲイニング',
    color: 'text-amber-800 dark:text-amber-300',
    badgeBg:
      'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700',
    accentBg: 'bg-amber-500',
  },
  trail: {
    label: 'トレイルランニング',
    shortLabel: 'トレイルラン',
    desc: '100マイル・100km・ミドル・ショート・VK',
    color: 'text-teal-800 dark:text-teal-300',
    badgeBg:
      'bg-teal-100 text-teal-950 border-teal-300 dark:bg-teal-950/60 dark:text-teal-200 dark:border-teal-700',
    accentBg: 'bg-teal-600',
  },
  cycling: {
    label: 'サイクリング / ロングライド',
    shortLabel: 'サイクリング',
    desc: 'ロングライド・ヒルクライム・グラベル・ロード',
    color: 'text-sky-800 dark:text-sky-300',
    badgeBg:
      'bg-sky-100 text-sky-950 border-sky-300 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-700',
    accentBg: 'bg-sky-600',
  },
  marathon: {
    label: 'マラソン / ウルトラ',
    shortLabel: 'マラソン・ウルトラ',
    desc: '100kmウルトラ・フルマラソン・ジャーニーラン',
    color: 'text-indigo-800 dark:text-indigo-300',
    badgeBg:
      'bg-indigo-100 text-indigo-950 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-700',
    accentBg: 'bg-indigo-600',
  },
};

export const ELEMENT_BADGES: Record<string, { icon: string; label: string; style: string }> = {
  '100マイル': {
    icon: '👑',
    label: '100マイル(160km)',
    style:
      'bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-700',
  },
  '100km+': {
    icon: '🔥',
    label: '100km級ウルトラ',
    style:
      'bg-orange-100 text-orange-950 border-orange-300 dark:bg-orange-950/70 dark:text-orange-200 dark:border-orange-700',
  },
  '読図': {
    icon: '🧭',
    label: '2.5万図・読図',
    style:
      'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700',
  },
  'MTB': {
    icon: '🚵',
    label: 'MTB必須',
    style:
      'bg-yellow-100 text-yellow-950 border-yellow-300 dark:bg-yellow-950/70 dark:text-yellow-200 dark:border-yellow-700',
  },
  'パドル': {
    icon: '🚣',
    label: 'カヤック/ラフト',
    style:
      'bg-cyan-100 text-cyan-950 border-cyan-300 dark:bg-cyan-950/70 dark:text-cyan-200 dark:border-cyan-700',
  },
  'ロゲイニング': {
    icon: '🗺️',
    label: 'ロゲイニング',
    style:
      'bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700',
  },
  'オリエンテーリング': {
    icon: '🚩',
    label: 'オリエンテーリング',
    style:
      'bg-lime-100 text-lime-950 border-lime-300 dark:bg-lime-950/70 dark:text-lime-200 dark:border-lime-700',
  },
  '夜間': {
    icon: '🔦',
    label: '夜間行動あり',
    style:
      'bg-purple-100 text-purple-950 border-purple-300 dark:bg-purple-950/70 dark:text-purple-200 dark:border-purple-700',
  },
  'トレック': {
    icon: '⛰️',
    label: '山岳トレック',
    style:
      'bg-teal-100 text-teal-950 border-teal-300 dark:bg-teal-950/70 dark:text-teal-200 dark:border-teal-700',
  },
  'ロード': {
    icon: '🛣️',
    label: 'オンロード',
    style:
      'bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  },
  '日帰り': {
    icon: '☀️',
    label: '1日完結',
    style:
      'bg-sky-100 text-sky-950 border-sky-300 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-700',
  },
};

export const ENTRY_STATUS_CONFIG: Record<
  EntryStatus,
  { label: string; badge: string; dot: string; pulse?: boolean }
> = {
  open: {
    label: 'エントリー受付中',
    badge:
      'bg-emerald-100 text-emerald-950 border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-500/50 font-extrabold',
    dot: 'bg-emerald-600 dark:bg-emerald-400',
  },
  closing_soon: {
    label: '締切間近',
    badge:
      'bg-rose-100 text-rose-950 border-rose-400 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-500/60 font-extrabold',
    dot: 'bg-rose-600',
    pulse: true,
  },
  upcoming: {
    label: '告知・準備中',
    badge:
      'bg-sky-100 text-sky-950 border-sky-300 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-700/60 font-bold',
    dot: 'bg-sky-600 dark:bg-sky-400',
  },
  closed: {
    label: '受付終了',
    badge:
      'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700 font-bold',
    dot: 'bg-slate-500 dark:bg-slate-500',
  },
};

export const REGIONS = ['中国', '四国', '近畿', '中部', '関東', '甲信越', '九州', '東北', '北海道'];

export const PREFECTURES = [
  // 中国地方（全5県）
  '広島県',
  '岡山県',
  '山口県',
  '島根県',
  '鳥取県',
  // 四国地方（全4県）
  '愛媛県',
  '香川県',
  '徳島県',
  '高知県',
  // 近畿地方
  '京都府',
  '奈良県',
  '兵庫県',
  '滋賀県',
  '大阪府',
  '和歌山県',
  '三重県',
  // 中部・甲信越・関東・その他主要道県
  '岐阜県',
  '静岡県',
  '長野県',
  '山梨県',
  '新潟県',
  '富山県',
  '石川県',
  '福井県',
  '東京都',
  '神奈川県',
  '埼玉県',
  '群馬県',
  '栃木県',
  '福岡県',
  '熊本県',
  '大分県',
  '宮崎県',
  '鹿児島県',
  '沖縄県',
  '宮城県',
  '岩手県',
  '秋田県',
  '山形県',
  '福島県',
  '北海道',
];

export function formatDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[0]}年${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function formatPrice(num: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(num);
}
