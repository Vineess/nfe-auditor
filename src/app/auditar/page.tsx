'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'

type Severity = 'error' | 'warning' | 'info'
type Finding = {
  severity: Severity
  code: string
  title: string
  message: string
  path?: string
  hint?: string
}

type TotalsMeta = {
  vProd?: number
  vDesc?: number
  vFrete?: number
  vSeg?: number
  vOutro?: number
  vNF?: number
}

type SumsMeta = {
  vProd: number
  vDesc: number
  vFrete: number
  vSeg: number
  vOutro: number
}

type AuditResult = {
  ok: boolean
  meta: {
    itemsCount: number
    hasNfeProc: boolean
    accessKey?: string
    totals?: TotalsMeta
    sums?: SumsMeta
  }
  summary: { errors: number; warnings: number; infos: number }
  findings: Finding[]
}

function severityBadge(sev: Severity) {
  if (sev === 'error') return <Badge variant="destructive">Erro</Badge>
  if (sev === 'warning') return <Badge variant="secondary">Alerta</Badge>
  return <Badge variant="outline">Info</Badge>
}

function formatBRL(v: number | undefined) {
  if (v === undefined || v === null || Number.isNaN(v)) return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function formatNum(v: number | undefined) {
  if (v === undefined || v === null || Number.isNaN(v)) return '-'
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      return true
    } catch {
      return false
    }
  }
}

