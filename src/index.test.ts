import { describe, expect, test } from 'vitest'

import {
  crc16,
  decode,
  decodeTag81,
  detect,
  encode,
  encodeAdditionalData,
  encodeTag81,
  generate,
  parse,
  parseBarcode,
  tag,
  validate,
  withCrcTag,
} from './index'
import { AID_PROMPTPAY } from './constants'

describe('crc16', () => {
  test('UTF-8 sequences (2, 3 and 4 bytes)', () => {
    expect(crc16('Café')).toBe('8FDF')
    expect(crc16('ร้านทดสอบ')).toBe('1EA0')
    expect(crc16('a\u{1F600}b')).toBe('BF6B')
  })

  test('unpaired surrogate is replaced with U+FFFD', () => {
    expect(crc16('lone\uD800x')).toBe('64F6')
  })
})

describe('tlv', () => {
  test('decode/encode round trip', () => {
    const payload = '000411110104222202043333'
    const tags = decode(payload)
    expect(tags).toHaveLength(3)
    expect(encode(tags)).toBe(payload)
  })

  test('decode stops at malformed tag', () => {
    // 'ZZ' is not a valid tag-length header → decoding stops there
    expect(decode('00041111ZZ043333')).toEqual([{ id: '00', value: '1111', length: 4 }])
    expect(decode('ZZ')).toEqual([])
  })

  test('decode rejects tags with truncated values', () => {
    expect(decode('0002')).toEqual([])
    expect(decode('00041111010422')).toEqual([{ id: '00', value: '1111', length: 4 }])
    expect(parse('0002')).toBeNull()
  })

  test('withCrcTag appends checksum', () => {
    expect(withCrcTag('000201', '63')).toBe('0002016304' + crc16('0002016304'))
  })

  test('withCrcTag lowercase mode', () => {
    expect(withCrcTag('000201', '63', true)).toBe('0002016304' + crc16('0002016304').toLowerCase())
  })

  test('tag builder records value length', () => {
    expect(tag('54', '30.00')).toEqual({ id: '54', value: '30.00', length: 5 })
  })

  test('tag builder rejects values that exceed the 2-digit length field', () => {
    expect(() => tag('59', 'x'.repeat(100))).toThrow(RangeError)
    expect(tag('59', 'x'.repeat(99)).length).toBe(99)
  })
})

describe('parse', () => {
  test('rejects non-EMVCo payload', () => {
    expect(parse('AAAA0000')).toBeNull()
    expect(parse('')).toBeNull()
    expect(parse(undefined as unknown as string)).toBeNull()
  })

  test('decodes tags and reads values', () => {
    const qr = parse('000411110104222202043333')
    expect(qr?.getTags()).toHaveLength(3)
    expect(qr?.getTag('01')?.value).toBe('2222')
    expect(qr?.getTagValue('02')).toBe('3333')
    expect(qr?.getPayload()).toBe('000411110104222202043333')
    expect(qr?.toString()).toBe('000411110104222202043333')
  })

  test('strict mode rejects bad checksum', () => {
    expect(
      parse(
        '00020101021229370016A0000006770101110113006680111111153037645802TH540520.156304FFFF',
        true,
      ),
    ).toBeNull()
  })

  test('strict mode accepts valid checksum and reads sub-tags', () => {
    expect(
      parse(
        '00020101021229370016A0000006770101110113006680111111153037645802TH540520.15630442BE',
        true,
      )?.getTagValue('29', '01'),
    ).toBe('0066801111111')
  })

  test('strict mode with UTF-8 merchant fields', () => {
    const payload =
      '00020101021129370016A0000006770101110113006681222333353037645802TH5927ร้านทดสอบ6021กรุงเทพ630488F4'

    expect(parse(payload, true)).not.toBeNull()
    expect(parse(payload.slice(0, -4) + 'FFFF', true)).toBeNull()
  })

  test('isValid re-verifies CRC tag', () => {
    const payload =
      '00020101021229370016A0000006770101110113006680111111153037645802TH540520.15630442BE'
    expect(parse(payload)?.isValid('63')).toBe(true)
    expect(parse(payload + '00')?.isValid('63')).toBe(false)
  })
})

