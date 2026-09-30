import { ProxyType, type ProxyTypeName } from '../generate/any-id'
import { parse } from '../parse'
import { AID_PROMPTPAY } from '../constants'
import { extractAdditionalData, type AdditionalData } from '../additional-data'

export interface AnyIdData {
  /** Proxy type detected from the sub-tag ID */
  type: ProxyTypeName

  /** Recipient number (mobile in local format, National ID, etc.) */
  target: string

  /** Transaction amount, present only when the QR carries Tag 54 */
  amount?: number

  /** Additional data, present only when the QR carries Tag 62 */
  additionalData?: AdditionalData
}

/**
 * Validate and extract data from a PromptPay AnyID (Tag 29) QR payload.
 *
 * @param payload - QR Code payload
 * @returns Proxy data, or `null` when the payload is not AnyID data
 */
export function anyId(payload: string): AnyIdData | null {
  const qr = parse(payload, true)
  if (!qr) return null

  if (qr.getTagValue('00') !== '01') return null
  if (qr.getTagValue('29', '00') !== AID_PROMPTPAY) return null

  const entry = (Object.entries(ProxyType) as [ProxyTypeName, string][]).find(
    ([, id]) => qr.getTagValue('29', id) !== undefined,
  )
  if (!entry) return null

  const [type, subId] = entry
  let target = qr.getTagValue('29', subId) as string

  // Normalise the MSISDN back to the local 0XXXXXXXXX format
  if (type === 'MSISDN' && target.length === 13 && target.startsWith('0066')) {
    target = '0' + target.slice(-9)
  }

  const amountRaw = qr.getTagValue('54')
  const additionalData = extractAdditionalData(qr.getTags())

  return {
    type,
    target,
    ...(amountRaw !== undefined ? { amount: Number.parseFloat(amountRaw) } : {}),
    ...(Object.keys(additionalData).length > 0 ? { additionalData } : {}),
  }
}
