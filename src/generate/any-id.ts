import { AID_PROMPTPAY, COUNTRY_TH, CURRENCY_THB } from '../constants'
import { encodeAdditionalData, type AdditionalData } from '../additional-data'
import { encode, tag, withCrcTag } from '../tlv'

/** PromptPay AnyID proxy types — sub-tag IDs under Tag 29 */
export const ProxyType = {
  /** Mobile number */
  MSISDN: '01',

  /** National ID or Tax ID */
  NATID: '02',

  /** E-Wallet ID */
  EWALLETID: '03',

  /** Bank Account (reserved) */
  BANKACC: '04',
} as const

export type ProxyTypeName = keyof typeof ProxyType

export interface AnyIdConfig {
  /** Proxy type */
  type: ProxyTypeName

  /** Recipient number (mobile, National ID, Tax ID or E-Wallet ID) */
  target: string

  /** Transaction amount (omit for a dynamic amount) */
  amount?: number

  /** Additional data carried in Tag 62 (bill number, purpose, …) */
  additionalData?: AdditionalData
}

/**
 * Generate a PromptPay AnyID (Tag 29) QR payload.
 *
 * Mobile numbers are normalised to the `0066XXXXXXXXX` MSISDN format.
 *
 * @returns QR Code payload
 */
export function anyId({ type, target, amount, additionalData }: AnyIdConfig): string {
  const proxyValue =
    type === 'MSISDN' ? ('0000000000000' + target.replace(/^0/, '66')).slice(-13) : target

  const payload = [
    tag('00', '01'),
    tag('01', amount ? '12' : '11'),
    tag('29', encode([tag('00', AID_PROMPTPAY), tag(ProxyType[type], proxyValue)])),
    tag('53', CURRENCY_THB),
    tag('58', COUNTRY_TH),
  ]

  if (amount) payload.push(tag('54', Number(amount).toFixed(2)))
  if (additionalData) {
    const encoded = encodeAdditionalData(additionalData)
    if (encoded) payload.push(tag('62', encoded))
  }

  return withCrcTag(encode(payload), '63')
}
