# promptpay-parse

Zero-dependency TypeScript library for **PromptPay & EMVCo QR Codes** — parse, generate and validate. Works in **Node.js (18+), Next.js, Nuxt, Deno, Bun and browsers**.

Implemented directly from the [EMVCo QR Code](https://www.emvco.com/emv-technologies/qrcodes/) and [BOT Thai QR Payment](https://www.bot.or.th) specifications.

## Features

- **Parse** — PromptPay / EMVCo QR data strings into a typed tag object
- **Generate** — QR payloads from templates: PromptPay AnyID, Bill Payment, Slip Verify (Mini-QR), TrueMoney, BOT Barcode
- **Validate** — CRC-16 checksum and per-format structure checks (Slip Verify API Mini QR, TrueMoney Slip Verify, BCEL OneProof)
- **Zero dependencies** — single build, no runtime installs

## Install

```sh
npm install promptpay-parse
```

## Usage

### Parse a QR payload and read tags

```ts
import { parse } from 'promptpay-parse'

const qr = parse('00020101021129370016A0000006770101110113006681222333353037645802TH63041DCF')

qr?.getTagValue('00') // '01'
qr?.getTagValue('29', '01') // sub-tag of Tag 29
qr?.isValid('63') // true — CRC re-verified
```

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

// PromptPay AnyID — mobile / National ID / e-Wallet
const anyIdPayload = generate.anyId({ type: 'MSISDN', target: '0812223333', amount: 30 })

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
const barcode = generate.botBarcode({ billerId: '099400016550100', ref1: '123456789012', amount: 3649.22 })
```

Feed the payload string into any QR Code image library (e.g. `qrcode`) to render the image.

### Validate & extract

```ts
import { parseBarcode, validate } from 'promptpay-parse'
// or deep import: import { slipVerify } from 'promptpay-parse/validate'

const slip = validate.slipVerify('004100060000010103014022000111222233344ABCD125102TH910417DF')
if (slip) {
  await bankApi.inquire(slip.sendingBank, slip.transRef)
}

validate.anyId(anyIdPayload) // { type: 'MSISDN', target: '0812223333', amount: 30 }
validate.billPayment(billPayload) // { billerId, ref1, ref2?, ref3?, amount? }
validate.trueMoneySlipVerify(tmSlipPayload) // { eventType, transactionId, date }

// BOT Barcode → PromptPay Bill Payment QR (Tag 30)
parseBarcode('|099999999999990\r111222333444\r\r0')?.toQrTag30()
```

### Browser global (CDN)

```html
<script src="https://cdn.jsdelivr.net/npm/promptpay-parse/dist/index.global.js"></script>

<script>
  const payload = PromptPayParse.generate.trueMoney({ mobileNo: '08xxxxxxxx', amount: 10 })
</script>
```

The same `dist/index.global.js` file is attached to every [GitHub Release](../../releases) — download it and serve it yourself if you don't use a CDN.

## API

| Export | Description |
| --- | --- |
| `parse(payload, strict?, subTags?)` | Parse EMVCo QR → `EmvQr` (`getTag`, `getTagValue`, `getTags`, `isValid`) or `null` |
| `parseBarcode(payload)` | Parse BOT Barcode → `BotBarcode` (`toString`, `toQrTag30`) or `null` |
| `generate.anyId / billPayment / slipVerify / trueMoney / trueMoneySlipVerify / botBarcode` | Payload generators |
| `validate.anyId / billPayment / slipVerify / trueMoneySlipVerify / bcelOneProof` | Format validators & extractors |
| `crc16(data)` | CRC-16/CCITT-FALSE over UTF-8 bytes, 4-digit uppercase hex |
| `decode / encode / tag / withCrcTag / getTag` | Raw TLV utilities |
| `ProxyType` | AnyID proxy type map (`MSISDN`, `NATID`, `EWALLETID`, `BANKACC`) |

## Versioning & release flow

Semver (`MAJOR.MINOR.PATCH`). To cut a release:

```sh
npm version patch   # or minor / major
git push --follow-tags
```

Pushing a `v*` tag triggers `.github/workflows/publish.yml`: install → typecheck → build → test → `npm publish --provenance` → GitHub Release with `dist/index.global.js` attached. Requires the `NPM_TOKEN` secret in the repository settings.

## References

- [EMV QR Code Specification](https://www.emvco.com/emv-technologies/qrcodes/)
- [Thai QR Payment Standard (BOT)](https://www.bot.or.th/content/dam/bot/fipcs/documents/FPG/2562/ThaiPDF/25620084.pdf)
- [Slip Verify API Mini QR Data](https://developer.scb/assets/documents/documentation/qr-payment/extracting-data-from-mini-qr.pdf)
- [BOT Barcode Standard](https://www.bot.or.th/content/dam/bot/documents/th/our-roles/payment-systems/about-payment-systems/Std_Barcode.pdf)

## License

[MIT](LICENSE)
