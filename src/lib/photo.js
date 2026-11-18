// Profile pictures. The app has no file storage, so a photo is shrunk in the browser to a small
// square JPEG and saved on the member's own profile as a data URL (about 5-15 KB).
// firestore.rules checks the same format and size limit as isPhoto() below.

export const PHOTO_SIZE = 128; // pixels, width and height
export const MAX_PHOTO_LENGTH = 100000; // characters of data URL, matches firestore.rules
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // the original file someone picks

const PHOTO_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

// True when a value is a profile photo the security rules will accept.
export function isPhoto(value) {
  return typeof value === 'string' && value.length <= MAX_PHOTO_LENGTH && PHOTO_PATTERN.test(value);
}

// Returns a message explaining why a picked file can't be used, or null when it's fine.
export function photoProblem(file) {
  if (!file) return 'Choose a picture to upload.';
  if (!file.type || !file.type.startsWith('image/')) return 'That file isn\'t a picture. Choose a JPG, PNG or similar image.';
  if (file.size > MAX_UPLOAD_BYTES) return 'That picture is too large. Choose one under 15 MB.';
  return null;
}

// The largest centered square in a width x height image, so photos crop evenly instead of stretching.
export function centerSquare(width, height) {
  const side = Math.min(width, height);
  return { sx: Math.round((width - side) / 2), sy: Math.round((height - side) / 2), side };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(Object.assign(new Error('unreadable image'), { code: 'app/bad-photo' }));
    };
    img.src = url;
  });
}

// Browser only: turns a picked image file into a small square JPEG data URL.
export async function makeProfilePhoto(file) {
  if (photoProblem(file)) throw Object.assign(new Error(photoProblem(file)), { code: 'app/bad-photo' });
  const img = await loadImage(file);
  const { sx, sy, side } = centerSquare(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const ctx = canvas.getContext('2d');
  // JPEG has no transparency, so transparent PNGs get a white background instead of black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  for (const quality of [0.85, 0.7, 0.5]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (isPhoto(url)) return url;
  }
  throw Object.assign(new Error('photo too large'), { code: 'app/bad-photo' });
}
