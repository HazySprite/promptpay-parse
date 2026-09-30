import QRCode from 'qrcode'
import { describe, expect, test } from 'vitest'

import { anyId } from '../generate'
import { downloadPng, renderSvg, svgToPngDataUrl } from './index'

const payload = anyId({ type: 'MSISDN', target: '0812223333' })

function darkModuleCount(text: string): number {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  let count = 0
  for (const bit of qr.modules.data) if (bit === 1) count++
  return count
}

describe('renderSvg', () => {
  test('produces a self-contained SVG covering every dark module', () => {
    const { svg, errorCorrectionLevel } = renderSvg({ payload })

    expect(errorCorrectionLevel).toBe('M')
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
    expect(svg.endsWith('</svg>')).toBe(true)

    const rects = svg.match(/<rect /g)?.length ?? 0
    // background rect + one rect per horizontal dark run; runs never exceed modules
    expect(rects).toBeGreaterThan(1)
    expect(rects - 1).toBeLessThanOrEqual(darkModuleCount(payload))
    // every module is painted: sum of rect areas covers the dark area
    const area = [...svg.matchAll(/width="([\d.]+)" height="([\d.]+)"/g)].reduce(
      (sum, [, w, h]) => sum + Number(w) * Number(h),
      0,
    )
    const { size } = QRCode.create(payload, { errorCorrectionLevel: 'M' }).modules
    const unit = 420 / (size + 4)
    expect(area).toBeGreaterThanOrEqual(darkModuleCount(payload) * unit * unit * 0.99)
  })

  test('honours size, margin and colors', () => {
    const { svg } = renderSvg({ payload, size: 210, margin: 4, dark: '#123456', light: '#fedcba' })

    expect(svg).toContain('width="210" height="210"')
    expect(svg).toContain('fill="#123456"')
    expect(svg).toContain('fill="#fedcba"')
    expect(svg).toContain('viewBox="0 0 210 210"')
  })

  test('a logo forces error-correction level H and reports the ratio', () => {
    const { svg, errorCorrectionLevel, logoSizeRatio, caution } = renderSvg({
      payload,
      logo: { href: 'data:image/png;base64,AAA' },
    })

    expect(errorCorrectionLevel).toBe('H')
    expect(logoSizeRatio).toBe(0.22)
    expect(caution).toBe(false)
    expect(svg).toContain('<image href="data:image/png;base64,AAA"')
  })

  test('rejects oversized logos instead of producing an unscannable QR', () => {
    expect(() => renderSvg({ payload, logo: { href: 'x', sizeRatio: 0.5 } })).toThrow(RangeError)
    expect(() => renderSvg({ payload, logo: { href: 'x', sizeRatio: 0 } })).toThrow(RangeError)
    const edge = renderSvg({ payload, logo: { href: 'x', sizeRatio: 0.28 } })
    expect(edge.caution).toBe(true)
  })

  test('escapes caption text and lays it out below the code', () => {
    const { svg } = renderSvg({
      payload,
      caption: { title: 'ร้าน <A&B>', amount: '฿250.00', subtitle: "พร้อมเพย์ '081'" },
    })

    expect(svg).toContain('height="492"')
    expect(svg).toContain('ร้าน &lt;A&amp;B&gt;')
    expect(svg).toContain('฿250.00')
    expect(svg).toContain('พร้อมเพย์ &#39;081&#39;')
  })

  test('rejects invalid options and payloads', () => {
    expect(() => renderSvg({ payload, size: 0 })).toThrow(RangeError)
    expect(() => renderSvg({ payload, margin: -1 })).toThrow(RangeError)
    expect(() => renderSvg({ payload: '' })).toThrow()
  })
})

describe('browser PNG helpers', () => {
  test('report the missing DOM instead of failing silently', async () => {
    const { svg } = renderSvg({ payload })
    await expect(svgToPngDataUrl(svg)).rejects.toThrow(/requires a browser DOM/)
    await expect(downloadPng(svg, 'qr.png')).rejects.toThrow(/requires a browser DOM/)
  })
})
