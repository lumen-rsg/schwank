import { ApiError } from './api-errors';

type ImageLimits = {
  maximumBytes: number;
  maximumWidth: number;
  maximumHeight: number;
  maximumPixels: number;
};

const mimeSignatures = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

function invalidImage(message = 'The image could not be verified.'): never {
  throw new ApiError(message, 400, 'image_invalid');
}

function readPngSize(bytes: Uint8Array) {
  if (
    bytes.length < 45 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    ) ||
    ![0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130].every(
      (value, index) => bytes[bytes.length - 12 + index] === value,
    )
  )
    return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpegSize(bytes: Uint8Array) {
  if (
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[bytes.length - 2] !== 0xff ||
    bytes[bytes.length - 1] !== 0xd9
  )
    return null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    )
      continue;
    if (offset + 1 >= bytes.length) return null;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return null;
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      if (length < 7) return null;
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    offset += length;
  }
  return null;
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function littleEndian24(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readWebpSize(bytes: Uint8Array) {
  if (
    bytes.length < 30 ||
    ascii(bytes, 0, 4) !== 'RIFF' ||
    ascii(bytes, 8, 4) !== 'WEBP' ||
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
      4,
      true,
    ) +
      8 !==
      bytes.length
  )
    return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === 'VP8X')
    return {
      width: littleEndian24(bytes, 24) + 1,
      height: littleEndian24(bytes, 27) + 1,
    };
  if (chunk === 'VP8L' && bytes[20] === 0x2f)
    return {
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height:
        1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
    };
  if (
    chunk === 'VP8 ' &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  )
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  return null;
}

function decodeBase64(value: string, maximumBytes: number) {
  if (
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  )
    invalidImage();
  if ((value.length / 4) * 3 > maximumBytes + 2)
    throw new ApiError('The image is too large.', 413, 'image_too_large');
  let decoded: string;
  try {
    decoded = atob(value);
  } catch {
    invalidImage();
  }
  if (decoded.length > maximumBytes)
    throw new ApiError('The image is too large.', 413, 'image_too_large');
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export function validateDataImage(value: unknown, limits: ImageLimits) {
  if (value === '') return null;
  if (typeof value !== 'string') invalidImage();
  const match = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(value);
  if (!match)
    throw new ApiError(
      'Use a JPEG, PNG, or WebP image.',
      400,
      'image_invalid_type',
    );
  const bytes = decodeBase64(match[2], limits.maximumBytes);
  const mime = mimeSignatures[match[1] as keyof typeof mimeSignatures];
  const size =
    mime === 'image/png'
      ? readPngSize(bytes)
      : mime === 'image/jpeg'
        ? readJpegSize(bytes)
        : readWebpSize(bytes);
  if (!size) invalidImage();
  if (
    size.width < 1 ||
    size.height < 1 ||
    size.width > limits.maximumWidth ||
    size.height > limits.maximumHeight ||
    size.width * size.height > limits.maximumPixels
  )
    throw new ApiError(
      'The image dimensions are too large.',
      413,
      'image_too_large',
    );
  return value;
}