describe('generate', () => {
  test('anyId MSISDN without amount', () => {
    expect(generate.anyId({ type: 'MSISDN', target: '0812223333' })).toBe(
      '00020101021129370016A0000006770101110113006681222333353037645802TH63041DCF',
    )
  })

  test('anyId MSISDN with amount', () => {
    expect(generate.anyId({ type: 'MSISDN', target: '0812223333', amount: 30 })).toBe(
      '00020101021229370016A0000006770101110113006681222333353037645802TH540530.0063043CAD',
    )
  })

  test('anyId National ID passes through as-is', () => {
    const payload = generate.anyId({
      type: 'NATID',
      target: '1234567890123',
      amount: 100,
    })
    expect(payload).toContain('02131234567890123')
    expect(parse(payload)?.isValid('63')).toBe(true)
  })

  test('slipVerify', () => {
    expect(
      generate.slipVerify({
        sendingBank: '002',
        transRef: '0002123123121200011',
      }),
    ).toBe('004000060000010103002021900021231231212000115102TH91049C30')
  })

  test('trueMoney without amount', () => {
    expect(generate.trueMoney({ mobileNo: '0801111111' })).toBe(
      '00020101021129390016A000000677010111031514000080111111153037645802TH63047C0F',
    )
  })

  test('trueMoney with amount and message', () => {
    expect(
      generate.trueMoney({
        mobileNo: '0801111111',
        amount: 10.05,
        message: 'Hello World!',
      }),
    ).toBe(
      '00020101021229390016A000000677010111031514000080111111153037645802TH540510.05814800480065006C006C006F00200057006F0072006C006400216304F5A2',
    )
  })

  test('billPayment with ref2 and ref3', () => {
    expect(
      generate.billPayment({
        billerId: '0112233445566',
        ref1: 'CUSTOMER001',
        ref2: 'INV001',
        ref3: 'SCB',
      }),
    ).toBe(
      '00020101021130620016A000000677010112011301122334455660211CUSTOMER0010306INV00153037645802TH62070703SCB6304780E',
    )
  })

  test('billPayment with amount', () => {
    const payload = generate.billPayment({
      billerId: '0112233445566',
      ref1: 'CUSTOMER001',
      amount: 250,
    })
    expect(payload).toContain('010212')
    expect(payload).toContain('5406250.00')
    expect(parse(payload)?.isValid('63')).toBe(true)
  })

  test('trueMoneySlipVerify uses lowercase CRC', () => {
    const payload = generate.trueMoneySlipVerify({
      eventType: 'P2P',
      transactionId: 'TM1234567890',
      date: '30092026',
    })
    expect(payload).toMatch(/9104[0-9a-f]{4}$/)
    expect(parse(payload, true)).not.toBeNull()
  })

  test('botBarcode without ref2 and amount', () => {
    expect(
      generate.botBarcode({
        billerId: '099999999999990',
        ref1: '111222333444',
      }),
    ).toBe('|099999999999990\r111222333444\r\r0')
  })

  test('botBarcode with ref2 and amount', () => {
    expect(
      generate.botBarcode({
        billerId: '099400016550100',
        ref1: '123456789012',
        ref2: '670429',
        amount: 3649.22,
      }),
    ).toBe('|099400016550100\r123456789012\r670429\r364922')
  })

  test('botBarcode amounts avoid float artifacts', () => {
    expect(
      generate.botBarcode({
        billerId: '099400016550100',
        ref1: '123456789012',
        amount: 30.1,
      }),
    ).toBe('|099400016550100\r123456789012\r\r3010')
  })
})

