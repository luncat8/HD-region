#!/usr/bin/env python3
"""
gen_test_outpaint.py
Генерирует изображение full.png и метаданные full.json
Параметры: измените WIDTH, HEIGHT, ORIG_W, ORIG_H, ORIG_X, ORIG_Y при необходимости.
Требует: Pillow
pip install pillow
"""
from PIL import Image, ImageDraw, ImageFont
import json
import os

# Параметры итогового изображения (outpaint canvas)
WIDTH = 2000
HEIGHT = 1200

# Параметры оригинальной части внутри холста (в пикселях)
ORIG_W = 800
ORIG_H = 1000
# Разместим оригинал примерно в центре, но можно сместить
ORIG_X = (WIDTH - ORIG_W) // 2
ORIG_Y = (HEIGHT - ORIG_H) // 2

OUTFILE_IMG = "full.png"
OUTFILE_JSON = "full.json"

# Цвета
COLOR_BG = (30, 30, 30)            # фон всего холста
COLOR_ORIG = (240, 240, 220)       # центральная исходная область
COLOR_TOP = (200, 120, 120)
COLOR_BOTTOM = (120, 160, 200)
COLOR_LEFT = (140, 200, 140)
COLOR_RIGHT = (200, 160, 140)
BORDER_COLOR = (20, 20, 20)
TEXT_COLOR = (10, 10, 10)

def draw_label(draw, pos, text, size=24, anchor='lt'):
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", size)
    except Exception:
        font = ImageFont.load_default()
    draw.text(pos, text, fill=TEXT_COLOR, font=font, anchor=anchor)

def main():
    img = Image.new("RGB", (WIDTH, HEIGHT), COLOR_BG)
    draw = ImageDraw.Draw(img)

    # Нарисуем зоны: top, bottom, left, right (outpaint)
    # Верхняя полоса
    if ORIG_Y > 0:
        draw.rectangle([0, 0, WIDTH, ORIG_Y], fill=COLOR_TOP)
        draw_label(draw, (10, max(10, ORIG_Y//2)), "TOP OUTPAINT", size=36)
    # Нижняя полоса
    if ORIG_Y + ORIG_H < HEIGHT:
        draw.rectangle([0, ORIG_Y + ORIG_H, WIDTH, HEIGHT], fill=COLOR_BOTTOM)
        draw_label(draw, (10, ORIG_Y + ORIG_H + max(10, (HEIGHT - (ORIG_Y+ORIG_H))//2)), "BOTTOM OUTPAINT", size=36)
    # Левая полоса
    if ORIG_X > 0:
        draw.rectangle([0, 0, ORIG_X, HEIGHT], fill=COLOR_LEFT)
        draw_label(draw, (max(10, ORIG_X//2), 10), "LEFT OUTPAINT", size=36)
    # Правая полоса
    if ORIG_X + ORIG_W < WIDTH:
        draw.rectangle([ORIG_X + ORIG_W, 0, WIDTH, HEIGHT], fill=COLOR_RIGHT)
        draw_label(draw, (ORIG_X + ORIG_W + max(10, (WIDTH - (ORIG_X+ORIG_W))//2), 10), "RIGHT OUTPAINT", size=36)

    # Нарисуем саму оригинальную область
    draw.rectangle([ORIG_X, ORIG_Y, ORIG_X + ORIG_W, ORIG_Y + ORIG_H], fill=COLOR_ORIG, outline=BORDER_COLOR, width=6)
    draw_label(draw, (ORIG_X + ORIG_W//2, ORIG_Y + 20), "ORIGINAL REGION", size=42, anchor='mt')

    # Добавим сетку/элементы внутри оригинала для проверки масштаба
    # Вертикальные линии
    for i in range(0, ORIG_W+1, ORIG_W//4):
        x = ORIG_X + i
        draw.line([(x, ORIG_Y), (x, ORIG_Y + ORIG_H)], fill=BORDER_COLOR, width=2)
        draw_label(draw, (x+6, ORIG_Y + ORIG_H - 20), f"x={i}", size=20)
    # Горизонтальные линии
    for j in range(0, ORIG_H+1, ORIG_H//5):
        y = ORIG_Y + j
        draw.line([(ORIG_X, y), (ORIG_X + ORIG_W, y)], fill=BORDER_COLOR, width=2)
        draw_label(draw, (ORIG_X + 6, y+6), f"y={j}", size=20)

    # Пометьте углы оригинальной области
    corner_labels = [
        ((ORIG_X+10, ORIG_Y+10), "TL"),
        ((ORIG_X+ORIG_W-10, ORIG_Y+10), "TR"),
        ((ORIG_X+10, ORIG_Y+ORIG_H-10), "BL"),
        ((ORIG_X+ORIG_W-10, ORIG_Y+ORIG_H-10), "BR"),
    ]
    for p, t in corner_labels:
        draw_label(draw, p, t, size=24, anchor='lt')

    # Сохраним изображение
    img.save(OUTFILE_IMG)
    print(f"Saved {OUTFILE_IMG} ({WIDTH}x{HEIGHT})")

    # Сохраним JSON с originalRect
    meta = {
        "image": OUTFILE_IMG,
        "originalRect": {"x": ORIG_X, "y": ORIG_Y, "w": ORIG_W, "h": ORIG_H},
        "canvas": {"w": WIDTH, "h": HEIGHT}
    }
    with open(OUTFILE_JSON, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"Saved {OUTFILE_JSON}")

if __name__ == "__main__":
    main()
