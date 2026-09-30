# promptpay-parse (ภาษาไทย)

ไลบรารี TypeScript **ไม่มี dependency** สำหรับ **PromptPay & EMVCo QR Codes** — อ่าน (parse), แก้ไข (manipulate), สร้าง (generate), จำแนก (detect) และเรนเดอร์ (render) ครบในตัวเดียว

พัฒนาตามสเปก [EMVCo QR Code](https://www.emvco.com/emv-technologies/qrcodes/) และ [มาตรฐาน Thai QR Payment ของ ธปท.](https://www.bot.or.th)

English documentation: [../../README.md](../../README.md)

## ความสามารถ

- **Parse** — อ่านข้อมูล QR PromptPay / EMVCo เป็น object พร้อม typed fields ครบทุก Tag มาตรฐาน (ชื่อร้าน เมือง MCC ข้อมูลเพิ่มเติม ฯลฯ)
- **Manipulate** — แก้ไข QR ที่ scan มาได้ (`withTag`, `withoutTag`, `setAmount`) แล้วได้ payload ใหม่ที่คำนวณ CRC ให้อัตโนมัติ
- **Generate** — สร้าง payload จากเทมเพลต: AnyID, Bill Payment, Slip Verify (Mini-QR), TrueMoney, TrueMoney Slip Verify, BOT Barcode
- **Detect** — จำแนกชนิด payload จากเครื่อง scan ใน call เดียว พร้อมดึงข้อมูลออกมาเป็น union type
- **Validate** — ตรวจ CRC-16 และโครงสร้างรายฟอร์แมต (รวม auto-fix CRC ที่ถูกตัด 0 หน้าจากแอปธนาคารบางตัว)
- **Render** (ตัวเลือก) — เรนเดอร์ QR เป็น SVG แบบ self-contained พร้อมโลโก้และแคปชันภาษาไทย
- **ศูนย์ dependency** — ตัวหลักไม่ติดตั้งอะไรเพิ่ม (`./render` ใช้ `qrcode` เป็น optional peer dependency)

## ติดตั้ง

```sh
npm install promptpay-parse
# ถ้าต้องการเรนเดอร์รูป:
npm install promptpay-parse qrcode
```

ใช้ได้ทั้ง Node.js, Bun, Deno, เฟรมเวิร์ก (Next.js, Nuxt) และเบราว์เซอร์

## เริ่มใช้งาน

### อ่าน QR และดึงค่า Tag

```ts
import { parse } from 'promptpay-parse'

const qr = parse('00020101021129370016A0000006770101110113006681222333353037645802TH63041DCF')
// แบบระบุ options: parse(payload, { strict: true, subTags: true })

qr?.getTagValue('00') // '01'
qr?.getTagValue('29', '01') // sub-tag ของ Tag 29
qr?.isValid('63') // true — ตรวจ CRC ซ้ำ
```

### อ่านข้อมูลแบบ typed

```ts
qr?.fields.merchantName // 'ร้านทดสอบ'
qr?.fields.merchantCity // 'กรุงเทพ'
qr?.fields.pointOfInitiation // 'static' (ผู้จ่ายกรอกยอดเอง) | 'dynamic' (ยอดติดใน QR)
qr?.fields.amount
qr?.fields.additionalData // { billNumber?, purpose?, terminalLabel?, ... } จาก Tag 62
qr?.fields.merchantAccountInfo // Tag 26–51 พร้อม AID
```

### แก้ไข QR ที่มีอยู่

ทุกการแก้ไขคืน `EmvQr` **ตัวใหม่** — ตัวเดิมไม่ถูกแตะต้อง และ CRC ถูกคำนวณใหม่เสมอ

```ts
const qr = parse(payload)!

const withAmount = qr.setAmount(250) // ฝังยอด → เปลี่ยนเป็น dynamic QR
const edited = qr.withTag('59', 'ร้านของฉัน').withoutTag('53') // แก้ Tag ทั่วไป

edited.getPayload() // payload ใหม่พร้อม CRC ใหม่
edited.isValid('63') // true
```

### จำแนก payload จากเครื่อง scan

```ts
import { detect } from 'promptpay-parse'

const result = detect(scannedString)

switch (result.format) {
  case 'anyId':
    result.type // 'MSISDN' | 'NATID' | 'EWALLETID' | 'BANKACC'
    result.target
    result.amount
    result.additionalData
    break
  case 'billPayment':
    result.billerId
    result.ref1
    break
  case 'trueMoney':
    result.mobileNo
    result.message
    break
  case 'slipVerify':
    result.sendingBank
    result.transRef
    break
  // trueMoneySlipVerify | bcelOneProof | botBarcode | emv | unknown
}
```

การจำแนกเป็นเชิงโครงสร้าง ดังนั้น payload ที่ CRC เพี้ยนยังถูกจำแนกได้ — ใช้ `validate.*` หรือ `qr.isValid()` เมื่อความถูกต้องของ checksum สำคัญ

### สร้าง QR payload

```ts
import { generate } from 'promptpay-parse'

// AnyID — เบอร์มือถือ / เลขบัตร / e-Wallet + Tag 62 ได้
generate.anyId({
  type: 'MSISDN',
  target: '0812223333',
  amount: 30,
  additionalData: { billNumber: 'INV-2026-0001', purpose: 'Lunch' },
})

// Bill Payment (Tag 30)
generate.billPayment({
  billerId: '0112233445566',
  ref1: 'INV12345',
  ref2: 'INV001',
  ref3: 'SCB',
  amount: 300,
})

// TrueMoney (รองรับข้อความ Tag 81)
generate.trueMoney({ mobileNo: '0801111111', amount: 10.05, message: 'สวัสดี' })

// Slip Verify "Mini-QR" จากสลิป
generate.slipVerify({ sendingBank: '014', transRef: '0002123123121200011' })

// BOT Barcode
generate.botBarcode({ billerId: '099400016550100', ref1: '123456789012', amount: 3649.22 })
```

### ตรวจสอบและดึงข้อมูล

```ts
import { validate } from 'promptpay-parse'

validate.slipVerify(payload) // { sendingBank, transRef } หรือ null
validate.anyId(payload) // { type, target, amount?, additionalData? }
validate.billPayment(payload) // { billerId, ref1, ref2?, ref3?, amount? }
validate.trueMoneySlipVerify(payload) // { eventType, transactionId, date }
validate.bcelOneProof(payload) // { type, ticket, fccref }
```

### เรนเดอร์เป็นรูป (ต้องติดตั้ง `qrcode` เพิ่ม)

```ts
import { renderSvg, downloadPng } from 'promptpay-parse/render'

const { svg } = renderSvg({
  payload,
  size: 420,
  logo: { href: logoDataUri, sizeRatio: 0.22 },
  caption: { title: 'ร้านกาแฟบ้านสวน', amount: '฿250.00', subtitle: 'พร้อมเพย์ 081-xxx-xxxx' },
})

// ในเบราว์เซอร์ — แปลงเป็น PNG แล้วดาวน์โหลด
await downloadPng(svg, 'promptpay-250.png', { scale: 3 })
```

> **โลโก้ใน QR มีข้อจำกัดด้านความปลอดภัย** — ไลบรารีบังคับ error-correction level `H` ทุกครั้งที่ใส่โลโก้ และห้ามขนาดเกิน 30% ของความกว้าง (`RangeError` ถ้าเกิน) เพราะ QR ที่แสกนไม่ออกหน้าร้าน แย่กว่าโลโก้ที่เล็กกว่าที่คิดไว้เสมอ

ในฝั่ง server ให้นำ SVG ไป rasterise ด้วย `@resvg/resvg-js` (helper ฝั่ง browser ต้องมี DOM)

## เอกสารอ้างอิง

- [EMV QR Code Specification](https://www.emvco.com/emv-technologies/qrcodes/)
- [มาตรฐาน Thai QR Payment (ธปท.)](https://www.bot.or.th/content/dam/bot/fipcs/documents/FPG/2562/ThaiPDF/25620084.pdf)
- [Slip Verify API Mini QR Data](https://developer.scb/assets/documents/documentation/qr-payment/extracting-data-from-mini-qr.pdf)
- [มาตรฐาน BOT Barcode](https://www.bot.or.th/content/dam/bot/documents/th/our-roles/payment-systems/about-payment-systems/Std_Barcode.pdf)

## License

[MIT](../../LICENSE)
