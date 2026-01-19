import { XMLParser } from 'fast-xml-parser'
import { asArray, extractAccessKeyFromInfNFeId, safeString } from './utils'

export type ParsedNFe = {
  raw: any
  hasNfeProc: boolean
  accessKey?: string
  infNFe?: any
  det: any[]
  totals?: any
  ide?: any
  emit?: any
  dest?: any
}

export function parseNFeXml(xml: string): ParsedNFe {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    parseTagValue: true,
    parseAttributeValue: true,
  })

  const raw = parser.parse(xml)

  // tenta achar nfeProc.NFe.infNFe
  const nfeProc = raw?.nfeProc
  const NFe = nfeProc?.NFe ?? raw?.NFe
  const infNFe = NFe?.infNFe

  const hasNfeProc = Boolean(nfeProc)

  const infNFeId = infNFe?.['@_Id']
  const fromId = extractAccessKeyFromInfNFeId(infNFeId)

    const fromProt = safeString(raw?.nfeProc?.protNFe?.infProt?.chNFe)
    .replace(/\D/g, '')
    .slice(0, 44)

    const accessKey = (fromId ?? fromProt) || undefined


  const det = asArray(infNFe?.det)
  const totals = infNFe?.total?.ICMSTot
  const ide = infNFe?.ide
  const emit = infNFe?.emit
  const dest = infNFe?.dest

  return { raw, hasNfeProc, accessKey, infNFe, det, totals, ide, emit, dest }
}
