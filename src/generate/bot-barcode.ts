import { BotBarcode } from '../bot-barcode'

export interface BotBarcodeConfig {
  /** Biller ID (Tax ID + suffix) */
  billerId: string

  /** Reference No. 1 / Customer No. */
  ref1: string

  /** Reference No. 2 */
  ref2?: string | null

  /** Transaction amount in THB */
  amount?: number | null
}

/**
 * Generate a BOT Barcode string
 * (`|billerId\rref1\rref2\ramount`, amount in satang).
 *
 * @returns Barcode payload
 */
export function botBarcode({
  billerId,
  ref1,
  ref2,
  amount,
}: BotBarcodeConfig): string {
  return new BotBarcode(
    billerId,
    ref1,
    ref2 ?? null,
    amount ?? null,
  ).toString()
}