describe('parseBarcode', () => {
  test('converts BOT Barcode to Tag 30 without optional fields', () => {
    expect(parseBarcode('|099999999999990\r111222333444\r\r0')?.toQrTag30()).toBe(
      '00020101021130550016A0000006770101120115099999999999990021211122233344453037645802TH63043EE7',
    )
  })

  test('converts BOT Barcode with ref2 and amount', () => {
    expect(parseBarcode('|099400016550100\r123456789012\r670429\r364922')?.toQrTag30()).toBe(
      '00020101021230650016A00000067701011201150994000165501000212123456789012030667042953037645802TH54073649.2263044534',
    )
  })

  test('rejects QR payload and truncated barcode', () => {
    expect(
      parseBarcode(
        '00020101021230650016A00000067701011201150994000165501000212123456789012030667042953037645802TH54073649.2263044534',
      ),
    ).toBeNull()
    expect(parseBarcode('|099400016550100\r123456789012\r670429')).toBeNull()
  })

  test('rejects corrupted barcode with extra fields, tolerates trailing delimiter', () => {
    expect(parseBarcode('|099400016550100\r123456789012\r670429\r364922\rEXTRA')).toBeNull()
    expect(parseBarcode('|099400016550100\r123456789012\r670429\r364922\r')).not.toBeNull()
    expect(parseBarcode('|099400016550100\r123456789012\r670429\r364922\r\n')).not.toBeNull()
  })

  test('round trips through toString', () => {
    const barcode = parseBarcode('|099400016550100\r123456789012\r670429\r364922')
    expect(barcode?.toString()).toBe('|099400016550100\r123456789012\r670429\r364922')
  })
})

describe('validate', () => {
  test('anyId round trip (MSISDN, no amount)', () => {
    expect(validate.anyId(generate.anyId({ type: 'MSISDN', target: '0812223333' }))).toEqual({
      type: 'MSISDN',
      target: '0812223333',
    })
  })

  test('anyId round trip (MSISDN, with amount)', () => {
    expect(
      validate.anyId(generate.anyId({ type: 'MSISDN', target: '0812223333', amount: 30 })),
    ).toEqual({ type: 'MSISDN', target: '0812223333', amount: 30 })
  })

  test('anyId round trip (NATID)', () => {
    expect(validate.anyId(generate.anyId({ type: 'NATID', target: '1234567890123' }))).toEqual({
      type: 'NATID',
      target: '1234567890123',
    })
  })

  test('anyId rejects slip verify payload', () => {
    expect(validate.anyId('004000060000010103002021900021231231212000115102TH91049C30')).toBeNull()
  })

  test('billPayment round trip (no optional fields)', () => {
    expect(
      validate.billPayment(
        generate.billPayment({ billerId: '0112233445566', ref1: 'CUSTOMER001' }),
      ),
    ).toEqual({ billerId: '0112233445566', ref1: 'CUSTOMER001' })
  })

  test('billPayment round trip (ref2, ref3, amount)', () => {
    expect(
      validate.billPayment(
        generate.billPayment({
          billerId: '0112233445566',
          ref1: 'CUSTOMER001',
          ref2: 'INV001',
          ref3: 'SCB',
          amount: 250,
        }),
      ),
    ).toEqual({
      billerId: '0112233445566',
      ref1: 'CUSTOMER001',
      ref2: 'INV001',
      ref3: 'SCB',
      amount: 250,
    })
  })

  test('billPayment rejects AnyID payload', () => {
    expect(
      validate.billPayment(generate.anyId({ type: 'MSISDN', target: '0812223333' })),
    ).toBeNull()
  })

  test('slipVerify extracts bank and reference', () => {
    expect(
      validate.slipVerify('004100060000010103014022000111222233344ABCD125102TH910417DF'),
    ).toEqual({ sendingBank: '014', transRef: '00111222233344ABCD12' })
  })

  test('slipVerify rejects AnyID payload', () => {
    expect(
      validate.slipVerify(
        '00020101021229370016A0000006770101110113006680111111153037645802TH540520.15630442BE',
      ),
    ).toBeNull()
  })

  test('slipVerify auto-fixes CRC with stripped leading zero', () => {
    // Some scanners/converters trim leading zeros from the checksum;
    // the auto-fix restores them (left-pad to 4 digits).
    let payload = ''
    let transRef = ''
    for (let i = 0; i < 10000; i++) {
      transRef = String(i).padStart(20, '0')
      payload = generate.slipVerify({ sendingBank: '014', transRef })
      if (payload.slice(-4).startsWith('0')) break
    }

    const body = payload.slice(0, -4)
    const truncated = body + payload.slice(-4).replace(/^0+/, '')
    expect(truncated.length).toBeLessThan(payload.length)
    expect(validate.slipVerify(truncated)).toEqual({
      sendingBank: '014',
      transRef,
    })
  })

  test('trueMoneySlipVerify round trip', () => {
    const payload = generate.trueMoneySlipVerify({
      eventType: 'P2P',
      transactionId: 'TM1234567890',
      date: '30092026',
    })
    expect(validate.trueMoneySlipVerify(payload)).toEqual({
      eventType: 'P2P',
      transactionId: 'TM1234567890',
      date: '30092026',
    })
  })

  test('trueMoneySlipVerify rejects other formats', () => {
    expect(
      validate.trueMoneySlipVerify(
        '00020101021129370016A0000006770101110113006681222333353037645802TH63041DCF',
      ),
    ).toBeNull()
  })

  test('bcelOneProof extracts proof data', () => {
    const payload = withCrcTag(
      encode([
        tag('00', '01'),
        tag(
          '33',
          encode([
            tag('00', 'BCEL'),
            tag('02', 'TICKET'),
            tag('03', '000123'),
            tag('04', 'REF0099'),
          ]),
        ),
      ]),
      '63',
    )
    expect(validate.bcelOneProof(payload)).toEqual({
      type: 'TICKET',
      ticket: '000123',
      fccref: 'REF0099',
    })
  })

  test('bcelOneProof rejects payloads without format markers', () => {
    const payload = withCrcTag(
      encode([
        tag('33', encode([tag('00', 'OTHER'), tag('02', 'T'), tag('03', 'K'), tag('04', 'R')])),
      ]),
      '63',
    )
    expect(validate.bcelOneProof(payload)).toBeNull()
    expect(validate.bcelOneProof(payload.slice(0, -4) + 'FFFF')).toBeNull()
  })
})

