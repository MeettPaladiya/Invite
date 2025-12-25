
import os
from PIL import Image
import random

def generate_noise(width=512, height=512, opacity=0.1):
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = image.load()
    
    for y in range(height):
        for x in range(width):
            if random.random() > 0.5:
                # White noise pixel
                alpha = int(255 * opacity)
                pixels[x, y] = (255, 255, 255, alpha)
    
    output_path = "/home/thommas/Desktop/Project_B/frontend/public/noise.png"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    image.save(output_path, "PNG")
    print(f"Noise texture generated at {output_path}")

if __name__ == "__main__":
    generate_noise()
