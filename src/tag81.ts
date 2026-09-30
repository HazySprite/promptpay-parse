/**
 * Encode a personal message as uppercase hex, one 4-digit group per UTF-16
 * code unit (UCS-2 style), as required by TrueMoney Tag 81.
 *
 * Equivalent to `Buffer.from(message, 'utf16le').swap16().toString('hex').toUpperCase()`
 * but without touching `Buffer`, so it runs in any JS runtime.
 *
 * @param message - Personal message
 * @returns Uppercase hex string
 */
export function encodeTag81(message: string): string {
  let hex = ''

  for (let i = 0; i < message.length; i++) {
    hex += message.charCodeAt(i).toString(16).padStart(4, '0')
  }

  return hex.toUpperCase()
}

/**
 * Decode a Tag 81 personal message from uppercase/lowercase hex
 * (one 4-digit group per UTF-16 code unit) back to a string.
 *
 * @param hex - Hex string as written by `encodeTag81`
 * @returns Decoded message (empty string for malformed input)
 */
export function decodeTag81(hex: string): string {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 4 !== 0) return ''

  let message = ''
  for (let i = 0; i < hex.length; i += 4) {
    message += String.fromCharCode(Number.parseInt(hex.slice(i, i + 4), 16))
  }

  return message
}
