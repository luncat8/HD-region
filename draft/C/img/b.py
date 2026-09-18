"""Поиск позиций оригиналов в outpainted изображениях + Сохранение AVIF с ROI"""

import os
import cv2
import numpy as np
import pyperclip
from pathlib import Path

# Попытка импортировать AVIF поддержку
try:
    from PIL import Image
    import pillow_avif
    HAS_AVIF = True
except ImportError:
    HAS_AVIF = False
    print("Warning: 'pillow-avif-plugin' not found. Will save as PNG instead.")

def is_animated_webp(filepath):
    try:
        cap = cv2.VideoCapture(str(filepath))
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.release()
        return frame_count > 1
    except:
        return False

def find_template_position(container_path, template_path):
    """Находит позицию template в container с помощью template matching"""
    container = cv2.imread(str(container_path), cv2.IMREAD_COLOR)
    template = cv2.imread(str(template_path), cv2.IMREAD_COLOR)
    
    if container is None or template is None:
        return None
    
    th, tw = container.shape[:2]
    ch, cw = template.shape[:2]
    
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

def create_roi_avif(container_path, roi):
    """
    Создает AVIF с эмуляцией ROI:
    1. Оригинал внутри ROI = макс качество.
    2. Снаружи = сильный блюр (минимальное качество).
    3. Переход = плавный градиент.
    """
    if not HAS_AVIF:
        return

    print(f"  Generating ROI AVIF for {container_path.name}...")
    
    # 1. Загрузка
    img_bgr = cv2.imread(str(container_path))
    if img_bgr is None: return

    # 2. Создаем "базу" для сжатия (сильный размыв)
    # sigma=40-60 дает очень сильное размытие, которое AVIF сожмет в 1 байт
    blurred = cv2.GaussianBlur(img_bgr, (0, 0), sigmaX=50, sigmaY=50)

    # 3. Создаем маску весов (0.0 .. 1.0)
    h, w = img_bgr.shape[:2]
    mask = np.zeros((h, w), dtype=np.float32)
    
    rx, ry, rw, rh = roi['x'], roi['y'], roi['w'], roi['h']
    
    # Жесткая область внутри ROI = 1.0
    # Ограничиваем координаты, чтобы не вылететь
    y1, y2 = max(0, ry), min(h, ry + rh)
    x1, x2 = max(0, rx), min(w, rx + rw)
    mask[y1:y2, x1:x2] = 1.0

    # 4. Делаем плавный переход (Feathering) через Distance Transform
    # Инвертируем маску, чтобы считать дистанцию от краев ROI наружу
    inv_mask = (1 - mask).astype(np.uint8)
    dist = cv2.distanceTransform(inv_mask, cv2.DIST_L2, 5)
    
    # Настраиваем ширину перехода (например, 300px полного перехода от 1.0 до 0.0)
    feather_radius = 300 
    
    # Нормализуем: всё что ближе feather_radius = 1.0, дальше = падает до 0.0
    # Формула: 1 - (dist / radius)
    grad = 1.0 - (dist / feather_radius)
    grad = np.clip(grad, 0, 1) # Обрезаем края
    
    # Объединяем: внутри ROI было 1.0, снаружи считаем градиент
    final_mask = np.maximum(mask, grad)
    
    # Расширяем размерность маски для умножения (H, W, 1)
    final_mask_3d = final_mask[:, :, np.newaxis]

    # 5. Смешиваем (Blend)
    # Result = Original * Mask + Blurred * (1 - Mask)
    # OpenCV работает с float 0..1 для расчетов
    res_float = (img_bgr.astype(np.float32) * final_mask_3d) + \
                (blurred.astype(np.float32) * (1.0 - final_mask_3d))
    
    res_uint8 = res_float.astype(np.uint8)

    # 6. Сохраняем
    out_path = container_path.with_name(container_path.stem + "_roi.avif")
    
    try:
        img_pil = Image.fromarray(cv2.cvtColor(res_uint8, cv2.COLOR_BGR2RGB))
        # quality=100 для AVIF в Pillow обычно означает lossless или близко к тому
        # Но так как мы заранее размыли фон, файл будет маленьким даже на max quality
        img_pil.save(out_path, quality=100)
        print(f"  Saved: {out_path.name}")
    except Exception as e:
        print(f"  Error saving AVIF: {e}")

def main():
    extensions = {'.jpg', '.jpeg', '.png', '.webp'}
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
                # print(f"Skipping animated: {fpath}")
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
            print(f"  Found at x={pos['x']}, y={pos['y']}")
            
            # !!! ГЕНЕРАЦИЯ AVIF ROI !!!
            create_roi_avif(container_path, pos)
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
        safe_fname = fname.replace("'", "\\'")
        js_lines.append(f"originals['{safe_fname}'] = {{ x: {pos['x']}, y: {pos['y']}, w: {pos['w']}, h: {pos['h']} }};")
    
    js_code = '\n'.join(js_lines)
    
    pyperclip.copy(js_code)
    print(f"\n=== Copied to clipboard ({len(results)} items) ===")
    # print(js_code) # Раскомментировать если нужно видеть код в консоли


if __name__ == "__main__":
    main()