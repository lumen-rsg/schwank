'use client';

import type { T } from '../features/types';
import type { CopyKey } from '../i18n';

export function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error('imageSourceTooLarge'));
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      reject(new Error('errorImageInvalidType'));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      if (
        image.width < 1 ||
        image.height < 1 ||
        image.width > 12_000 ||
        image.height > 12_000
      ) {
        URL.revokeObjectURL(url);
        reject(new Error('imageDimensionsTooLarge'));
        return;
      }
      const scale = Math.min(
        1,
        maxWidth / image.width,
        maxHeight / image.height,
      );
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error('imagePreparationFailed'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/webp', quality));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('imagePreparationFailed'));
    };
    image.src = url;
  });
}

export function imagePreparationMessage(cause: unknown, t: T) {
  const key = cause instanceof Error ? cause.message : 'imagePreparationFailed';
  return t(
    [
      'imageSourceTooLarge',
      'imageDimensionsTooLarge',
      'errorImageInvalidType',
      'imagePreparationFailed',
    ].includes(key)
      ? (key as CopyKey)
      : 'imagePreparationFailed',
  );
}