describe('EmvQr manipulation', () => {
  test('withTag replaces an existing tag in place and refreshes the CRC', () => {
    const qr = parse(generate.anyId({ type: 'MSISDN', target: '0812223333' }))!
    const next = qr.withTag('58', 'US')

    expect(next.getTagValue('58')).toBe('US')
    expect(next.isValid('63')).toBe(true)
    expect(validate.anyId(next.getPayload())).not.toBeNull()
    // original untouched
    expect(qr.getTagValue('58')).toBe('TH')
    expect(qr.isValid('63')).toBe(true)
  })

  test('withTag appends a new tag before the CRC tag', () => {
    const qr = parse(generate.anyId({ type: 'MSISDN', target: '0812223333' }))!
    const next = qr.withTag('59', 'ร้านทดสอบ')

    const ids = next.getTags().map((t) => t.id)
    expect(ids.indexOf('59')).toBe(ids.length - 2)
    expect(next.isValid('63')).toBe(true)
  })

  test('withoutTag removes a tag and refreshes the CRC', () => {
    const qr = parse(generate.anyId({ type: 'MSISDN', target: '0812223333', amount: 30 }))!
    const next = qr.withoutTag('54')

    expect(next.getTagValue('54')).toBeUndefined()
    expect(next.getTagValue('01')).toBe('12')
    expect(next.isValid('63')).toBe(true)
  })

  test('setAmount bakes an amount and flips to dynamic', () => {
    const qr = parse(generate.anyId({ type: 'MSISDN', target: '0812223333' }))!
    const next = qr.setAmount(123.456)

    expect(next.getTagValue('01')).toBe('12')
    expect(next.getTagValue('54')).toBe('123.46')
    expect(next.isValid('63')).toBe(true)

    const extracted = validate.anyId(next.getPayload())
    expect(extracted?.amount).toBeCloseTo(123.46)
  })

  test('setAmount(undefined) reverts to a static QR', () => {
    const qr = parse(generate.anyId({ type: 'MSISDN', target: '0812223333', amount: 30 }))!
    const next = qr.setAmount(undefined)

    expect(next.getTagValue('54')).toBeUndefined()
    expect(next.getTagValue('01')).toBe('11')
    expect(next.isValid('63')).toBe(true)
  })

  test('manipulation chains', () => {
    const qr = parse(generate.anyId({ type: 'MSISDN', target: '0812223333' }))!
    const next = qr.setAmount(50).withTag('59', 'Shop').withoutTag('58')

    expect(next.getTagValue('54')).toBe('50.00')
    expect(next.getTagValue('59')).toBe('Shop')
    expect(next.getTagValue('58')).toBeUndefined()
    expect(next.isValid('63')).toBe(true)
  })

  test('CRC tag is protected from direct manipulation', () => {
    const qr = parse(generate.anyId({ type: 'MSISDN', target: '0812223333' }))!
    expect(() => qr.withTag('63', 'ZZZZ')).toThrow(RangeError)
    expect(() => qr.withoutTag('63')).toThrow(RangeError)
  })

  test('manipulation works with the Slip Verify CRC tag (91)', () => {
    const qr = parse(generate.slipVerify({ sendingBank: '014', transRef: '0002123123121200011' }))!
    expect(qr.crcTagId).toBe('91')

    const next = qr.withTag('51', 'US')
    expect(next.crcTagId).toBe('91')
    expect(next.isValid('91')).toBe(true)
  })

  test('fields exposes typed EMVCo data', () => {
    // TLV length is in characters per the EMVCo spec, so build the payload
    // instead of hardcoding a byte-length fixture.
    const payload = withCrcTag(
      encode([
        tag('00', '01'),
        tag('01', '11'),
        tag('29', encode([tag('00', AID_PROMPTPAY), tag('01', '0066812223333')])),
        tag('52', '5812'),
        tag('53', '764'),
        tag('58', 'TH'),
        tag('59', 'ร้านทดสอบ'),
        tag('60', 'กรุงเทพ'),
        tag('62', encode([tag('05', 'REF-9'), tag('08', 'Coffee')])),
      ]),
      '63',
    )
    const qr = parse(payload, { strict: true })!

    expect(qr.fields).toMatchObject({
      payloadFormat: '01',
      pointOfInitiation: 'static',
      merchantCategoryCode: '5812',
      currency: '764',
      country: 'TH',
      merchantName: 'ร้านทดสอบ',
      merchantCity: 'กรุงเทพ',
      additionalData: { referenceLabel: 'REF-9', purpose: 'Coffee' },
    })
    expect(qr.fields.merchantAccountInfo[0]?.aid).toBe(AID_PROMPTPAY)
    expect(qr.fields.amount).toBeUndefined()
  })
})

