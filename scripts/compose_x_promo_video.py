#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
scripts/compose_x_promo_video.py

Gemini等で生成した複数の縦型ショート動画（MP4）を無料で結合し、
src/data/events.json の最新データ（締切まじか・新規追加・注目大会）をもとに
日本語テロップ・デザインカードを合成して、X（旧Twitter）投稿用の完成MP4動画を出力します。

使い方:
  .\.venv\Scripts\python.exe scripts/compose_x_promo_video.py <動画1.mp4> <動画2.mp4> [--out promo_videos/x_promo_latest.mp4]
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

ROOT_DIR = Path(__file__).resolve().parent.parent
EVENTS_PATH = ROOT_DIR / "src" / "data" / "events.json"
OUT_DIR = ROOT_DIR / "promo_videos"
SITE_URL = "https://yachimaru-sports.github.io/outdoor-race-hub/"

FONT_BOLD = r"C:\Windows\Fonts\YuGothB.ttc"
FONT_MED = r"C:\Windows\Fonts\YuGothM.ttc"

W, H = 720, 1280


def get_today_jst() -> str:
    jst = timezone(timedelta(hours=9))
    return datetime.now(jst).strftime("%Y-%m-%d")


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    if os.path.exists(path):
        return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def pick_promo_events(today: str) -> dict:
    events = json.loads(EVENTS_PATH.read_text(encoding="utf-8"))
    upcoming = [e for e in events if (e.get("date") or "") >= today and e.get("entry_status") != "closed"]

    closing = sorted(
        [e for e in upcoming if (e.get("entry_deadline") or "") >= today],
        key=lambda e: e["entry_deadline"],
    )[:2]

    recent = sorted(
        [e for e in upcoming if e.get("added_at")],
        key=lambda e: e.get("added_at", ""),
        reverse=True,
    )[:2]

    featured = [
        e for e in upcoming
        if any(k in e.get("title", "") for k in ["Hiroshima", "UTMB", "FUJI", "信越", "PEAKS", "DEEP JAPAN"])
    ][:2]

    return {
        "total": len(events),
        "closing": closing,
        "recent": recent,
        "featured": featured,
    }


def shorten(text: str, max_len: int = 24) -> str:
    t = text.split("（")[0].split("(")[0].strip()
    return t if len(t) <= max_len else t[: max_len - 1] + "…"


def draw_rounded_card(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: tuple[int, int, int, int],
    outline: tuple[int, int, int, int] | None = None,
    radius: int = 24,
    width: int = 3,
):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_text_shadow(
    draw: ImageDraw.ImageDraw,
    pos: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int] = (255, 255, 255, 255),
    shadow: tuple[int, int, int, int] = (0, 0, 0, 200),
    anchor: str = "lt",
):
    x, y = pos
    draw.text((x + 2, y + 3), text, font=font, fill=shadow, anchor=anchor)
    draw.text((x, y), text, font=font, fill=fill, anchor=anchor)


def make_header(draw: ImageDraw.ImageDraw):
    f_brand = load_font(FONT_BOLD, 28)
    draw_rounded_card(draw, (140, 48, 580, 108), fill=(15, 23, 42, 210), outline=(249, 115, 22, 240), radius=30, width=3)
    draw_text_shadow(draw, (360, 78), "OUTDOOR RACE HUB", f_brand, fill=(255, 255, 255, 255), anchor="mm")


def create_overlay_closing(data: dict, out_path: Path):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    make_header(draw)

    f_badge = load_font(FONT_BOLD, 30)
    f_title = load_font(FONT_BOLD, 34)
    f_sub = load_font(FONT_MED, 26)

    # バッジ
    draw_rounded_card(draw, (50, 790, 430, 848), fill=(220, 38, 38, 245), radius=16)
    draw_text_shadow(draw, (240, 819), "【緊急】エントリー締切まじか！", f_badge, anchor="mm")

    # メインカード
    draw_rounded_card(draw, (40, 864, 680, 1140), fill=(10, 15, 30, 215), outline=(239, 68, 68, 200), radius=24, width=2)

    y = 895
    for ev in data["closing"][:2]:
        name = shorten(ev["title"], 19)
        dl = ev.get("entry_deadline", "")
        pref = ev.get("prefecture", "")
        dt = ev.get("date", "")
        draw_text_shadow(draw, (70, y), f"▶ {name}", f_title, fill=(255, 255, 255, 255))
        draw_text_shadow(draw, (95, y + 46), f"締切: {dl}  |  開催: {dt} ({pref})", f_sub, fill=(253, 186, 116, 255))
        y += 112

    img.save(out_path)


