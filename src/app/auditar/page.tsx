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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

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

    emitName?: string
    destName?: string
    nNF?: string
    serie?: string
    dhEmi?: string
    vNF?: number

    totals?: TotalsMeta
    sums?: SumsMeta
  }
  summary: { errors: number; warnings: number; infos: number }
  findings: Finding[]
}

type BatchRow = {
  fileName: string
  size: number
  result?: AuditResult
  error?: string
}

function severityBadge(sev: Severity) {
  if (sev === 'error') return <Badge variant="destructive">Erro</Badge>
  if (sev === 'warning') return <Badge variant="secondary">Alerta</Badge>
  return <Badge variant="outline">Info</Badge>
}

function okBadge(ok: boolean) {
  return ok ? <Badge variant="outline">OK</Badge> : <Badge variant="secondary">Com alertas</Badge>
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

function csvEscape(v: any) {
  const s = String(v ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export default function AuditarPage() {
  // ---- SINGLE ----
  const [xml, setXml] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AuditResult | null>(null)
  const [filter, setFilter] = useState<Severity | 'all'>('all')
  const [query, setQuery] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)
  const [copiedFindingKey, setCopiedFindingKey] = useState<string | null>(null)

  // ---- BATCH ----
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [batchRows, setBatchRows] = useState<BatchRow[]>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })
  const [batchQuery, setBatchQuery] = useState('')
  const [batchCopied, setBatchCopied] = useState<string | null>(null)

  // ---- BATCH Fullscreen details ----
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<BatchRow | null>(null)
  const [drawerFilter, setDrawerFilter] = useState<Severity | 'all'>('all')
  const [drawerQuery, setDrawerQuery] = useState('')
  const [drawerCopied, setDrawerCopied] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!result) return []
    const base = filter === 'all' ? result.findings : result.findings.filter((f) => f.severity === filter)

    const q = query.trim().toLowerCase()
    if (!q) return base

    return base.filter((f) => {
      const hay = [f.severity, f.code, f.title, f.message, f.path ?? '', f.hint ?? ''].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [result, filter, query])

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

  // -------- BATCH handlers --------
  function onPickBatchFiles(files: FileList | null) {
    const arr = Array.from(files ?? [])
    setBatchFiles(arr)

    const next: BatchRow[] = arr.map((f) => ({ fileName: f.name, size: f.size }))
    setBatchRows(next)
    setBatchProgress({ done: 0, total: next.length })
    setBatchQuery('')
  }

  async function runBatch() {
    if (batchFiles.length === 0) return
    setBatchLoading(true)

    const arr = batchFiles
    const rows: BatchRow[] = arr.map((f) => ({ fileName: f.name, size: f.size }))
    setBatchRows(rows)
    setBatchProgress({ done: 0, total: rows.length })

    let done = 0

    for (let i = 0; i < arr.length; i++) {
      const file = arr[i]
      try {
        const xmlText = await file.text()
        const res = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ xml: xmlText }),
        })
        const data = (await res.json()) as AuditResult
        rows[i] = { ...rows[i], result: data }
      } catch (e: any) {
        rows[i] = { ...rows[i], error: 'Falha ao analisar este arquivo.' }
      }

      done++
      setBatchRows([...rows])
      setBatchProgress({ done, total: rows.length })
    }

    setBatchLoading(false)
  }

  const batchFiltered = useMemo(() => {
    const q = batchQuery.trim().toLowerCase()
    if (!q) return batchRows
    return batchRows.filter((r) => {
      const m = r.result?.meta
      const hay = [
        r.fileName,
        m?.accessKey ?? '',
        m?.emitName ?? '',
        m?.destName ?? '',
        m?.nNF ?? '',
        m?.serie ?? '',
        m?.dhEmi ?? '',
        String(m?.vNF ?? ''),
        String(r.result?.summary?.errors ?? ''),
        String(r.result?.summary?.warnings ?? ''),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [batchRows, batchQuery])

  function exportBatchJson() {
    const payload = batchRows.map((r) => ({
      fileName: r.fileName,
      size: r.size,
      error: r.error,
      result: r.result,
    }))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'auditoria-nfe-lote.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function exportBatchCsv() {
    const headers = ['arquivo', 'ok', 'erros', 'alertas', 'infos', 'chave', 'emitente', 'destinatario', 'nNF', 'serie', 'dhEmi', 'vNF']
    const lines = [headers.join(',')]

    for (const r of batchRows) {
      const m = r.result?.meta
      const s = r.result?.summary
      const row = [
        csvEscape(r.fileName),
        csvEscape(r.result ? (r.result.ok ? 'OK' : 'NAO_OK') : 'ERRO'),
        csvEscape(s?.errors ?? ''),
        csvEscape(s?.warnings ?? ''),
        csvEscape(s?.infos ?? ''),
        csvEscape(m?.accessKey ?? ''),
        csvEscape(m?.emitName ?? ''),
        csvEscape(m?.destName ?? ''),
        csvEscape(m?.nNF ?? ''),
        csvEscape(m?.serie ?? ''),
        csvEscape(m?.dhEmi ?? ''),
        csvEscape(m?.vNF ?? ''),
      ]
      lines.push(row.join(','))
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'auditoria-nfe-lote.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function copyBatchValue(key: string, value: string) {
    if (!value) return
    const ok = await copyToClipboard(value)
    if (!ok) return
    setBatchCopied(key)
    setTimeout(() => setBatchCopied(null), 1200)
  }

  function clearBatch() {
    setBatchFiles([])
    setBatchRows([])
    setBatchProgress({ done: 0, total: 0 })
    setBatchQuery('')
  }

  // -------- Details (fullscreen) helpers --------
  function openDrawerFor(row: BatchRow) {
    setSelectedBatch(row)
    setDrawerFilter('all')
    setDrawerQuery('')
    setDrawerCopied(null)
    setDrawerOpen(true)
  }

  const drawerResult = selectedBatch?.result

  const drawerFindingsFiltered = useMemo(() => {
    const all = drawerResult?.findings ?? []
    const base = drawerFilter === 'all' ? all : all.filter((f) => f.severity === drawerFilter)
    const q = drawerQuery.trim().toLowerCase()
    if (!q) return base
    return base.filter((f) => {
      const hay = [f.severity, f.code, f.title, f.message, f.path ?? '', f.hint ?? ''].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [drawerResult, drawerFilter, drawerQuery])

  async function copyDrawer(key: string, value: string) {
    if (!value) return
    const ok = await copyToClipboard(value)
    if (!ok) return
    setDrawerCopied(key)
    setTimeout(() => setDrawerCopied(null), 1200)
  }

  function exportSelectedJson() {
    if (!selectedBatch?.result) return
    const payload = {
      fileName: selectedBatch.fileName,
      size: selectedBatch.size,
      error: selectedBatch.error,
      result: selectedBatch.result,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auditoria-${selectedBatch.fileName.replace(/\.xml$/i, '')}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const drawerTotals = drawerResult?.meta.totals
  const drawerSums = drawerResult?.meta.sums

  const drawerVnfExpected =
    drawerTotals?.vProd !== undefined
      ? Number(
          (
            (drawerTotals.vProd || 0) +
            (drawerTotals.vFrete || 0) +
            (drawerTotals.vSeg || 0) +
            (drawerTotals.vOutro || 0) -
            (drawerTotals.vDesc || 0)
          ).toFixed(2)
        )
      : undefined

  const drawerVnfDiff =
    drawerTotals?.vNF !== undefined && drawerVnfExpected !== undefined
      ? Number((drawerVnfExpected - (drawerTotals.vNF || 0)).toFixed(2))
      : undefined

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single">Único</TabsTrigger>
          <TabsTrigger value="batch">Lote</TabsTrigger>
        </TabsList>

        {/* ---------------- SINGLE ---------------- */}
        <TabsContent value="single" className="space-y-6">
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

                    {(result.meta.emitName || result.meta.destName || result.meta.nNF || result.meta.serie) && (
                      <div className="text-xs text-muted-foreground">
                        {result.meta.emitName ? (
                          <span>
                            <b>Emit:</b> {result.meta.emitName} ·{' '}
                          </span>
                        ) : null}
                        {result.meta.destName ? (
                          <span>
                            <b>Dest:</b> {result.meta.destName} ·{' '}
                          </span>
                        ) : null}
                        {result.meta.nNF ? (
                          <span>
                            <b>nNF:</b> {result.meta.nNF} ·{' '}
                          </span>
                        ) : null}
                        {result.meta.serie ? (
                          <span>
                            <b>Série:</b> {result.meta.serie}
                          </span>
                        ) : null}
                      </div>
                    )}
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
                    <Button size="sm" variant={filter === 'error' ? 'default' : 'secondary'} onClick={() => setFilter('error')}>
                      Erros ({result.summary.errors})
                    </Button>
                    <Button size="sm" variant={filter === 'warning' ? 'default' : 'secondary'} onClick={() => setFilter('warning')}>
                      Alertas ({result.summary.warnings})
                    </Button>
                    <Button size="sm" variant={filter === 'info' ? 'default' : 'secondary'} onClick={() => setFilter('info')}>
                      Infos ({result.summary.infos})
                    </Button>
                  </div>

                  <div className="sm:w-[340px]">
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar (código, título, mensagem, caminho...)" />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <Separator />

                {totals && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">vProd</div>
                      <div className="text-lg font-semibold">{formatBRL(totals.vProd)}</div>
                      {sums?.vProd !== undefined && <div className="text-xs text-muted-foreground">Soma itens: {formatBRL(sums.vProd)}</div>}
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">vDesc</div>
                      <div className="text-lg font-semibold">{formatBRL(totals.vDesc ?? 0)}</div>
                      {sums?.vDesc !== undefined && <div className="text-xs text-muted-foreground">Soma itens: {formatBRL(sums.vDesc)}</div>}
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
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                {severityBadge(f.severity)}
                                <span className="text-sm font-semibold">{f.title}</span>
                                <span className="text-xs text-muted-foreground font-mono truncate">{f.code}</span>
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
                              <Button size="sm" variant="outline" disabled={!f.path} onClick={() => copyFinding(f, 'path')}>
                                {copiedFindingKey === `${f.code}-path` ? 'Copiado!' : 'Caminho'}
                              </Button>
                            </div>
                          </div>

                          {(f.path || f.hint) && (
                            <div className="text-xs text-muted-foreground space-y-1">
                              {f.path ? (
                                <div>
                                  <span className="font-medium">Caminho:</span>{' '}
                                  <span className="font-mono break-all">{f.path}</span>
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
        </TabsContent>

        {/* ---------------- BATCH ---------------- */}
        <TabsContent value="batch" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Auditar em lote</CardTitle>
              <CardDescription>Selecione vários XMLs e gere uma tabela com status, totais e exportações (CSV/JSON).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2">
                  <input
                    id="batch-files"
                    type="file"
                    multiple
                    accept=".xml,text/xml,application/xml"
                    className="hidden"
                    onChange={(e) => onPickBatchFiles(e.target.files)}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => document.getElementById('batch-files')?.click()} disabled={batchLoading}>
                      Selecionar XMLs
                    </Button>

                    <Button type="button" variant="secondary" onClick={clearBatch} disabled={batchLoading || batchRows.length === 0}>
                      Limpar
                    </Button>

                    <span className="text-sm text-muted-foreground">
                      Arquivos: <b>{batchRows.length}</b>
                      {batchLoading || batchProgress.total > 0 ? (
                        <>
                          {' '}
                          · Progresso: <b>{batchProgress.done}/{batchProgress.total}</b>
                        </>
                      ) : null}
                    </span>
                  </div>

                  {batchFiles.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {batchFiles.slice(0, 5).map((f) => f.name).join(' · ')}
                      {batchFiles.length > 5 ? ` · +${batchFiles.length - 5}` : ''}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={runBatch} disabled={batchLoading || batchRows.length === 0}>
                    {batchLoading ? `Analisando... (${batchProgress.done}/${batchProgress.total})` : 'Analisar lote'}
                  </Button>

                  <Button variant="outline" onClick={exportBatchCsv} disabled={batchRows.length === 0}>
                    Exportar CSV
                  </Button>
                  <Button variant="outline" onClick={exportBatchJson} disabled={batchRows.length === 0}>
                    Exportar JSON
                  </Button>
                </div>
              </div>

              <div className="sm:w-[420px]">
                <Input value={batchQuery} onChange={(e) => setBatchQuery(e.target.value)} placeholder="Buscar no lote (arquivo, chave, emitente, destinatário...)" />
              </div>

              <Separator />

              <div className="rounded-lg border">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-muted-foreground">
                  <div className="col-span-3">Arquivo</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1 text-right">Erros</div>
                  <div className="col-span-1 text-right">Alertas</div>
                  <div className="col-span-2">Emitente</div>
                  <div className="col-span-2">Destinatário</div>
                  <div className="col-span-1">nNF</div>
                  <div className="col-span-1 text-right">vNF</div>
                </div>
                <Separator />

                <ScrollArea className="h-[520px]">
                  <div className="divide-y">
                    {batchFiltered.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">Nenhum registro para esta busca.</div>
                    ) : (
                      batchFiltered.map((r) => {
                        const m = r.result?.meta
                        const s = r.result?.summary
                        const key = m?.accessKey ?? ''
                        const clickable = Boolean(r.result)

                        return (
                          <button
                            key={r.fileName}
                            type="button"
                            onClick={() => (r.result ? openDrawerFor(r) : null)}
                            disabled={!clickable}
                            className={[
                              'w-full text-left',
                              'grid grid-cols-12 gap-2 px-3 py-3 text-sm',
                              clickable ? 'cursor-pointer hover:bg-muted/40' : 'cursor-not-allowed opacity-70',
                            ].join(' ')}
                          >
                            <div className="col-span-3">
                              <div className="font-medium">{r.fileName}</div>
                              {key ? (
                                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="font-mono truncate">{key}</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      copyBatchValue(`${r.fileName}-key`, key)
                                    }}
                                  >
                                    {batchCopied === `${r.fileName}-key` ? 'Copiado!' : 'Copiar'}
                                  </Button>
                                </div>
                              ) : r.error ? (
                                <div className="text-xs text-destructive">{r.error}</div>
                              ) : (
                                <div className="text-xs text-muted-foreground">Aguardando análise...</div>
                              )}
                            </div>

                            <div className="col-span-1">{r.result ? okBadge(r.result.ok) : r.error ? <Badge variant="destructive">Erro</Badge> : <Badge variant="secondary">-</Badge>}</div>

                            <div className="col-span-1 text-right font-mono">{s?.errors ?? '-'}</div>
                            <div className="col-span-1 text-right font-mono">{s?.warnings ?? '-'}</div>

                            <div className="col-span-2 truncate" title={m?.emitName ?? ''}>
                              {m?.emitName ?? '-'}
                            </div>
                            <div className="col-span-2 truncate" title={m?.destName ?? ''}>
                              {m?.destName ?? '-'}
                            </div>

                            <div className="col-span-1 font-mono">{m?.nNF ?? '-'}</div>
                            <div className="col-span-1 text-right font-mono">{m?.vNF !== undefined ? formatBRL(m.vNF) : '-'}</div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          {/* Fullscreen Details */}
          <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DialogContent className="max-w-none w-[100vw] h-[100dvh] p-0 gap-0">
              {/* Header fixo */}
              <div className="border-b px-5 py-4">
                <DialogHeader>
                  <DialogTitle>Detalhes do XML</DialogTitle>
                  <DialogDescription>
                    {selectedBatch?.fileName ? <span className="font-mono break-all">{selectedBatch.fileName}</span> : 'Selecione um arquivo da lista.'}
                  </DialogDescription>
                </DialogHeader>
              </div>

              {/* Conteúdo com scroll */}
              <div className="h-[calc(100dvh-92px)] overflow-y-auto">
                <div className="px-5 py-5 space-y-5">
                  {!drawerResult ? (
                    <div className="text-sm text-muted-foreground">Nenhum resultado selecionado.</div>
                  ) : (
                    <>
                      {/* Barra topo (status + ações) */}
                      <div className="rounded-lg border p-4 space-y-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            {okBadge(drawerResult.ok)}
                            <Badge variant="outline">Erros: {drawerResult.summary.errors}</Badge>
                            <Badge variant="outline">Alertas: {drawerResult.summary.warnings}</Badge>
                            <Badge variant="outline">Infos: {drawerResult.summary.infos}</Badge>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={exportSelectedJson}>
                              Exportar JSON
                            </Button>
                            {drawerResult.meta.accessKey ? (
                              <Button variant="outline" onClick={() => copyDrawer('accessKey', drawerResult.meta.accessKey!)}>
                                {drawerCopied === 'accessKey' ? 'Copiado!' : 'Copiar chave'}
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        <Separator />

                        <div className="grid gap-2 lg:grid-cols-2 text-sm">
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">Resumo</div>
                            <div className="text-sm text-muted-foreground">
                              Itens: <b className="text-foreground">{drawerResult.meta.itemsCount}</b> · nfeProc:{' '}
                              <b className="text-foreground">{drawerResult.meta.hasNfeProc ? 'sim' : 'não'}</b>
                            </div>
                            {drawerResult.meta.accessKey ? (
                              <div className="text-sm text-muted-foreground">
                                Chave: <span className="font-mono break-all">{drawerResult.meta.accessKey}</span>
                              </div>
                            ) : null}
                          </div>

                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">Identificação</div>
                            <div className="text-sm text-muted-foreground">
                              {drawerResult.meta.emitName ? (
                                <span>
                                  <b className="text-foreground">Emit:</b> {drawerResult.meta.emitName}{' '}
                                </span>
                              ) : (
                                <span>-</span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {drawerResult.meta.destName ? (
                                <span>
                                  <b className="text-foreground">Dest:</b> {drawerResult.meta.destName}{' '}
                                </span>
                              ) : (
                                <span>-</span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {drawerResult.meta.nNF ? (
                                <span>
                                  <b className="text-foreground">nNF:</b> {drawerResult.meta.nNF}{' '}
                                </span>
                              ) : null}
                              {drawerResult.meta.serie ? (
                                <span>
                                  · <b className="text-foreground">Série:</b> {drawerResult.meta.serie}{' '}
                                </span>
                              ) : null}
                              {drawerResult.meta.dhEmi ? (
                                <span>
                                  · <b className="text-foreground">Emissão:</b> {drawerResult.meta.dhEmi}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Financeiro */}
                      {drawerTotals ? (
                        <div className="grid gap-3 lg:grid-cols-3">
                          <div className="rounded-lg border p-4">
                            <div className="text-xs text-muted-foreground">vProd</div>
                            <div className="text-xl font-semibold">{formatBRL(drawerTotals.vProd)}</div>
                            {drawerSums?.vProd !== undefined ? (
                              <div className="text-xs text-muted-foreground">Soma itens: {formatBRL(drawerSums.vProd)}</div>
                            ) : null}
                          </div>

                          <div className="rounded-lg border p-4">
                            <div className="text-xs text-muted-foreground">vDesc</div>
                            <div className="text-xl font-semibold">{formatBRL(drawerTotals.vDesc ?? 0)}</div>
                            {drawerSums?.vDesc !== undefined ? (
                              <div className="text-xs text-muted-foreground">Soma itens: {formatBRL(drawerSums.vDesc)}</div>
                            ) : null}
                          </div>

                          <div className="rounded-lg border p-4">
                            <div className="text-xs text-muted-foreground">Frete / Seguro / Outros</div>
                            <div className="text-sm font-semibold">
                              {formatBRL(drawerTotals.vFrete ?? 0)} / {formatBRL(drawerTotals.vSeg ?? 0)} / {formatBRL(drawerTotals.vOutro ?? 0)}
                            </div>
                            {drawerSums ? (
                              <div className="text-xs text-muted-foreground">
                                Itens: {formatBRL(drawerSums.vFrete)} / {formatBRL(drawerSums.vSeg)} / {formatBRL(drawerSums.vOutro)}
                              </div>
                            ) : null}
                          </div>

                          <div className="rounded-lg border p-4 lg:col-span-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <div className="text-xs text-muted-foreground">vNF (Total NF)</div>
                                <div className="text-3xl font-semibold">{formatBRL(drawerTotals.vNF)}</div>
                              </div>

                              {drawerVnfExpected !== undefined && drawerTotals.vNF !== undefined ? (
                                <div className="text-left sm:text-right">
                                  <div className="text-xs text-muted-foreground">Composição esperada</div>
                                  <div className="text-sm font-semibold">{formatBRL(drawerVnfExpected)}</div>
                                  {drawerVnfDiff !== undefined ? (
                                    <div className="text-xs text-muted-foreground">
                                      Diferença: <span className="font-mono">{formatNum(drawerVnfDiff)}</span>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {/* Findings */}
                      <div className="rounded-lg border p-4 space-y-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant={drawerFilter === 'all' ? 'default' : 'secondary'} onClick={() => setDrawerFilter('all')}>
                              Todos ({drawerResult.findings.length})
                            </Button>
                            <Button size="sm" variant={drawerFilter === 'error' ? 'default' : 'secondary'} onClick={() => setDrawerFilter('error')}>
                              Erros ({drawerResult.summary.errors})
                            </Button>
                            <Button size="sm" variant={drawerFilter === 'warning' ? 'default' : 'secondary'} onClick={() => setDrawerFilter('warning')}>
                              Alertas ({drawerResult.summary.warnings})
                            </Button>
                            <Button size="sm" variant={drawerFilter === 'info' ? 'default' : 'secondary'} onClick={() => setDrawerFilter('info')}>
                              Infos ({drawerResult.summary.infos})
                            </Button>
                          </div>

                          <div className="lg:w-[420px]">
                            <Input value={drawerQuery} onChange={(e) => setDrawerQuery(e.target.value)} placeholder="Buscar nos findings..." />
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-3">
                          {drawerFindingsFiltered.length === 0 ? (
                            <div className="text-sm text-muted-foreground">Nenhum finding para este filtro/busca.</div>
                          ) : (
                            drawerFindingsFiltered.map((f, idx) => (
                              <div key={`${f.code}-${idx}`} className="rounded-lg border p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {severityBadge(f.severity)}
                                      <span className="text-sm font-semibold">{f.title}</span>
                                      <span className="text-xs text-muted-foreground font-mono truncate max-w-[220px] sm:max-w-[420px]">
                                        {f.code}
                                      </span>
                                    </div>
                                    <div className="text-sm">{f.message}</div>

                                    {(f.path || f.hint) ? (
                                      <div className="pt-2 text-xs text-muted-foreground space-y-1">
                                        {f.path ? (
                                          <div>
                                            <span className="font-medium">Caminho:</span>{' '}
                                            <span className="font-mono break-all">{f.path}</span>
                                          </div>
                                        ) : null}
                                        {f.hint ? (
                                          <div>
                                            <span className="font-medium">Dica:</span> {f.hint}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="flex flex-wrap gap-2 sm:justify-end">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => copyDrawer(`finding-${f.code}-msg`, `${f.title}\n${f.message}`)}
                                    >
                                      {drawerCopied === `finding-${f.code}-msg` ? 'Copiado!' : 'Copiar'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => copyDrawer(`finding-${f.code}-json`, JSON.stringify(f, null, 2))}
                                    >
                                      {drawerCopied === `finding-${f.code}-json` ? 'Copiado!' : 'JSON'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!f.path}
                                      onClick={() => copyDrawer(`finding-${f.code}-path`, f.path ?? '')}
                                    >
                                      {drawerCopied === `finding-${f.code}-path` ? 'Copiado!' : 'Caminho'}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  )
}
