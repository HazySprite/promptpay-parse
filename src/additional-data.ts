import type { TlvTag } from './tlv'

/** EMVCo Tag 62 (Additional Data Template) sub-tag IDs */
export const ADDITIONAL_DATA_TAGS = {
  billNumber: '01',
  mobileNumber: '02',
  storeLabel: '03',
  loyaltyNumber: '04',
  referenceLabel: '05',
  customerLabel: '06',
  terminalLabel: '07',
  purpose: '08',
} as const

export type AdditionalDataKey = keyof typeof ADDITIONAL_DATA_TAGS

/** Additional data carried in Tag 62 of a merchant QR */
export type AdditionalData = {
  [K in AdditionalDataKey]?: string
}

/**
 * Encode additional data into a Tag 62 value.
 *
 * Sub-tags are emitted in ID order (`01`–`08`); empty strings are skipped.
 *
 * @param data - Additional data fields
 * @returns TLV string of sub-tags
 */
export function encodeAdditionalData(data: AdditionalData): string {
  const entries = Object.entries(ADDITIONAL_DATA_TAGS) as [AdditionalDataKey, string][]

  let payload = ''
  for (const [key, id] of entries) {
    const value = data[key]
    if (value === undefined || value === '') continue
    payload += id
    payload += String(value.length).padStart(2, '0')
    payload += value
  }

  return payload
}

/**
 * Extract additional data from decoded tags.
 *
 * @param tags - Decoded top-level TLV tags
 * @returns Present fields only (empty object when Tag 62 is absent)
 */
export function extractAdditionalData(tags: TlvTag[]): AdditionalData {
  const template = tags.find((t) => t.id === '62')
  if (!template?.subTags) return {}

  const data: AdditionalData = {}
  for (const [key, id] of Object.entries(ADDITIONAL_DATA_TAGS) as [AdditionalDataKey, string][]) {
    const sub = template.subTags.find((s) => s.id === id)
    if (sub && sub.value !== '') data[key] = sub.value
  }

  return data
}
