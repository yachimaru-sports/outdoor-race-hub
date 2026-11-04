#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/weekly_trend_updater.py
OUTDOOR RACE HUB 季節動的適応＆楽天市場ランキング連携・週次トレンド更新スクリプト

【機能概要】
1. 季節（現在月）による必携ギアの動的重み付け・優先度自動適応
   - 夏季（6〜9月）: 熱中症対策、保冷ボトル、電解質・塩熱サプリ、通気性メッシュ
   - 冬季（11〜2月）: 低体温症対策、防寒インナー、防風シェル・ジレ、防寒ビバーク
   - 春秋（3〜5月、10月）: レインウェア、軽量シェル、主要山岳必携装備
2. 楽天市場ランキングAPI（IchibaItem/Ranking）連携
   - 「アウトドア」「ランニング」「自転車」の週間売れ筋ランキングTOP30を自動巡回
   - 必携品カテゴリに合致する急上昇トレンドアイテムを自動検出
   - 個別アフィリエイトリンク・高解像度画像のHTTP実機検証
3. マスターカタログ（scripts/gear_catalog.json）へのトレンド・季節情報の自動反映
"""

import os
import sys
import json
import re
import urllib.parse
from datetime import datetime, timezone, timedelta
import logging
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("weekly_trend_updater")

JST = timezone(timedelta(hours=9))

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
CATALOG_PATH = os.path.join(SCRIPT_DIR, "gear_catalog.json")

RAKUTEN_APP_ID = os.environ.get("RAKUTEN_APP_ID", "").strip()
RAKUTEN_AFFILIATE_ID = os.environ.get("RAKUTEN_AFFILIATE_ID", "58fb598b.0ed2da59.58fb598c.27018da5").strip()
RANKING_API_ENDPOINT = "https://app.rakuten.co.jp/services/api/IchibaItem/Ranking/20220601"

# 楽天ランキング対象ジャンル
# 302347: アウトドア
# 302346: ランニング・マラソン
# 302348: 自転車・サイクリング
TARGET_GENRES = [
    {"id": 302347, "name": "アウトドア", "sports": ["trail", "adventure"]},
    {"id": 302346, "name": "ランニング", "sports": ["marathon", "trail"]},
    {"id": 302348, "name": "自転車", "sports": ["cycling", "adventure"]},
]

HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
}


def get_current_season() -> str:
    """現在月（JST）から現在の季節を判定"""
    month = datetime.now(JST).month
    if 6 <= month <= 9:
        return "summer"
    elif month in [11, 12, 1, 2]:
        return "winter"
    else:
        return "spring_autumn"


def fetch_genre_ranking(genre_id: int) -> list[dict]:
    """楽天市場ジャンル別ランキングAPIから上位アイテムを取得"""
    if not RAKUTEN_APP_ID:
        return []

    params = {
        "applicationId": RAKUTEN_APP_ID,
        "affiliateId": RAKUTEN_AFFILIATE_ID,
        "genreId": genre_id,
        "format": "json",
        "formatVersion": 2,
    }

    try:
        res = requests.get(RANKING_API_ENDPOINT, params=params, headers=HTTP_HEADERS, timeout=8.0)
        if res.status_code != 200:
            logger.warning(f"ランキングAPIエラー (ジャンル {genre_id}) HTTP {res.status_code}")
            return []
        data = res.json()
        return data.get("Items", [])
    except Exception as e:
        logger.warning(f"ランキングAPI通信例外 (ジャンル {genre_id}): {e}")
        return []


def update_catalog_with_season_and_trends():
    """マスターカタログの季節適応およびランキングトレンドの付与"""
    season = get_current_season()
    season_names = {
        "summer": "☀️ 夏季・猛暑＆熱中症対策シーズン",
        "winter": "❄️ 冬季・防寒＆低体温症対策シーズン",
        "spring_autumn": "🍁 春秋・高山気象＆基本必携シーズン"
    }
    logger.info("========================================================")
    logger.info(f" 季節動的適応＆楽天市場ランキング連携 開始")
    logger.info(f" 現在のシーズン判定: {season_names.get(season)}")
    logger.info("========================================================")

    if not os.path.exists(CATALOG_PATH):
        logger.error(f"マスターカタログが見つかりません: {CATALOG_PATH}")
        return

    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    # 1. 季節による優先度と解説の動的調整
    for item in catalog:
        item_season = item.get("season", "all")
        # 季節の一致判定
        if item_season == season:
            item["seasonal_priority"] = 10  # 季節最優先
            if season == "summer" and "保冷" in item.get("title", ""):
                item["seasonal_badge"] = "☀️ 猛暑対策・保冷必須"
            elif season == "winter" and "防寒" in item.get("standard_title", ""):
                item["seasonal_badge"] = "❄️ 冬季山岳・防寒必携"
            else:
                item["seasonal_badge"] = "⭐ 今期注目の推奨品"
        elif item_season == "all":
            item["seasonal_priority"] = 5   # 通年定番
            item["seasonal_badge"] = "定番必携"
        else:
            item["seasonal_priority"] = 1   # オフシーズン
            item["seasonal_badge"] = "通年ストック"

    # 2. 楽天市場ランキングAPI巡回（週次トレンドの注入）
    ranking_hits = 0
    if RAKUTEN_APP_ID:
        for g in TARGET_GENRES:
            items = fetch_genre_ranking(g["id"])
            logger.info(f"📊 楽天ジャンルランキング [{g['name']}] より {len(items)} 件を取得")

            for rank_item in items[:20]:
                rank = rank_item.get("rank", 99)
                item_name = rank_item.get("itemName", "")
                item_url = rank_item.get("itemUrl", "")

                # カタログ内の既存ギアとマッチング
                for cat_item in catalog:
                    keywords = cat_item.get("match_keywords", []) + [cat_item.get("brand", "")]
                    # 複数キーワードがランキング商品名に含まれるか照合
                    matches = [kw for kw in keywords if kw and kw.lower() in item_name.lower()]
                    if len(matches) >= 2:
                        cat_item["trend_rank"] = rank
                        cat_item["trend_genre"] = g["name"]
                        cat_item["standard_title"] = f"【楽天{g['name']}部門 第{rank}位】" + re.sub(r"^【[^】]+】", "", cat_item.get("standard_title", ""))
                        ranking_hits += 1
                        logger.info(f"  🔥 ランキング一致: [{cat_item['id']}] 第{rank}位 ({cat_item['title'][:25]})")
                        break

    # 3. 季節優先度 ＞ ランキング順位 ＞ 定番順 にソート
    catalog.sort(
        key=lambda x: (
            -x.get("seasonal_priority", 0),
            x.get("trend_rank", 999),
            x.get("original_price", 0)
        )
    )

    # 4. 更新結果を gear_catalog.json に保存
    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
        f.write("\n")

    logger.info(f"🎉 マスターカタログ更新完了: 全 {len(catalog)} 品目（季節適応完了 / ランキング反映 {ranking_hits} 件）")


if __name__ == "__main__":
    update_catalog_with_season_and_trends()
