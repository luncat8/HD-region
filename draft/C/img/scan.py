#!/usr/bin/env python3
"""Поиск позиций оригиналов в outpainted изображениях"""
#pip install opencv-python
#pip install pillow pillow-avif-plugin

#теперь надо обновить скрипт создания описания чтобы копировал нужное для вставки в HTML. Соглашение о именах файлов "_c" означает central HD область

import os
import cv2
import numpy as np
import pyperclip
from pathlib import Path

from PIL import Image

def read_image_any_format(path):
    img = Image.open(path).convert("RGB")   # Pillow читает AVIF
    img = np.array(img)                     # PIL → NumPy
    img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)  # RGB → BGR (для OpenCV)
    return img
    
def find_template_position(container_path, template_path):
    """Находит позицию template в container с помощью template matching"""
    #container = cv2.imread(str(container_path), cv2.IMREAD_COLOR)
    #template = cv2.imread(str(template_path), cv2.IMREAD_COLOR)
    #in case CV2 cant read avif
    container = read_image_any_format(str(container_path))
    template = read_image_any_format(str(template_path))

    if container is None or template is None:
        return None
    
    th, tw = container.shape[:2]
    ch, cw = template.shape[:2]
    #print(th, tw, ch, cw)
    if tw > cw or th > ch:
        return None
    
    # Template matching
    result = cv2.matchTemplate(container, template, cv2.TM_CCOEFF_NORMED)
    min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)
    
    # Проверяем качество совпадения
    if max_val < 0.95:
        print(f"  Warning: low match confidence {max_val:.3f} for {template_path.name}")
        if max_val < 0.8:
            return None
    
    x, y = max_loc
    return {'x': x, 'y': y, 'w': tw, 'h': th, 'confidence': max_val}


def is_animated_webp(filepath):
    try:
        cap = cv2.VideoCapture(str(filepath))
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.release()
        return frame_count > 1
    except:
        return False


def main():
    extensions = {'.avif', '.jpg', '.jpeg', '.png', '.webp'}
    results = {}
    
    # Собираем все файлы
    all_files = {}
    for root, dirs, files in os.walk('.'):
        for fname in files:
            fpath = Path(root) / fname
            ext = fpath.suffix.lower()
            if ext not in extensions:
                continue
            if ext == '.webp' and is_animated_webp(fpath):
                print(f"Skipping animated: {fpath}")
                continue
            all_files[fpath] = fpath.stem
    
    # Ищем пары filename_c и filename
    processed = set()
    
    for fpath, stem in all_files.items():
        if not stem.endswith('_c'):
            continue
        
        base_stem = stem[:-2]  # убираем _c
        ext = fpath.suffix
        container_path = fpath
        
        # Ищем оригинал
        template_path = fpath.parent / f"{base_stem}{ext}"
        
        if template_path not in all_files:
            # Пробуем другие расширения
            found = False
            for other_ext in extensions:
                alt_path = fpath.parent / f"{base_stem}{other_ext}"
                if alt_path in all_files:
                    template_path = alt_path
                    found = True
                    break
            if not found:
                continue
        
        print(f"Processing: {container_path.name} <- {template_path.name}")
        
        pos = find_template_position(container_path, template_path)
        if pos:
            # Используем имя оригинального файла (с расширением) как ключ
            key = template_path.name
            results[key] = pos
            print(f"  Found at x={pos['x']}, y={pos['y']}, w={pos['w']}, h={pos['h']}")
        else:
            print(f"  Not found!")
        
        processed.add(container_path)
        processed.add(template_path)
    
    if not results:
        print("\nNo pairs found.")
        return
    
    # Генерируем JS код
    js_lines = []
    for fname, pos in sorted(results.items()):
        # экранируем одинарные кавычки в имени файла, если есть
        safe_fname = fname.replace("'", "\\'")
        js_lines.append(f"originals['{safe_fname}'] = {{ x: {pos['x']}, y: {pos['y']}, w: {pos['w']}, h: {pos['h']} }};")
    
    js_code = '\n'.join(js_lines)
    
    pyperclip.copy(js_code)
    print(f"\n=== Copied to clipboard ({len(results)} items) ===")
    print(js_code)


if __name__ == "__main__":
    main()