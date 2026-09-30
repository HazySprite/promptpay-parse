import { billPayment } from './generate/bill-payment'

/**
 * Barcode payload following the BOT Barcode Standard
 * (`|billerId\rref1\rref2\ramount`, amount in satang).
 */
export class BotBarcode {
  constructor(
    /** Biller ID (Tax ID + suffix) */
    public readonly billerId: string,
    /** Reference No. 1 / Customer No. */
    public readonly ref1: string,
    /** Reference No. 2, or `null` when absent */
    public readonly ref2: string | null = null,
    /** Transaction amount in THB, or `null` when the barcode has no amount */
    public readonly amount: number | null = null,
  ) {}

  /**
   * Parse a BOT Barcode string from a scanner.
   *
   * @param payload - Barcode string, expected to start with `|`
   * @returns Parsed barcode, or `null` when the payload is not BOT Barcode data
   */
  static fromString(payload: string): BotBarcode | null {
    if (!payload.startsWith('|')) return null

    const parts = payload.slice(1).split('\r')
    if (parts.length < 4) return null
    // Extra non-empty fields indicate a corrupted scan; dropping them
    // would silently change what a payment system reads back.
    if (parts.slice(4).some((p) => p.trim() !== '')) return null

    const billerId = parts[0]
    const ref1 = parts[1]
    const ref2 = parts[2]
    const amountField = parts[3]
    if (!billerId || !ref1 || ref2 === undefined || amountField === undefined) {
      return null
    }

    const satang = Number.parseInt(amountField, 10)
    const amount =
      amountField !== '0' && Number.isFinite(satang) ? Number((satang / 100).toFixed(2)) : null

    return new BotBarcode(billerId, ref1, ref2.length > 0 ? ref2 : null, amount)
  }

  /**
   * Encode back to the BOT Barcode string format.
   *
   * Amount is rounded to 2 decimals and converted to satang with
   * `Math.round` to avoid floating-point artifacts (e.g. `30.10 * 100`).
   */
  toString(): string {
    const amountField = this.amount == null ? '0' : String(Math.round(this.amount * 100))
    return `|${this.billerId}\r${this.ref1}\r${this.ref2 ?? ''}\r${amountField}`
  }

  /**
   * Convert to a PromptPay Bill Payment (Tag 30) QR payload.
   *
   * Works for billers whose destination bank accepts Tag 30 transfers.
   *
   * @returns QR Code payload
   */
  toQrTag30(): string {
    return billPayment({
      billerId: this.billerId,
      ref1: this.ref1,
      ref2: this.ref2 ?? undefined,
      amount: this.amount ?? undefined,
    })
  }
}
