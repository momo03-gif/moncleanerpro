// ════════════════════════════════════════════════════════════════════════════
//  Compression d'image côté navigateur (canvas) — AVANT upload.
//  Objectif : réduire fortement le poids des photos pour économiser le stockage
//  Supabase (offre gratuite). On redimensionne à une largeur/hauteur max et on
//  réexporte en JPEG qualité modérée. Aucune dépendance externe.
// ════════════════════════════════════════════════════════════════════════════

export interface CompressOptions {
  maxSize?: number;   // plus grande dimension (px) après redimensionnement
  quality?: number;   // qualité JPEG (0–1)
}

const DEFAULTS: Required<CompressOptions> = { maxSize: 1280, quality: 0.7 };

// Compresse un fichier image et renvoie un nouveau File (JPEG). En cas d'échec
// (format exotique, navigateur sans canvas), renvoie le fichier d'origine.
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxSize, quality } = { ...DEFAULTS, ...opts };
  if (!file.type.startsWith('image/')) return file;

  try {
    const bitmap = await loadBitmap(file);
    const { width, height } = scaleToFit(bitmap.width, bitmap.height, maxSize);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob) return file;

    // Si la « compression » a grossi le fichier (rare), on garde l'original.
    if (blob.size >= file.size && file.type === 'image/jpeg') return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

// Charge l'image dans un ImageBitmap (rapide) avec repli sur <img>.
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch { /* repli ci-dessous */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function scaleToFit(w: number, h: number, maxSize: number): { width: number; height: number } {
  if (w <= maxSize && h <= maxSize) return { width: w, height: h };
  const ratio = w > h ? maxSize / w : maxSize / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}
