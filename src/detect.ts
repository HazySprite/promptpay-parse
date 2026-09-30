import { extractAdditionalData, type AdditionalData } from './additional-data'
import { AID_BILL_PAYMENT, AID_PROMPTPAY } from './constants'
import { type ProxyTypeName } from './generate/any-id'
import { BotBarcode } from './bot-barcode'
import { EmvQr } from './emv-qr'
import { decodeTag81 } from './tag81'
import { parse, parseBarcode } from './parse'

/** A PromptPay QR classified as AnyID (Tag 29) */
export interface DetectedAnyId {
  format: 'anyId'
  qr: EmvQr
  type: ProxyTypeName
  target: string
  amount?: number
  additionalData?: AdditionalData
}

/** A PromptPay QR classified as Bill Payment (Tag 30) */
export interface DetectedBillPayment {
  format: 'billPayment'
  qr: EmvQr
  billerId: string
  ref1: string
  ref2?: string
  ref3?: string
  amount?: number
}

/** A TrueMoney Wallet QR */
export interface DetectedTrueMoney {
  format: 'trueMoney'
  qr: EmvQr
  mobileNo: string
  amount?: number
  message?: string
}

/** A Slip Verify ("Mini-QR") payload */
export interface DetectedSlipVerify {
  format: 'slipVerify'
  qr: EmvQr
  sendingBank: string
  transRef: string
}

/** A TrueMoney Slip Verify payload */
export interface DetectedTrueMoneySlipVerify {
  format: 'trueMoneySlipVerify'
  qr: EmvQr
  eventType: string | undefined
  transactionId: string | undefined
  date: string | undefined
}

/** A BCEL OneProof payload */
export interface DetectedBcelOneProof {
  format: 'bcelOneProof'
  qr: EmvQr
  type: string | undefined
  ticket: string | undefined
  fccref: string | undefined
}

/** Result of {@link detect} — one variant per known format */
export type DetectedQr =
  | { format: 'botBarcode'; barcode: BotBarcode }
  | DetectedAnyId
  | DetectedBillPayment
  | DetectedTrueMoney
  | DetectedSlipVerify
  | DetectedTrueMoneySlipVerify
  | DetectedBcelOneProof
  | { format: 'emv'; qr: EmvQr }
  | { format: 'unknown' }

/**
 * Detect the format of a scanned payload and extract its data in one call.
 *
 * Classification is structural (does not depend on a valid CRC), so tampered
 * or truncated payloads are still classified; use `result.qr.isValid(...)`
 * or the `validate.*` functions when checksum integrity matters.
 *
 * @param payload - Payload from a QR or barcode scanner
 * @returns Discriminated union — switch on `result.format`
 */
export function detect(payload: string): DetectedQr {
  if (typeof payload === 'string' && payload.startsWith('|')) {
    const barcode = parseBarcode(payload)
    return barcode ? { format: 'botBarcode', barcode } : { format: 'unknown' }
  }

  const qr = parse(payload)
  if (!qr) return { format: 'unknown' }

  const moneySlip = tryTrueMoneySlipVerify(qr)
  if (moneySlip) return { format: 'trueMoneySlipVerify', qr, ...moneySlip }

  const slip = trySlipVerify(qr)
  if (slip) return { format: 'slipVerify', qr, ...slip }

  const amountRaw = qr.getTagValue('54')
  const amountData = amountRaw !== undefined ? { amount: Number.parseFloat(amountRaw) } : {}

  if (qr.getTagValue('00') === '01' && qr.getTagValue('29', '00') === AID_PROMPTPAY) {
    const ewallet = qr.getTagValue('29', '03')
    if (ewallet !== undefined && ewallet.startsWith('14000')) {
      const messageRaw = qr.getTagValue('81')
      return {
        format: 'trueMoney',
        qr,
        mobileNo: ewallet.slice(5),
        ...amountData,
        ...(messageRaw !== undefined ? { message: decodeTag81(messageRaw) } : {}),
      }
    }

    const anyIdTarget = tryAnyIdTarget(qr)
    if (anyIdTarget) {
      const additional = extractAdditionalData(qr.getTags())
      return {
        format: 'anyId',
        qr,
        ...anyIdTarget,
        ...amountData,
        ...(Object.keys(additional).length > 0 ? { additionalData: additional } : {}),
      }
    }
  }

  if (
    qr.getTagValue('00') === '01' &&
    qr.getTagValue('30', '00') === AID_BILL_PAYMENT &&
    qr.getTagValue('30', '01') &&
    qr.getTagValue('30', '02')
  ) {
    return {
      format: 'billPayment',
      qr,
      billerId: qr.getTagValue('30', '01')!,
      ref1: qr.getTagValue('30', '02')!,
      ...(qr.getTagValue('30', '03') ? { ref2: qr.getTagValue('30', '03')! } : {}),
      ...(qr.getTagValue('62', '07') ? { ref3: qr.getTagValue('62', '07')! } : {}),
      ...amountData,
    }
  }

  // Detection uses the issuer marker only — `00 === '01'` is shared by every
  // PromptPay payload and would misclassify them as BCEL.
  const issuer = qr.getTagValue('33', '00')
  if (issuer === 'BCEL' || issuer === 'ONEPROOF') {
    return {
      format: 'bcelOneProof',
      qr,
      type: qr.getTagValue('33', '02'),
      ticket: qr.getTagValue('33', '03'),
      fccref: qr.getTagValue('33', '04'),
    }
  }

  return { format: 'emv', qr }
}

/** Resolve the AnyID proxy type and normalised target from Tag 29 */
function tryAnyIdTarget(qr: EmvQr): { type: ProxyTypeName; target: string } | null {
  const subTags: [ProxyTypeName, string][] = [
    ['MSISDN', '01'],
    ['NATID', '02'],
    ['EWALLETID', '03'],
    ['BANKACC', '04'],
  ]

  for (const [type, subId] of subTags) {
    const target = qr.getTagValue('29', subId)
    if (target === undefined) continue
    if (type === 'MSISDN' && target.length === 13 && target.startsWith('0066')) {
      return { type, target: '0' + target.slice(-9) }
    }
    return { type, target }
  }

  return null
}

/** TrueMoney Slip Verify: Tag 00 sub-tags 00 and 01 both `01` */
function tryTrueMoneySlipVerify(qr: EmvQr) {
  if (qr.getTagValue('00', '00') !== '01' || qr.getTagValue('00', '01') !== '01') return null

  return {
    eventType: qr.getTagValue('00', '02'),
    transactionId: qr.getTagValue('00', '03'),
    date: qr.getTagValue('00', '04'),
  }
}

/** Slip Verify: Tag 00 sub-tag 00 `000001` with bank and reference present */
function trySlipVerify(qr: EmvQr) {
  if (qr.getTagValue('00', '00') !== '000001') return null

  const sendingBank = qr.getTagValue('00', '01')
  const transRef = qr.getTagValue('00', '02')
  if (!sendingBank || !transRef) return null

  return { sendingBank, transRef }
}
