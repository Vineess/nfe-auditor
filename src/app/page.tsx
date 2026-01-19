import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>NF-e Auditor</CardTitle>
          <CardDescription>
            Auditor gratuito para encontrar inconsistências comuns no XML da NF-e antes de enviar para a SEFAZ.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Link href="/auditar">
            <Button>Começar auditoria</Button>
          </Link>
          <Link href="https://github.com" target="_blank">
            <Button variant="secondary">Ver no GitHub</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
