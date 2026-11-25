import React, { useEffect, useState } from 'react';
import {
  X,
  HelpCircle,
  Search,
  MapPin,
  Star,
  CalendarPlus,
  Filter,
  Bookmark,
  SlidersHorizontal,
  Sparkles,
  CheckCircle2,
  Share2,
  Check,
  Clock,
  ShieldCheck,
  Map as MapIcon,
  Play,
  BookOpen,
} from 'lucide-react';

interface HowToUseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToUseModal: React.FC<HowToUseModalProps> = ({ isOpen, onClose }) => {
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyGuideUrl = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('guide', '1');
      url.hash = '#/';
      await navigator.clipboard.writeText(url.toString());
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // クリップボード非対応環境では無視
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-2.5 sm:p-4 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-use-modal-title"
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-teal-200" />
            </div>
            <div className="min-w-0">
              <h2
                id="how-to-use-modal-title"
                className="text-base sm:text-lg font-black tracking-tight truncate"
              >
                かんたん使い方マニュアル
              </h2>
              <p className="text-[11px] sm:text-xs text-teal-100 font-medium truncate">
                「日本地図から探す → 条件絞り込み → 会場確認 → カレンダー登録」まで1分で完結！
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyGuideUrl}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors cursor-pointer"
              title="このマニュアルを直接開くURLをコピー"
            >
              {copiedUrl ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>コピー済み</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>マニュアルURLを共有</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
              aria-label="使い方マニュアルを閉じる"
              title="閉じる (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* スクロール可能な本文エリア */}
        <div className="overflow-y-auto px-4 sm:px-6 py-5 space-y-6 text-slate-800 dark:text-slate-200">
          {/* セクション1：最速4ステップ */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 text-[11px] font-black">
                まずはこれだけ！
              </span>
              <h3 className="text-sm sm:text-base font-black text-slate-950 dark:text-white">
                1分でできる最速4ステップ
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    地図＆条件で探す
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  <strong>「全国マップ」</strong>から日本地図で選ぶか、競技ジャンル・エリア・距離で狙いの大会を一瞬で抽出します。
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    地図で場所を確認
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  大会の<strong>都道府県・エリア名</strong>を押すと、Googleマップの集合場所へ直行します。
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[11px] font-black flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    お気に入り登録
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  <strong>★ボタン</strong>を押すと上部にカウントダウンと必携装備の準備率が出現します。
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                    4
                  </span>
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    カレンダーに一発登録
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  <strong>カレンダーボタン</strong>から、開催日やエントリー締切を自分の予定表へ即追加！
                </p>
              </div>
            </div>
          </section>

          {/* 新設特集セクション：日本地図から探す（全国レースマップ）の使い方 */}
          <section className="rounded-2xl bg-gradient-to-br from-teal-50 via-emerald-50/70 to-sky-50 dark:from-teal-950/50 dark:via-emerald-950/40 dark:to-slate-900 border-2 border-teal-300 dark:border-teal-700 p-4 space-y-3 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-black text-teal-950 dark:text-teal-100 flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-teal-600 text-white shrink-0">
                  <MapIcon className="w-4 h-4" />
                </span>
                <span>日本地図から探す（全国レースマップ）の使い方</span>
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-teal-700 text-white text-[10px] font-black tracking-wide">
                3段階ズーム対応
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] sm:text-xs text-slate-700 dark:text-slate-200">
              <div className="p-3 rounded-xl bg-white/85 dark:bg-slate-900/75 border border-teal-200/80 dark:border-teal-800/70">
                <p className="font-black text-slate-950 dark:text-white mb-1">
                  ① 全国 → 地方 → 県内ピンの3段階ズーム
                </p>
                <p className="leading-relaxed">
                  上部の<strong>「全国マップ」</strong>ボタンから地図を開き、気になる<strong>地方 → 都道府県</strong>をタップすると滑らかにズームします。地図左上の大きな<strong>「← 戻る」</strong>ボタンで1つ前の画面へ戻れます。
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/85 dark:bg-slate-900/75 border border-teal-200/80 dark:border-teal-800/70">
                <p className="font-black text-slate-950 dark:text-white mb-1">
                  ② 4色×4形状マーカーで競技が一目瞭然
                </p>
                <p className="leading-relaxed mb-1.5">
                  地図上の開催地ドットは種目ごとに色と形が分かれています。
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white">● トレイル</span>
                  <span className="px-1.5 py-0.5 rounded bg-sky-600 text-white">◆ サイクル</span>
                  <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white">■ マラソン</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">★ AR</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/85 dark:bg-slate-900/75 border border-teal-200/80 dark:border-teal-800/70">
                <p className="font-black text-slate-950 dark:text-white mb-1">
                  ③ 県内ピンから詳細確認 ＆ 一覧へ引き継ぎ
                </p>
                <p className="leading-relaxed">
                  県内マップのピンを押すと大会名・開催日・受付状況が表示され、詳細画面の確認や<strong>「このエリアで大会一覧を絞り込む」</strong>からトップ一覧へ条件を引き継げます。
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/85 dark:bg-slate-900/75 border border-teal-200/80 dark:border-teal-800/70">
                <p className="font-black text-slate-950 dark:text-white mb-1">
                  ④ 地図上でのリアルタイム絞り込み
                </p>
                <p className="leading-relaxed">
                  地図ページ上部のフィルターで<strong>種目・受付中のみ・開催時期</strong>を切り替えると、地図上の開催地ドットや都道府県別の件数もリアルタイムに連動します。
                </p>
              </div>
            </div>
          </section>

          {/* セクション2：便利な機能ボタン早見表 */}
          <section>
            <h3 className="text-sm sm:text-base font-black text-slate-950 dark:text-white mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>見逃しがちな便利機能・ボタン早見表</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* カレンダー追加 */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shrink-0">
                  <CalendarPlus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white">
                    カレンダー追加（Google / iPhone）
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    <strong>大会開催日</strong>だけでなく、<strong>エントリー開始日・締切日</strong>もワンクリックでGoogleカレンダーに登録できます。iPhone / Outlook向けの <code>.ics</code> 保存にも対応。
                  </p>
                </div>
              </div>

              {/* マップ直行 */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60">
                <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700 shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white">
                    エリア名タップでGoogleマップ直行
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    一覧やカードに表示されている<strong>都道府県・エリア名</strong>はボタンになっています。クリックすると会場・集合場所のGoogleマップが直接開き、移動距離の確認に便利です。
                  </p>
                </div>
              </div>

              {/* お気に入り＆カウントダウン */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shrink-0">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white">
                    お気に入り → カウントダウン＆装備管理
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    ★を付けた大会は「お気に入りのみ表示」で比較できるほか、上部に<strong>「あと◯日」カウントダウン</strong>と<strong>必携装備の準備率</strong>が自動で表示されます。
                  </p>
                </div>
              </div>

              {/* 競技3段階タップ */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/60">
                <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-700 shrink-0">
                  <Filter className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white">
                    競技ジャンルの3段階タップ（除外検索）
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    競技ボタンは押すたびに <strong>①これだけ表示 → ②これを除外 → ③元通り</strong> と切り替わります。「ロードバイク以外を見たい」などの絞り込みが一瞬です。
                  </p>
                </div>
              </div>

              {/* プリセット＆自動保存 */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60">
                <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700 shrink-0">
                  <Bookmark className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white">
                    検索条件の自動保存 ＆ マイプリセット
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    前回の絞り込み条件は次回アクセス時に自動で復元されます。よく使う条件はプリセットとして名前を付けて保存しておくとワンタップで呼び出せます。
                  </p>
                </div>
              </div>

              {/* 表示切替＆キーワード */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shrink-0">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white">
                    一覧／カード・PC版／スマホ版・ダーク切替
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    一覧テーブル表示とカード表示の切替、スマホからPC版一覧への切替、目に優しいダークモード切替もヘッダーや検索パネルからいつでも変更できます。
                  </p>
                </div>
              </div>

              {/* 毎日変わる開催地の風景 ＆ 今日の景色ボタン */}
              <div className="md:col-span-2 flex items-start gap-3 p-3.5 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/60">
                <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700 shrink-0">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white">
                    毎日変わる開催地の風景 ＆「今日の景色」ボタン
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    1日1回目のアクセス時に、近日開催大会の風景を使ったオープニング演出が流れます。ページ最上部の<strong>「▶ 今日の景色」</strong>ボタンからいつでも見返せるほか、<strong>「本日の背景」</strong>バッジからその開催地の大会詳細も確認できます。
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* セクション3：知っていると便利な小ワザ ＆ 安心ポイント */}
          <section className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 p-3.5 sm:p-4 space-y-2.5">
            <h3 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white flex items-center gap-1.5">
              <Search className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>知っていると便利な小ワザ・安心ポイント</span>
            </h3>
            <ul className="space-y-2 text-[11px] sm:text-xs text-slate-700 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <span>
                  <strong>キーワード検索は装備名・会場名にも対応：</strong>大会名だけでなく「ヘッドライト」「熊鈴」「100マイル」「阿蘇」などで横断検索できます。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <span>
                  <strong>大会をクリックで詳細＆必携品チェック：</strong>各大会を押すと詳細画面が開き、必携装備のチェックリスト管理や該当ギアの楽天特価確認ができます。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>会員登録不要・完全無料：</strong>お気に入りや装備チェックはお使いのブラウザ内に自動保存されます（※別の端末やブラウザとは同期されません）。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                <span>
                  <strong>毎朝自動アップデート：</strong>新着大会の追加、受付開始・締切間近の自動判定、特価ギア情報を毎日自動で更新しています。
                </span>
              </li>
            </ul>
          </section>
        </div>

        {/* フッター */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-950/70 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium text-center sm:text-left">
            見返したいときは、画面上部の <strong className="text-sky-700 dark:text-sky-300">「? マニュアル / 使い方マニュアル」</strong> ボタンからいつでも開けます。
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs sm:text-sm shadow-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            さっそく使ってみる
          </button>
        </div>
      </div>
    </div>
  );
};
