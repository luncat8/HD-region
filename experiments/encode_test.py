#!/usr/bin/env python3
"""
encode_test.py — measure AVIF filler strategies for the HD-region pipeline.

For each source image + ROI rect, encodes the candidate "base/filler" variants
and prints byte sizes, so the plan-tools decision is backed by real encoder
output, not guesses:

  A  full image, q40                 (plain high compression)
  B  full image, q25                 (quality-adjust only)
  C  ROI painted black, q40          (user proposal)
  D  ROI = 1/16 downscale upscaled (nearest), q40   ("remnant" hole)
  D2 ROI = 1/16 downscale upscaled (bilinear), q40
  E  ROI strongly blurred, q40       (the LLM-suggested blur trick)
  F  four tiles L/R/T/D around ROI, q40 (sum)

plus H = the HD crop itself at q80 for reference.

Run: .venv/bin/python experiments/encode_test.py
"""
import io
import sys
from PIL import Image, ImageFilter
import pillow_avif  # noqa: F401  (registers AVIF)

Q_BASE = 40
Q_LOW = 25
Q_HD = 80

CASES = [
	("input/3.avif", (476, 101, 1016, 900)),   # real photo outpaint
	("input/1.png", (477, 239, 804, 1056)),    # synthetic flat zones
]


def enc(img, q):
	buf = io.BytesIO()
	img.convert("RGB").save(buf, "AVIF", quality=q)
	return buf.tell()


def hole(img, rect, fill):
	out = img.copy()
	x, y, w, h = rect
	out.paste(fill, (x, y, x + w, y + h))
	return out


def remnant(img, rect, resample):
	x, y, w, h = rect
	roi = img.crop((x, y, x + w, y + h))
	small = roi.resize((max(1, w // 16), max(1, h // 16)), Image.BILINEAR)
	return hole(img, rect, small.resize((w, h), resample))


def tiles(img, rect, q):
	W, H = img.size
	x, y, w, h = rect
	parts = [
		(0, 0, x, H),          # L
		(x + w, 0, W, H),      # R
		(x, 0, x + w, y),      # T
		(x, y + h, x + w, H),  # D
	]
	total = 0
	for box in parts:
		if box[2] - box[0] < 1 or box[3] - box[1] < 1:
			continue
		total += enc(img.crop(box), q)
	return total


def main():
	for path, rect in CASES:
		img = Image.open(path).convert("RGB")
		x, y, w, h = rect
		rows = [
			("A full q40", enc(img, Q_BASE)),
			("B full q25", enc(img, Q_LOW)),
			("C black hole q40", enc(hole(img, rect, Image.new("RGB", (w, h), (0, 0, 0))), Q_BASE)),
			("D remnant nearest q40", enc(remnant(img, rect, Image.NEAREST), Q_BASE)),
			("D2 remnant bilinear q40", enc(remnant(img, rect, Image.BILINEAR), Q_BASE)),
			("E blur roi q40", enc(hole(img, rect, img.crop((x, y, x + w, y + h)).filter(ImageFilter.GaussianBlur(30))), Q_BASE)),
			("F 4 tiles q40", tiles(img, rect, Q_BASE)),
			("H hd crop q80", enc(img.crop((x, y, x + w, y + h)), Q_HD)),
		]
		print(f"== {path} {img.size} rect={rect}")
		base = rows[0][1]
		for name, size in rows:
			print(f"\t{name:<24} {size // 1024:>4} KB  ({size / base:.2f}x A)")
	return 0


if __name__ == "__main__":
	sys.exit(main())
