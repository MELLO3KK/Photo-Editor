import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageOps
import os

class ImageProcessor:
    @staticmethod
    def apply_adjustments(image_input, settings):
        """
        Apply professional adjustments using NumPy and PIL.
        image_input can be a file path or a PIL Image object.
        """
        if isinstance(image_input, Image.Image):
            img = image_input
        else:
            img = Image.open(image_input)
            
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Normalize settings to floats
        numeric_keys = [
            'exposure', 'brightness', 'contrast', 'saturation', 
            'temperature', 'tint', 'highlights', 'shadows', 
            'whites', 'blacks', 'vibrance', 'clarity', 'dehaze',
            'red', 'green', 'blue', 'rotation', 'sharpness'
        ]
        for key in numeric_keys:
            if key in settings:
                try:
                    settings[key] = float(settings[key])
                except (ValueError, TypeError):
                    pass

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

        # --- 3.5 RGB Channel Gains (applied once at the end for consistency) ---
        # Note: We apply RGB gains after all other adjustments for accurate color grading
        if any(k in settings for k in ['red', 'green', 'blue']):
            r_gain = settings.get('red', 500.0) / 500.0
            g_gain = settings.get('green', 500.0) / 500.0
            b_gain = settings.get('blue', 500.0) / 500.0
            
            arr = np.array(img).astype(np.float32) / 255.0
            arr[:,:,0] *= r_gain
            arr[:,:,1] *= g_gain
            arr[:,:,2] *= b_gain
            arr = np.clip(arr, 0, 1)
            img = Image.fromarray((arr * 255).astype(np.uint8))

        # --- 4.5 Vignette Effect ---
        if 'vignette' in settings and settings['vignette'] != 0:
            arr_v = np.array(img).astype(np.float32) / 255.0
            v_amount = settings['vignette'] / 1000.0
            h, w = arr_v.shape[:2]
            y, x = np.ogrid[:h, :w]
            cx, cy = w / 2, h / 2
            radius = min(h, w) / 2
            dist = np.sqrt((x - cx)**2 + (y - cy)**2) / radius
            vignette_mask = np.clip(1 - dist * v_amount * 0.7, 0, 1)
            vignette_mask = np.stack([vignette_mask, vignette_mask, vignette_mask], axis=-1)
            arr_v = arr_v * vignette_mask
            img = Image.fromarray((np.clip(arr_v, 0, 1) * 255).astype(np.uint8))

        # --- 4.6 Sepia Tone Effect ---
        if 'sepia' in settings and settings['sepia'] != 0:
            arr_s = np.array(img).astype(np.float32) / 255.0
            sepia_amount = settings['sepia'] / 1000.0
            sepia_matrix = np.array([
                [0.393, 0.769, 0.189],
                [0.349, 0.686, 0.168],
                [0.272, 0.534, 0.131]
            ])
            sepia_img = np.dot(arr_s, sepia_matrix.T)
            sepia_img = np.clip(sepia_img, 0, 1)
            img = Image.fromarray(((arr_s * (1 - sepia_amount) + sepia_img * sepia_amount) * 255).astype(np.uint8))

        # Sharpness
        if 'sharpness' in settings and settings['sharpness'] != 100.0:
            enhancer = ImageEnhance.Sharpness(img)
            img = enhancer.enhance(settings['sharpness'] / 100.0)
            
        # Rotation
        if 'rotation' in settings and settings['rotation'] != 0:
            img = img.rotate(-settings['rotation'], expand=True) # Counter-clockwise to match JS

        # Flip
        if settings.get('flip_h'):
            img = ImageOps.mirror(img)
        if settings.get('flip_v'):
            img = ImageOps.flip(img)

        # Crop (x, y, w, h)
        if 'crop' in settings and settings['crop']:
            crop = settings['crop']
            x, y, w, h = int(crop['x']), int(crop['y']), int(crop['width']), int(crop['height'])
            img = img.crop((x, y, x + w, y + h))

        return img

    @staticmethod
    def get_default_settings():
        """Returns the neutral/default settings for all parameters."""
        return {
            'exposure': 0,
            'brightness': 200,
            'contrast': 200,
            'saturation': 200,
            'temperature': 0,
            'tint': 0,
            'highlights': 0,
            'shadows': 0,
            'whites': 0,
            'blacks': 0,
            'vibrance': 0,
            'clarity': 0,
            'dehaze': 0,
            'red': 500,
            'green': 500,
            'blue': 500,
            'rotation': 0,
            'flip_h': False,
            'flip_v': False,
            'sharpness': 100,
            'crop': None,
            'vignette': 0,
            'sepia': 0
        }

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
