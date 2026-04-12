import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageOps
import os

class ImageProcessor:
    @staticmethod
    def apply_adjustments(image_path, settings):
        """
        Apply adjustments like brightness, contrast, etc.
        settings: dict containing adjustment values
        """
        img = Image.open(image_path)
        
        # Brightness
        if 'brightness' in settings:
            enhancer = ImageEnhance.Brightness(img)
            img = enhancer.enhance(settings['brightness'])
            
        # Contrast
        if 'contrast' in settings:
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(settings['contrast'])
            
        # Color (Saturation)
        if 'saturation' in settings:
            enhancer = ImageEnhance.Color(img)
            img = enhancer.enhance(settings['saturation'])

        # RGB Channel Gains
        if any(k in settings for k in ['red', 'green', 'blue']):
            r_gain = settings.get('red', 1.0)
            g_gain = settings.get('green', 1.0)
            b_gain = settings.get('blue', 1.0)
            
            if img.mode != 'RGB':
                img = img.convert('RGB')
                
            r, g, b = img.split()
            r = r.point(lambda i: i * r_gain)
            g = g.point(lambda i: i * g_gain)
            b = b.point(lambda i: i * b_gain)
            img = Image.merge('RGB', (r, g, b))
            
        # Rotation
        if 'rotation' in settings and settings['rotation'] != 0:
            img = img.rotate(-settings['rotation'], expand=True) # Counter-clockwise to match JS

        # Crop (x, y, w, h)
        if 'crop' in settings and settings['crop']:
            crop = settings['crop']
            # Crop parameters are relative to the rotated image
            x, y, w, h = int(crop['x']), int(crop['y']), int(crop['width']), int(crop['height'])
            img = img.crop((x, y, x + w, y + h))

        return img

    @staticmethod
    def crop_image(image_path, crop_params):
        """
        crop_params: [x, y, width, height]
        """
        img = Image.open(image_path)
        x, y, w, h = crop_params
        return img.crop((x, y, x + w, y + h))

    @staticmethod
    def rotate_image(image_path, angle):
        img = Image.open(image_path)
        return img.rotate(angle, expand=True)

    @staticmethod
    def resize_image(image_path, size):
        """
        size: (width, height)
        """
        img = Image.open(image_path)
        return img.resize(size, Image.Resampling.LANCZOS)

    @staticmethod
    def apply_advanced_ops(image_path, op_type, params):
        """
        Handle OpenCV specific operations if needed
        """
        img_cv = cv2.imread(image_path)
        if op_type == 'gaussian_blur':
            kernel_size = params.get('kernel_size', (5, 5))
            processed = cv2.GaussianBlur(img_cv, kernel_size, 0)
        elif op_type == 'grayscale':
            processed = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        else:
            processed = img_cv
            
        # Convert back to PIL
        processed_rgb = cv2.cvtColor(processed, cv2.COLOR_BGR2RGB)
        return Image.fromarray(processed_rgb)
