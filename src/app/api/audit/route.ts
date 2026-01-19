import { NextResponse } from 'next/server'
import { auditXml } from '@/lib/audit'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const result = auditXml(body)
    return NextResponse.json(result, { status: 200 })
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        meta: { itemsCount: 0, hasNfeProc: false },
        summary: { errors: 1, warnings: 0, infos: 0 },
        findings: [
          {
            severity: 'error',
            code: 'SERVER_ERROR',
            title: 'Erro no servidor',
            message: 'Falha ao processar a requisição.',
          },
        ],
      },
      { status: 500 }
    )
  }
}
