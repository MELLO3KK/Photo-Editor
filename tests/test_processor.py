import pytest
import os
from PIL import Image
from processor import ImageProcessor

def test_image_adjustments():
    # Create a dummy gray image (mid-tone)
    img = Image.new('RGB', (100, 100), color=(128, 128, 128))
    img_path = 'test_img.jpg'
    img.save(img_path)
    
    try:
        settings = {'brightness': 1.5, 'contrast': 1.2}
        processed = ImageProcessor.apply_adjustments(img_path, settings)
        
        assert processed.size == (100, 100)
        # Check if actually different
        assert processed.getpixel((0,0)) != img.getpixel((0,0))
    finally:
        if os.path.exists(img_path):
            os.remove(img_path)

def test_advanced_adjustments():
    img = Image.new('RGB', (100, 100), color=(128, 128, 128))
    img_path = 'test_adv.jpg'
    img.save(img_path)
    
    try:
        # Test Exposure
        settings = {'exposure': 1.0}
        processed = ImageProcessor.apply_adjustments(img_path, settings)
        assert processed.getpixel((0,0))[0] > 128

        # Test Temperature
        settings = {'temperature': 0.5}
        processed = ImageProcessor.apply_adjustments(img_path, settings)
        r, g, b = processed.getpixel((0,0))
        assert r > b # Warmer shifts red up, blue down

        # Test Clarity
        settings = {'clarity': 1.0}
        processed = ImageProcessor.apply_adjustments(img_path, settings)
        assert processed.size == (100, 100)
        
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
