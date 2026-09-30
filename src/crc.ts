let encoder: InstanceType<typeof TextEncoder> | undefined

/**
 * Lookup table for CRC-16/CCITT-FALSE (`0x1021`), precomputed per byte
 * value so each input byte costs one table lookup instead of eight
 * shift/xor iterations.
 */
const TABLE = new Uint16Array(256)
for (let i = 0; i < 256; i++) {
  let crc = i << 8
  for (let bit = 0; bit < 8; bit++) {
    crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  TABLE[i] = crc
}

/**
 * Compute CRC-16/CCITT-FALSE over the UTF-8 bytes of `data`.
 *
 * Parameters follow the EMVCo / Thai QR Payment Standard:
 * polynomial `0x1021`, initial value `0xFFFF`, no reflection, no final XOR.
 * Non-ASCII characters are encoded as UTF-8 first; unpaired surrogates are
 * replaced with `U+FFFD` (same as `TextEncoder` default behavior).
 *
 * @param data - Input string
 * @returns Checksum as a 4-digit uppercase hex string
 */
export function crc16(data: string): string {
  encoder ??= new TextEncoder()
  let crc = 0xffff

  for (const byte of encoder.encode(data)) {
    crc = TABLE[byte ^ (crc >> 8)]! ^ ((crc << 8) & 0xffff)
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}