export default function AuditarPage() {
  const [xml, setXml] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AuditResult | null>(null)
  const [filter, setFilter] = useState<Severity | 'all'>('all')
  const [query, setQuery] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)
  const [copiedFindingKey, setCopiedFindingKey] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!result) return []
    const base = filter === 'all' ? result.findings : result.findings.filter((f) => f.severity === filter)

    const q = query.trim().toLowerCase()
    if (!q) return base

    return base.filter((f) => {
      const hay = [
        f.severity,
        f.code,
        f.title,
        f.message,
        f.path ?? '',
        f.hint ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return hay.includes(q)
    })
  }, [result, filter, query])

  async function onAnalyze() {
    setErr(null)
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml }),
      })
      const data = (await res.json()) as AuditResult
      setResult(data)
    } catch (e: any) {
      setErr('Falha ao chamar o auditor. Verifique sua conexão e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function onPickFile(file: File) {
    const text = await file.text()
    setXml(text)
  }

  function exportJson() {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'auditoria-nfe.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function copyAccessKey() {
    const key = result?.meta.accessKey
    if (!key) return
    const ok = await copyToClipboard(key)
    if (!ok) return
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 1200)
  }

  async function copyWholeJson() {
    if (!result) return
    const ok = await copyToClipboard(JSON.stringify(result, null, 2))
    if (!ok) return
    setCopiedJson(true)
    setTimeout(() => setCopiedJson(false), 1200)
  }

  async function copyFinding(f: Finding, kind: 'message' | 'path' | 'json') {
    let payload = ''
    if (kind === 'message') payload = `${f.title}\n${f.message}`
    if (kind === 'path') payload = f.path ?? ''
    if (kind === 'json') payload = JSON.stringify(f, null, 2)

    if (!payload) return
    const ok = await copyToClipboard(payload)
    if (!ok) return
    setCopiedFindingKey(`${f.code}-${kind}`)
    setTimeout(() => setCopiedFindingKey(null), 1200)
  }

  const totals = result?.meta.totals
  const sums = result?.meta.sums

  const vnfExpected =
    totals?.vProd !== undefined
      ? Number(
          (
            (totals.vProd || 0) +
            (totals.vFrete || 0) +
            (totals.vSeg || 0) +
            (totals.vOutro || 0) -
            (totals.vDesc || 0)
          ).toFixed(2)
        )
      : undefined

  const vnfDiff =
    totals?.vNF !== undefined && vnfExpected !== undefined
      ? Number((vnfExpected - (totals.vNF || 0)).toFixed(2))
      : undefined

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Auditar NF-e (pré-SEFAZ)</CardTitle>
          <CardDescription>
            Cole o XML da NF-e (ou envie o arquivo). A análise roda e mostra inconsistências comuns de preenchimento e totais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".xml,text/xml,application/xml"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onPickFile(f)
                }}
              />
              <Button variant="secondary" onClick={() => setXml('')} disabled={loading || !xml}>
                Limpar
              </Button>
            </div>

            <Button onClick={onAnalyze} disabled={loading || xml.trim().length < 10}>
              {loading ? 'Analisando...' : 'Analisar'}
            </Button>
          </div>

          <Textarea
            value={xml}
            onChange={(e) => setXml(e.target.value)}
            placeholder="Cole aqui o conteúdo do XML (.xml) da NF-e..."
            className="min-h-[260px] font-mono text-xs"
          />

          {err && (
            <Alert variant="destructive">
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <CardTitle>Resultado</CardTitle>
                <CardDescription>
                  Itens: <b>{result.meta.itemsCount}</b> · nfeProc: <b>{result.meta.hasNfeProc ? 'sim' : 'não'}</b>
                  {result.meta.accessKey ? (
                    <>
                      {' '}
                      · chave: <b className="font-mono text-xs">{result.meta.accessKey}</b>
                    </>
                  ) : null}
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={exportJson}>
                  Exportar JSON
                </Button>
                <Button variant="outline" onClick={copyWholeJson}>
                  {copiedJson ? 'Copiado!' : 'Copiar JSON'}
                </Button>
                {result.meta.accessKey && (
                  <Button variant="outline" onClick={copyAccessKey}>
                    {copiedKey ? 'Copiado!' : 'Copiar chave'}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={filter === 'all' ? 'default' : 'secondary'} onClick={() => setFilter('all')}>
                  Todos ({result.findings.length})
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'error' ? 'default' : 'secondary'}
                  onClick={() => setFilter('error')}
                >
                  Erros ({result.summary.errors})
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'warning' ? 'default' : 'secondary'}
                  onClick={() => setFilter('warning')}
                >
                  Alertas ({result.summary.warnings})
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'info' ? 'default' : 'secondary'}
                  onClick={() => setFilter('info')}
                >
                  Infos ({result.summary.infos})
                </Button>
              </div>

              <div className="sm:w-[340px]">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar (código, título, mensagem, caminho...)"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <Separator />

            {/* Resumo Financeiro */}
            {totals && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">vProd</div>
                  <div className="text-lg font-semibold">{formatBRL(totals.vProd)}</div>
                  {sums?.vProd !== undefined && (
                    <div className="text-xs text-muted-foreground">Soma itens: {formatBRL(sums.vProd)}</div>
                  )}
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">vDesc</div>
                  <div className="text-lg font-semibold">{formatBRL(totals.vDesc ?? 0)}</div>
                  {sums?.vDesc !== undefined && (
                    <div className="text-xs text-muted-foreground">Soma itens: {formatBRL(sums.vDesc)}</div>
                  )}
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">vFrete / vSeg / vOutro</div>
                  <div className="text-sm font-semibold">
                    {formatBRL(totals.vFrete ?? 0)} / {formatBRL(totals.vSeg ?? 0)} / {formatBRL(totals.vOutro ?? 0)}
                  </div>
                  {sums && (
                    <div className="text-xs text-muted-foreground">
                      Itens: {formatBRL(sums.vFrete)} / {formatBRL(sums.vSeg)} / {formatBRL(sums.vOutro)}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border p-3 sm:col-span-2 lg:col-span-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">vNF (Total NF)</div>
                      <div className="text-2xl font-semibold">{formatBRL(totals.vNF)}</div>
                    </div>

                    {vnfExpected !== undefined && totals.vNF !== undefined && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Composição esperada</div>
                        <div className="text-sm font-semibold">{formatBRL(vnfExpected)}</div>
                        {vnfDiff !== undefined && (
                          <div className="text-xs text-muted-foreground">
                            Diferença: <span className="font-mono">{formatNum(vnfDiff)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <ScrollArea className="h-[520px] pr-4">
              <div className="space-y-3">
                {filtered.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum item para este filtro/busca.</div>
                ) : (
                  filtered.map((f, idx) => (
                    <div key={`${f.code}-${idx}`} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {severityBadge(f.severity)}
                            <span className="text-sm font-semibold">{f.title}</span>
                            <span className="text-xs text-muted-foreground font-mono">{f.code}</span>
                          </div>
                          <div className="text-sm">{f.message}</div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => copyFinding(f, 'message')}>
                            {copiedFindingKey === `${f.code}-message` ? 'Copiado!' : 'Copiar'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => copyFinding(f, 'json')}>
                            {copiedFindingKey === `${f.code}-json` ? 'Copiado!' : 'JSON'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!f.path}
                            onClick={() => copyFinding(f, 'path')}
                          >
                            {copiedFindingKey === `${f.code}-path` ? 'Copiado!' : 'Caminho'}
                          </Button>
                        </div>
                      </div>

                      {(f.path || f.hint) && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          {f.path ? (
                            <div>
                              <span className="font-medium">Caminho:</span>{' '}
                              <span className="font-mono">{f.path}</span>
                            </div>
                          ) : null}
                          {f.hint ? (
                            <div>
                              <span className="font-medium">Dica:</span> {f.hint}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
