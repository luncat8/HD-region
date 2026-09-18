#!/usr/bin/env python3
from PIL import Image
import numpy as np
import subprocess
import sys

def avif_roi_encode(input_path, output_path, center_q=100, edge_q=20):
    """AVIF с гауссовым ROI"""
    img = Image.open(input_path)
    w, h = img.size
    
    # Создаем gain map (гауссиана)
    y, x = np.ogrid[:h, :w]
    cy, cx = h/2, w/2
    sigma = min(w, h) * 0.35
    
    gaussian = np.exp(-((x-cx)**2 + (y-cy)**2) / (2*sigma**2))
    gain_map = (gaussian * (center_q - edge_q) + edge_q).astype(np.uint8)
    
    # Сохраняем
    Image.fromarray(gain_map).save('_roi_gain.png')
    
    # Кодируем
    cmd = [
        'avifenc', '-s', '6', '-q', str(center_q),
        '--gain-map', '_roi_gain.png',
        input_path, output_path
    ]
    subprocess.run(cmd, check=True)
    print(f"✅ {output_path} создан!")

# Использование
avif_roi_encode('1.png', 'photo_roi.avif', center_q=100, edge_q=15)