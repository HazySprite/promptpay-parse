import { encode, tag, withCrcTag } from '../tlv'

export interface TrueMoneySlipVerifyConfig {
  /** Event type (e.g. `P2P`) */
  eventType: string

  /** Transaction ID */
  transactionId: string

  /** Transaction date, `DDMMYYYY` */
  date: string
}

/**
 * Generate a TrueMoney Slip Verify QR payload.
 *
 * Same family as the regular Slip Verify QR, with differences:
 * Tag 00 sub-tags `00`/`01` are `01`, Tag 51 is absent, and the CRC
 * checksum is written in lowercase (case-sensitive for TrueMoney).
 *
 * @returns QR Code payload
 */
export function trueMoneySlipVerify({
  eventType,
  transactionId,
  date,
}: TrueMoneySlipVerifyConfig): string {
  const payload = [
    tag(
      '00',
      encode([
        tag('00', '01'),
        tag('01', '01'),
        tag('02', eventType),
        tag('03', transactionId),
        tag('04', date),
      ]),
    ),
  ]

  return withCrcTag(encode(payload), '91', true)
}