def create_overlay_new(data: dict, out_path: Path):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    make_header(draw)

    f_badge = load_font(FONT_BOLD, 30)
    f_title = load_font(FONT_BOLD, 34)
    f_sub = load_font(FONT_MED, 26)

    draw_rounded_card(draw, (50, 790, 460, 848), fill=(2, 132, 199, 245), radius=16)
    draw_text_shadow(draw, (255, 819), "★ 2027年 注目の新着大会", f_badge, anchor="mm")

    draw_rounded_card(draw, (40, 864, 680, 1140), fill=(10, 15, 30, 215), outline=(56, 189, 248, 200), radius=24, width=2)

    picks = (data["recent"] + data["featured"])[:2]
    y = 895
    for ev in picks:
        name = shorten(ev["title"], 19)
        dt = ev.get("date", "")
        pref = ev.get("prefecture", "")
        dist = ev.get("distance_km", 0)
        dist_str = f" / {dist}km" if dist else ""
        draw_text_shadow(draw, (70, y), f"▶ {name}", f_title, fill=(255, 255, 255, 255))
        draw_text_shadow(draw, (95, y + 46), f"開催: {dt} ({pref}{dist_str})", f_sub, fill=(125, 211, 252, 255))
        y += 112

    img.save(out_path)


def create_overlay_summary(data: dict, out_path: Path):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    make_header(draw)

    f_big = load_font(FONT_BOLD, 42)
    f_mid = load_font(FONT_BOLD, 30)
    f_sub = load_font(FONT_MED, 26)

    draw_rounded_card(draw, (40, 820, 680, 1140), fill=(10, 15, 30, 215), outline=(249, 115, 22, 220), radius=24, width=3)
    draw_text_shadow(draw, (360, 880), f"国内 {data['total']} 大会を網羅！", f_big, fill=(251, 146, 60, 255), anchor="mm")
    draw_text_shadow(draw, (360, 950), "トレラン・マラソン・ロングライド", f_mid, fill=(255, 255, 255, 255), anchor="mm")
    draw_text_shadow(draw, (360, 1005), "最新開催日・申込リンク・必携装備を", f_sub, fill=(203, 213, 225, 255), anchor="mm")
    draw_text_shadow(draw, (360, 1050), "毎朝自動で最新化してお届け", f_sub, fill=(203, 213, 225, 255), anchor="mm")

    img.save(out_path)


def create_overlay_cta(data: dict, out_path: Path):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    make_header(draw)

    f_big = load_font(FONT_BOLD, 40)
    f_btn = load_font(FONT_BOLD, 32)
    f_sub = load_font(FONT_MED, 26)

    draw_rounded_card(draw, (40, 800, 680, 1145), fill=(10, 15, 30, 230), outline=(249, 115, 22, 245), radius=26, width=3)
    draw_text_shadow(draw, (360, 865), "次の挑戦を今すぐ見つけよう！", f_big, fill=(255, 255, 255, 255), anchor="mm")
    draw_text_shadow(draw, (360, 930), "公式リンク・締切日・必携装備が一目でわかる", f_sub, fill=(203, 213, 225, 255), anchor="mm")

    draw_rounded_card(draw, (85, 985, 635, 1065), fill=(234, 88, 12, 255), radius=40)
    draw_text_shadow(draw, (360, 1025), "ポストのリンクから今すぐチェック！", f_btn, fill=(255, 255, 255, 255), anchor="mm")
    draw_text_shadow(draw, (360, 1105), "OUTDOOR RACE HUB で検索", f_sub, fill=(253, 186, 116, 255), anchor="mm")

    img.save(out_path)


