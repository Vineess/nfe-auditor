export type Severity = 'error' | 'warning' | 'info'

export type Finding = {
    severity: Severity
    code: string
    title: string
    message: string
    path?: string
    hint?: string
}

export type AuditResult = {
  ok: boolean
  meta: {
    itemsCount: number
    hasNfeProc: boolean
    accessKey?: string

    // novos
    emitName?: string
    destName?: string
    nNF?: string
    serie?: string
    dhEmi?: string
    vNF?: number

    totals?: {
      vProd?: number
      vDesc?: number
      vFrete?: number
      vSeg?: number
      vOutro?: number
      vNF?: number
    }
    sums?: {
      vProd: number
      vDesc: number
      vFrete: number
      vSeg: number
      vOutro: number
    }
  }
  summary: {
    errors: number
    warnings: number
    infos: number
  }
  findings: Finding[]
}
