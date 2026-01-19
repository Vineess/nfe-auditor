'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'

type Severity = 'error' | 'warning' | 'info'
type Finding = {
  severity: Severity
  code: string
  title: string
  message: string
  path?: string
  hint?: string
}
type AuditResult = {
  ok: boolean
  meta: { itemsCount: number; hasNfeProc: boolean; accessKey?: string }
  summary: { errors: number; warnings: number; infos: number }
  findings: Finding[]
}

function severityBadge(sev: Severity) {
  if (sev === 'error') return <Badge variant="destructive">Erro</Badge>
  if (sev === 'warning') return <Badge variant="secondary">Alerta</Badge>
  return <Badge variant="outline">Info</Badge>
}

export default function AuditarPage() {
  const [xml, setXml] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AuditResult | null>(null)
  const [filter, setFilter] = useState<Severity | 'all'>('all')
  const [err, setErr] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!result) return []
    if (filter === 'all') return result.findings
    return result.findings.filter(f => f.severity === filter)
  }, [result, filter])

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
                      {' '}· chave: <b className="font-mono text-xs">{result.meta.accessKey}</b>
                    </>
                  ) : null}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={exportJson}>
                  Exportar JSON
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={filter === 'all' ? 'default' : 'secondary'}
                onClick={() => setFilter('all')}
              >
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
          </CardHeader>

          <CardContent className="space-y-4">
            <Separator />

            <ScrollArea className="h-[520px] pr-4">
              <div className="space-y-3">
                {filtered.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum item para este filtro.</div>
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
