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
