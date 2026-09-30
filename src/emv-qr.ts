import { extractAdditionalData, type AdditionalData } from './additional-data'
import { decode, encode, getTag, tag, withCrcTag, type TlvTag } from './tlv'

/** Merchant account information template (Tags 26–51) with decoded sub-tags */
export interface MerchantAccountInfo {
  /** Template Tag ID (`26`–`51`) */
  id: string

  /** Application Identifier from sub-tag `00`, when present */
  aid: string | undefined

  /** Decoded sub-tags */
  subTags: TlvTag[]
}

/** Typed view of the well-known EMVCo MPM data elements */
export interface EmvQrFields {
  /** Tag 00 — Payload Format Indicator */
  payloadFormat: string | undefined

  /** Tag 01 — Point of Initiation Method (`static` = payer enters amount, `dynamic` = amount baked in) */
  pointOfInitiation: 'static' | 'dynamic' | undefined

  /** Tags 26–51 — Merchant Account Information templates */
  merchantAccountInfo: MerchantAccountInfo[]

  /** Tag 52 — Merchant Category Code (ISO 18245) */
  merchantCategoryCode: string | undefined

  /** Tag 53 — Transaction Currency (ISO 4217 numeric, `764` = THB) */
  currency: string | undefined

  /** Tag 54 — Transaction Amount */
  amount: number | undefined

  /** Tag 55 — Tip or Convenience Indicator */
  tipIndicator: string | undefined

  /** Tag 56 — Value of Convenience Fee (fixed) */
  convenienceFeeFixed: string | undefined

  /** Tag 57 — Value of Convenience Fee (percentage) */
  convenienceFeePercent: string | undefined

  /** Tag 58 — Country Code */
  country: string | undefined

  /** Tag 59 — Merchant Name */
  merchantName: string | undefined

  /** Tag 60 — Merchant City */
  merchantCity: string | undefined

  /** Tag 61 — Merchant Postal Code */
  postalCode: string | undefined

  /** Tag 62 — Additional Data (present fields only) */
  additionalData: AdditionalData

  /** Tags 65–99 — Unreserved Templates with decoded sub-tags */
  unreservedTemplates: Record<string, TlvTag[]>

  /** CRC tag value (Tag 63 / 91) */
  crc: string | undefined
}

const TEMPLATE_RANGE = /^([2-4][6-9]|5[01])$/
const UNRESERVED_RANGE = /^(6[5-9]|[7-9]\d)$/

/** Parsed EMVCo-compatible QR payload with tag access, CRC verification and immutable manipulation */
export class EmvQr {
  constructor(
    private readonly payload: string,
    private readonly tags: TlvTag[],
  ) {}

  /** CRC Tag ID — the last tag of an EMVCo payload (`63` PromptPay, `91` Slip Verify) */
  get crcTagId(): string | undefined {
    return this.tags[this.tags.length - 1]?.id
  }

  /** Get a tag (or sub-tag) by ID */
  getTag(id: string, subId?: string): TlvTag | undefined {
    return getTag(this.tags, id, subId)
  }

  /** Get a tag value (or sub-tag value) by ID */
  getTagValue(id: string, subId?: string): string | undefined {
    return this.getTag(id, subId)?.value
  }

  /** All decoded top-level tags */
  getTags(): TlvTag[] {
    return this.tags
  }

  /** QR payload string — after any manipulation, the re-encoded payload with a fresh CRC */
  getPayload(): string {
    return this.payload
  }

  /** QR payload string */
  toString(): string {
    return this.payload
  }

