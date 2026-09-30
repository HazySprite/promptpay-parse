import { BotBarcode } from './bot-barcode'
import { EmvQr } from './emv-qr'
import { crc16 } from './crc'
import { decode, type TlvTag } from './tlv'

const TLV_HEADER = /^\d{4}/

/**
 * Parse any EMVCo-compatible QR Code data string.
 *
 * Nested TLV sub-tags (e.g. Tag 29 / 30 / 62) are decoded automatically
 * using a well-formedness heuristic.
 *
 * @param payload - QR Code data string from the scanner
 * @param strict - Reject the payload when its trailing CRC checksum fails
 * @param subTags - Decode nested TLV sub-tags (default `true`)
 * @returns Parsed QR instance, or `null` when the payload is not EMVCo data
 */
export function parse(
  payload: string,
  strict = false,
  subTags = true,
): EmvQr | null {
  if (typeof payload !== 'string' || !TLV_HEADER.test(payload)) return null

  if (strict) {
    const body = payload.slice(0, -4)
    if (payload.slice(-4).toUpperCase() !== crc16(body)) return null
  }

  const tags = decode(payload)
  if (tags.length === 0) return null

  if (subTags) {
    for (const t of tags) {
      const sub = tryDecodeSubTags(t.value)
      if (sub) t.subTags = sub
    }
  }

  return new EmvQr(payload, tags)
}

/**
 * Parse a BOT Barcode data string (Thai QR Payment Standard).
 *
 * @param payload - Barcode data string from the scanner
 * @returns Parsed barcode, or `null` when the payload is not BOT Barcode data
 */
export function parseBarcode(payload: string): BotBarcode | null {
  return BotBarcode.fromString(payload)
}

/**
 * A value looks like nested TLV when it starts with a 4-digit
 * tag-length header and every decoded entry is internally consistent
 * (declared length > 0 and equal to the actual value length).
 */
function tryDecodeSubTags(value: string): TlvTag[] | undefined {
  if (!TLV_HEADER.test(value)) return undefined

  const sub = decode(value)
  const wellFormed =
    sub.length > 0 &&
    sub.every((s) => s.length > 0 && s.length === s.value.length)

  return wellFormed ? sub : undefined
}
