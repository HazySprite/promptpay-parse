import { AID_PROMPTPAY, COUNTRY_TH, CURRENCY_THB } from '../constants'
import { encodeTag81 } from '../tag81'
import { encode, tag, withCrcTag } from '../tlv'

export interface TrueMoneyConfig {
  /** Mobile number */
  mobileNo: string

  /** Transaction amount (omit for a dynamic amount) */
  amount?: number

  /** Personal message (Tag 81) */
  message?: string
}

/**
 * Generate a TrueMoney Wallet QR payload.
 *
 * Other banking apps can scan this like a regular E-Wallet PromptPay QR;
 * the personal message (Tag 81) is ignored by them.
 *
 * @returns QR Code payload
 */
export function trueMoney({ mobileNo, amount, message }: TrueMoneyConfig): string {
  const payload = [
    tag('00', '01'),
    tag('01', amount ? '12' : '11'),
    tag('29', encode([tag('00', AID_PROMPTPAY), tag('03', `14000${mobileNo}`)])),
    tag('53', CURRENCY_THB),
    tag('58', COUNTRY_TH),
  ]

  if (amount) payload.push(tag('54', Number(amount).toFixed(2)))
  if (message) payload.push(tag('81', encodeTag81(message)))

  return withCrcTag(encode(payload), '63')
}
