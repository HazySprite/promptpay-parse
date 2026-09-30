import { AID_BILL_PAYMENT } from '../constants'
import { parse } from '../parse'

export interface BillPaymentData {
  /** Biller ID (National ID / Tax ID + suffix) */
  billerId: string

  /** Reference No. 1 */
  ref1: string

  /** Reference No. 2, present only when the QR carries Tag 30 sub-tag 03 */
  ref2?: string

  /** Reference No. 3, present only when the QR carries Tag 62 sub-tag 07 */
  ref3?: string

  /** Transaction amount, present only when the QR carries Tag 54 */
  amount?: number
}

/**
 * Validate and extract data from a PromptPay Bill Payment (Tag 30) QR payload.
 *
 * @param payload - QR Code payload
 * @returns Bill payment data, or `null` when the payload is not Bill Payment data
 */
export function billPayment(payload: string): BillPaymentData | null {
  const qr = parse(payload, true)
  if (!qr) return null

  const billerId = qr.getTagValue('30', '01')
  const ref1 = qr.getTagValue('30', '02')

  if (qr.getTagValue('00') !== '01') return null
  if (qr.getTagValue('30', '00') !== AID_BILL_PAYMENT) return null
  if (!billerId || !ref1) return null

  const ref2 = qr.getTagValue('30', '03')
  const ref3 = qr.getTagValue('62', '07')
  const amountRaw = qr.getTagValue('54')

  return {
    billerId,
    ref1,
    ...(ref2 !== undefined ? { ref2 } : {}),
    ...(ref3 !== undefined ? { ref3 } : {}),
    ...(amountRaw !== undefined ? { amount: Number.parseFloat(amountRaw) } : {}),
  }
}
