import QRCode from 'qrcode'

/** Logo overlay inside the QR code */
export interface RenderLogo {
  /** Image source — use a `data:` URI so the SVG stays self-contained */
  href: string

  /** Logo size as a fraction of the QR width (default `0.22`, max `0.3`) */
  sizeRatio?: number
}

/** Text block rendered below the QR code */
export interface RenderCaption {
  /** Main line, e.g. merchant name */
  title?: string

  /** Amount line, e.g. `฿250.00` */
  amount?: string

  /** Secondary line, e.g. PromptPay number */
  subtitle?: string
}

export interface RenderSvgOptions {
  /** QR payload produced by `generate.*` or `EmvQr` */
  payload: string

  /** QR size in px (default `420`) */
  size?: number

  /** Quiet-zone margin in modules (default `2`) */
  margin?: number

  /** Dark module color (default `#000000`) */
  dark?: string

  /** Light background color (default `#ffffff`) */
  light?: string

  /** Error-correction level used when no logo is present (default `M`) */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'

  /** Centered logo overlay — forces error-correction level `H` */
  logo?: RenderLogo

  /** Text block below the code */
  caption?: RenderCaption
}

export interface RenderSvgResult {
  /** Self-contained SVG string (no external fetches when the logo is a `data:` URI) */
  svg: string

  /** Error-correction level actually used */
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'

  /** Present when a logo was drawn — the effective size ratio */
  logoSizeRatio?: number

  /** `true` when the logo ratio exceeds `0.25` (close to the safety cap) */
  caution?: boolean
}

export interface PngOptions {
  /** Integer scale factor for the raster (default `3`) */
  scale?: number

  /** Background fill painted before the QR (default `#ffffff`) */
  background?: string
}

const FONT_STACK = "'IBM Plex Sans Thai','Noto Sans Thai','Helvetica Neue',Arial,sans-serif"

const MAX_LOGO_RATIO = 0.3
const DEFAULT_LOGO_RATIO = 0.22
const CAPTION_HEIGHT = 72

/**
 * Render a QR payload as a self-contained SVG string.
 *
 * A logo spends the QR's Reed-Solomon error-correction budget on one
 * contiguous block, which is harder to recover from than scattered damage —
 * so a logo forces error-correction level `H` and is capped at a `0.3`
 * size ratio. A QR that fails to scan at the till is worse than a smaller
 * logo.
 *
 * @returns SVG string plus the settings actually applied
 */
