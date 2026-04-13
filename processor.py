import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageOps
import os

class ImageProcessor:
    @staticmethod
    def apply_adjustments(image_path, settings):
        """
        Apply professional adjustments using NumPy and PIL.
        """
        img = Image.open(image_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Convert to NumPy array for advanced processing (float32 for precision)
        arr = np.array(img).astype(np.float32) / 255.0

        # --- 1. Exposure ---
        if 'exposure' in settings and settings['exposure'] != 0:
            exposure_val = settings['exposure'] / 200.0
            arr = arr * (2 ** exposure_val)

        # --- 2. WB: Temperature & Tint ---
        # Temperature (Blue-Yellow): -1 to 1
        if 'temperature' in settings and settings['temperature'] != 0:
            temp = settings['temperature'] / 1000.0
            if temp > 0: # Warmer (Yellow/Red)
                arr[:,:,0] += temp * 0.1 # Red
                arr[:,:,2] -= temp * 0.1 # Blue
            else: # Cooler (Blue)
                arr[:,:,0] += temp * 0.1
                arr[:,:,2] -= temp * 0.1
        
        # Tint (Green-Magenta): -1 to 1
        if 'tint' in settings and settings['tint'] != 0:
            tint = settings['tint'] / 1000.0
            arr[:,:,1] -= tint * 0.05 # Green channel

        # --- 3. Light: Highlights, Shadows, Whites, Blacks ---
        # Calculate luminance (standard coefficients)
        lumi = 0.299 * arr[:,:,0] + 0.587 * arr[:,:,1] + 0.114 * arr[:,:,2]
        lumi = np.stack([lumi, lumi, lumi], axis=-1)

        # Highlights & Shadows
        if 'highlights' in settings and settings['highlights'] != 0:
            h_val = settings['highlights'] / 1000.0
            h_mask = np.clip((lumi - 0.5) * 2, 0, 1)
            arr = arr + h_mask * (h_val * 0.2)
            
        if 'shadows' in settings and settings['shadows'] != 0:
            s_val = settings['shadows'] / 1000.0
            s_mask = np.clip((0.5 - lumi) * 2, 0, 1)
            arr = arr + s_mask * (s_val * 0.2)

        # Whites & Blacks
        if 'whites' in settings and settings['whites'] != 0:
            w_val = settings['whites'] / 1000.0
            arr = arr + (lumi > 0.7) * (w_val * 0.1)
        if 'blacks' in settings and settings['blacks'] != 0:
            b_val = settings['blacks'] / 1000.0
            arr = arr + (lumi < 0.3) * (b_val * 0.1)

        # Clip after additions
        arr = np.clip(arr, 0, 1)

        # --- 4. Presence: Vibrance, Clarity, Dehaze ---
        # Convert back to uint8 for some PIL ops or continue in NP
        img = Image.fromarray((arr * 255).astype(np.uint8))

        # Brightness (Original)
        if 'brightness' in settings and settings['brightness'] != 200.0:
            enhancer = ImageEnhance.Brightness(img)
            img = enhancer.enhance(settings['brightness'] / 200.0)
            
        # Contrast (Original)
        if 'contrast' in settings and settings['contrast'] != 200.0:
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(settings['contrast'] / 200.0)
            
        # Saturation (Original)
        if 'saturation' in settings and settings['saturation'] != 200.0:
            enhancer = ImageEnhance.Color(img)
            img = enhancer.enhance(settings['saturation'] / 200.0)

        # Vibrance (Smart Saturation)
        if 'vibrance' in settings and settings['vibrance'] != 0:
            arr_v = np.array(img).astype(np.float32) / 255.0
            hsv = cv2.cvtColor(arr_v, cv2.COLOR_RGB2HSV)
            sat = hsv[:,:,1]
            vibrance = settings['vibrance'] / 1000.0
            hsv[:,:,1] = np.clip(sat + (vibrance * (1.0 - sat) * 0.5), 0, 1)
            arr_v = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
            img = Image.fromarray((arr_v * 255).astype(np.uint8))

        # Clarity (Local Contrast)
        if 'clarity' in settings and settings['clarity'] != 0:
            arr_c = np.array(img)
            blur = cv2.GaussianBlur(arr_c, (0, 0), 10)
            clarity_val = settings['clarity'] / 1000.0
            img = Image.fromarray(cv2.addWeighted(arr_c, 1 + clarity_val*0.5, blur, -clarity_val*0.5, 0))

        # Dehaze
        if 'dehaze' in settings and settings['dehaze'] != 0:
            dehaze_val = settings['dehaze'] / 1000.0
            enhancer_c = ImageEnhance.Contrast(img)
            img = enhancer_c.enhance(1.0 + dehaze_val * 0.2)
            enhancer_s = ImageEnhance.Color(img)
            img = enhancer_s.enhance(1.0 + dehaze_val * 0.1)

        # RGB Channel Gains
        if any(k in settings for k in ['red', 'green', 'blue']):
            r_gain = settings.get('red', 500.0) / 500.0
            g_gain = settings.get('green', 500.0) / 500.0
            b_gain = settings.get('blue', 500.0) / 500.0
            
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
