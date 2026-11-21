const formats = { png: 'png', jpg: 'jpeg', jpeg: 'jpeg', webp: 'webp', gif: 'gif', avif: 'avif', bmp: 'bmp' };

export function photoType(message) {
  if (message.type !== 'file' || !message.blob) return '';
  const mime = message.blob.type;
  if (/^image\/(png|jpeg|webp|gif|avif|bmp)$/.test(mime)) return mime;
  const extension = message.name?.match(/\.(png|jpe?g|webp|gif|avif|bmp)$/i)?.[1];
  return extension ? 'image/' + formats[extension.toLowerCase()] : '';
}

export async function makeThumbnail(file) {
  if (!photoType({ type: 'file', name: file.name, blob: file })) return '';
  const photo = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 80 / Math.max(photo.width, photo.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(photo.width * scale));
    canvas.height = Math.max(1, Math.round(photo.height * scale));
    canvas.getContext('2d').drawImage(photo, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.55);
  } finally {
    photo.close();
  }
}
