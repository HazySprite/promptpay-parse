import { COUNTRY_TH } from '../constants'
import { encode, tag, withCrcTag } from '../tlv'

export interface SlipVerifyConfig {
  /** Bank code (e.g. `002` for Bangkok Bank, `014` for SCB) */
  sendingBank: string

  /** Transaction reference */
  transRef: string
}

/**
 * Generate a Slip Verify ("Mini-QR") payload — the small QR printed on
 * payment slips, used with Bank Open API transaction inquiries.
 *
 * CRC Tag ID is `91` for this format.
 *
 * @returns QR Code payload
 */
export function slipVerify({ sendingBank, transRef }: SlipVerifyConfig): string {
  const payload = [
    tag('00', encode([tag('00', '000001'), tag('01', sendingBank), tag('02', transRef)])),
    tag('51', COUNTRY_TH),
  ]

  return withCrcTag(encode(payload), '91')
}
