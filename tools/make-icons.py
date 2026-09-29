from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent / "public"
OUT = ROOT / "icons"
OUT.mkdir(exist_ok=True)

BG = (34, 32, 46)
COLORS = [(255, 107, 139), (77, 163, 255)]
PATTERN = [[0, 1, 0], [1, 0, 1], [0, 1, 1]]
SCALE = 4


def font(px):
    for f in [ROOT / "fonts" / "nunito-latin.woff2", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
        try:
            ft = ImageFont.truetype(str(f), px)
            try:
                ft.set_variation_by_axes([900])
            except Exception:
                pass
            return ft
        except Exception:
            continue
    return ImageFont.load_default()


def shade(c, k=0.84):
    return tuple(int(v * k) for v in c)


def render(size, content_frac, rounded, transparent):
    S = size * SCALE
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0) if transparent else BG + (255,))
    d = ImageDraw.Draw(img)
    if transparent:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * rounded), fill=BG + (255,))
    grid = S * content_frac
    gap = grid * 0.07
    tile = (grid - 2 * gap) / 3
    x0 = (S - grid) / 2
    y0 = (S - grid) / 2
    r = tile * 0.24
    depth = tile * 0.09
    for gy in range(3):
        for gx in range(3):
            c = COLORS[PATTERN[gy][gx]]
            x = x0 + gx * (tile + gap)
            y = y0 + gy * (tile + gap)
            d.rounded_rectangle([x, y, x + tile, y + tile], radius=r, fill=shade(c))
            d.rounded_rectangle([x, y, x + tile, y + tile - depth], radius=r, fill=c)
    ft = font(int(tile * 0.86))
    cx = x0 + 1.5 * tile + gap
    cy = y0 + 1.5 * tile + gap - depth / 2
    d.text((cx, cy), "3", font=ft, fill=(31, 29, 43), anchor="mm")
    return img.resize((size, size), Image.LANCZOS)


def main():
    render(512, 0.62, 0.22, True).save(OUT / "icon-512.png")
    render(192, 0.62, 0.22, True).save(OUT / "icon-192.png")
    render(512, 0.5, 0, False).save(OUT / "maskable-512.png")
    render(180, 0.6, 0, False).convert("RGB").save(OUT / "apple-touch-icon.png")
    render(32, 0.8, 0.2, True).save(OUT / "favicon-32.png")
    svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
        '<rect width="64" height="64" rx="14" fill="#22202E"/>',
    ]
    hexes = ["#FF6B8B", "#4DA3FF"]
    for gy in range(3):
        for gx in range(3):
            svg.append(f'<rect x="{8 + gx * 17}" y="{8 + gy * 17}" width="14" height="14" rx="3.5" fill="{hexes[PATTERN[gy][gx]]}"/>')
    svg.append('<text x="32" y="37.5" font-family="Nunito,Arial,sans-serif" font-weight="900" font-size="13" text-anchor="middle" fill="#1F1D2B">3</text>')
    svg.append("</svg>")
    (OUT / "favicon.svg").write_text("".join(svg))
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
