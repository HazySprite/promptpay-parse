import { parse } from '../parse'

export interface TrueMoneySlipVerifyData {
  /** Event type (e.g. `P2P`) */
  eventType: string | undefined

  /** Transaction ID */
  transactionId: string | undefined

  /** Transaction date, `DDMMYYYY` */
  date: string | undefined
}

/**
 * Validate and extract data from a TrueMoney Slip Verify QR payload.
 *
 * The CRC checksum is lowercase in this format; strict parsing compares
 * case-insensitively, so both cases pass.
 *
 * @param payload - QR Code payload
 * @returns Transaction data, or `null` when the payload is invalid
 */
export function trueMoneySlipVerify(payload: string): TrueMoneySlipVerifyData | null {
  const qr = parse(payload, true)
  if (!qr) return null

  if (qr.getTagValue('00', '00') !== '01') return null
  if (qr.getTagValue('00', '01') !== '01') return null

  return {
    eventType: qr.getTagValue('00', '02'),
    transactionId: qr.getTagValue('00', '03'),
    date: qr.getTagValue('00', '04'),
  }
}
