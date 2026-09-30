![promptpay-parse — PromptPay & EMVCo QR toolkit](https://raw.githubusercontent.com/HazySprite/promptpay-parse/master/docs/assets/banner.png)

# promptpay-parse

[English](../README.md) · [npm](https://www.npmjs.com/package/promptpay-parse)

**สร้าง PromptPay QR และอ่านข้อมูล QR ชำระเงินด้วย JavaScript หรือ TypeScript** สร้าง payload สำหรับรับเงิน อ่านข้อมูลที่สแกนมา เปลี่ยนยอด หรือดึงเลขอ้างอิงธุรกรรมจากสลิป

- **ตัวหลักไม่มี runtime dependency** ติดตั้ง `qrcode` เพิ่มเมื่อต้องการสร้างรูป QR
- **อ่านข้อมูลพร้อม TypeScript types** เข้าถึงผู้รับเงิน ยอด ชื่อร้าน และเลขอ้างอิงโดยไม่ต้องถอด Tag เอง
- **รองรับหลายรูปแบบ** ทั้ง PromptPay, TrueMoney, Slip Verify, BOT Barcode และข้อมูล EMVCo QR ทั่วไป

## Install

```sh
npm install promptpay-parse
```

รองรับ Node.js 18+ พร้อม exports แบบ ESM และ CommonJS รวมถึง [browser global](#browser-global)

## Quick start

สร้าง PromptPay payload จากเบอร์มือถือ พร้อมยอดชำระ 30 บาท:

```ts
import { generate, validate } from 'promptpay-parse'

const payload = generate.anyId({
  type: 'MSISDN',
  target: '0812223333',
  amount: 30,
})

console.log(payload) // The string to encode as a QR image
console.log(validate.anyId(payload))
// { type: 'MSISDN', target: '0812223333', amount: 30 }
```

ฟังก์ชันสร้าง QR คืนค่าเป็น **payload string** ใช้ [SVG renderer](#render-a-qr-image) เพื่อแปลงเป็นรูป หากต้องการให้ผู้จ่ายกรอกยอดในแอปธนาคารเอง ให้เว้น `amount` เมื่อใช้งานรับเงินจริง ให้เปลี่ยนเป็นเบอร์ที่ลงทะเบียนพร้อมเพย์ของคุณ

## Choose your task

| ต้องการทำอะไร                                   | เริ่มที่                                               |
| ----------------------------------------------- | ------------------------------------------------------ |
| สร้าง QR รับเงินพร้อมเพย์                       | [`generate.anyId`](#quick-start)                       |
| แสดง QR พร้อมคำบรรยายภาษาไทยหรือโลโก้           | [`renderSvg`](#render-a-qr-image)                      |
| อ่านและจำแนก QR ที่สแกนมา                       | [`parse` / `detect`](#read-a-scanned-qr)               |
| กำหนดยอดหรือแก้ไข QR เดิม                       | [`setAmount` / `withTag`](#change-a-qr-amount)         |
| ดึงรหัสธนาคารและเลขอ้างอิงธุรกรรมจากสลิป        | [`validate.slipVerify`](#extract-payment-slip-details) |
| ใช้งาน Bill Payment, TrueMoney หรือ BOT Barcode | [More payment formats](#more-payment-formats)          |

## Usage

### Render a QR image

ติดตั้ง dependency เพิ่มสำหรับสร้างรูป QR:

```sh
npm install promptpay-parse qrcode
```

```ts
import { generate } from 'promptpay-parse'
import { renderSvg } from 'promptpay-parse/render'

const { svg } = renderSvg({
  payload: generate.anyId({ type: 'MSISDN', target: '0812223333', amount: 30 }),
  size: 420,
  caption: { title: 'ร้านกาแฟบ้านสวน', amount: '฿30.00', subtitle: 'พร้อมเพย์' },
})

console.log(svg) // SVG markup ready to display or save as an .svg file
```

`renderSvg` ใช้ได้ทั้ง Node.js และเบราว์เซอร์ หากต้องการโลโก้ ให้ส่ง `logo` ที่ระบุ `href` ของรูปและ `sizeRatio` เช่น `0.22` ใช้ data URI หากต้องการรวมรูปไว้ใน SVG การใส่โลโก้จะบังคับ error correction level เป็น `H` และอัตราส่วนขนาดต้องมากกว่า `0` แต่ไม่เกิน `0.3` มิฉะนั้นจะเกิด `RangeError`

หากต้องการ PNG ดู [การดาวน์โหลด PNG ในเบราว์เซอร์](#browser-png-download)

### Read a scanned QR

ส่ง **ข้อความที่ถอดรหัสแล้ว** จากตัวสแกน QR เข้ามา ไลบรารีอ่านข้อมูลจาก payload string ส่วนการสแกนรูปให้จัดการในแอปของคุณ

```ts
import { detect, parse } from 'promptpay-parse'

const scannedPayload =
  '00020101021229370016A0000006770101110113006680111111153037645802TH540520.15630442BE'

const qr = parse(scannedPayload, { strict: true })
if (!qr) throw new Error('Invalid QR payload or checksum')

console.log(qr.fields.amount) // 20.15

const result = detect(scannedPayload)
if (result.format === 'anyId') {
  console.log(result.target) // '0801111111'
  console.log(result.amount) // 20.15
}
```

`parse` คืนค่า `EmvQr` หรือ `null` และถอดรหัส Tag ซ้อนให้โดยค่าเริ่มต้น ใช้ `{ strict: true }` เพื่อตรวจ CRC checksum ด้วย ส่วน `detect` จำแนกจากโครงสร้าง หากต้องการตรวจ checksum ให้ใช้ strict parsing หรือ validator ของรูปแบบนั้น

ผลจาก `detect` เป็น typed union ของรูปแบบ `anyId`, `billPayment`, `trueMoney`, `slipVerify`, `trueMoneySlipVerify`, `bcelOneProof`, `botBarcode`, `emv` และ `unknown` ตรวจ `result.format` เพื่อเข้าถึงฟิลด์ของแต่ละรูปแบบ

### Change a QR amount

```ts
import { generate, parse } from 'promptpay-parse'

const payload = generate.anyId({ type: 'MSISDN', target: '0812223333' })
const qr = parse(payload, { strict: true })
if (!qr) throw new Error('Invalid QR payload')

const updated = qr.setAmount(250).withTag('59', 'My Shop')

console.log(updated.fields.amount) // 250
console.log(updated.fields.merchantName) // 'My Shop'
console.log(updated.isValid('63')) // true
console.log(updated.getPayload()) // New payload with a recomputed CRC

const withoutAmount = updated.setAmount(undefined)
console.log(withoutAmount.fields.pointOfInitiation) // 'static'
console.log(qr.fields.amount) // undefined — the original is unchanged
```

การแก้ไขคืนค่า **`EmvQr` ตัวใหม่** พร้อมคำนวณ CRC ใหม่ `setAmount` ปรับสถานะ static/dynamic ให้ด้วย ส่วน Tag อื่นใช้ `withTag` และ `withoutTag`

### Extract payment slip details

อ่าน payload ของ Mini-QR บนสลิปชำระเงิน:

```ts
import { validate } from 'promptpay-parse'

const slipPayload = '004100060000010103014022000111222233344ABCD125102TH910417DF'
const slip = validate.slipVerify(slipPayload)

if (slip) {
  console.log(slip.sendingBank) // '014'
  console.log(slip.transRef) // '00111222233344ABCD12'
}
```

validator ตรวจโครงสร้างและ checksum ของ payload แล้วคืนรหัสธนาคารกับเลขอ้างอิงธุรกรรม หรือ `null` หากต้องการยืนยันการชำระเงิน ให้นำข้อมูลนี้ไปสอบถามผ่าน transaction inquiry API ของธนาคาร การตรวจ checksum เพียงอย่างเดียวไม่ยืนยันว่ามีการโอนเงินจริง

`validate.slipVerify` เติมเลขศูนย์นำหน้าของ CRC ที่ถูกตัดออกให้โดยค่าเริ่มต้น ส่ง `false` เป็นอาร์กิวเมนต์ที่สองหากต้องการปิดการแก้ไขนี้

### More payment formats

```ts
import { generate, parseBarcode, validate } from 'promptpay-parse'

const bill = generate.billPayment({
  billerId: '0112233445566',
  ref1: 'INV12345',
  ref2: 'INV001',
  ref3: 'SCB',
  amount: 300,
})
console.log(validate.billPayment(bill))
// { billerId: '0112233445566', ref1: 'INV12345', ref2: 'INV001', ref3: 'SCB', amount: 300 }

const wallet = generate.trueMoney({ mobileNo: '0801111111', amount: 10.05, message: 'Hello' })
console.log(wallet) // TrueMoney Wallet payload with a personal message

const walletSlip = generate.trueMoneySlipVerify({
  eventType: 'P2P',
  transactionId: 'TM1234567890',
  date: '30092026',
})
console.log(validate.trueMoneySlipVerify(walletSlip))
// { eventType: 'P2P', transactionId: 'TM1234567890', date: '30092026' }

const barcode = generate.botBarcode({
  billerId: '099400016550100',
  ref1: '123456789012',
  amount: 3649.22,
})
console.log(parseBarcode(barcode)?.toQrTag30()) // Convert to a Bill Payment QR payload
```

AnyID รองรับ `NATID` (เลขประจำตัวประชาชน/เลขผู้เสียภาษี) และ `EWALLETID` ด้วย ส่วน `BANKACC` เป็น proxy type ที่สงวนไว้ สำหรับ BCEL OneProof ใช้ `detect` จำแนกและ `validate.bcelOneProof` ตรวจสอบได้

## Advanced usage

<details>
<summary>อ่าน typed fields และ Tag โดยตรง</summary>

```ts
import { generate, parse } from 'promptpay-parse'

const payload = generate.anyId({
  type: 'MSISDN',
  target: '0812223333',
  additionalData: { billNumber: 'INV-2026-0001', purpose: 'Lunch' },
})
const qr = parse(payload, { strict: true })
if (!qr) throw new Error('Invalid QR payload')

const merchantQr = qr.withTag('52', '5812').withTag('59', 'ร้านทดสอบ').withTag('60', 'กรุงเทพ')

console.log(merchantQr.fields.merchantName) // 'ร้านทดสอบ'
console.log(merchantQr.fields.merchantCity) // 'กรุงเทพ'
console.log(merchantQr.fields.merchantCategoryCode) // '5812'
console.log(qr.fields.additionalData) // { billNumber: 'INV-2026-0001', purpose: 'Lunch' }
console.log(qr.getTagValue('29', '01')) // '0066812223333'
```

`fields` มี `pointOfInitiation`, `amount`, `merchantAccountInfo` (Tag 26–51) และ `unreservedTemplates` (Tag 65–99) ด้วย ฟิลด์ที่ไม่มีข้อมูลจะเป็น `undefined` ส่ง `{ subTags: false }` ให้ `parse` เพื่อข้ามการถอดรหัส Tag ซ้อน และยังใช้รูปแบบอาร์กิวเมนต์ `parse(payload, strict?, subTags?)` ได้

</details>

<details>
<summary>สร้างข้อมูล TLV โดยตรง</summary>

```ts
import { encode, tag, withCrcTag } from 'promptpay-parse'

const data = encode([tag('00', '01'), tag('01', '11')])
console.log(withCrcTag(data, '63')) // '0002010102116304AD0A'
```

`tag` และ `encode` ไม่รับค่าที่มีความยาวเกินกว่าฟิลด์ความยาวสองหลักจะระบุได้ ส่วน `crc16` คำนวณ CRC-16/CCITT-FALSE จากไบต์ UTF-8 และคืนเลขฐานสิบหกตัวพิมพ์ใหญ่สี่หลัก

</details>

### Browser PNG download

<details>
<summary>ดาวน์โหลด PNG จากแอปในเบราว์เซอร์</summary>

ติดตั้ง `qrcode` ตามหัวข้อ [Render a QR image](#render-a-qr-image) แล้วรันตัวอย่างนี้ในโมดูลของแอปฝั่งเบราว์เซอร์:

```ts
import { generate } from 'promptpay-parse'
import { downloadPng, renderSvg } from 'promptpay-parse/render'

const { svg } = renderSvg({
  payload: generate.anyId({ type: 'MSISDN', target: '0812223333', amount: 30 }),
  caption: { title: 'ร้านกาแฟบ้านสวน', amount: '฿30.00' },
})

await downloadPng(svg, 'promptpay-30.png', { scale: 3 })
```

`downloadPng` และ `svgToPngDataUrl` ต้องใช้ DOM และ canvas ของเบราว์เซอร์ โดย `svgToPngDataUrl` คืนค่าเป็น PNG data URL หากต้องการแปลงเป็น PNG ฝั่งเซิร์ฟเวอร์ ต้องใช้ SVG rasterizer เพิ่ม

</details>

### Browser global

<details>
<summary>ใช้งานผ่าน script tag หรือ CommonJS</summary>

```html
<script src="https://cdn.jsdelivr.net/npm/promptpay-parse/dist/index.global.js"></script>
<script>
  const payload = PromptPayParse.generate.anyId({
    type: 'MSISDN',
    target: '0812223333',
    amount: 30,
  })
  console.log(PromptPayParse.validate.anyId(payload))
</script>
```

ดาวน์โหลด `dist/index.global.js` จาก [GitHub Releases](https://github.com/HazySprite/promptpay-parse/releases) มาให้บริการเองได้เช่นกัน ตัวหลักเรียกใช้ผ่าน `PromptPayParse` ส่วน renderer ใช้ entry แยกที่ `promptpay-parse/render`

สำหรับ CommonJS:

```js
const { generate, validate } = require('promptpay-parse')

const payload = generate.anyId({ type: 'MSISDN', target: '0812223333', amount: 30 })
console.log(validate.anyId(payload))
// { type: 'MSISDN', target: '0812223333', amount: 30 }
```

</details>

## API reference

| Export                                                                    | ใช้ทำอะไร                                                                                                               |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `parse` / `parseBarcode`                                                  | อ่านข้อมูล EMVCo QR หรือ BOT Barcode แล้วคืน object หรือ `null`                                                         |
| `EmvQr`                                                                   | `fields`, `getTag`, `getTagValue`, `getTags`, `getPayload`, `crcTagId`, `isValid`, `withTag`, `withoutTag`, `setAmount` |
| `detect`                                                                  | จำแนก payload และดึงข้อมูลเป็น discriminated union                                                                      |
| `generate.*`                                                              | `anyId`, `billPayment`, `slipVerify`, `trueMoney`, `trueMoneySlipVerify`, `botBarcode`                                  |
| `validate.*`                                                              | `anyId`, `billPayment`, `slipVerify`, `trueMoneySlipVerify`, `bcelOneProof`; คืนข้อมูลที่ดึงได้หรือ `null`              |
| `generate.ProxyType`                                                      | ตาราง proxy ของ AnyID: `MSISDN`, `NATID`, `EWALLETID`, `BANKACC`                                                        |
| `encodeAdditionalData` / `extractAdditionalData` / `ADDITIONAL_DATA_TAGS` | ฟังก์ชันและค่าคงที่สำหรับ EMVCo Tag 62                                                                                  |
| `encodeTag81` / `decodeTag81`                                             | เข้ารหัสและถอดรหัสข้อความส่วนตัวของ TrueMoney                                                                           |
| `crc16` / `decode` / `encode` / `tag` / `withCrcTag` / `getTag`           | ฟังก์ชันสำหรับ CRC และข้อมูล TLV                                                                                        |
| `renderSvg` / `downloadPng` / `svgToPngDataUrl`                           | นำเข้าจาก `promptpay-parse/render`; ต้องติดตั้ง `qrcode`                                                                |

นำเข้า generator และ validator โดยตรงได้ด้วย: `import { anyId, ProxyType } from 'promptpay-parse/generate'` และ `import { slipVerify } from 'promptpay-parse/validate'`

## Development

```sh
npm ci
npm test          # run tests
npm run coverage  # tests with V8 coverage
npm run lint      # Prettier + ESLint
npm run typecheck # TypeScript checks
npm run build     # ESM, CommonJS, browser global, and types
npm run format    # format and fix lint issues
```

[CI](../.github/workflows/ci.yml) รัน typecheck, lint, coverage และ build บน Node 20/22 พร้อมงานทดสอบแยกสำหรับ Bun และ Deno

<details>
<summary>กำหนดเวอร์ชันและออก release (สำหรับผู้ดูแล)</summary>

กำหนดเวอร์ชันตาม semver (`MAJOR.MINOR.PATCH`):

```sh
npm version patch # or minor / major
git push --follow-tags
```

Tag รูปแบบ `v*` เรียก [publish workflow](../.github/workflows/publish.yml) ซึ่งตรวจว่า Tag ตรงกับเวอร์ชันแพ็กเกจ รันการตรวจสอบ เผยแพร่ไปยัง npm พร้อม provenance และสร้าง GitHub Release ที่แนบ `dist/index.global.js` โดยใช้ secret `NPM_TOKEN` ของ repository

</details>

## References

- [EMVCo QR Code specification](https://www.emvco.com/emv-technologies/qrcodes/)
- [Thai QR Payment Standard (BOT)](https://www.bot.or.th/content/dam/bot/fipcs/documents/FPG/2562/ThaiPDF/25620084.pdf)
- [Slip Verify API Mini QR Data](https://developer.scb/assets/documents/documentation/qr-payment/extracting-data-from-mini-qr.pdf)
- [BOT Barcode Standard](https://www.bot.or.th/content/dam/bot/documents/th/our-roles/payment-systems/about-payment-systems/Std_Barcode.pdf)

## License

[MIT](../LICENSE)
