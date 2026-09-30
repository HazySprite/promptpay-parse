![promptpay-parse — PromptPay & EMVCo QR toolkit](https://raw.githubusercontent.com/HazySprite/promptpay-parse/master/docs/assets/banner.png)

# promptpay-parse

[ภาษาไทย](docs/README.th.md) · [npm](https://www.npmjs.com/package/promptpay-parse)

**Generate PromptPay QR payloads and read payment QR data in JavaScript or TypeScript.** Build a payment QR, read a scanned payload, change its amount, or extract transaction references from a slip.

- **No runtime dependencies in the core.** Install `qrcode` only when you need image rendering.
- **Typed data.** Read recipient details, amounts, merchant fields, and references without decoding tags yourself.
- **Multiple payment formats.** PromptPay, TrueMoney, Slip Verify, BOT Barcode, and generic EMVCo QR data in one toolkit.

## Install

```sh
npm install promptpay-parse
```

Node.js 18+; ESM and CommonJS exports are included. A [browser global](#browser-global) is also available.

## Quick start

Create a PromptPay payload for a mobile number with a ฿30 payment amount:

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

Generators return a **payload string**. Use [the SVG renderer](#render-a-qr-image) to turn it into an image. Omit `amount` to let the payer enter the amount in their banking app. Use your own PromptPay-registered number when accepting payments.

## Choose your task

| I want to…                                          | Start with                                             |
| --------------------------------------------------- | ------------------------------------------------------ |
| Create a PromptPay payment QR                       | [`generate.anyId`](#quick-start)                       |
| Display a QR with a Thai caption or logo            | [`renderSvg`](#render-a-qr-image)                      |
| Read a scanned QR and identify its format           | [`parse` / `detect`](#read-a-scanned-qr)               |
| Set an amount or edit an existing QR                | [`setAmount` / `withTag`](#change-a-qr-amount)         |
| Extract bank and transaction references from a slip | [`validate.slipVerify`](#extract-payment-slip-details) |
| Work with Bill Payment, TrueMoney, or BOT Barcode   | [More payment formats](#more-payment-formats)          |

## Usage

### Render a QR image

Install the optional rendering dependency:

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

`renderSvg` works in Node.js and browsers. For a logo, pass `logo` with an image `href` (use a data URI for a self-contained SVG) and `sizeRatio`, such as `0.22`. A logo forces error correction level `H`; ratios must be greater than `0` and at most `0.3`, otherwise the renderer throws `RangeError`.

For PNG output, see [browser PNG download](#browser-png-download).

### Read a scanned QR

Pass the **decoded text** from your QR scanner. The library reads payload strings; image scanning happens in your app.

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

`parse` returns `EmvQr` or `null`. It decodes nested tags by default; `{ strict: true }` also checks the CRC checksum. `detect` classifies by structure, so use strict parsing or a format validator when you also need checksum validation.

Detection returns a typed union with these formats: `anyId`, `billPayment`, `trueMoney`, `slipVerify`, `trueMoneySlipVerify`, `bcelOneProof`, `botBarcode`, `emv`, and `unknown`. Switch on `result.format` to access each format's fields.

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

Edits return a **new `EmvQr`** and recompute its CRC. `setAmount` also updates the static/dynamic flag. Use `withTag` and `withoutTag` for other tag edits.

### Extract payment slip details

Read the Mini-QR payload from a payment slip:

```ts
import { validate } from 'promptpay-parse'

const slipPayload = '004100060000010103014022000111222233344ABCD125102TH910417DF'
const slip = validate.slipVerify(slipPayload)

if (slip) {
  console.log(slip.sendingBank) // '014'
  console.log(slip.transRef) // '00111222233344ABCD12'
}
```

The validator checks the payload's structure and checksum and returns the bank code and transaction reference, or `null`. To confirm a payment, send those details to your bank's transaction inquiry API. Checksum validation alone does not confirm that money was transferred.

`validate.slipVerify` also restores leading zeros in truncated CRCs by default; pass `false` as its second argument to disable this repair.

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

AnyID also supports `NATID` (national/tax ID) and `EWALLETID`. `BANKACC` is a reserved proxy type. BCEL OneProof payloads can be classified with `detect` and checked with `validate.bcelOneProof`.

## Advanced usage

<details>
<summary>Read typed fields and raw tags</summary>

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

`fields` also exposes `pointOfInitiation`, `amount`, `merchantAccountInfo` (Tags 26–51), and `unreservedTemplates` (Tags 65–99). Optional fields are `undefined` when absent. Pass `{ subTags: false }` to `parse` to skip nested tag decoding; positional `parse(payload, strict?, subTags?)` remains supported.

</details>

<details>
<summary>Build raw TLV data</summary>

```ts
import { encode, tag, withCrcTag } from 'promptpay-parse'

const data = encode([tag('00', '01'), tag('01', '11')])
console.log(withCrcTag(data, '63')) // '0002010102116304AD0A'
```

`tag` and `encode` reject values that exceed the two-digit length field. `crc16` computes CRC-16/CCITT-FALSE over UTF-8 bytes and returns four uppercase hex digits.

</details>

### Browser PNG download

<details>
<summary>Download a PNG from a browser app</summary>

Install `qrcode` as shown in [Render a QR image](#render-a-qr-image), then run this in your browser app's module:

```ts
import { generate } from 'promptpay-parse'
import { downloadPng, renderSvg } from 'promptpay-parse/render'

const { svg } = renderSvg({
  payload: generate.anyId({ type: 'MSISDN', target: '0812223333', amount: 30 }),
  caption: { title: 'ร้านกาแฟบ้านสวน', amount: '฿30.00' },
})

await downloadPng(svg, 'promptpay-30.png', { scale: 3 })
```

`downloadPng` and `svgToPngDataUrl` require a browser DOM and canvas. `svgToPngDataUrl` returns a PNG data URL instead of downloading. Server PNG conversion requires a separate SVG rasterizer.

</details>

### Browser global

<details>
<summary>Use a script tag or CommonJS</summary>

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

You can also download `dist/index.global.js` from [GitHub Releases](https://github.com/HazySprite/promptpay-parse/releases) and serve it yourself. Core exports are available under `PromptPayParse`; the optional renderer uses the separate `promptpay-parse/render` entry.

For CommonJS:

```js
const { generate, validate } = require('promptpay-parse')

const payload = generate.anyId({ type: 'MSISDN', target: '0812223333', amount: 30 })
console.log(validate.anyId(payload))
// { type: 'MSISDN', target: '0812223333', amount: 30 }
```

</details>

## API reference

| Export                                                                    | Purpose                                                                                                                 |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `parse` / `parseBarcode`                                                  | Parse EMVCo QR or BOT Barcode data; return an object or `null`                                                          |
| `EmvQr`                                                                   | `fields`, `getTag`, `getTagValue`, `getTags`, `getPayload`, `crcTagId`, `isValid`, `withTag`, `withoutTag`, `setAmount` |
| `detect`                                                                  | Classify a payload and extract data as a discriminated union                                                            |
| `generate.*`                                                              | `anyId`, `billPayment`, `slipVerify`, `trueMoney`, `trueMoneySlipVerify`, `botBarcode`                                  |
| `validate.*`                                                              | `anyId`, `billPayment`, `slipVerify`, `trueMoneySlipVerify`, `bcelOneProof`; return extracted data or `null`            |
| `generate.ProxyType`                                                      | AnyID proxy map: `MSISDN`, `NATID`, `EWALLETID`, `BANKACC`                                                              |
| `encodeAdditionalData` / `extractAdditionalData` / `ADDITIONAL_DATA_TAGS` | EMVCo Tag 62 helpers                                                                                                    |
| `encodeTag81` / `decodeTag81`                                             | TrueMoney personal message codec                                                                                        |
| `crc16` / `decode` / `encode` / `tag` / `withCrcTag` / `getTag`           | CRC and raw TLV utilities                                                                                               |
| `renderSvg` / `downloadPng` / `svgToPngDataUrl`                           | From `promptpay-parse/render`; requires `qrcode`                                                                        |

Generators and validators also have direct imports: `import { anyId, ProxyType } from 'promptpay-parse/generate'` and `import { slipVerify } from 'promptpay-parse/validate'`.

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

[CI](.github/workflows/ci.yml) runs typecheck, lint, coverage, and build on Node 20/22, with separate test jobs for Bun and Deno.

<details>
<summary>Versioning and releases (maintainers)</summary>

Releases follow semver (`MAJOR.MINOR.PATCH`):

```sh
npm version patch # or minor / major
git push --follow-tags
```

A `v*` tag triggers the [publish workflow](.github/workflows/publish.yml), which checks the tag against the package version, runs verification, publishes to npm with provenance, and creates a GitHub Release with `dist/index.global.js`. Publishing uses the repository's `NPM_TOKEN` secret.

</details>

## References

- [EMVCo QR Code specification](https://www.emvco.com/emv-technologies/qrcodes/)
- [Thai QR Payment Standard (BOT)](https://www.bot.or.th/content/dam/bot/fipcs/documents/FPG/2562/ThaiPDF/25620084.pdf)
- [Slip Verify API Mini QR Data](https://developer.scb/assets/documents/documentation/qr-payment/extracting-data-from-mini-qr.pdf)
- [BOT Barcode Standard](https://www.bot.or.th/content/dam/bot/documents/th/our-roles/payment-systems/about-payment-systems/Std_Barcode.pdf)

## License

[MIT](LICENSE)
