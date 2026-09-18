#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# ------------------------------------------------------------
# gen_test.py
#   Генерирует HTML‑тестовый файл.
#   Настраиваемые параметры центральной области – измените
#   X, Y, W, H ниже.
# ------------------------------------------------------------

import textwrap

# ---------- 1. Настройки центральной области ----------
X = 512
Y = 256
W = 768
H = 1024
# -----------------------------------------------------

# Таблица со всеми тестовыми изображениями (можно добавить свои)
TEST_FILES = [
    "1.png",
]

# Строка, которую нужно вставить в скрипт
def make_js_originals_block(file_path: str) -> str:
    return f"""originals['{file_path}'] = {{ x: {X}, y: {Y}, w: {W}, h: {H} }};"""

# Генерируем HTML‑шаблон
html_template = textwrap.dedent("""\
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Auto‑resize background</title>
  <style>
    html, body {{ margin:0; height:100%; overflow:hidden; }}
    #bg {{
      position:fixed; 
      inset:0; 
      background-size:contain; 
      background-repeat:no-repeat; 
      background-position:center; 
      background-origin:content-box; 
      width:100%; height:100%;
    }}
    #canvas {{
      position:absolute; 
      inset:0; 
      pointer-events:none; 
    }}
  </style>
</head>
<body>
  <div id="bg"><img id="bgImg" src="{TEST_FILES[0]}"></div>
  <canvas id="canvas"></canvas>

  <script>
    // ---------- Описание центральной области ----------
    const originals = {{
{snippet}
    }};

    // ---------- Загрузка изображения ----------
    const bgImg = document.getElementById('bgImg');
    const imgUrl = location.search.slice(1) || '{TEST_FILES[0].split('.')[0]}.png';
    bgImg.src = imgUrl;

    // ---------- Отрисовка выделенной области ----------
    const ctx = document.getElementById('canvas').getContext('2d');

    function drawHighlight() {{
      const src = bgImg;
      if (!src.naturalWidth) return;

      const srcW = src.naturalWidth;
      const srcH = src.naturalHeight;
      const rect = originals['{TEST_FILES[0]}'];

      const scale = Math.min(window.innerWidth / rect.w, window.innerHeight / rect.h);
      const drawScale = scale;                     // масштаб, позволяющий полностью разместить область

      const offsetX = (window.innerWidth  - rect.w * drawScale) / 2;
      const offsetY = (window.innerHeight - rect.h * drawScale) / 2;

      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      ctx.fillStyle = 'rgba(255,0,0,0.4)';
      ctx.fillRect(
        offsetX + rect.x * drawScale,
        offsetY + rect.y * drawScale,
        rect.w * drawScale,
        rect.h * drawScale
      );
    }}

    window.addEventListener('resize', drawHighlight);
    bgImg.onload = drawHighlight;
  </script>
</body>
</html>
""")

# ------------------------------------------------------------
# 2. Формируем строку, которую вставляем в шаблон
# ------------------------------------------------------------
snippet = "\n".join(make_js_originals_block(f) for f in TEST_FILES)

# ------------------------------------------------------------
# 3. Заполняем шаблон и выводим результат
# ------------------------------------------------------------
print(html_template.format(snippet=snippet))