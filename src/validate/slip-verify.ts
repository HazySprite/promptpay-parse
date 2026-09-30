import { parse } from '../parse'

export interface SlipVerifyData {
  /** Bank code */
  sendingBank: string

  /** Transaction reference */
  transRef: string
}

/**
 * Validate and extract data from a Slip Verify ("Mini-QR") payload,
 * for use with Bank Open API transaction inquiries.
 *
 * @param payload - QR Code payload
 * @param crcAutoFix - Left-pad a truncated CRC checksum, a known defect
 *   of some bank apps (default `true`)
 * @returns Bank code and transaction reference, or `null` when invalid
 */
export function slipVerify(payload: string, crcAutoFix = true): SlipVerifyData | null {
  if (crcAutoFix) {
    const idx = payload.lastIndexOf('9104')
    if (idx !== -1) {
      const crc = payload.slice(idx + 4)
      if (crc.length > 0 && crc.length < 4) {
        payload = payload.slice(0, idx + 4) + crc.padStart(4, '0')
      }
    }
  }

  const qr = parse(payload, true)
  if (!qr) return null

  const apiType = qr.getTagValue('00', '00')
  const sendingBank = qr.getTagValue('00', '01')
  const transRef = qr.getTagValue('00', '02')

  if (apiType !== '000001' || !sendingBank || !transRef) return null

  return { sendingBank, transRef }
}
