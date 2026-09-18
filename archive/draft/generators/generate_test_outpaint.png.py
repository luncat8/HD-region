
from PIL import Image, ImageDraw, ImageFont
import sys
import os
import subprocess

# Настройки original rect
x = 512
y = 256
w = 768
h = 1024

# canvas size (пример: original в центре с outpaint по 512 пикселей вокруг)
left_pad = 512
right_pad = 512
top_pad = 256
bottom_pad = 256

img_w = left_pad + w + right_pad
img_h = top_pad + h + bottom_pad

out_name = "test_outpaint.png"

img = Image.new("RGBA", (img_w, img_h), (40,40,40,255))
draw = ImageDraw.Draw(img)

# draw outpaint zones in different colors
# center original area: neutral
orig_box = (left_pad, top_pad, left_pad + w, top_pad + h)
draw.rectangle(orig_box, fill=(220,220,220,255))

# left outpaint
draw.rectangle((0,0,left_pad,img_h), fill=(180,80,80,255))
# right outpaint
draw.rectangle((left_pad + w,0,img_w,img_h), fill=(80,180,80,255))
# top outpaint
draw.rectangle((left_pad,0,left_pad+w,top_pad), fill=(80,80,180,255))
# bottom outpaint
draw.rectangle((left_pad,top_pad+h,left_pad+w,img_h), fill=(200,180,80,255))

# corners (overlap) add stripes to visualize edges
for i in range(0, img_w, 40):
	for j in range(0, img_h, 40):
		if i < left_pad or i >= left_pad + w or j < top_pad or j >= top_pad + h:
			if (i//40 + j//40) % 2 == 0:
				draw.rectangle((i, j, i+20, j+20), fill=(0,0,0,40))

# draw border around original
draw.rectangle(orig_box, outline=(0,0,0,255), width=4)

# label sizes and positions
try:
	font = ImageFont.truetype("DejaVuSans.ttf", 20)
except:
	font = ImageFont.load_default()

draw.text((10,10), f"canvas {img_w}x{img_h}", fill=(255,255,255,255), font=font)
draw.text((10,40), f"original: {{ x: {x}, y: {y}, w: {w}, h: {h} }}", fill=(255,255,255,255), font=font)

# save
img.save(out_name)
print("Saved", out_name)

# compute original rect in image coordinates relative to whole image
orig_str = f"original: {{ x: {x}, y: {y}, w: {w}, h: {h} }}"

# But note: in viewer we assumed original rect refers to image pixels.
# In this generator we've put the original area at (left_pad, top_pad) inside image.
# To make viewer work, user can either paste the orig_str above with x,y referring to the central region coordinates inside the image.
# For convenience, also print the coordinates relative to the generated image:
rel_x = left_pad + 0
rel_y = top_pad + 0
rel_str = f"original: {{ x: {rel_x}, y: {rel_y}, w: {w}, h: {h} }}"
print("Use this original rect string in HTML/JS (image pixel coords):")
print(rel_str)

# try to copy to clipboard (cross-platform best-effort)
copied = False
try:
	platform = sys.platform
	if platform == "darwin":
		p = subprocess.Popen("pbcopy", env=os.environ, stdin=subprocess.PIPE)
		p.communicate(rel_str.encode("utf-8"))
		copied = True
	elif platform.startswith("win"):
		import ctypes
		if ctypes.windll.user32.OpenClipboard(None):
			ctypes.windll.user32.EmptyClipboard()
			h = ctypes.windll.kernel32.GlobalAlloc(0x2000, len(rel_str.encode("utf-8")) + 1)
			ptr = ctypes.windll.kernel32.GlobalLock(h)
			ctypes.cdll.msvcrt.strcpy(ctypes.c_char_p(ptr), rel_str.encode("utf-8"))
			ctypes.windll.kernel32.GlobalUnlock(h)
			ctypes.windll.user32.SetClipboardData(1, h)
			ctypes.windll.user32.CloseClipboard()
			copied = True
	elif platform.startswith("linux"):
		# try xclip then xsel
		p = subprocess.Popen(["xclip","-selection","clipboard"], stdin=subprocess.PIPE)
		p.communicate(rel_str.encode("utf-8"))
		if p.returncode == 0:
			copied = True
		else:
			p = subprocess.Popen(["xsel","--clipboard","--input"], stdin=subprocess.PIPE)
			p.communicate(rel_str.encode("utf-8"))
			if p.returncode == 0:
				copied = True
except Exception as e:
	pass

if copied:
	print("Original rect string copied to clipboard.")
else:
	print("Could not copy to clipboard automatically. Please copy the line below manually:")
	print(rel_str)
