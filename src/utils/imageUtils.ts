export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export function isSupportedImageFile(file: File): boolean {
  if ((ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type.toLowerCase())) {
    return true;
  }
  const lower = file.name.toLowerCase();
  return (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.heic') ||
    lower.endsWith('.heif')
  );
}

export function inferMimeType(file: File): string {
  if (file.type && (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type.toLowerCase())) {
    return file.type.toLowerCase();
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image file'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

/**
 * Prepares an image for temporary Gemini analysis while preserving legibility of fine text/MRZ.
 * Keeps individual uploads compact (typically <= 1.4 MB) so 1-2 images fit well inside Vercel's 4.5 MB limit.
 */
export async function prepareImageForUpload(
  file: File
): Promise<{ base64: string; mimeType: string }> {
  const mimeType = inferMimeType(file);
  const dataUrl = await readFileAsDataUrl(file);

  // For HEIC/HEIF (cannot be reliably re-encoded via canvas across all browsers) or compact images <= 900 KB
  if (mimeType === 'image/heic' || mimeType === 'image/heif' || file.size <= 900 * 1024) {
    const base64 = dataUrl.split(',')[1] ?? '';
    return { base64, mimeType };
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode error'));
      el.src = dataUrl;
    });

    const encodeAt = (maxDim: number, quality: number): string => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const targetW = Math.max(1, Math.round(img.width * scale));
      const targetH = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.drawImage(img, 0, 0, targetW, targetH);
      return canvas.toDataURL('image/jpeg', quality).split(',')[1] ?? '';
    };

    let base64 = encodeAt(1800, 0.86);
    // If still > ~1.4 MB binary (~1.9 MB base64), step down slightly so 2 pages stay under 4.5 MB JSON
    if (base64.length > 1_900_000) {
      base64 = encodeAt(1400, 0.78) || base64;
    }

    if (base64) {
      return { base64, mimeType: 'image/jpeg' };
    }
    return { base64: dataUrl.split(',')[1] ?? '', mimeType };
  } catch {
    const base64 = dataUrl.split(',')[1] ?? '';
    return { base64, mimeType };
  }
}
