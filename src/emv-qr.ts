import { encode, getTag, withCrcTag, type TlvTag } from './tlv'

/** Parsed EMVCo-compatible QR payload with tag access and CRC verification */
export class EmvQr {
  constructor(
    private readonly payload: string,
    private readonly tags: TlvTag[],
  ) {}

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

  /** Original QR payload string */
  getPayload(): string {
    return this.payload
  }

  /** Original QR payload string */
  toString(): string {
    return this.payload
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
}
