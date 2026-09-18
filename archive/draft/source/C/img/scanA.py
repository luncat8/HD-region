#!/usr/bin/env python3
import os
from pathlib import Path
import cv2
import numpy as np
import pyperclip

EXTS = ['.jpg', '.jpeg', '.png', '.webp']
THRESH_WARN = 0.95
THRESH_ACCEPT = 0.8

def is_animated_webp(p: Path) -> bool:
    try:
        cap = cv2.VideoCapture(str(p))
        cnt = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.release()
        return cnt > 1
    except Exception:
        return False

def read_image(p: Path):
    img = cv2.imread(str(p), cv2.IMREAD_COLOR)
    return img

def find_template_position(container_path: Path, template_path: Path):
    cont = read_image(container_path)
    templ = read_image(template_path)
    if cont is None:
        print(f"Can't read container: {container_path}")
        return None
    if templ is None:
        print(f"Can't read template: {template_path}")
        return None
    th, tw = templ.shape[:2]
    ch, cw = cont.shape[:2]
    if tw > cw or th > ch:
        return None
    res = cv2.matchTemplate(cont, templ, cv2.TM_CCOEFF_NORMED)
    _, max_val, _, max_loc = cv2.minMaxLoc(res)
    if max_val < THRESH_WARN:
        print(f"  Warning: low match confidence {max_val:.3f} for {template_path.name}")
        if max_val < THRESH_ACCEPT:
            return None
    x, y = max_loc
    return {'x': int(x), 'y': int(y), 'w': int(tw), 'h': int(th), 'confidence': float(max_val)}

def collect_files(root='.'):
    files = {}
    for r, _, fnames in os.walk(root):
        for fn in fnames:
            p = Path(r) / fn
            ext = p.suffix.lower()
            if ext not in EXTS:
                continue
            if ext == '.webp' and is_animated_webp(p):
                # skip animated webp
                continue
            files[p.resolve()] = p.stem
    return files

def main():
    files = collect_files('.')
    if not files:
        print("No image files found.")
        return

    results = {}
    # build quick lookup of stems with extensions
    # map: (parent_resolved, stem) -> list of Path(s) with different ext
    lookup = {}
    for p in files.keys():
        key = (p.parent.resolve(), p.stem)
        lookup.setdefault(key, []).append(p)

    for p in sorted(files.keys()):
        stem = files[p]
        if not stem.endswith('_c'):
            continue
        base_stem = stem[:-2]
        parent = p.parent.resolve()
        # try same extension first
        candidate = parent / f"{base_stem}{p.suffix.lower()}"
        candidate = candidate.resolve()
        found_template = None
        if candidate in files:
            found_template = candidate
        else:
            # try other extensions in deterministic order
            for ext in EXTS:
                alt = (parent / f"{base_stem}{ext}").resolve()
                if alt in files:
                    found_template = alt
                    break
        if not found_template:
            # not found original file
            continue

        print(f"Processing: {p.name} <- {found_template.name}")
        pos = find_template_position(p, found_template)
        if pos:
            # key = path relative to cwd, use posix with no leading './'
            rel = os.path.relpath(p, start='.')
            results[rel] = pos
            print(f"  Found at x={pos['x']}, y={pos['y']}, w={pos['w']}, h={pos['h']} (conf {pos['confidence']:.3f})")
        else:
            print("  Not found!")

    if not results:
        print("\nNo pairs found.")
        return

    # produce JS lines
    lines = []
    lines.append("const originals = originals || {};")
    for fname in sorted(results.keys()):
        pos = results[fname]
        # escape single quotes in path
        safe = fname.replace("'", "\\'")
        lines.append(f"originals['{safe}'] = {{ x: {pos['x']}, y: {pos['y']}, w: {pos['w']}, h: {pos['h']} }};")

    js = "\n".join(lines)
    pyperclip.copy(js)
    print(f"\n=== Copied to clipboard ({len(results)} items) ===")
    print(js)

if __name__ == "__main__":
    main()
