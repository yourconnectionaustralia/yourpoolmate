// Downscale and re-encode a photo so uploads are fast and storage stays small.
// Used for both the OCR scan and the printout photo kept with a test.

export const MAX_DIMENSION = 1600;   // px — plenty for printout text
export const JPEG_QUALITY = 0.85;

export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('Could not prepare that photo. Try again.')); return; }
        resolve({ dataUrl, base64: dataUrl.split(',')[1], mediaType: 'image/jpeg', blob });
      }, 'image/jpeg', JPEG_QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file doesn\'t look like a photo — try again.')); };
    img.src = url;
  });
}
