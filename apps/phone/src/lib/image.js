// Shrinks a photo on the phone before it is sent: at most 1024 px on the long side, JPEG ~80%.
// Typical result is 100-250 KB instead of several MB, and EXIF data (location etc.) is dropped by the re-encode.
export async function photoToJpegDataUrl(file, maxSide = 1024, quality = 0.8) {
  let source;
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    source = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('That photo could not be opened. Try another one.'));
      img.src = URL.createObjectURL(file);
    });
  }
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();
  return canvas.toDataURL('image/jpeg', quality);
}
