#!/usr/bin/env python3
"""Генерация тестового изображения с цветными зонами"""

import pyperclip
from PIL import Image, ImageDraw

# === НАСТРОЙКИ ===
orig_x = 512
orig_y = 256
orig_w = 768
orig_h = 1024

# Размер полного изображения (с outpaint)
full_w = 1920
full_h = 1536

output_file = "1.png"
# =================

def main():
    img = Image.new('RGB', (full_w, full_h), (80, 80, 80))
    draw = ImageDraw.Draw(img)
    
    # Закрашиваем зоны разными цветами
    # Верх - синий
    draw.rectangle([0, 0, full_w, orig_y], fill=(50, 50, 150))
    # Низ - зелёный
    draw.rectangle([0, orig_y + orig_h, full_w, full_h], fill=(50, 150, 50))
    # Лево - красный
    draw.rectangle([0, orig_y, orig_x, orig_y + orig_h], fill=(150, 50, 50))
    # Право - жёлтый
    draw.rectangle([orig_x + orig_w, orig_y, full_w, orig_y + orig_h], fill=(150, 150, 50))
    
    # Оригинальная область - белая с сеткой
    draw.rectangle([orig_x, orig_y, orig_x + orig_w, orig_y + orig_h], fill=(255, 255, 255))
    
    # Сетка внутри оригинала
    grid_step = 64
    for gx in range(orig_x, orig_x + orig_w, grid_step):
        draw.line([(gx, orig_y), (gx, orig_y + orig_h)], fill=(200, 200, 200), width=1)
    for gy in range(orig_y, orig_y + orig_h, grid_step):
        draw.line([(orig_x, gy), (orig_x + orig_w, gy)], fill=(200, 200, 200), width=1)
    
    # Рамка оригинала
    draw.rectangle([orig_x, orig_y, orig_x + orig_w - 1, orig_y + orig_h - 1], outline=(255, 0, 0), width=3)
    
    # Крест в центре оригинала
    cx = orig_x + orig_w // 2
    cy = orig_y + orig_h // 2
    draw.line([(cx - 30, cy), (cx + 30, cy)], fill=(255, 0, 0), width=2)
    draw.line([(cx, cy - 30), (cx, cy + 30)], fill=(255, 0, 0), width=2)
    
    img.save(output_file)
    print(f"Saved: {output_file} ({full_w}x{full_h})")
    print(f"Original rect: x={orig_x}, y={orig_y}, w={orig_w}, h={orig_h}")
    
    # Копируем JS код в буфер
    js_code = f"originals['{output_file}'] = {{ x: {orig_x}, y: {orig_y}, w: {orig_w}, h: {orig_h} }};"
    pyperclip.copy(js_code)
    print(f"\nCopied to clipboard:\n{js_code}")

if __name__ == "__main__":
    main()