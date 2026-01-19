import { onlyDigits } from './br'

export function onlyLetters(v: any): string {
  return String(v ?? '').trim().toUpperCase()
}

export function isValidCEP(cepRaw: string): boolean {
  const cep = onlyDigits(cepRaw)
  if (cep.length !== 8) return false
  if (/^(\d)\1{7}$/.test(cep)) return false // 00000000, 11111111...
  return true
}

export function first2CFOP(cfopRaw: any): string {
  const s = String(cfopRaw ?? '').trim()
  const m = s.match(/^(\d{2})/)
  return m?.[1] ?? ''
}

/**
 * Heurística simples:
 * - CFOP iniciando com 5/1 = operação interna
 * - CFOP iniciando com 6/2 = operação interestadual
 * - 7/3 = exterior (não vamos forçar, só info/alerta)
 */
export function cfopExpectedByUf(cfopRaw: any, ufEmit: string, ufDest: string) {
  const ufE = onlyLetters(ufEmit)
  const ufD = onlyLetters(ufDest)
  const p2 = first2CFOP(cfopRaw)

  if (!ufE || !ufD || p2.length !== 2) return { expected: null as 'interna'|'interestadual'|'exterior'|null }

  const sameUf = ufE === ufD
  if (p2 === '51' || p2 === '11' || p2[0] === '1' || p2[0] === '5') {
    // internos comuns
    return { expected: sameUf ? 'interna' : 'interestadual' }
  }
  if (p2[0] === '2' || p2[0] === '6') {
    return { expected: sameUf ? 'interna' : 'interestadual' }
  }
  if (p2[0] === '3' || p2[0] === '7') {
    return { expected: 'exterior' }
  }
  return { expected: null }
}

export function isInternalCfop(cfopRaw: any): boolean {
  const p2 = first2CFOP(cfopRaw)
  return p2.startsWith('1') || p2.startsWith('5')
}

export function isInterstateCfop(cfopRaw: any): boolean {
  const p2 = first2CFOP(cfopRaw)
  return p2.startsWith('2') || p2.startsWith('6')
}
