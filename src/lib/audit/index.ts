import { z } from 'zod'
import { parseNFeXml } from './parse'
import type { AuditResult, Finding } from './types'
import { asArray, calcNfeKeyDV, get, round2, toNumber } from './utils'
import { isValidCPF, isValidCNPJ } from './br'

const InputSchema = z.object({
  xml: z.string().min(10, 'XML vazio ou muito curto'),
})

function push(findings: Finding[], f: Finding) {
  findings.push(f)
}

export function auditXml(input: unknown): AuditResult {
  const findings: Finding[] = []
  const parsedInput = InputSchema.safeParse(input)

  if (!parsedInput.success) {
    for (const issue of parsedInput.error.issues) {
      push(findings, {
        severity: 'error',
        code: 'INPUT_INVALID',
        title: 'Entrada inválida',
        message: issue.message,
        path: issue.path?.join('.') || 'xml',
        hint: 'Cole o XML completo da NF-e (conteúdo do arquivo .xml).',
      })
    }

    return summarize({ findings, itemsCount: 0, hasNfeProc: false })
  }

  const xml = parsedInput.data.xml

  let parsed: ReturnType<typeof parseNFeXml> | null = null
  try {
    parsed = parseNFeXml(xml)
  } catch (e: any) {
    push(findings, {
      severity: 'error',
      code: 'XML_PARSE_ERROR',
      title: 'XML inválido',
      message: 'Não foi possível ler o XML (provável erro de formatação).',
      hint: 'Verifique se o XML está completo e bem formatado (tags fechadas, sem caracteres quebrados).',
    })
    return summarize({ findings, itemsCount: 0, hasNfeProc: false })
  }

  // ---- Regras: estrutura mínima
  if (!parsed.infNFe) {
    push(findings, {
      severity: 'error',
      code: 'INFNFE_MISSING',
      title: 'Estrutura não encontrada',
      message: 'Não encontrei NFe.infNFe no XML.',
      path: 'NFe.infNFe',
      hint: 'Confirme se este XML é de NF-e (modelo 55) e se contém a estrutura padrão (nfeProc/NFe/infNFe).',
    })
    return summarize({ findings, itemsCount: 0, hasNfeProc: parsed.hasNfeProc, accessKey: parsed.accessKey })
  }

  if (parsed.det.length === 0) {
    push(findings, {
      severity: 'error',
      code: 'ITEMS_EMPTY',
      title: 'Sem itens',
      message: 'A NF-e não possui itens (det).',
      path: 'NFe.infNFe.det',
      hint: 'Verifique se o XML está completo. Uma NF-e válida deve conter ao menos 1 item.',
    })
  }

  // ---- Regra: chave de acesso e DV
  if (parsed.accessKey) {
    const key = parsed.accessKey.replace(/\D/g, '')
    if (key.length !== 44) {
      push(findings, {
        severity: 'warning',
        code: 'ACCESS_KEY_LEN',
        title: 'Chave de acesso incompleta',
        message: `A chave extraída não possui 44 dígitos (encontrei ${key.length}).`,
        hint: 'Verifique se o atributo Id da infNFe está no formato NFe{44dígitos}.',
      })
    } else {
      const dvCalc = calcNfeKeyDV(key)
      const dvIn = Number(key[43])
      if (dvCalc === null) {
        push(findings, {
          severity: 'warning',
          code: 'ACCESS_KEY_DV_UNKNOWN',
          title: 'Não consegui validar o DV',
          message: 'Não foi possível calcular o dígito verificador da chave.',
        })
      } else if (dvCalc !== dvIn) {
        push(findings, {
          severity: 'error',
          code: 'ACCESS_KEY_DV_MISMATCH',
          title: 'Chave com DV inválido',
          message: `DV da chave parece incorreto. Informado: ${dvIn}, calculado: ${dvCalc}.`,
          hint: 'Se a chave foi digitada/alterada manualmente, gere novamente a partir dos dados originais.',
        })
      } else {
        push(findings, {
          severity: 'info',
          code: 'ACCESS_KEY_OK',
          title: 'Chave de acesso OK',
          message: 'Chave de acesso com DV válido.',
        })
      }
    }
  } else {
    push(findings, {
      severity: 'warning',
      code: 'ACCESS_KEY_NOT_FOUND',
      title: 'Chave de acesso não encontrada',
      message: 'Não consegui extrair a chave de acesso (infNFe.@Id ou protNFe.infProt.chNFe).',
      hint: 'Se for possível, use o XML com nfeProc (com protocolo).',
    })
  }

  // ---- Regra: campos essenciais (ide/emit/dest)
  if (!parsed.ide) {
    push(findings, {
      severity: 'error',
      code: 'IDE_MISSING',
      title: 'IDE ausente',
      message: 'Não encontrei ide dentro de infNFe.',
      path: 'NFe.infNFe.ide',
    })
  }
  if (!parsed.emit) {
    push(findings, {
      severity: 'error',
      code: 'EMIT_MISSING',
      title: 'Emitente ausente',
      message: 'Não encontrei emit dentro de infNFe.',
      path: 'NFe.infNFe.emit',
    })
  }
  if (!parsed.dest) {
    push(findings, {
      severity: 'warning',
      code: 'DEST_MISSING',
      title: 'Destinatário ausente',
      message: 'Não encontrei dest dentro de infNFe (em algumas operações pode existir, mas geralmente é obrigatório).',
      path: 'NFe.infNFe.dest',
    })
  }

    // ---- Regra: CPF/CNPJ emitente/destinatário
  const emitCnpj = parsed.emit?.CNPJ ?? parsed.emit?.CPF
  if (emitCnpj) {
    const isCnpj = String(emitCnpj).replace(/\D/g,'').length === 14
    const ok = isCnpj ? isValidCNPJ(String(emitCnpj)) : isValidCPF(String(emitCnpj))
    if (!ok) {
      push(findings, {
        severity: 'error',
        code: 'EMIT_DOC_INVALID',
        title: 'Documento do emitente inválido',
        message: `O ${isCnpj ? 'CNPJ' : 'CPF'} do emitente parece inválido.`,
        path: 'NFe.infNFe.emit',
        hint: 'Verifique o número e os dígitos verificadores do documento do emitente.',
      })
    } else {
      push(findings, {
        severity: 'info',
        code: 'EMIT_DOC_OK',
        title: 'Documento do emitente OK',
        message: `Documento do emitente (${isCnpj ? 'CNPJ' : 'CPF'}) válido.`,
      })
    }
  } else {
    push(findings, {
      severity: 'warning',
      code: 'EMIT_DOC_MISSING',
      title: 'Documento do emitente ausente',
      message: 'Não encontrei CNPJ/CPF no emitente.',
      path: 'NFe.infNFe.emit.CNPJ',
      hint: 'O emitente deve ter CNPJ (ou CPF em casos específicos).',
    })
  }

  const destDoc = parsed.dest?.CNPJ ?? parsed.dest?.CPF
  if (parsed.dest) {
    if (destDoc) {
      const isCnpj = String(destDoc).replace(/\D/g,'').length === 14
      const ok = isCnpj ? isValidCNPJ(String(destDoc)) : isValidCPF(String(destDoc))
      if (!ok) {
        push(findings, {
          severity: 'warning',
          code: 'DEST_DOC_INVALID',
          title: 'Documento do destinatário suspeito',
          message: `O ${isCnpj ? 'CNPJ' : 'CPF'} do destinatário parece inválido.`,
          path: 'NFe.infNFe.dest',
          hint: 'Verifique o número e os dígitos verificadores do documento do destinatário.',
        })
      } else {
        push(findings, {
          severity: 'info',
          code: 'DEST_DOC_OK',
          title: 'Documento do destinatário OK',
          message: `Documento do destinatário (${isCnpj ? 'CNPJ' : 'CPF'}) válido.`,
        })
      }
    } else {
      push(findings, {
        severity: 'warning',
        code: 'DEST_DOC_MISSING',
        title: 'Documento do destinatário ausente',
        message: 'Não encontrei CNPJ/CPF no destinatário.',
        path: 'NFe.infNFe.dest.CNPJ',
        hint: 'Geralmente o destinatário deve ter CNPJ/CPF, dependendo do tipo de operação.',
      })
    }
  }


  // ---- Regra: totais vs itens (vProd + vDesc)
  const itens = parsed.det

  let sumVProd = 0
  let sumVDesc = 0
  let vProdMissing = 0

  for (const d of itens) {
    const vProd = toNumber(get(d, 'prod.vProd'))
    const vDesc = toNumber(get(d, 'prod.vDesc'))
    if (vProd === null) vProdMissing++
    else sumVProd += vProd
    if (vDesc !== null) sumVDesc += vDesc
  }

  sumVProd = round2(sumVProd)
  sumVDesc = round2(sumVDesc)

  const totVProd = toNumber(parsed.totals?.vProd)
  const totVDesc = toNumber(parsed.totals?.vDesc)

  if (!parsed.totals) {
    push(findings, {
      severity: 'warning',
      code: 'TOTALS_MISSING',
      title: 'Totais ausentes',
      message: 'Não encontrei total.ICMSTot no XML.',
      path: 'NFe.infNFe.total.ICMSTot',
      hint: 'Algumas validações de soma não poderão ser feitas sem os totais.',
    })
  } else {
    if (vProdMissing > 0) {
      push(findings, {
        severity: 'warning',
        code: 'ITEM_VPROD_MISSING',
        title: 'vProd ausente em itens',
        message: `${vProdMissing} item(ns) sem prod.vProd.`,
        hint: 'Cada item deveria ter vProd preenchido para bater com os totais.',
      })
    }

    if (totVProd !== null) {
      const diff = round2(sumVProd - totVProd)
      if (Math.abs(diff) > 0.01) {
        push(findings, {
          severity: 'error',
          code: 'TOTAL_VPROD_MISMATCH',
          title: 'Total de produtos não confere',
          message: `Soma vProd(itens)=${sumVProd} mas total vProd=${totVProd} (diferença ${diff}).`,
          path: 'NFe.infNFe.total.ICMSTot.vProd',
          hint: 'Revise arredondamentos e valores unitários/quantidades dos itens.',
        })
      } else {
        push(findings, {
          severity: 'info',
          code: 'TOTAL_VPROD_OK',
          title: 'Total de produtos OK',
          message: `Soma dos itens bate com o total vProd (${totVProd}).`,
        })
      }
    }

    if (totVDesc !== null && sumVDesc > 0) {
      const diff = round2(sumVDesc - totVDesc)
      if (Math.abs(diff) > 0.01) {
        push(findings, {
          severity: 'warning',
          code: 'TOTAL_VDESC_MISMATCH',
          title: 'Desconto pode não conferir',
          message: `Soma vDesc(itens)=${sumVDesc} mas total vDesc=${totVDesc} (diferença ${diff}).`,
          path: 'NFe.infNFe.total.ICMSTot.vDesc',
          hint: 'Verifique se descontos foram aplicados por item ou apenas no total.',
        })
      } else {
        push(findings, {
          severity: 'info',
          code: 'TOTAL_VDESC_OK',
          title: 'Total de desconto OK',
          message: `Soma dos descontos dos itens bate com vDesc (${totVDesc}).`,
        })
      }
    }
  }

  // ---- Regra: itens com quantidade/preço zerados (bem comum)
  for (let i = 0; i < itens.length; i++) {
    const d = itens[i]
    const qCom = toNumber(get(d, 'prod.qCom'))
    const vUn = toNumber(get(d, 'prod.vUnCom'))
    const cProd = String(get(d, 'prod.cProd') ?? '').trim()

    if (qCom !== null && qCom <= 0) {
      push(findings, {
        severity: 'error',
        code: 'ITEM_QCOM_ZERO',
        title: 'Quantidade inválida',
        message: `Item ${i + 1}${cProd ? ` (${cProd})` : ''}: qCom <= 0.`,
        path: `NFe.infNFe.det[${i}].prod.qCom`,
        hint: 'Quantidade deve ser maior que zero.',
      })
    }

    if (vUn !== null && vUn <= 0) {
      push(findings, {
        severity: 'warning',
        code: 'ITEM_VUN_ZERO',
        title: 'Valor unitário suspeito',
        message: `Item ${i + 1}${cProd ? ` (${cProd})` : ''}: vUnCom <= 0.`,
        path: `NFe.infNFe.det[${i}].prod.vUnCom`,
        hint: 'Confirme se o valor unitário está correto.',
      })
    }
  }

  return summarize({
    findings,
    itemsCount: parsed.det.length,
    hasNfeProc: parsed.hasNfeProc,
    accessKey: parsed.accessKey,
  })
}

function summarize(params: {
  findings: Finding[]
  itemsCount: number
  hasNfeProc: boolean
  accessKey?: string
}): AuditResult {
  const errors = params.findings.filter(f => f.severity === 'error').length
  const warnings = params.findings.filter(f => f.severity === 'warning').length
  const infos = params.findings.filter(f => f.severity === 'info').length

  return {
    ok: errors === 0,
    meta: {
      itemsCount: params.itemsCount,
      hasNfeProc: params.hasNfeProc,
      accessKey: params.accessKey,
    },
    summary: { errors, warnings, infos },
    findings: params.findings,
  }
}
