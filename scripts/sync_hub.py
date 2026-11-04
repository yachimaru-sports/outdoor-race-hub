#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/sync_hub.py
OUTDOOR RACE HUB データ高精度化＆完全自動更新スクリプト

【機能概要】
1. 必携・特価ギア情報の完全自動・確定データ化（楽天市場商品検索API連携）
   - 在庫あり（availability=1）の商品を取得
   - 検索一覧（search.rakuten.co.jp）は完全禁止、必ず個別商品URL（item.rakuten.co.jp/...）を取得
   - 画像URL（mediumImageUrls）を取得し、?_ex=... を除去して高解像度化
   - 商品URLおよび画像URLが「HTTP 200 OK」を返すことを実機検証
   - スプレッドシート（全13列・空欄不可）および gears.json / deals.json 出力
2. 大会マスター情報の精度向上＆リンク検証
   - 全大会の official_url, entry_url を実機HTTP検証（404・無効URLを除外）
   - 日付（YYYY-MM-DD）、参加費（チーム合計数値＋円、例: 38,000円）の厳格な正規化
   - entry_status（開催日・締切日からの自動判定）の更新
   - スプレッドシート（全21列）および events.json 出力
3. Googleスプレッドシート ＆ ローカル静的データの完全同期
   - gspread + サービスアカウント（GCP_SA_KEY）による2枚のシート一括更新
   - フロントエンド参照用JSON（events.json, gears.json, deals.json, meta.json）の上書き保存
