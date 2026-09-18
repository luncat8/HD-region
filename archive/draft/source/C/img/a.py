"""Поиск позиций оригиналов в outpainted изображениях + сохранение в AVIF с эмуляцией ROI"""

import os
import cv2
import numpy as np
import pyperclip
from pathlib import Path
from PIL import Image
import sys

# Проверка поддержки AVIF
try:
    import pillow_avif_plugin
    AVIF_SUPPORTED = True
except ImportError:
    AVIF_SUPPORTED = False
    print("Предупреждение: pillow_avif_plugin не установлен. AVIF сохранение недоступно.")
    print("Установите: pip install pillow-avif-plugin")

def is_animated_webp(filepath):
    """Проверяет, является ли webp анимированным"""
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
    
    th, tw = template.shape[:2]
    ch, cw = container.shape[:2]
    
    if tw > cw or th > ch:
        return None
    
    # Template matching
    result = cv2.matchTemplate(container, template, cv2.TM_CCOEFF_NORMED)
    min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)
    
    # Проверяем качество совпадения
    if max_val < 0.95:
        print(f"  Предупреждение: низкая уверенность {max_val:.3f} для {template_path.name}")
        if max_val < 0.8:
            return None
    
    x, y = max_loc
    return {'x': x, 'y': y, 'w': tw, 'h': th, 'confidence': max_val}

def create_roi_mask(shape, roi_pos, feather=0):
    """
    Создает маску ROI. 1.0 внутри ROI, 0.0 снаружи.
    С feather > 0 создает плавный переход (гамма-коррекция)
    """
    mask = np.zeros(shape[:2], dtype=np.float32)
    x, y, w, h = roi_pos['x'], roi_pos['y'], roi_pos['w'], roi_pos['h']
    
    if feather > 0:
        # Создаем жесткую маску
        hard_mask = np.zeros(shape[:2], dtype=np.float32)
        hard_mask[y:y+h, x:x+w] = 1.0
        
        # Размываем границы
        mask = cv2.GaussianBlur(hard_mask, (feather*2+1, feather*2+1), 0)
        # Нормализуем
        mask = np.clip(mask, 0, 1)
    else:
        mask[y:y+h, x:x+w] = 1.0
    
    return mask

def save_avif_with_roi_emulated(image_path, roi_pos, output_path, 
                               roi_quality=90, bg_quality=20, 
                               blur_kernel=51, feather=30):
    """
    Сохраняет изображение в AVIF с эмуляцией ROI через pre-blur + маска.
    
    Аргументы:
    - image_path: путь к исходному изображению
    - roi_pos: dict с координатами ROI {x, y, w, h}
    - output_path: путь для сохранения AVIF
    - roi_quality: качество для ROI (1-100)
    - bg_quality: качество для фона (1-100), влияет на степень blur
    - blur_kernel: размер ядра размытия для фона
    - feather: размер плавного перехода на границе ROI
    """
    if not AVIF_SUPPORTED:
        print("  Ошибка: AVIF поддержка не доступна")
        return False
    
    # Загружаем изображение
    img = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if img is None:
        print(f"  Ошибка: не удалось загрузить {image_path}")
        return False
    
    # Создаем маску ROI с плавным переходом
    mask = create_roi_mask(img.shape, roi_pos, feather=feather)
    
    # Размываем всё изображение (эмуляция сильного сжатия)
    # Чем ниже bg_quality, тем сильнее размытие
    blur_intensity = max(1, int((100 - bg_quality) / 100 * blur_kernel))
    if blur_intensity % 2 == 0:
        blur_intensity += 1
    
    blurred = cv2.GaussianBlur(img, (blur_intensity, blur_intensity), 0)
    
    # Смешиваем оригинал и размытое изображение через маску
    mask_3ch = mask[:, :, np.newaxis]
    result = (img.astype(np.float32) * mask_3ch + 
              blurred.astype(np.float32) * (1.0 - mask_3ch))
    result = np.clip(result, 0, 255).astype(np.uint8)
    
    # Конвертируем в PIL Image (RGB)
    result_rgb = cv2.cvtColor(result, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(result_rgb)
    
    # Вычисляем среднее качество на основе площади ROI
    total_pixels = img.shape[0] * img.shape[1]
    roi_pixels = roi_pos['w'] * roi_pos['h']
    bg_pixels = total_pixels - roi_pixels
    
    if total_pixels > 0:
        # Взвешенное качество
        quality = int((roi_quality * roi_pixels + bg_quality * bg_pixels) / total_pixels)
    else:
        quality = roi_quality
    
    # Сохраняем в AVIF
    try:
        pil_image.save(output_path, 'AVIF', quality=quality)
        print(f"  Сохранено в AVIF: {output_path.name} (качество: {quality})")
        return True
    except Exception as e:
        print(f"  Ошибка сохранения AVIF: {e}")
        return False

def main():
    # Параметры AVIF
    SAVE_AVIF = True  # Можно выключить
    ROI_QUALITY = 90   # Высокое качество для оригинального региона
    BG_QUALITY = 15    # Низкое качество для outpainted области (сильное размытие)
    BLUR_KERNEL = 51   # Базовый размер ядра размытия
    FEATHER = 30       # Плавность перехода
    
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
                print(f"Пропуск анимированного: {fpath}")
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
        
        print(f"\nОбработка: {container_path.name} <- {template_path.name}")
        
        pos = find_template_position(container_path, template_path)
        if pos:
            # Используем имя оригинального файла (с расширением) как ключ
            key = template_path.name
            results[key] = pos
            print(f"  Найдено: x={pos['x']}, y={pos['y']}, w={pos['w']}, h={pos['h']}")
            
            # Сохраняем в AVIF с эмуляцией ROI
            if SAVE_AVIF and AVIF_SUPPORTED:
                output_path = container_path.with_suffix('.avif')
                save_avif_with_roi_emulated(
                    container_path, 
                    pos,
                    output_path,
                    roi_quality=ROI_QUALITY,
                    bg_quality=BG_QUALITY,
                    blur_kernel=BLUR_KERNEL,
                    feather=FEATHER
                )
        else:
            print(f"  Не найдено!")
        
        processed.add(container_path)
        processed.add(template_path)
    
    if not results:
        print("\nНе найдено пар.")
        return
    
    # Генерируем JS код
    js_lines = []
    for fname, pos in sorted(results.items()):
        # экранируем одинарные кавычки в имени файла, если есть
        safe_fname = fname.replace("'", "\\'")
        js_lines.append(f"originals['{safe_fname}'] = {{ x: {pos['x']}, y: {pos['y']}, w: {pos['w']}, h: {pos['h']} }};")
    
    js_code = '\n'.join(js_lines)
    
    pyperclip.copy(js_code)
    print(f"\n=== Скопировано в буфер ({len(results)} элементов) ===")
    print(js_code)


if __name__ == "__main__":
    main()