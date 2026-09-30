import { crc16 } from './crc'

/** Single Tag-Length-Value entry of an EMVCo QR payload */
export interface TlvTag {
  /** Tag ID (2 digits) */
  id: string

  /** Tag value (or the raw nested payload when `subTags` is present) */
  value: string

  /** Declared value length */
  length: number

  /** Decoded nested TLV tags, if any */
  subTags?: TlvTag[]
}

const LENGTH_FIELD = /^\d{2}$/

/**
 * Decode a TLV string into an array of tags.
 *
 * Stops at the first malformed tag instead of producing garbage entries.
 *
 * @param payload - TLV string
 * @returns Array of TLV tags (empty when nothing could be decoded)
 */
export function decode(payload: string): TlvTag[] {
  const tags: TlvTag[] = []

  let offset = 0
  while (offset + 4 <= payload.length) {
    const id = payload.slice(offset, offset + 2)
    const rawLength = payload.slice(offset + 2, offset + 4)
    if (!LENGTH_FIELD.test(id) || !LENGTH_FIELD.test(rawLength)) break

    const length = Number(rawLength)
    const value = payload.slice(offset + 4, offset + 4 + length)

    tags.push({ id, value, length })
    offset += 4 + length
  }

  return tags
}

/**
 * Encode an array of TLV tags back into a TLV string.
 *
 * Tags carrying `subTags` are encoded from the sub-tags; the declared
 * `length` is always written as-is.
 *
 * @param tags - Array of TLV tags
 * @returns TLV string
 */
export function encode(tags: TlvTag[]): string {
  let payload = ''

  for (const t of tags) {
    payload += t.id
    payload += String(t.length).padStart(2, '0')
    payload += t.subTags ? encode(t.subTags) : t.value
  }

  return payload
}

/**
 * Append a CRC tag (`id` + `04` + checksum) to a TLV string.
 *
 * @param payload - TLV string without the CRC tag
 * @param crcTagId - CRC Tag ID (e.g. `63` for PromptPay, `91` for Slip Verify)
 * @param lowercase - Emit the checksum in lowercase (TrueMoney Slip Verify uses this)
 * @returns TLV string with the CRC tag appended
 */
export function withCrcTag(
  payload: string,
  crcTagId: string,
  lowercase = false,
): string {
  const body = payload + crcTagId.padStart(2, '0') + '04'
  return body + (lowercase ? crc16(body).toLowerCase() : crc16(body))
}

/**
 * Find a tag (or nested sub-tag) by ID.
 *
 * @param tags - Array of TLV tags
 * @param id - Tag ID to find
 * @param subId - Optional sub-tag ID inside the found tag
 * @returns Matching tag, or `undefined` when absent
 */
export function getTag(
  tags: TlvTag[],
  id: string,
  subId?: string,
): TlvTag | undefined {
  const tag = tags.find((t) => t.id === id)
  if (subId) return tag?.subTags?.find((s) => s.id === subId)
  return tag
}

/**
 * Create a TLV tag from an ID and a value.
 *
 * @param id - Tag ID
 * @param value - Tag value
 * @returns TLV tag
 */
export function tag(id: string, value: string): TlvTag {
  return { id, value, length: value.length }
}
