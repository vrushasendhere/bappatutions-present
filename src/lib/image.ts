/**
 * Upload hygiene without an image codec.
 *
 * A Worker can't decode and re-encode an image without shipping a large
 * WebAssembly library, so instead of re-encoding we walk the file's own
 * container structure: that proves it really is the format it claims (the
 * type comes from the bytes, never from the browser's Content-Type), and lets
 * us drop the segments that carry metadata — above all EXIF, where a phone
 * photo keeps the GPS position it was taken at. Anything that doesn't parse
 * cleanly is rejected rather than stored.
 *
 * Pixel data is copied through untouched, so nothing is recompressed.
 */

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export interface CleanImage {
  bytes: Uint8Array;
  contentType: string;
  ext: 'png' | 'jpg' | 'webp' | 'gif';
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));
const u32be = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const u32le = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

/** JPEG: drop APP1 (EXIF/XMP), APP13 (IPTC) and COM segments; everything
 *  from the start of scan onward is image data and copied verbatim. */
function stripJpeg(b: Uint8Array): Uint8Array | null {
  const out: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    if (marker === 0xda) {
      out.push(b.subarray(i));
      return concat(out);
    }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) return null;
    const metadata = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!metadata) out.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return null; // never reached image data
}

const PNG_METADATA = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

function stripPng(b: Uint8Array): Uint8Array | null {
  const out: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = u32be(b, i);
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (end > b.length) return null;
    if (!PNG_METADATA.has(type)) out.push(b.subarray(i, end));
    i = end;
    if (type === 'IEND') return concat(out);
  }
  return null;
}

/** WebP: drop the EXIF and XMP chunks, clear the flags in VP8X that
 *  announced them, and rewrite the RIFF size to match. */
function stripWebp(b: Uint8Array): Uint8Array | null {
  const chunks: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const fourcc = ascii(b, i, 4);
    const size = u32le(b, i + 4);
    if (i + 8 + size > b.length) return null;
    if (fourcc !== 'EXIF' && fourcc !== 'XMP ') {
      const chunk = new Uint8Array(8 + size + (size & 1)); // pad byte stays 0
      chunk.set(b.subarray(i, i + 8 + size));
      if (fourcc === 'VP8X' && size > 0) chunk[8] &= ~(0x08 | 0x04);
      chunks.push(chunk);
    }
    i += 8 + size + (size & 1);
  }
  if (!chunks.length) return null;
  const body = concat(chunks);
  const out = new Uint8Array(12 + body.length);
  out.set(b.subarray(0, 4)); // "RIFF"
  new DataView(out.buffer).setUint32(4, 4 + body.length, true);
  out.set(b.subarray(8, 12), 8); // "WEBP"
  out.set(body, 12);
  return out;
}

export function cleanImage(b: Uint8Array): CleanImage | null {
  if (b.length > MAX_IMAGE_BYTES || b.length < 16) return null;

  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') {
    const bytes = stripPng(b);
    return bytes && { bytes, contentType: 'image/png', ext: 'png' };
  }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    const bytes = stripJpeg(b);
    return bytes && { bytes, contentType: 'image/jpeg', ext: 'jpg' };
  }
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const bytes = stripWebp(b);
    return bytes && { bytes, contentType: 'image/webp', ext: 'webp' };
  }
  const gif = ascii(b, 0, 6);
  if (gif === 'GIF87a' || gif === 'GIF89a') {
    // GIF has no EXIF block to leak; stored as-is.
    return { bytes: b, contentType: 'image/gif', ext: 'gif' };
  }
  return null;
}