def main():
    parser = argparse.ArgumentParser(description="X投稿用プロモーション動画合成ツール")
    parser.add_argument("videos", nargs=2, help="結合する2本の縦型MP4動画パス")
    parser.add_argument("--out", default=str(OUT_DIR / "x_promo_latest.mp4"), help="出力MP4パス")
    args = parser.parse_args()

    v1, v2 = Path(args.videos[0]), Path(args.videos[1])
    if not v1.exists() or not v2.exists():
        print("❌ 指定された動画ファイルが見つかりません。")
        sys.exit(1)

    today = get_today_jst()
    data = pick_promo_events(today)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_mp4 = Path(args.out)

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        ov1 = tmp / "ov1_closing.png"
        ov2 = tmp / "ov2_new.png"
        ov3 = tmp / "ov3_summary.png"
        ov4 = tmp / "ov4_cta.png"

        create_overlay_closing(data, ov1)
        create_overlay_new(data, ov2)
        create_overlay_summary(data, ov3)
        create_overlay_cta(data, ov4)

        # 2本の動画(各10.03秒)を 9.6秒地点で 0.4秒クロスフェード連結 -> 合計約19.6秒
        # テロップタイミング:
        #   0.3〜4.8s: 締切まじか
        #   5.0〜9.5s: 注目の新着大会
        #  10.0〜14.8s: 全220大会網羅
        #  15.0〜19.6s: CTA（リンク誘導）
        filter_complex = (
            "[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=24,format=yuv420p[v0];"
            "[1:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=24,format=yuv420p[v1];"
            "[v0][v1]xfade=transition=slideleft:duration=0.4:offset=9.6[vbase];"
            "[0:a][1:a]acrossfade=d=0.4[aout];"
            "[vbase][2:v]overlay=0:0:enable='between(t,0.3,4.8)'[vo1];"
            "[vo1][3:v]overlay=0:0:enable='between(t,5.0,9.5)'[vo2];"
            "[vo2][4:v]overlay=0:0:enable='between(t,10.0,14.8)'[vo3];"
            "[vo3][5:v]overlay=0:0:enable='between(t,15.0,19.8)'[vout]"
        )

        cmd = [
            ffmpeg, "-y",
            "-i", str(v1),
            "-i", str(v2),
            "-i", str(ov1),
            "-i", str(ov2),
            "-i", str(ov3),
            "-i", str(ov4),
            "-filter_complex", filter_complex,
            "-map", "[vout]",
            "-map", "[aout]",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "medium",
            "-crf", "20",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            str(out_mp4),
        ]

        print("🎬 X投稿用プロモーション動画を合成中...")
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            print("❌ ffmpeg エラー:")
            print(res.stderr[-1500:])
            sys.exit(1)

    # X投稿用テキスト（Xの280ウェイト＝全角140文字上限に確実に収める）
    closing_lines = [f"🔥 {shorten(e['title'], 16)}（締切 {e.get('entry_deadline')[5:]}）" for e in data["closing"][:2]]
    recent_lines = [f"✨ {shorten(e['title'], 16)}（{e.get('date')}）" for e in data["recent"][:1]]
    post_text = "\n".join([
        "【アウトドア大会 最新情報】",
        *closing_lines,
        *recent_lines,
        "",
        f"全{data['total']}大会を毎日自動更新👇",
        SITE_URL,
        "#トレラン #マラソン #ロードバイク",
    ])
    post_path = OUT_DIR / "x_promo_post.txt"
    post_path.write_text(post_text + "\n", encoding="utf-8")

    size_mb = out_mp4.stat().st_size / (1024 * 1024)
    print(f"\n🎉 完成しました！ ({size_mb:.2f} MB)")
    print(f"   動画ファイル: {out_mp4}")
    print(f"   X投稿用テキスト: {post_path}")
    print("\n--- そのままコピペして使えるX投稿文 ---")
    print(post_text)


if __name__ == "__main__":
    main()
