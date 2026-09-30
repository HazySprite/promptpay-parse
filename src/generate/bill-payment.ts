import { AID_BILL_PAYMENT, COUNTRY_TH, CURRENCY_THB } from '../constants'
import { encode, tag, withCrcTag } from '../tlv'

export interface BillPaymentConfig {
  /** Biller ID (National ID / Tax ID + suffix) */
  billerId: string

  /** Transaction amount (omit for a dynamic amount) */
  amount?: number

  /** Reference No. 1 */
  ref1: string

  /** Reference No. 2 */
  ref2?: string

  /** Reference No. 3 (undocumented, carried in Tag 62 sub-tag 07) */
  ref3?: string
}

/**
 * Generate a PromptPay Bill Payment (Tag 30) QR payload.
 *
 * @returns QR Code payload
 */
export function billPayment({
  billerId,
  amount,
  ref1,
  ref2,
  ref3,
}: BillPaymentConfig): string {
  const tag30 = encode([
    tag('00', AID_BILL_PAYMENT),
    tag('01', billerId),
    tag('02', ref1),
    ...(ref2 ? [tag('03', ref2)] : []),
  ])

  const payload = [
    tag('00', '01'),
    tag('01', amount ? '12' : '11'),
    tag('30', tag30),
    tag('53', CURRENCY_THB),
    tag('58', COUNTRY_TH),
  ]

  if (amount) payload.push(tag('54', Number(amount).toFixed(2)))
  if (ref3) payload.push(tag('62', encode([tag('07', ref3)])))

  return withCrcTag(encode(payload), '63')
}
