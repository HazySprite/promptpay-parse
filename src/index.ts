export { BotBarcode } from './bot-barcode'
export { EmvQr, type EmvQrFields, type MerchantAccountInfo } from './emv-qr'
export { parse, parseBarcode, type ParseOptions } from './parse'
export { crc16 } from './crc'
export { decode, encode, getTag, tag, withCrcTag, type TlvTag } from './tlv'
export { decodeTag81, encodeTag81 } from './tag81'
export {
  ADDITIONAL_DATA_TAGS,
  encodeAdditionalData,
  extractAdditionalData,
  type AdditionalData,
  type AdditionalDataKey,
} from './additional-data'
export { detect, type DetectedQr } from './detect'

export * as generate from './generate'
export * as validate from './validate'
