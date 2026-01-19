export function toNumber(v: any): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function get(obj: any, path: string): any {
  // path tipo: "a.b.c"
  return path.split('.').reduce((acc, key) => (acc && key in acc ? acc[key] : undefined), obj)
}

export function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === null || v === undefined) return []
  return Array.isArray(v) ? v : [v]
}

/**
 * Calcula DV (dígito verificador) da chave de acesso NF-e (44 dígitos).
 * Entrada: chave com 43 dígitos (sem o DV) OU 44 (com DV). Retorna DV calculado.
 */
export function calcNfeKeyDV(key43or44: string): number | null {
  const digits = key43or44.replace(/\D/g, '')
  const key43 = digits.length === 44 ? digits.slice(0, 43) : digits
  if (key43.length !== 43) return null

  const weights = [2,3,4,5,6,7,8,9]
  let sum = 0
  let wIdx = 0

  // da direita pra esquerda
  for (let i = key43.length - 1; i >= 0; i--) {
    const d = Number(key43[i])
    if (!Number.isFinite(d)) return null
    sum += d * weights[wIdx]
    wIdx = (wIdx + 1) % weights.length
  }

  const mod = sum % 11
  const dv = 11 - mod
  if (dv === 10 || dv === 11) return 0
  return dv
}

export function extractAccessKeyFromInfNFeId(id: any): string | undefined {
  // id costuma vir como "NFe3519..."
  const s = String(id ?? '').trim()
  const m = s.match(/NFe(\d{44})/)
  return m?.[1]
}

export function safeString(v: any): string {
  if (v === null || v === undefined) return ''
  return String(v)
}
