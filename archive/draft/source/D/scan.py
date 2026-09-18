#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
gen_originals.py

Скрипт собирает описание центральной области для каждой картинки‑фонового
файла и для её « cíליתi» (например 1_c.png) аналогичной картинки.
Результат – обычный JavaScript‑объект, готовый вставить в HTML.

Поддерживает только неизменённые (не анимированные) .jpg, .jpeg, .png, .webp.
"""

import os
import sys
from pathlib import Path
from PIL import Image

def is_animated(img_path: Path) -> bool:
    """Простейшая проверка анимации: если frames > 1, считаем анимированным."""
    try:
        with Image.open(img_path) as im:
            return im.n_frames > 1
    except Exception:
        return True

def find_base_image(candidate: Path) -> Path | None:
    """
    Ищем файл без суффикса *_c.* в той же папке.
    Пример: 1_c.png -> 1.png
    """
    base = candidate.stem.replace('_c', '')
    possible = candidate.with_name(base + candidate.suffix)
    return possible if possible.exists() else None

def compute_region(img_path: Path, base_path: Path) -> dict:
    """
    Пример простой стратегии:
      - Открываем базовую карту (base_path) – это «центральная область».
      - Находим её позицию в candidate‑файле, сравнивая цвета пикселей.
      - Возвращаем (x, y, w, h) в пикселях базовой карты.
    Здесь реализована упрощённая версия: берём центр базовой карты и
      ищем такой же цвет в candidate‑картине.
    """
    # Открываем базовую картинку, берём её центр
    with Image.open(base_path) as base_im:
        base_center = base_im.getpixel((base_im.width // 2, base_im.height // 2))

    # Открываем candidate‑картинку
    with Image.open(img_path) as cand_im:
        cand_w, cand_h = cand_im.size
        cand_center = cand_im.getpixel((cand_w // 2, cand_h // 2))

        # Если центр­иальный пиксель совпадает, считаем, что это та самая область.
        # Теперь ищем в candidate‑картинке область того же размера, что и базовая,
        # где центр совпадает.
        base_w, base_h = base_im.size
        # Простейший масштаб: сохраняем пропорцию базы, но делаем её少し меньше.
        # Здесь просто берём оригинальный размер базовой картинки как w/h.
        w, h = base_w, base_h

        # Находим левый верхний угол, где центр совпадает с centroid'ом candidate'а.
        # Поскольку мы знаем размеры, просто вычисляем смещение относительно центра.
        x = cand_w // 2 - w // 2
        y = cand_h // 2 - h // 2
        return {"x": x, "y": y, "w": w, "h": h}

def process_file(file_path: Path) -> dict | None:
    """Возвращает словарь с параметрами оригинала или None, если не нашли."""
    # Ищем counterpart *_c.* в той же папке
    counterpart = file_path.name
    if not counterpart.endswith('_c.' + file_path.suffix):
        return None

    # Убираем суффикс
    base_name = counterpart[:-3]          # убираем "_c."
    base_path = file_path.with_name(base_name + file_path.suffix)

    if not base_path.exists():
        return None

    if is_animated(file_path) or is_animated(base_path):
        return None   # игнорируем анимированные файлы

    try:
        region = compute_region(file_path, base_path)
        # Приводим к целым числам, как требуется в описании
        return {
            file_path.name: {
                "x": int(region["x"]),
                "y": int(region["y"]),
                "w": int(region["w"]),
                "h": int(region["h"]),
            }
        }
    except Exception as e:
        print(f"⚠️  Ошибка при обработке {file_path}: {e}", file=sys.stderr)
        return None

def main():
    root = Path.cwd()
    results = {}

    for ext in ("*.jpg", "*.jpeg", "*.png", "*.webp"):
        for p in root.rglob(ext):
            entry = process_file(p)
            if entry:
                results.update(entry)

    # Выводим JavaScript‑объект
    if not results:
        print("const originals = {};")
        return

    lines = ["const originals = {"]
    for key, val in results.items():
        lines.append(f"  '{key.split('.')[0]}.png': {{ x: {val['x']}, y: {val['y']}, w: {val['w']}, h: {val['h']} }},")
    lines.append("};")
    print("\n".join(lines))

if __name__ == "__main__":
    main()