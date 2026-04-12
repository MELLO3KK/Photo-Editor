import pytest
import os
from PIL import Image
from processor import ImageProcessor

def test_image_adjustments():
    # Create a dummy image
    img = Image.new('RGB', (100, 100), color='red')
    img_path = 'test_img.jpg'
    img.save(img_path)
    
    try:
        settings = {'brightness': 1.5, 'contrast': 1.2}
        processed = ImageProcessor.apply_adjustments(img_path, settings)
        
        assert processed.size == (100, 100)
        # Check if actually different (hard to check exact values without deep pixel analysis)
        assert processed.getpixel((0,0)) != img.getpixel((0,0))
    finally:
        if os.path.exists(img_path):
            os.remove(img_path)

def test_image_rotation():
    img = Image.new('RGB', (100, 50), color='blue')
    img_path = 'test_rot.jpg'
    img.save(img_path)
    
    try:
        settings = {'rotation': 90}
        processed = ImageProcessor.apply_adjustments(img_path, settings)
        
        # 90 deg rotation of 100x50 should be 50x100
        assert processed.size == (50, 100)
    finally:
        if os.path.exists(img_path):
            os.remove(img_path)