describe('additional data (Tag 62)', () => {
  test('encodes sub-tags in ID order and skips empty values', () => {
    const encoded = encodeAdditionalData({
      purpose: 'Lunch',
      billNumber: 'INV-1',
      storeLabel: '',
    })
    expect(encoded).toBe('0105INV-10805Lunch')
  })

  test('anyId generates and validates Tag 62 round trip', () => {
    const payload = generate.anyId({
      type: 'MSISDN',
      target: '0812223333',
      amount: 30,
      additionalData: { billNumber: 'INV-2026-0001', terminalLabel: 'POS-01' },
    })

    expect(payload).toContain('6227' + '0113INV-2026-0001' + '0706POS-01')
    expect(parse(payload)?.isValid('63')).toBe(true)
    expect(validate.anyId(payload)).toEqual({
      type: 'MSISDN',
      target: '0812223333',
      amount: 30,
      additionalData: { billNumber: 'INV-2026-0001', terminalLabel: 'POS-01' },
    })
  })
})

describe('decodeTag81', () => {
  test('round trips through encodeTag81', () => {
    expect(decodeTag81(encodeTag81('Hello World!'))).toBe('Hello World!')
    expect(decodeTag81(encodeTag81('สวัสดี'))).toBe('สวัสดี')
    expect(decodeTag81('zz')).toBe('')
    expect(decodeTag81('zzzz')).toBe('')
  })
})

