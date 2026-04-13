from PIL import Image
import numpy as np
from processor import ImageProcessor
import os

def test_rgb_gains():
    # Create a red image
    img = Image.new('RGB', (100, 100), color=(100, 0, 0))
    
    # Apply settings to increase red
    settings = {'red': 1000} # Should double red to 200
    
    print(f"Original pixel: {img.getpixel((0,0))}")
    processed = ImageProcessor.apply_adjustments(img, settings)
    new_pixel = processed.getpixel((0,0))
    print(f"Processed pixel (red: 1000): {new_pixel}")
    
    # Apply settings to decrease red
    settings = {'red': 250} # Should half red to 50
    processed = ImageProcessor.apply_adjustments(img, settings)
    new_pixel = processed.getpixel((0,0))
    print(f"Processed pixel (red: 250): {new_pixel}")

    # Test string inputs
    print("\nTesting string inputs:")
    settings = {'red': "1000"} 
    try:
        processed = ImageProcessor.apply_adjustments(img, settings)
        print(f"Processed pixel (red: '1000'): {processed.getpixel((0,0))}")
    except Exception as e:
        print(f"Caught expected error with string input: {e}")

if __name__ == "__main__":
    test_rgb_gains()