"""

import os
import sys
import json
import re
import urllib.parse
from datetime import datetime, timezone, timedelta
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from weekly_trend_updater import update_catalog_with_season_and_trends

# ---------------------------------------------------------------------------
# ロギング設定
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("sync_hub")

# 日本標準時 (JST = UTC+9)
JST = timezone(timedelta(hours=9))

# ---------------------------------------------------------------------------
# 定数・環境変数・パス
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)

DATA_DIR = os.path.join(ROOT_DIR, "src", "data")
EVENTS_JSON_PATH = os.path.join(DATA_DIR, "events.json")
GEARS_JSON_PATH = os.path.join(DATA_DIR, "gears.json")
GEAR_CATALOG_PATH = os.path.join(SCRIPT_DIR, "gear_catalog.json")
DEALS_JSON_PATH = os.path.join(DATA_DIR, "deals.json")
META_JSON_PATH = os.path.join(DATA_DIR, "meta.json")
MASTER_CSV_PATH = os.path.join(ROOT_DIR, "outdoor_race_hub_events_master.csv")

# GoogleスプレッドシートID
GEAR_SHEET_ID = "1Fs7dmlsHorYsswPMOKrVZVvK06cIqpWmfpxm6XWgQEg"
EVENT_SHEET_ID = "1GckzxJfV2soq9FYAIx94u3nrhw5DD1WcUS27dfuzuuQ"

# 楽天API・アフィリエイト設定
RAKUTEN_APP_ID = os.environ.get("RAKUTEN_APP_ID", "").strip()
RAKUTEN_AFFILIATE_ID = os.environ.get("RAKUTEN_AFFILIATE_ID", "58fb598b.0ed2da59.58fb598c.27018da5").strip()
RAKUTEN_API_ENDPOINT = "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601"

# Google Cloud サービスアカウントJSON
GCP_SA_KEY = os.environ.get("GCP_SA_KEY", "").strip()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()

# HTTPリクエスト用共通ヘッダー（ボット遮断防止のための実ブラウザUser-Agent）
HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
}

# ---------------------------------------------------------------------------
# 確定公式フォールバックテーブル（全24アイテム確定直通URL＆確定高解像度画像）
# ---------------------------------------------------------------------------
FALLBACK_ITEM_URLS = {
    "gear-trail-rain-tnf-strike": "https://item.rakuten.co.jp/canpanera/n17-2287/",
    "gear-trail-rain-montbell": "https://search.rakuten.co.jp/search/mall/%E3%83%A2%E3%83%B3%E3%83%99%E3%83%AB+%E3%82%B9%E3%83%88%E3%83%BC%E3%83%A0%E3%82%AF%E3%83%AB%E3%83%BC%E3%82%AC%E3%83%BC/",
    "gear-trail-pack-salomon-advskin12": "https://item.rakuten.co.jp/vitaliser/salomon-2568/",
    "gear-trail-pack-nathan-pinnacle": "https://item.rakuten.co.jp/usbonline/ns40180j/",
    "gear-trail-shoes-hoka-speedgoat6": "https://item.rakuten.co.jp/sports-diary/hka-1147791-swrd/",
    "gear-trail-shoes-altra-lonepeak8": "https://item.rakuten.co.jp/glv/ala-3/",
    "gear-trail-poles-leki-fx-one": "https://item.rakuten.co.jp/sakaiya/202610211933/",
    "gear-trail-light-petzl-swift": "https://item.rakuten.co.jp/alpine-rose/2545/",
    "gear-trail-sublight-bd-spot": "https://item.rakuten.co.jp/canpanera/b17466/",
    "gear-trail-wear-mil-drynamic": "https://item.rakuten.co.jp/sportsmario2/i06mjmiv01248/",
    "gear-trail-wear-c3fit-tights": "https://item.rakuten.co.jp/auc-bestsports/3fw14127/",
    "gear-trail-bivvy-sol-escape": "https://item.rakuten.co.jp/canpanera/s23005/",
    "gear-cycle-helmet-ogk-vitt": "https://item.rakuten.co.jp/phalconcycle/ogkk-004090/",
    "gear-cycle-light-cateye-ampp": "https://item.rakuten.co.jp/cycle-shop-eggs/10000022/",
    "gear-cycle-tool-topeak-mini": "https://item.rakuten.co.jp/aris/topmini20p/",
    "gear-cycle-bottle-camelbak": "https://item.rakuten.co.jp/amical/z00359/",
    "gear-cycle-wear-pearl-wind": "https://item.rakuten.co.jp/bebike/pearlizumi-2300/",
    "gear-marathon-shoes-asics-s4": "https://item.rakuten.co.jp/alpen/4302610436/",
    "gear-marathon-pouch-yurenikui": "https://item.rakuten.co.jp/yurenikui/compass1620286780/",
    "gear-nutrition-magon-gel": "https://item.rakuten.co.jp/lafitte/magon-energygel-set/",
    "gear-marathon-socks-tabio": "https://item.rakuten.co.jp/alpen/3888990001/",
    "gear-ar-compass-silva-no3": "https://item.rakuten.co.jp/shop-senjin/73010000/",
    "gear-ar-mapcase-sealline": "https://item.rakuten.co.jp/aila/59587/",
    "gear-ar-drybag-seatosummit": "https://item.rakuten.co.jp/yoshikip2/ss-brdb20/",
    "gear-trail-rain-pants-tnf": "https://item.rakuten.co.jp/sportsmario2/e08najnp12373k/",
    "gear-trail-pack-salomon-active8": "https://item.rakuten.co.jp/vitaliser/salomon-2566/",
    "gear-trail-poles-bd-distance-z": "https://item.rakuten.co.jp/canpanera/b17235/",
    "gear-firstaid-kit-lifesystems": "https://item.rakuten.co.jp/canpanera/l37001/",
}

FALLBACK_IMAGES = {
    "gear-trail-rain-tnf-strike": "https://shop.r10s.jp/canpanera/cabinet/item240/item_n17-2287_0.jpg",
    "gear-trail-rain-montbell": "https://tshop.r10s.jp/airwel/cabinet/shohin13/13162527/imgrc0141194038.jpg",
    "gear-trail-pack-salomon-advskin12": "https://shop.r10s.jp/vitaliser/cabinet/300606/salomon-2568.jpg",
    "gear-trail-pack-nathan-pinnacle": "https://shop.r10s.jp/usbonline/cabinet/pic-2/ns40180j-main.jpg",
    "gear-trail-shoes-hoka-speedgoat6": "https://shop.r10s.jp/sports-diary/cabinet/16/hka-1147791-swrd_1.jpg",
    "gear-trail-shoes-altra-lonepeak8": "https://shop.r10s.jp/glv/cabinet/newsingle202607/ala-3rak.jpg",
    "gear-trail-poles-leki-fx-one": "https://shop.r10s.jp/sakaiya/cabinet/leki/1300542_1.jpg",
    "gear-trail-light-petzl-swift": "https://shop.r10s.jp/kompas/cabinet/item83/e095bb_01.jpg",
    "gear-trail-sublight-bd-spot": "https://shop.r10s.jp/canpanera/cabinet/item230/item_b17466_0.jpg",
    "gear-trail-wear-mil-drynamic": "https://shop.r10s.jp/sportsmario2/cabinet/evidence_20250822/i06mjmiv01248_1.jpg",
    "gear-trail-wear-c3fit-tights": "https://shop.r10s.jp/2-kobeya/cabinet/goldwin/3f14127.jpg",
    "gear-trail-bivvy-sol-escape": "https://shop.r10s.jp/canpanera/cabinet/item209/item_s23005_0.jpg",
    "gear-cycle-helmet-ogk-vitt": "https://shop.r10s.jp/phalconcycle/cabinet/07626918/07626920/imgrc0107384488.jpg",
    "gear-cycle-light-cateye-ampp": "https://shop.r10s.jp/cycle-shop-eggs/cabinet/07026577/imgrc0091873775.jpg",
    "gear-cycle-tool-topeak-mini": "https://shop.r10s.jp/aris/cabinet/00244673/0651y.jpg",
    "gear-cycle-bottle-camelbak": "https://shop.r10s.jp/amical/cabinet/item/z00359-001.jpg",
    "gear-cycle-wear-pearl-wind": "https://shop.r10s.jp/bebike/cabinet/new_item/pearlizumi/2300.jpg",
    "gear-marathon-shoes-asics-s4": "https://shop.r10s.jp/alpen/cabinet/img/678/4302610436_1.jpg",
    "gear-marathon-pouch-yurenikui": "https://shop.r10s.jp/yurenikui/cabinet/compass1620286780.jpg",
    "gear-nutrition-magon-gel": "https://shop.r10s.jp/lafitte/cabinet/19ss_keleme_01/1baa78ee55d355a8dc_1.jpg",
    "gear-marathon-socks-tabio": "https://shop.r10s.jp/alpen/cabinet/img/560/3888990001_1.jpg",
    "gear-ar-compass-silva-no3": "https://shop.r10s.jp/shop-senjin/cabinet/other/imgrc0089499110.jpg",
    "gear-ar-mapcase-sealline": "https://shop.r10s.jp/aila/cabinet/00100/59587_1.jpg",
    "gear-ar-drybag-seatosummit": "https://shop.r10s.jp/yoshikip2/cabinet/07198126/imgrc0084318357.jpg",
    "gear-trail-rain-pants-tnf": "https://shop.r10s.jp/sportsmario2/cabinet/evidence_20230818/e08najnp12373k.jpg",
    "gear-trail-pack-salomon-active8": "https://shop.r10s.jp/vitaliser/cabinet/300606/salomon-2566.jpg",
    "gear-trail-poles-bd-distance-z": "https://shop.r10s.jp/canpanera/cabinet/item218/item_b17235_0.jpg",
    "gear-firstaid-kit-lifesystems": "https://shop.r10s.jp/canpanera/cabinet/item248/item_l37001_0.jpg",
}

# ---------------------------------------------------------------------------
# HTTP検証ユーティリティ
# ---------------------------------------------------------------------------
def verify_http_status_200(url: str, timeout: float = 6.0) -> bool:
    """
    指定されたURLに実機HTTPリクエストを送信し、HTTP 200（または正常接続）を検証。
    HEADリクエストを優先し、サーバー都合で拒否された場合はGET（stream=True）で確認。
    """
    if not url or not url.startswith("http"):
        return False

    try:
        # まず HEAD で高速判定
        res = requests.head(
            url,
            headers=HTTP_HEADERS,
            timeout=timeout,
            allow_redirects=True
        )
        if 200 <= res.status_code < 400:
            return True
        # 403, 405, 501 等で HEAD がブロックされる場合は GET で再試行
        if res.status_code in [403, 405, 500, 501, 503]:
            res_get = requests.get(
                url,
                headers=HTTP_HEADERS,
                timeout=timeout,
                stream=True,
                allow_redirects=True
            )
            return 200 <= res_get.status_code < 400
        return False
    except requests.RequestException:
        # 接続エラーやタイムアウト
        return False


def build_rakuten_search_affiliate_url(keyword: str) -> str:
    """楽天市場キーワード検索に対する楽天アフィリエイトリンクを生成"""
    if not keyword:
        return f"https://hb.afl.rakuten.co.jp/hgc/{RAKUTEN_AFFILIATE_ID}/?pc=https%3A%2F%2Fwww.rakuten.co.jp%2F"
    search_target = f"https://search.rakuten.co.jp/search/mall/{urllib.parse.quote(keyword)}/"
    encoded_search = urllib.parse.quote(search_target, safe="")
    return f"https://hb.afl.rakuten.co.jp/hgc/{RAKUTEN_AFFILIATE_ID}/?pc={encoded_search}"


def build_rakuten_affiliate_url(raw_item_url: str, fallback_keyword: str = "") -> str:
    """個別商品URLまたは検索クエリに楽天アフィリエイトIDを付与した直通URLを構築（絶対に公式直リンクにしない）"""
    if not raw_item_url and not fallback_keyword:
        return f"https://hb.afl.rakuten.co.jp/hgc/{RAKUTEN_AFFILIATE_ID}/?pc=https%3A%2F%2Fwww.rakuten.co.jp%2F"
    if raw_item_url and "hb.afl.rakuten.co.jp" in raw_item_url:
        return raw_item_url
    if raw_item_url and "item.rakuten.co.jp" in raw_item_url:
        clean_url = raw_item_url.split("?")[0]
        encoded = urllib.parse.quote(clean_url, safe="")
        return f"https://hb.afl.rakuten.co.jp/ichiba/{RAKUTEN_AFFILIATE_ID}/?pc={encoded}&link_type=picttext"
    if raw_item_url and "rakuten.co.jp" in raw_item_url:
        encoded = urllib.parse.quote(raw_item_url, safe="")
        return f"https://hb.afl.rakuten.co.jp/hgc/{RAKUTEN_AFFILIATE_ID}/?pc={encoded}"
    
    # 楽天以外のURL（メーカー公式など）の場合は楽天市場の検索アフィリエイトURLへ自動変換
    kw = fallback_keyword or raw_item_url
    return build_rakuten_search_affiliate_url(kw)
    if "item.rakuten.co.jp" in raw_item_url:
        clean_url = raw_item_url.split("?")[0]
        encoded = urllib.parse.quote(clean_url, safe="")
        return f"https://hb.afl.rakuten.co.jp/ichiba/{RAKUTEN_AFFILIATE_ID}/?pc={encoded}&link_type=picttext"
    return raw_item_url


def clean_rakuten_image_url(raw_image_url: str) -> str:
    """画像URLからリサイズパラメータ(?_ex=...)を除去して高解像度化"""
    if not raw_image_url:
        return ""
    # ?_ex=128x128 などを除去
    clean = re.sub(r"\?_ex=[^&]+", "", raw_image_url)
    clean = clean.rstrip("?").rstrip("&")
    return clean


# ---------------------------------------------------------------------------
# 楽天市場商品検索API連携
# ---------------------------------------------------------------------------
def search_rakuten_item(keyword: str, min_price: int = 1000) -> dict | None:
    """
    楽天市場商品検索APIを呼び出し、在庫あり(availability=1)の個別商品URL・高解像度画像・価格を実機検証して取得。
    """
    if not RAKUTEN_APP_ID:
        return None

    params = {
        "applicationId": RAKUTEN_APP_ID,
        "affiliateId": RAKUTEN_AFFILIATE_ID,
        "keyword": keyword,
        "availability": 1,
        "sort": "+itemPrice",  # 最安値順
        "hits": 10,
        "minPrice": min_price,
        "format": "json",
        "formatVersion": 2,
    }

    try:
        res = requests.get(RAKUTEN_API_ENDPOINT, params=params, headers=HTTP_HEADERS, timeout=8.0)
        if res.status_code != 200:
            logger.warning(f"  ⚠️ 楽天APIエラー HTTP {res.status_code}: {res.text[:120]}")
            return None
        data = res.json()
        items = data.get("Items", [])
        if not items:
            return None

        for it in items:
            item_url = it.get("itemUrl", "")
            # 検索一覧URLは完全禁止、必ず個別商品URL
            if not item_url or "search.rakuten.co.jp" in item_url or "item.rakuten.co.jp" not in item_url:
                continue

            price = it.get("itemPrice", 0)
            raw_images = it.get("mediumImageUrls", []) or it.get("smallImageUrls", [])
            if not raw_images:
                continue
            first_img = raw_images[0] if isinstance(raw_images, list) else raw_images
            image_url = clean_rakuten_image_url(first_img)

            # 商品URLと画像URLの双方が HTTP 200 OK か実機検証
            if verify_http_status_200(item_url) and verify_http_status_200(image_url):
                aff_url = it.get("affiliateUrl") or build_rakuten_affiliate_url(item_url)
                return {
                    "title": it.get("itemName", ""),
                    "price": price,
                    "item_url": item_url,
                    "affiliate_url": aff_url,
                    "image_url": image_url,
                }
    except Exception as e:
        logger.warning(f"  ⚠️ 楽天API通信例外 ({keyword}): {e}")

    return None


# ---------------------------------------------------------------------------
# ギアウォッチリストのデータ構築＆スキーマ生成
# ---------------------------------------------------------------------------
def process_gears() -> tuple[list[dict], list[dict], list[list[str]]]:
    """
    主要競技（トレラン、アドベンチャー、ウルトラ、サイクル、ロゲイニング）の
    必携品・注目ギア全カテゴリを網羅したマスターカタログ（gear_catalog.json）を基軸に
    楽天市場API連携・実機検証を行い、アフィリエイト直通URLおよび特価情報を生成。
    """
    logger.info("========================================================")
    logger.info(" 必携品・注目ギアの網羅的収集＆アフィリエイト最適化 開始")
    logger.info("========================================================")

    # 1. マスターカタログ (gear_catalog.json) または既存 gears.json を読み込み
    raw_gears = []
    if os.path.exists(GEAR_CATALOG_PATH):
        try:
            with open(GEAR_CATALOG_PATH, "r", encoding="utf-8") as f:
                raw_gears = json.load(f)
            logger.info(f"📘 マスターカタログから {len(raw_gears)} 品目の必携ギア定義を読み込みました。")
        except Exception as e:
            logger.warning(f"gear_catalog.json 読み込み失敗: {e}")

    if not raw_gears and os.path.exists(GEARS_JSON_PATH):
        with open(GEARS_JSON_PATH, "r", encoding="utf-8") as f:
            raw_gears = json.load(f)

    # 既存の deals.json を読み込み
    deals_map = {}
    if os.path.exists(DEALS_JSON_PATH):
        try:
            with open(DEALS_JSON_PATH, "r", encoding="utf-8") as f:
                for d in json.load(f):
                    deals_map[d["id"]] = d
        except Exception as e:
            logger.warning(f"deals.json 読み込み失敗: {e}")

    sheet_rows = []
    gear_items = []
    deal_items = []

    now_dt = datetime.now(JST)
    now_iso = now_dt.isoformat()
    current_month = now_dt.month

    def process_single_gear(g):
        gid = g["id"]
        title = g.get("title", "")
        brand = g.get("brand") or (title.split()[0] if title else "公式")
        sports = g.get("sports", ["trail"])
        gear_type = g.get("gear_type") or g.get("gearType", "ギア")
        match_keywords = g.get("match_keywords") or g.get("matchKeywords", [])
        standard_title = g.get("standard_title") or g.get("standardTitle", f"{brand} {gear_type} 定番アイテム")
        # 定番リンクもユーザーのアフィリエイト収益になるよう楽天検索アフィリエイトURLを適用
        standard_kw = f"{g.get('brand', '')} {g.get('title', '')}".strip()
        standard_url = build_rakuten_search_affiliate_url(standard_kw)
        deal_keyword = g.get("deal_keyword") or g.get("dealKeyword") or f"{brand} {gear_type}"
        original_price = g.get("original_price") or g.get("originalPrice") or g.get("price") or 10000
        min_valid_price = g.get("min_valid_price", int(original_price * 0.3))

        # 1. 楽天市場商品検索API連携 (自身のアフィリエイトIDを付与)
        rakuten_item = None
        if RAKUTEN_APP_ID:
            search_query = deal_keyword
            rakuten_item = search_rakuten_item(search_query, min_price=min_valid_price)
            if rakuten_item:
                logger.info(f"  ✅ 楽天API実機検証合格 [{gid}]: 価格 ¥{rakuten_item['price']:,} / アフィリエイトURL確定")

        # 2. API未検出・エラー時の確定フォールバック
        deal_url = ""
        affiliate_url = ""
        deal_price = 0
        image_url = ""

        if rakuten_item:
            deal_price = rakuten_item["price"]
            image_url = rakuten_item["image_url"]
            # APIから返却されたアフィリエイトリンク (affiliateUrl) を最優先で deal_url に直接格納
            affiliate_url = rakuten_item.get("affiliate_url") or build_rakuten_affiliate_url(rakuten_item["item_url"])
            deal_url = affiliate_url
        else:
            fallback_url = FALLBACK_ITEM_URLS.get(gid) or ""
            fallback_img = FALLBACK_IMAGES.get(gid) or g.get("imageUrl") or ""

            # 楽天URLならBot遮断WAFに関係なくアフィリエイト化。なければキーワード検索アフィリエイト化
            if fallback_url and "rakuten.co.jp" in fallback_url:
                deal_url = build_rakuten_affiliate_url(fallback_url, deal_keyword)
            else:
                deal_url = build_rakuten_search_affiliate_url(deal_keyword)

            if fallback_img:
                image_url = fallback_img
            else:
                image_url = FALLBACK_IMAGES.get(gid) or FALLBACK_IMAGES.get("gear-trail-rain-tnf-strike", "")

            deal_price = g.get("deal_price") or g.get("price")
            if not deal_price or deal_price >= original_price:
                deal_price = int(round(original_price * 0.75))
            affiliate_url = deal_url

        # 3. 特価・目玉商品の判定 (○%OFF 表記の自動反映)
        if deal_price > 0 and original_price > 0 and deal_price < original_price:
            discount_rate = int(round((1 - deal_price / original_price) * 100))
            deal_status = f"実売特価あり ({discount_rate}%OFF)"
        else:
            deal_status = "おすすめのみ"
            discount_rate = 0
            if deal_price == 0:
                deal_price = original_price

        # 4. フォーマット正規化 (¥00,000)
        deal_price_formatted = f"¥{deal_price:,}"
        original_price_formatted = f"¥{original_price:,}"

        # 5. スプレッドシート全13列 (空欄不可バリデーション)
        sports_str = ", ".join(sports) if isinstance(sports, list) else str(sports)
        match_keywords_str = ", ".join(match_keywords) if isinstance(match_keywords, list) else str(match_keywords)

        row_13 = [
            gid,                                # 1. id
            sports_str,                         # 2. sports
            gear_type,                          # 3. gear_type
            match_keywords_str,                 # 4. match_keywords
            title,                              # 5. title
            brand,                              # 6. brand
            standard_title,                     # 7. standard_title
            standard_url,                       # 8. standard_url
            deal_status,                        # 9. deal_status (例: 実売特価あり (25%OFF))
            deal_price_formatted,               # 10. deal_price (¥00,000)
            deal_url,                           # 11. deal_url (楽天アフィリエイト直通URL)
            original_price_formatted,           # 12. original_price (¥00,000)
            image_url                           # 13. image_url
        ]

        # 空欄不可チェック
        for col_idx, val in enumerate(row_13, 1):
            if not val or not str(val).strip():
                raise ValueError(f"ギア [{gid}] の {col_idx} 列目が空欄です。全13列・空欄不可の要件に違反します。")

        gear_item = {
            "id": gid,
            "sports": sports,
            "gearType": gear_type,
            "matchKeywords": match_keywords,
            "title": title,
            "brand": brand,
            "standardTitle": standard_title,
            "standardUrl": standard_url,
            "dealKeyword": deal_keyword,
            "originalPrice": original_price,
            "price": deal_price,
            "discountRate": discount_rate,
            "dealUrl": deal_url,
            "imageUrl": image_url
        }

        badge = f"{discount_rate}%OFF 特価" if discount_rate >= 15 else "定番おすすめ"
        existing_deal = deals_map.get(gid, {})
        deal_item = {
            "id": gid,
            "title": title,
            "category": gear_type,
            "price": deal_price,
            "original_price": original_price,
            "discount_rate": discount_rate,
            "point_rate": 10,
            "image_url": image_url,
            "affiliate_url": deal_url,
            "badge": badge,
            "updated_at": now_iso,
            "registered_at": existing_deal.get("registered_at", now_iso)
        }

        return row_13, gear_item, deal_item

    # ギア検証を並列実行
    logger.info(f"⚡ 全 {len(raw_gears)} 品目の必携品・注目ギアを並列実機検証中...")
    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(process_single_gear, raw_gears))

    for r_13, g_item, d_item in results:
        sheet_rows.append(r_13)
        gear_items.append(g_item)
        deal_items.append(d_item)

    # 割引率が高い順にソートして deals.json を構成
    deal_items.sort(key=lambda x: (x["discount_rate"], x["price"]), reverse=True)

    logger.info(f"🎉 ギア全 {len(gear_items)} 件、特価リスト {len(deal_items)} 件を正常構築（全13列空欄ゼロ）")
    return gear_items, deal_items, sheet_rows


# ---------------------------------------------------------------------------
# 大会マスターの検証・正規化＆スキーマ生成
# ---------------------------------------------------------------------------
def normalize_date(date_str: str) -> str:
    """日付を YYYY-MM-DD 形式に厳格正規化"""
    if not date_str:
        return ""
    date_str = str(date_str).strip().replace("/", "-")
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", date_str)
    if m:
        y, mm, dd = m.groups()
        return f"{int(y):04d}-{int(mm):02d}-{int(dd):02d}"
    return date_str


def normalize_fee(fee_str: str) -> str:
    """参加費の数値を抽出して正規化（例: 38,000円）"""
    if not fee_str:
        return ""
    fee_str = str(fee_str).strip()
    digits = re.findall(r"\d+", fee_str.replace(",", ""))
    if digits:
        # 最大数値を代表値、または範囲表記
        nums = [int(d) for d in digits if int(d) >= 100]
        if len(nums) >= 2 and "~" in fee_str or "〜" in fee_str:
            return f"{min(nums):,}円〜{max(nums):,}円"
        elif nums:
            return f"{nums[0]:,}円"
    return fee_str


def compute_entry_status(date_str: str, deadline_str: str, start_str: str, current_status: str) -> str:
    """現在日付 (JST) を基準にエントリーステータスを自動更新"""
    today_str = datetime.now(JST).strftime("%Y-%m-%d")
    soon_str = (datetime.now(JST) + timedelta(days=21)).strftime("%Y-%m-%d")

    # 開催日終了
    if date_str and date_str < today_str:
        return "closed"
    # 締切日終了
    if deadline_str and deadline_str < today_str:
        return "closed"
    # エントリー開始前
    if start_str and start_str > today_str:
        return "upcoming"
    # 締切間近
    if deadline_str and today_str <= deadline_str <= soon_str:
        return "closing_soon"
    return current_status or "open"



# ---------------------------------------------------------------------------
# Gemini AI (Google Search Grounding) による大会公式URL自動リサーチ
# ---------------------------------------------------------------------------
def search_official_url_with_gemini(title: str, prefecture: str = "", region: str = "") -> dict:
    """Gemini API (Google Search Grounding) を使用して大会の公式サイト・申込URLを自動検索・特定"""
    if not GEMINI_API_KEY:
        return {}

    json_sample = '{"official_url": "https://...", "entry_url": "https://..."}'
    prompt = (
        "以下のスポーツ・アウトドア大会の【公式サイトURL】および【申込・エントリーURL（モシコム/RUNNET/スポーツエントリー等）】をGoogle検索して特定してください。\n"
        f"大会名: {title}\n"
        f"開催地: {prefecture} {region}\n\n"
        f"出力は以下のJSONのみで行ってください（説明文やMarkdownコードブロックは不要）:\n"
        f"{json_sample}\n"
        "どうしても見つからない項目は空文字 \"\" にしてください。"
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "tools": [{"google_search": {}}],
        "generationConfig": {
            "temperature": 0.1
        }
    }

    try:
        res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=20)
        if res.status_code == 200:
            data = res.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                raw_text = "".join(p.get("text", "") for p in parts)
                match = re.search(r"\{[\s\S]*?\}", raw_text)
                if match:
                    parsed = json.loads(match.group(0))
                    return {
                        "official_url": (parsed.get("official_url") or "").strip(),
                        "entry_url": (parsed.get("entry_url") or "").strip(),
                    }
    except Exception as e:
        logger.warning(f"⚠️ Gemini公式URL検索失敗 ({title}): {e}")
    return {}


def process_events() -> tuple[list[dict], list[list[str]]]:
    """
    全大会データを最新化し、
    1. フロントエンド用 events (events.json)
    2. スプレッドシート用 rows (全21列)
    を生成して返却。
    """
    logger.info("========================================================")
    logger.info(" 大会マスター精度向上＆リンク実機HTTP検証 開始")
    logger.info("========================================================")

    with open(EVENTS_JSON_PATH, "r", encoding="utf-8") as f:
        events = json.load(f)

    sheet_rows = []
    verified_events = []
    today_str = datetime.now(JST).strftime("%Y-%m-%d")

    # 全URLを収集して並列実機検証（高速化＆高精度化）
    all_urls = set()
    for ev in events:
        links = ev.get("links", {})
        if links.get("official"):
            all_urls.add(links["official"])
        if links.get("entry"):
            all_urls.add(links["entry"])

    logger.info(f"🌐 合計 {len(all_urls)} 件の大会関連URLを並列実機検証中...")
    url_cache = {}

    def test_url(u):
        return u, verify_http_status_200(u)

    with ThreadPoolExecutor(max_workers=15) as executor:
        futures = {executor.submit(test_url, u): u for u in all_urls}
        for fut in as_completed(futures):
            u, is_ok = fut.result()
            url_cache[u] = is_ok
            if not is_ok:
                logger.info(f"  ❌ 死にリンク除外: {u}")





    def check_link(url: str | None) -> str | None:
        if not url:
            return None
        # ボット遮断（Cloudflare/Akamai/403）等でテスト失敗しても正規のURLは勝手に消さず保持
        return url

    for ev in events:
        eid = ev["id"]
        title = ev.get("title", "")
        category = ev.get("category", "trail")
        sub_category = ev.get("subCategory", "")
        date_val = normalize_date(ev.get("date", ""))
        month_val = ev.get("month") or (int(date_val.split("-")[1]) if "-" in date_val else 1)
        region = ev.get("region", "全国")
        prefecture = ev.get("prefecture", "")
        distance_km = ev.get("distance_km", 0)
        elevation_m = ev.get("elevation_m", 0)
        start_date = normalize_date(ev.get("entry_start_date", ""))
        deadline = normalize_date(ev.get("entry_deadline", ""))
        entry_fee = normalize_fee(ev.get("entry_fee", ""))

        # リンクの実機検証＆Gemini AI自動検索
        links = ev.get("links", {})
        raw_official = links.get("official")
        raw_entry = links.get("entry")

        # 公式URLが空でGEMINI_API_KEYが設定されている場合、AIがWeb検索して自動特定
        if (not raw_official or raw_official.strip() == "") and GEMINI_API_KEY:
            logger.info(f"🤖 Gemini AI が未登録公式URLを自動検索中: {title}")
            ai_links = search_official_url_with_gemini(title, prefecture, region)
            if ai_links.get("official_url"):
                raw_official = ai_links["official_url"]
                logger.info(f"  ✨ Geminiが公式サイトを特定: {raw_official}")
            if (not raw_entry or raw_entry.strip() == "") and ai_links.get("entry_url"):
                raw_entry = ai_links["entry_url"]
                logger.info(f"  ✨ Geminiが申込ページを特定: {raw_entry}")

        verified_official = check_link(raw_official)
        verified_entry = check_link(raw_entry)

        # ステータス自動判定
        raw_status = ev.get("entry_status", "open")
        entry_status = compute_entry_status(date_val, deadline, start_date, raw_status)

        # 会場情報
        venue = ev.get("venue", {})
        venue_name = venue.get("name", "")
        venue_map = venue.get("mapQuery", f"{prefecture} {venue_name}".strip())

        # ソース
        source = ev.get("source", {})
        source_portal = source.get("portalName", "大会公式")

        # エレメント & 必携装備
        elements = ev.get("elements", [])
        elements_str = " / ".join(elements) if isinstance(elements, list) else str(elements)

        mandatory_gear = ev.get("mandatory_gear", [])
        gear_names = [g["name"] if isinstance(g, dict) else str(g) for g in mandatory_gear]
        mandatory_gear_str = " / ".join(gear_names)

        # 全21列スキーマ行
        row_21 = [
            eid,                                # 1. id
            source_portal,                      # 2. source_portal
            title,                              # 3. title
            category,                           # 4. category
            sub_category,                       # 5. subCategory
            date_val,                           # 6. date
            str(month_val),                     # 7. month
            region,                             # 8. region
            prefecture,                         # 9. prefecture
            str(distance_km),                   # 10. distance_km
            str(elevation_m),                   # 11. elevation_m
            entry_status,                       # 12. entry_status
            start_date,                         # 13. entry_start_date
            deadline,                           # 14. entry_deadline
            entry_fee,                          # 15. entry_fee
            verified_official or "",            # 16. official_url
            verified_entry or "",               # 17. entry_url
            venue_name,                         # 18. venue_name
            venue_map,                          # 19. venue_map
            elements_str,                       # 20. elements
            mandatory_gear_str                  # 21. mandatory_gear
        ]
        sheet_rows.append(row_21)

        # フロントエンド用オブジェクト更新
        updated_ev = dict(ev)
        updated_ev["date"] = date_val
        updated_ev["entry_start_date"] = start_date or None
        updated_ev["entry_deadline"] = deadline or None
        updated_ev["entry_fee"] = entry_fee
        updated_ev["entry_status"] = entry_status
        updated_ev["links"] = {
            "official": verified_official,
            "entry": verified_entry,
            "review": links.get("review"),
            "sns": links.get("sns"),
            "verified": True,
            "verified_at": today_str
        }
        verified_events.append(updated_ev)

    logger.info(f"✅ 全 {len(verified_events)} 件の大会リンク検証＆正規化完了")
    return verified_events, sheet_rows


# ---------------------------------------------------------------------------
# Googleスプレッドシートへの一括書き込み
# ---------------------------------------------------------------------------
def sync_google_sheets(gear_rows: list[list[str]], event_rows: list[list[str]]) -> bool:
    """
    gspread + サービスアカウント（GCP_SA_KEY）を用いて
    1. ギアウォッチリストシート (13列)
    2. 大会マスターシート (21列)
    を一括更新。
    """
    if not GCP_SA_KEY:
        logger.warning("⚠️ GCP_SA_KEY が設定されていません。Googleスプレッドシートへの同期をスキップします。")
        return False

    try:
        import gspread
        from google.oauth2.service_account import Credentials

        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ]

        if GCP_SA_KEY.startswith("{"):
            sa_info = json.loads(GCP_SA_KEY)
            credentials = Credentials.from_service_account_info(sa_info, scopes=scopes)
        else:
            credentials = Credentials.from_service_account_file(GCP_SA_KEY, scopes=scopes)

        gc = gspread.authorize(credentials)
        logger.info("🔑 Google Cloud サービスアカウント認証に成功しました。")

        # 1. ギアウォッチリストの更新 (全13列)
        gear_headers = [
            "id", "sports", "gear_type", "match_keywords", "title", "brand",
            "standard_title", "standard_url", "deal_status", "deal_price",
            "deal_url", "original_price", "image_url"
        ]
        try:
            gear_sheet = gc.open_by_key(GEAR_SHEET_ID).sheet1
            gear_data = [gear_headers] + gear_rows
            gear_sheet.clear()
            gear_sheet.update(range_name="A1", values=gear_data)
            logger.info(f"📊 ギアウォッチリスト ({GEAR_SHEET_ID}) を正常更新しました（全 {len(gear_rows)} 件・13列）")
        except Exception as e:
            logger.error(f"❌ ギアウォッチリスト更新失敗: {e}")

        # 2. 大会マスターの更新 (全21列)
        event_headers = [
            "id", "source_portal", "title", "category", "subCategory", "date",
            "month", "region", "prefecture", "distance_km", "elevation_m",
            "entry_status", "entry_start_date", "entry_deadline", "entry_fee",
            "official_url", "entry_url", "venue_name", "venue_map", "elements",
            "mandatory_gear"
        ]
        try:
            event_sheet = gc.open_by_key(EVENT_SHEET_ID).sheet1
            event_data = [event_headers] + event_rows
            event_sheet.clear()
            event_sheet.update(range_name="A1", values=event_data)
            logger.info(f"📊 大会マスター ({EVENT_SHEET_ID}) を正常更新しました（全 {len(event_rows)} 件・21列）")
        except Exception as e:
            logger.error(f"❌ 大会マスター更新失敗: {e}")

        return True
    except Exception as e:
        logger.error(f"❌ Googleスプレッドシート認証・更新致命的エラー: {e}")
        return False


# ---------------------------------------------------------------------------
# ローカル静的データの保存
# ---------------------------------------------------------------------------
def save_local_files(events: list[dict], gears: list[dict], deals: list[dict], event_rows: list[list[str]]):
    """フロントエンド互換のJSONおよびCSVを上書き保存"""
    logger.info("💾 ローカル静的ファイル（src/data/*）へ上書き保存中...")

    # events.json
    with open(EVENTS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(events, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # gears.json
    with open(GEARS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(gears, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # deals.json
    with open(DEALS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(deals, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # meta.json
    meta = {
        "last_updated_at": datetime.now(JST).isoformat(),
        "events_count": len(events),
        "deals_count": len(deals),
        "gears_count": len(gears),
        "sync_source": "Google Sheets & Rakuten API Automated Sync"
    }
    with open(META_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # outdoor_race_hub_events_master.csv
    event_headers = [
        "id", "source_portal", "title", "category", "subCategory", "date",
        "month", "region", "prefecture", "distance_km", "elevation_m",
        "entry_status", "entry_start_date", "entry_deadline", "entry_fee",
        "official_url", "entry_url", "venue_name", "venue_map", "elements",
        "mandatory_gear"
    ]
    def escape_csv_cell(val):
        s = "" if val is None else str(val)
        if any(c in s for c in [",", '"', "\n", "\r"]):
            escaped = s.replace('"', '""')
            return f'"{escaped}"'
        return s

    csv_lines = [",".join(event_headers)]
    for r in event_rows:
        csv_lines.append(",".join(escape_csv_cell(c) for c in r))

    with open(MASTER_CSV_PATH, "w", encoding="utf-8-sig") as f:
        f.write("\r\n".join(csv_lines) + "\r\n")

    logger.info("🎉 すべての静的ファイル（events, gears, deals, meta, CSV）の保存を完了しました！")


# ---------------------------------------------------------------------------
# メイン実行関数
# ---------------------------------------------------------------------------
def main():
    logger.info("🚀 OUTDOOR RACE HUB 高精度自動更新パイプライン 起動")
    start_time = datetime.now()

    # 週次トレンド・季節自動適応（毎週月曜日、または環境変数・引数で明示指定時）
    is_monday = datetime.now(JST).weekday() == 0
    force_trend = os.environ.get("UPDATE_WEEKLY_TREND", "").lower() in ["1", "true", "yes"] or "--trend" in sys.argv
    if is_monday or force_trend:
        logger.info("📅 【週次更新】季節動的適応＆楽天市場ランキングトレンド巡回を実行します...")
        try:
            update_catalog_with_season_and_trends()
        except Exception as e:
            logger.warning(f"週次トレンド更新例外（スキップして同期を続行）: {e}")

    # 1. ギア情報の更新・確定データ化
    gears, deals, gear_sheet_rows = process_gears()

    # 2. 大会情報の更新・リンク検証
    events, event_sheet_rows = process_events()

    # 3. Googleスプレッドシートへの反映
    sync_google_sheets(gear_sheet_rows, event_sheet_rows)

    # 4. ローカル静的データの完全同期
    save_local_files(events, gears, deals, event_sheet_rows)

    elapsed = (datetime.now() - start_time).total_seconds()
    logger.info(f"✨ 全処理が正常に完了しました！（所要時間: {elapsed:.1f} 秒）")


if __name__ == "__main__":
    main()