export function renderSvg({
  payload,
  size = 420,
  margin = 2,
  dark = '#000000',
  light = '#ffffff',
  errorCorrectionLevel = 'M',
  logo,
  caption,
}: RenderSvgOptions): RenderSvgResult {
  if (size <= 0) throw new RangeError(`size must be positive (got ${size})`)
  if (margin < 0) throw new RangeError(`margin must be >= 0 (got ${margin})`)

  let level = errorCorrectionLevel
  let logoRatio: number | undefined
  if (logo) {
    level = 'H'
    logoRatio = logo.sizeRatio ?? DEFAULT_LOGO_RATIO
    if (logoRatio <= 0 || logoRatio > MAX_LOGO_RATIO) {
      throw new RangeError(
        `Logo sizeRatio ${logoRatio} exceeds the safe maximum of ${MAX_LOGO_RATIO}. ` +
          'Shrink the logo, or put your branding in the caption below the code instead.',
      )
    }
  }

  const qr = QRCode.create(payload, { errorCorrectionLevel: level })
  const { size: moduleCount, data } = qr.modules
  const unit = size / (moduleCount + margin * 2)
  const offset = margin * unit

  const parts: string[] = []
  const captionHeight = caption ? CAPTION_HEIGHT : 0
  const width = size
  const height = size + captionHeight

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
      `viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges" role="img">`,
  )
  parts.push(`<rect width="${width}" height="${height}" fill="${light}"/>`)
  parts.push(`<g fill="${dark}">`)

  // Merge horizontal runs of dark modules into single rects.
  let y = 0
  while (y < moduleCount) {
    let runStart = -1
    let x = 0
    while (x <= moduleCount) {
      const darkModule = x < moduleCount && data[y * moduleCount + x] === 1
      if (darkModule && runStart === -1) runStart = x
      if (!darkModule && runStart !== -1) {
        const px = offset + runStart * unit
        const py = offset + y * unit
        const w = (x - runStart) * unit
        parts.push(
          `<rect x="${round(px)}" y="${round(py)}" width="${round(w)}" height="${round(unit)}"/>`,
        )
        runStart = -1
      }
      x++
    }
    y++
  }
  parts.push('</g>')

  if (logo && logoRatio !== undefined) {
    const box = size * logoRatio
    const lx = (size - box) / 2
    const ly = (size - box) / 2
    const pad = box * 0.08
    parts.push(
      `<rect x="${round(lx - pad)}" y="${round(ly - pad)}" width="${round(box + pad * 2)}" ` +
        `height="${round(box + pad * 2)}" rx="${round(box * 0.12)}" fill="${light}"/>`,
    )
    parts.push(
      `<image href="${escapeXml(logo.href)}" x="${round(lx)}" y="${round(ly)}" ` +
        `width="${round(box)}" height="${round(box)}" preserveAspectRatio="xMidYMid meet"/>`,
    )
  }

  if (caption) {
    const cx = width / 2
    const lines: string[] = []
    if (caption.title) {
      lines.push(text(cx, size + 24, caption.title, 18, 600))
    }
    if (caption.amount) {
      lines.push(text(cx, size + 46, caption.amount, 16, 500))
    }
    if (caption.subtitle) {
      lines.push(text(cx, size + 66, caption.subtitle, 12, 400, '#555555'))
    }
    parts.push(...lines)
  }

  parts.push('</svg>')

  return {
    svg: parts.join(''),
    errorCorrectionLevel: level,
    ...(logoRatio !== undefined ? { logoSizeRatio: logoRatio, caution: logoRatio > 0.25 } : {}),
  }
}

/**
 * Rasterise an SVG string to a PNG data URL using the browser's canvas.
 * Requires a DOM — on the server, rasterise the SVG with `@resvg/resvg-js`.
 *
 * @param svg - SVG string from {@link renderSvg}
 * @param options - Scale and background color
 */
export async function svgToPngDataUrl(svg: string, options: PngOptions = {}): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error(
      'svgToPngDataUrl requires a browser DOM. On the server, rasterise the SVG with @resvg/resvg-js instead.',
    )
  }

  const { scale = 3, background = '#ffffff' } = options
  const [, width = '300', height = '300'] = /width="(\d+)" height="(\d+)"/.exec(svg) ?? []

  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Failed to load the SVG into an <img> element'))
    image.src = `data:image/svg+xml;base64,${base64Encode(svg)}`
  })

  const canvas = document.createElement('canvas')
  canvas.width = Number(width) * scale
  canvas.height = Number(height) * scale

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not acquire a 2D canvas context')

  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  return canvas.toDataURL('image/png')
}

/**
 * Rasterise and trigger a browser download of the PNG.
 * Requires a DOM — see {@link svgToPngDataUrl}.
 *
 * @param svg - SVG string from {@link renderSvg}
 * @param filename - Download file name
 * @param options - Scale and background color
 */
export async function downloadPng(
  svg: string,
  filename: string,
  options: PngOptions = {},
): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error(
      'downloadPng requires a browser DOM. On the server, rasterise the SVG with @resvg/resvg-js instead.',
    )
  }

  const dataUrl = await svgToPngDataUrl(svg, options)
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = filename
  anchor.click()
}

function text(
  x: number,
  y: number,
  content: string,
  size: number,
  weight: number,
  fill = '#000000',
): string {
  return (
    `<text x="${round(x)}" y="${y}" text-anchor="middle" fill="${fill}" ` +
    `font-family="${FONT_STACK}" font-size="${size}" font-weight="${weight}">` +
    `${escapeXml(content)}</text>`
  )
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function base64Encode(value: string): string {
  if (typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(value)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    }
    return btoa(binary)
  }
  return Buffer.from(value, 'utf8').toString('base64')
}