describe('parse options object', () => {
  const payload =
    '00020101021229370016A0000006770101110113006680111111153037645802TH540520.15630442BE'

  test('positional and options forms are equivalent', () => {
    expect(parse(payload, true)).toEqual(parse(payload, { strict: true }))
    expect(parse(payload, { strict: true, subTags: false })?.getTag('29', '01')).toBeUndefined()
    expect(parse(payload, { strict: true })?.getTagValue('29', '01')).toBe('0066801111111')
    expect(parse(payload, { strict: true, subTags: false })).toEqual(parse(payload, true, false))
  })
})

describe('detect', () => {
  test('classifies AnyID with additional data', () => {
    const payload = generate.anyId({
      type: 'MSISDN',
      target: '0812223333',
      amount: 30,
      additionalData: { purpose: 'Lunch' },
    })
    const result = detect(payload)

    expect(result.format).toBe('anyId')
    if (result.format !== 'anyId') return
    expect(result.type).toBe('MSISDN')
    expect(result.target).toBe('0812223333')
    expect(result.amount).toBe(30)
    expect(result.additionalData).toEqual({ purpose: 'Lunch' })
  })

  test('classifies Bill Payment and TrueMoney', () => {
    const bill = detect(generate.billPayment({ billerId: '0112233445566', ref1: 'CUSTOMER001' }))
    expect(bill.format).toBe('billPayment')
    if (bill.format === 'billPayment') {
      expect(bill.billerId).toBe('0112233445566')
      expect(bill.ref1).toBe('CUSTOMER001')
    }

    const tm = detect(generate.trueMoney({ mobileNo: '0801111111', amount: 10, message: 'Hi' }))
    expect(tm.format).toBe('trueMoney')
    if (tm.format === 'trueMoney') {
      expect(tm.mobileNo).toBe('0801111111')
      expect(tm.amount).toBe(10)
      expect(tm.message).toBe('Hi')
    }
  })

  test('classifies slip verify, TrueMoney slip and BOT barcode', () => {
    const slip = detect(
      generate.slipVerify({ sendingBank: '014', transRef: '0002123123121200011' }),
    )
    expect(slip.format).toBe('slipVerify')
    if (slip.format === 'slipVerify') expect(slip.sendingBank).toBe('014')

    const tmSlip = detect(
      generate.trueMoneySlipVerify({ eventType: 'P2P', transactionId: 'TM123', date: '30092026' }),
    )
    expect(tmSlip.format).toBe('trueMoneySlipVerify')
    if (tmSlip.format === 'trueMoneySlipVerify') expect(tmSlip.eventType).toBe('P2P')

    const barcode = detect('|099400016550100\r123456789012\r670429\r364922')
    expect(barcode.format).toBe('botBarcode')
    if (barcode.format === 'botBarcode') expect(barcode.barcode.amount).toBe(3649.22)
  })

  test('classifies BCEL by issuer marker and falls back to emv/unknown', () => {
    const bcel = withCrcTag(
      encode([tag('33', encode([tag('00', 'ONEPROOF'), tag('02', 'T'), tag('03', 'K')]))]),
      '63',
    )
    expect(detect(bcel).format).toBe('bcelOneProof')

    expect(detect('000411110104222202043333').format).toBe('emv')
    expect(detect('garbage').format).toBe('unknown')
    expect(detect('|').format).toBe('unknown')
  })

  test('still classifies a tampered payload (structural, not strict)', () => {
    const payload = generate.anyId({ type: 'MSISDN', target: '0812223333', amount: 30 })
    const tampered = payload.slice(0, -4) + 'FFFF'
    const result = detect(tampered)

    expect(result.format).toBe('anyId')
    expect(parse(tampered, { strict: true })).toBeNull()
  })
})
