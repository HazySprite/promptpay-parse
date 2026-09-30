![promptpay-parse — PromptPay & EMVCo QR toolkit](https://raw.githubusercontent.com/HazySprite/promptpay-parse/master/docs/assets/banner.png)

# promptpay-parse

Zero-dependency TypeScript library for **PromptPay & EMVCo QR Codes** — parse, manipulate, generate, detect and render.

Implemented directly from the [EMVCo QR Code](https://www.emvco.com/emv-technologies/qrcodes/) and [BOT Thai QR Payment](https://www.bot.or.th) specifications.

## Features

- **Parse** — PromptPay / EMVCo QR data strings into a typed tag object, with typed extraction of all well-known EMVCo MPM fields (merchant name, city, MCC, additional data, …)
- **Manipulate** — edit any parsed QR (`withTag`, `withoutTag`, `setAmount`) and get a re-encoded payload with a freshly computed CRC
- **Generate** — QR payloads from templates: PromptPay AnyID, Bill Payment, Slip Verify (Mini-QR), TrueMoney, TrueMoney Slip Verify, BOT Barcode
- **Detect** — one call that classifies any scanned payload (AnyID / Bill Payment / TrueMoney / Slip Verify / BCEL OneProof / BOT Barcode / generic EMV) and extracts its data
- **Validate** — CRC-16 checksum and per-format structure checks
- **Render** (optional) — QR as a self-contained SVG with logo and Thai caption support
- **Zero dependencies** — single build, no runtime installs (the optional `./render` entry uses `qrcode` as an optional peer dependency)

## Install

```sh
npm install promptpay-parse
# optional, only for image rendering:
npm install promptpay-parse qrcode
```

## Usage

### Parse a QR payload and read tags

```ts
import { parse } from 'promptpay-parse'

const qr = parse('00020101021129370016A0000006770101110113006681222333353037645802TH63041DCF')
// or with an options object: parse(payload, { strict: true, subTags: true })

qr?.getTagValue('00') // '01'
qr?.getTagValue('29', '01') // sub-tag of Tag 29
qr?.isValid('63') // true — CRC re-verified
qr?.crcTagId // '63'
```

### Read typed EMVCo fields

```ts
qr?.fields.merchantName // 'ร้านทดสอบ'
qr?.fields.merchantCity // 'กรุงเทพ'
qr?.fields.merchantCategoryCode // '5812'
qr?.fields.pointOfInitiation // 'static' | 'dynamic'
qr?.fields.amount // number | undefined
qr?.fields.additionalData // { billNumber?: string, purpose?: string, ... }
qr?.fields.merchantAccountInfo // Tags 26–51 with AIDs and sub-tags
qr?.fields.unreservedTemplates // Tags 65–99
```

### Manipulate a parsed QR

Every manipulation returns a **new** `EmvQr`; the original is untouched and the CRC tag is recomputed automatically.

```ts
import { parse } from 'promptpay-parse'

const qr = parse('0002010102112937…63041DCF')!

// Bake an amount into a static QR (flips Tag 01 to dynamic)
const withAmount = qr.setAmount(250)

// Remove it again
const staticAgain = withAmount.setAmount(undefined)

// Generic tag editing, chainable
const edited = qr.withTag('59', 'My Shop').withoutTag('53')

edited.getPayload() // re-encoded payload with a fresh CRC
edited.isValid('63') // true
```

### Detect the format of any scanned payload

```ts
import { detect } from 'promptpay-parse'

const result = detect(scannedString)

switch (result.format) {
  case 'anyId':
    result.type // 'MSISDN'
    result.target // '0812223333'
    result.amount
    result.additionalData // Tag 62 fields when present
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
  case 'trueMoneySlipVerify':
  case 'bcelOneProof':
  case 'botBarcode':
  case 'emv': // generic EMVCo payload
  case 'unknown':
}
```

Classification is structural, so tampered payloads are still classified — combine with `validate.*` or `qr.isValid()` when checksum integrity matters.

### Build raw TLV data

```ts
import { encode, tag, withCrcTag } from 'promptpay-parse'

const payload = encode([tag('00', '01'), tag('01', '11')])
withCrcTag(payload, '63') // appends Tag 63 + CRC-16 checksum
```

### Generate QR payloads

```ts
import { generate } from 'promptpay-parse'
// or deep import: import { anyId } from 'promptpay-parse/generate'

// PromptPay AnyID — mobile / National ID / e-Wallet, with optional Tag 62 data
const anyIdPayload = generate.anyId({
  type: 'MSISDN',
  target: '0812223333',
  amount: 30,
  additionalData: { billNumber: 'INV-2026-0001', purpose: 'Lunch' },
})

// PromptPay Bill Payment (Tag 30)
const billPayload = generate.billPayment({
  billerId: '0112233445566',
  ref1: 'INV12345',
  ref2: 'INV001',
  ref3: 'SCB',
  amount: 300.0,
})

// TrueMoney Wallet (supports Tag 81 personal message)
const tmPayload = generate.trueMoney({ mobileNo: '0801111111', amount: 10.05, message: 'Hello' })

// Slip Verify "Mini-QR" from a payment slip
const slipPayload = generate.slipVerify({ sendingBank: '014', transRef: '0002123123121200011' })

// BOT Barcode (|billerId\rref1\rref2\ramount)
const barcode = generate.botBarcode({
  billerId: '099400016550100',
  ref1: '123456789012',
  amount: 3649.22,
})
```

Feed the payload string into any QR Code image library (e.g. `qrcode`) to render the image — or use the built-in renderer below.

### Validate & extract

```ts
import { parseBarcode, validate } from 'promptpay-parse'
// or deep import: import { slipVerify } from 'promptpay-parse/validate'

const slip = validate.slipVerify('004100060000010103014022000111222233344ABCD125102TH910417DF')
if (slip) {
  await bankApi.inquire(slip.sendingBank, slip.transRef)
}

validate.anyId(anyIdPayload) // { type: 'MSISDN', target: '0812223333', amount: 30, additionalData? }
validate.billPayment(billPayload) // { billerId, ref1, ref2?, ref3?, amount? }
validate.trueMoneySlipVerify(tmSlipPayload) // { eventType, transactionId, date }

// BOT Barcode → PromptPay Bill Payment QR (Tag 30)
parseBarcode('|099999999999990\r111222333444\r\r0')?.toQrTag30()
```

### Render an image (optional `qrcode` peer dependency)

```ts
import { generate } from 'promptpay-parse'
import { renderSvg, downloadPng } from 'promptpay-parse/render'

const { svg, errorCorrectionLevel } = renderSvg({
  payload: generate.billPayment({ billerId: '0112233445566', ref1: 'INV12345', amount: 250 }),
  size: 420,
  logo: { href: logoDataUri, sizeRatio: 0.22 },
  caption: { title: 'ร้านกาแฟบ้านสวน', amount: '฿250.00', subtitle: 'พร้อมเพย์' },
})

// browser: rasterise through the platform canvas and download
await downloadPng(svg, 'promptpay-250.png', { scale: 3 })
```

A logo spends the QR's error-correction budget on one contiguous block, so the renderer **forces level `H` whenever a logo is present** and throws `RangeError` above a `0.3` size ratio. `svgToPngDataUrl` returns the data URL without downloading; on the server rasterise the SVG with `@resvg/resvg-js`.

### Browser global (CDN)

```html
<script src="https://cdn.jsdelivr.net/npm/promptpay-parse/dist/index.global.js"></script>

<script>
  const payload = PromptPayParse.generate.trueMoney({ mobileNo: '08xxxxxxxx', amount: 10 })
</script>
```

The same `dist/index.global.js` file is attached to every [GitHub Release](../../releases) — download it and serve it yourself if you don't use a CDN.

## API

| Export                                                                                     | Description                                                                                                                                                           |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parse(payload, options?)`                                                                 | Parse EMVCo QR → `EmvQr` or `null`. Options: `{ strict?, subTags? }` (positional `parse(payload, strict?, subTags?)` still works)                                     |
| `EmvQr`                                                                                    | `getTag`, `getTagValue`, `getTags`, `getPayload`, `fields`, `crcTagId`, `isValid`, `withTag`, `withoutTag`, `setAmount`                                               |
| `detect(payload)`                                                                          | Classify any payload → discriminated union (`anyId`, `billPayment`, `trueMoney`, `slipVerify`, `trueMoneySlipVerify`, `bcelOneProof`, `botBarcode`, `emv`, `unknown`) |
| `generate.anyId / billPayment / slipVerify / trueMoney / trueMoneySlipVerify / botBarcode` | Payload generators                                                                                                                                                    |
| `validate.anyId / billPayment / slipVerify / trueMoneySlipVerify / bcelOneProof`           | Format validators & extractors                                                                                                                                        |
| `encodeAdditionalData / extractAdditionalData / ADDITIONAL_DATA_TAGS`                      | EMVCo Tag 62 additional data helpers                                                                                                                                  |
| `encodeTag81 / decodeTag81`                                                                | TrueMoney Tag 81 personal message codec                                                                                                                               |
| `crc16(data)`                                                                              | CRC-16/CCITT-FALSE over UTF-8 bytes, 4-digit uppercase hex                                                                                                            |
| `decode / encode / tag / withCrcTag / getTag`                                              | Raw TLV utilities (`tag` and `encode` reject values that exceed the 2-digit length field)                                                                             |
| `ProxyType`                                                                                | AnyID proxy type map (`MSISDN`, `NATID`, `EWALLETID`, `BANKACC`)                                                                                                      |
| `renderSvg / downloadPng / svgToPngDataUrl`                                                | QR image rendering — `import from 'promptpay-parse/render'`, requires `qrcode`                                                                                        |

อ่านเอกสารภาษาไทยได้ที่ [docs/README.th.md](docs/README.th.md)

## Development

```sh
npm test          # run the test suite
npm run coverage  # tests with V8 coverage report
npm run lint      # prettier --check + eslint
npm run format    # prettier --write + eslint --fix
npm run typecheck # tsc --noEmit
npm run build     # emit dist/ (esm, cjs, iife + types)
```

Every push/PR runs the full pipeline (typecheck → lint → coverage → build) on Node 20/22 plus Bun and Deno jobs.

## Versioning & release flow

Semver (`MAJOR.MINOR.PATCH`). To cut a release:

```sh
npm version patch   # or minor / major
git push --follow-tags
```

Pushing a `v*` tag triggers `.github/workflows/publish.yml`: install → typecheck → lint → build → test → `npm publish --provenance` → GitHub Release with `dist/index.global.js` attached. Requires the `NPM_TOKEN` secret in the repository settings.

## References

- [EMV QR Code Specification](https://www.emvco.com/emv-technologies/qrcodes/)
- [Thai QR Payment Standard (BOT)](https://www.bot.or.th/content/dam/bot/fipcs/documents/FPG/2562/ThaiPDF/25620084.pdf)
- [Slip Verify API Mini QR Data](https://developer.scb/assets/documents/documentation/qr-payment/extracting-data-from-mini-qr.pdf)
- [BOT Barcode Standard](https://www.bot.or.th/content/dam/bot/documents/th/our-roles/payment-systems/about-payment-systems/Std_Barcode.pdf)

## License

[MIT](LICENSE)
