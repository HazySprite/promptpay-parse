import fc from 'fast-check'
import { describe, expect, test } from 'vitest'

import {
  EmvQr,
  crc16,
  decode,
  detect,
  encode,
  generate,
  parse,
  tag,
  validate,
  type TlvTag,
} from './index'

// Hostile/untrusted input comes straight off scanner hardware; these
// properties pin down the parser's behaviour on arbitrary strings.

// Values are capped at 40 characters so `tag()` never trips its 99-char
// TLV length guard even when astral characters count as two UTF-16 units.
const asciiTag: fc.Arbitrary<TlvTag> = fc
  .tuple(fc.stringMatching(/^\d{2}$/), fc.string({ maxLength: 40 }))
  .map(([id, value]) => tag(id, value))

const canonicalTlv: fc.Arbitrary<string> = fc
  .array(asciiTag, { minLength: 0, maxLength: 8 })
  .map(encode)

describe('decode properties', () => {
  test('never throws on arbitrary input', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 512 }), (s) => {
        expect(() => decode(s)).not.toThrow()
      }),
    )
  })

  test('encode ∘ decode = id on canonical TLV', () => {
    fc.assert(
      fc.property(canonicalTlv, (payload) => {
        expect(encode(decode(payload))).toBe(payload)
      }),
    )
  })

  test('decode ∘ encode = id on tag arrays', () => {
    fc.assert(
      fc.property(fc.array(asciiTag, { maxLength: 8 }), (tags) => {
        expect(decode(encode(tags))).toEqual(tags)
      }),
    )
  })
})

describe('crc16 properties', () => {
  test('never throws, always 4 uppercase hex digits', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 256 }), (s) => {
        expect(crc16(s)).toMatch(/^[0-9A-F]{4}$/)
      }),
    )
  })
})

describe('parse properties', () => {
  test('arbitrary input yields EmvQr or null, never throws', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 512 }), (payload) => {
        let result: unknown
        expect(() => {
          result = parse(payload)
        }).not.toThrow()
        expect(result === null || result instanceof EmvQr).toBe(true)
      }),
    )
  })

  test('generated payloads always re-parse with a valid strict CRC', () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.constantFrom('MSISDN', 'NATID', 'EWALLETID'),
          target: fc.stringMatching(/^[0-9]{10,13}$/),
          amount: fc.option(fc.integer({ min: 1, max: 999999 }), { nil: undefined }),
        }),
        (config) => {
          const payload = generate.anyId(config)
          const qr = parse(payload, { strict: true })
          expect(qr).not.toBeNull()
          expect(validate.anyId(payload)).not.toBeNull()
        },
      ),
    )
  })

  test('setAmount round-trips through strict parse with the exact encoded value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999999 }),
        fc.constantFrom('MSISDN', 'NATID'),
        fc.stringMatching(/^[0-9]{10,13}$/),
        (satang, type, target) => {
          const amount = satang / 100
          const qr = parse(generate.anyId({ type, target }))!
          const next = qr.setAmount(amount)
          const reparsed = parse(next.getPayload(), { strict: true })!

          expect(reparsed.getTagValue('54')).toBe(amount.toFixed(2))
          expect(reparsed.getTagValue('01')).toBe('12')
          expect(next.isValid('63')).toBe(true)
        },
      ),
    )
  })
})

describe('detect properties', () => {
  test('arbitrary input returns a known format, never throws', () => {
    const formats = [
      'botBarcode',
      'anyId',
      'billPayment',
      'trueMoney',
      'slipVerify',
      'trueMoneySlipVerify',
      'bcelOneProof',
      'emv',
      'unknown',
    ]

    fc.assert(
      fc.property(fc.string({ maxLength: 512 }), (payload) => {
        let result: { format: string }
        expect(() => {
          result = detect(payload) as unknown as { format: string }
        }).not.toThrow()
        expect(formats).toContain(result!.format)
      }),
    )
  })

  test('every generated format is classified, not unknown', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999999 }), (satang) => {
        const amount = satang / 100
        expect(
          detect(generate.anyId({ type: 'MSISDN', target: '0812223333', amount })).format,
        ).toBe('anyId')
        expect(
          detect(generate.billPayment({ billerId: '0112233445566', ref1: 'CUSTOMER001', amount }))
            .format,
        ).toBe('billPayment')
        expect(detect(generate.trueMoney({ mobileNo: '0801111111', amount })).format).toBe(
          'trueMoney',
        )
        expect(
          detect(generate.slipVerify({ sendingBank: '014', transRef: '0002123123121200011' }))
            .format,
        ).toBe('slipVerify')
        expect(
          detect(
            generate.trueMoneySlipVerify({
              eventType: 'P2P',
              transactionId: 'TM1234567890',
              date: '30092026',
            }),
          ).format,
        ).toBe('trueMoneySlipVerify')
      }),
    )
  })
})
