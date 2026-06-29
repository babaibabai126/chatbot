"""Generate PWA icons for AAROHAN Business Hub"""
from PIL import Image, ImageDraw, ImageFont
import os

ICON_DIR = "/home/z/my-project/public/icons"
os.makedirs(ICON_DIR, exist_ok=True)

SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512]

def create_icon(size: int):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    margin = size // 12
    radius = size // 5
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius,
        fill=(5, 150, 105)
    )
    
    circle_margin = size // 4
    draw.ellipse(
        [circle_margin, circle_margin, size - circle_margin, size - circle_margin],
        fill=(4, 120, 87)
    )
    
    font_size = size // 3
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    text = "AH"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) // 2
    y = (size - text_h) // 2 - bbox[1]
    
    draw.text((x, y), text, fill=(255, 255, 255), font=font)
    
    filepath = os.path.join(ICON_DIR, f"icon-{size}x{size}.png")
    img.save(filepath, "PNG")
    print(f"Created {filepath}")

for size in SIZES:
    create_icon(size)

# Apple touch icon (180x180)
src = os.path.join(ICON_DIR, "icon-180x180.png")
dst = os.path.join(ICON_DIR, "apple-touch-icon.png")
if os.path.exists(src):
    os.rename(src, dst)
    print(f"Created {dst}")

# Favicon
img_32 = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
draw_32 = ImageDraw.Draw(img_32)
draw_32.rounded_rectangle([2, 2, 30, 30], radius=6, fill=(5, 150, 105))
try:
    font_32 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
except:
    font_32 = ImageFont.load_default()
draw_32.text((6, 7), "AH", fill=(255, 255, 255), font=font_32)
img_32.save("/home/z/my-project/public/icons/favicon.png", "PNG")
print("Created favicon.png")

print("\n✅ All icons generated!")
