import { parse } from '../parse'

export interface BcelOneProofData {
  /** Proof type (Tag 33 sub-tag 02) */
  type: string | undefined

  /** Ticket No. (Tag 33 sub-tag 03) */
  ticket: string | undefined

  /** Reference No. (Tag 33 sub-tag 04) */
  fccref: string | undefined
}

/**
 * Validate and extract data from a BCEL OneProof QR payload.
 *
 * The acceptance gate is deliberately lenient (any one of the format
 * markers present is enough) because real-world payloads vary.
 *
 * @param payload - QR Code payload
 * @returns Proof data, or `null` when the payload fails CRC or decodes to nothing
 */
export function bcelOneProof(payload: string): BcelOneProofData | null {
  const qr = parse(payload, true)
  if (!qr) return null

  const issuer = qr.getTagValue('33', '00')
  const isMarked =
    qr.getTagValue('00') === '01' ||
    qr.getTagValue('01') === '11' ||
    issuer === 'BCEL' ||
    issuer === 'ONEPROOF'

  if (!isMarked) return null

  return {
    type: qr.getTagValue('33', '02'),
    ticket: qr.getTagValue('33', '03'),
    fccref: qr.getTagValue('33', '04'),
  }
}
