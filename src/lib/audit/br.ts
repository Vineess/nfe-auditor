export function onlyDigits(v: any): string {
  return String(v ?? '').replace(/\D/g, '')
}

export function isValidCPF(cpfRaw: string): boolean {
  const cpf = onlyDigits(cpfRaw)
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false

  const calc = (baseLen: number) => {
    let sum = 0
    for (let i = 0; i < baseLen; i++) sum += Number(cpf[i]) * (baseLen + 1 - i)
    const mod = sum % 11
    return mod < 2 ? 0 : 11 - mod
  }

  const d1 = calc(9)
  const d2 = (() => {
    let sum = 0
    for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i)
    const mod = sum % 11
    return mod < 2 ? 0 : 11 - mod
  })()

  return Number(cpf[9]) === d1 && Number(cpf[10]) === d2
}

export function isValidCNPJ(cnpjRaw: string): boolean {
  const cnpj = onlyDigits(cnpjRaw)
  if (cnpj.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false

  const weights1 = [5,4,3,2,9,8,7,6,5,4,3,2]
  const weights2 = [6,5,4,3,2,9,8,7,6,5,4,3,2]

  const calcDigit = (base: string, weights: number[]) => {
    let sum = 0
    for (let i = 0; i < weights.length; i++) sum += Number(base[i]) * weights[i]
    const mod = sum % 11
    return mod < 2 ? 0 : 11 - mod
  }

  const base12 = cnpj.slice(0, 12)
  const d1 = calcDigit(base12, weights1)
  const base13 = base12 + String(d1)
  const d2 = calcDigit(base13, weights2)

  return Number(cnpj[12]) === d1 && Number(cnpj[13]) === d2
}
