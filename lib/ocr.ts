// OCR is a SECONDARY, OPTIONAL feature. It only fills the manual form.
// It must never save automatically and must never break the rest of the app.
// All Tesseract usage is dynamically imported and wrapped in try/catch.

export interface OcrResult {
  ticketNo?: string
  truckNo?: string
  gross?: number
  tare?: number
  net?: number
  rawText: string
}

// Attempt to read numeric fields from a ticket photo.
// Throws on failure; callers must fall back to manual entry.
export async function runOcr(
  image: File | Blob | string,
  onProgress?: (p: number) => void,
): Promise<OcrResult> {
  // Dynamic import so a missing/broken dependency never breaks the build/app.
  const Tesseract = await import('tesseract.js')

  // Recognize both English (Latin digits/labels) which is what most weigh
  // tickets print. Arabic labels are matched separately by keyword.
  const { data } = await Tesseract.recognize(image as unknown as string, 'eng', {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100))
      }
    },
  })

  const text = data.text ?? ''
  return { ...extractFields(text), rawText: text }
}

// Normalize Arabic-Indic digits to Latin so number parsing is consistent.
function normalizeDigits(input: string): string {
  const map: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  }
  return input.replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d)
}

// Parse all numbers on a line. Handles thousands separators (1.234 / 1,234),
// decimal commas, and trailing units like "kg" or "kۣg".
function numbersIn(s: string): number[] {
  const cleaned = normalizeDigits(s)
  const matches = cleaned.match(/\d[\d.,\s]*\d|\d/g) ?? []
  const out: number[] = []
  for (const raw of matches) {
    const token = raw.replace(/\s/g, '')
    let value: number
    if (token.includes(',') && token.includes('.')) {
      // Assume '.' thousands, ',' decimal or vice versa: strip thousands.
      const lastComma = token.lastIndexOf(',')
      const lastDot = token.lastIndexOf('.')
      if (lastComma > lastDot) {
        value = Number(token.replace(/\./g, '').replace(',', '.'))
      } else {
        value = Number(token.replace(/,/g, ''))
      }
    } else if (token.includes(',')) {
      // A single comma with 3 trailing digits -> thousands separator.
      value = /,\d{3}\b/.test(token)
        ? Number(token.replace(/,/g, ''))
        : Number(token.replace(',', '.'))
    } else if ((token.match(/\./g) ?? []).length > 1) {
      value = Number(token.replace(/\./g, ''))
    } else {
      value = Number(token)
    }
    if (Number.isFinite(value)) out.push(value)
  }
  return out
}

// Very lightweight heuristic parsing of the recognized text.
// The user always verifies these values in the manual form.
export function extractFields(text: string): Omit<OcrResult, 'rawText'> {
  const result: Omit<OcrResult, 'rawText'> = {}
  const lines = normalizeDigits(text)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)

  for (const line of lines) {
    const lower = line.toLowerCase()

    if (result.ticketNo === undefined && /(ticket|تذكرة|ticket\s*no|n[°o]\b|bon)/.test(lower)) {
      const nums = numbersIn(line)
      if (nums.length) result.ticketNo = String(nums[0])
    }

    if (
      result.truckNo === undefined &&
      /(truck|شاحنة|camion|matricule|immatric|plate|لوحة)/.test(lower)
    ) {
      const nums = numbersIn(line)
      if (nums.length) result.truckNo = String(nums[nums.length - 1])
    }

    if (result.gross === undefined && /(brut|gross|إجمالي|القائم|قائم|poids\s*brut)/.test(lower)) {
      const nums = numbersIn(line)
      if (nums.length) result.gross = pickWeight(nums)
    }

    if (result.tare === undefined && /(tare|فارغ|شاحنة فارغة|poids\s*tare)/.test(lower)) {
      const nums = numbersIn(line)
      if (nums.length) result.tare = pickWeight(nums)
    }

    if (result.net === undefined && /(net|صافي|الصافي|poids\s*net)/.test(lower)) {
      const nums = numbersIn(line)
      if (nums.length) result.net = pickWeight(nums)
    }
  }

  // Derive missing values from the arithmetic relation Net = Gross - Tare.
  if (result.gross !== undefined && result.tare !== undefined && result.net === undefined) {
    result.net = Math.max(result.gross - result.tare, 0)
  } else if (result.gross !== undefined && result.net !== undefined && result.tare === undefined) {
    result.tare = Math.max(result.gross - result.net, 0)
  } else if (result.tare !== undefined && result.net !== undefined && result.gross === undefined) {
    result.gross = result.tare + result.net
  }

  return result
}

// Weights are usually the largest plausible number on the line (units get
// dropped as tiny numbers, so favour the biggest value).
function pickWeight(nums: number[]): number {
  return nums.reduce((max, n) => (n > max ? n : max), nums[0])
}