  /** Typed view of the well-known EMVCo MPM data elements */
  get fields(): EmvQrFields {
    const v = (id: string) => this.getTagValue(id)
    const poi = v('01')

    const merchantAccountInfo: MerchantAccountInfo[] = this.tags
      .filter((t) => TEMPLATE_RANGE.test(t.id) && t.subTags)
      .map((t) => ({
        id: t.id,
        aid: t.subTags?.find((s) => s.id === '00')?.value,
        subTags: t.subTags ?? [],
      }))

    const unreservedTemplates: Record<string, TlvTag[]> = {}
    for (const t of this.tags) {
      if (UNRESERVED_RANGE.test(t.id) && t.subTags) {
        unreservedTemplates[t.id] = t.subTags
      }
    }

    const amountRaw = v('54')

    return {
      payloadFormat: v('00'),
      pointOfInitiation: poi === '11' ? 'static' : poi === '12' ? 'dynamic' : undefined,
      merchantAccountInfo,
      merchantCategoryCode: v('52'),
      currency: v('53'),
      amount: amountRaw !== undefined ? Number.parseFloat(amountRaw) : undefined,
      tipIndicator: v('55'),
      convenienceFeeFixed: v('56'),
      convenienceFeePercent: v('57'),
      country: v('58'),
      merchantName: v('59'),
      merchantCity: v('60'),
      postalCode: v('61'),
      additionalData: extractAdditionalData(this.tags),
      unreservedTemplates,
      crc: this.crcTagId ? v(this.crcTagId) : undefined,
    }
  }

  /**
   * Re-encode every tag except the CRC tag, recompute the checksum and
   * compare against the original payload.
   *
   * @param crcTagId - CRC Tag ID used by this payload format
   * @returns `true` when the payload is intact
   */
  isValid(crcTagId: string): boolean {
    const withoutCrc = this.tags.filter((t) => t.id !== crcTagId)
    return this.payload === withCrcTag(encode(withoutCrc), crcTagId)
  }

  /**
   * Set or replace a top-level tag and return a new `EmvQr` with a freshly
   * computed CRC tag. Existing tag order is preserved; new tags are appended
   * before the CRC tag.
   *
   * @param id - Tag ID
   * @param value - New tag value
   * @returns New `EmvQr` instance (original is untouched)
   */
  withTag(id: string, value: string): EmvQr {
    if (id === this.crcTagId) {
      throw new RangeError(`Tag ${id} is the CRC tag; it is recomputed automatically`)
    }

    const body = this.bodyTags()
    const next = tag(id, value)
    const idx = body.findIndex((t) => t.id === id)

    if (idx === -1) body.push(next)
    else body[idx] = next

    return this.cloneWith(body)
  }

  /**
   * Remove a top-level tag and return a new `EmvQr` with a freshly computed
   * CRC tag.
   *
   * @param id - Tag ID
   * @returns New `EmvQr` instance (original is untouched)
   */
  withoutTag(id: string): EmvQr {
    if (id === this.crcTagId) {
      throw new RangeError(`Tag ${id} is the CRC tag; it is recomputed automatically`)
    }

    return this.cloneWith(this.bodyTags().filter((t) => t.id !== id))
  }

  /**
   * Set the transaction amount (Tag 54) and flip the Point of Initiation
   * Method (Tag 01) between static (`11`) and dynamic (`12`).
   *
   * Passing `undefined` removes Tag 54 and marks the QR static again.
   *
   * @param amount - Amount in THB, or `undefined` for a static QR
   * @returns New `EmvQr` instance (original is untouched)
   */
  setAmount(amount: number | undefined): EmvQr {
    const next =
      amount === undefined ? this.withoutTag('54') : this.withTag('54', Number(amount).toFixed(2))
    return next.withTag('01', amount === undefined ? '11' : '12')
  }

  /** Body tags without the trailing CRC tag */
  private bodyTags(): TlvTag[] {
    return this.crcTagId ? this.tags.slice(0, -1) : [...this.tags]
  }

  /** Re-encode tags with the same CRC tag ID and re-decode into a new instance */
  private cloneWith(body: TlvTag[]): EmvQr {
    const crc = this.crcTagId
    const payload = crc ? withCrcTag(encode(body), crc) : encode(body)
    return new EmvQr(payload, decode(payload))
  }
}
