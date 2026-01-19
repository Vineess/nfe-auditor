# Auditor de NF-e (pré-SEFAZ)

Aplicação para auditar XMLs de NF-e **antes do envio para a SEFAZ**, identificando inconsistências comuns (estrutura, chave/DV, documentos, CEP, totais x itens, CFOP x UF, NCM etc.).

> Objetivo: reduzir rejeições e acelerar o diagnóstico com **findings** claros, filtros, busca e exportações.

---

## Visão geral

O auditor possui **dois modos**:

* **Único**: colar o XML ou escolher um arquivo `.xml` e analisar.
* **Lote**: selecionar vários XMLs, analisar em sequência e gerar uma tabela resumida com exportações.

Além disso, no modo **Lote**, ao clicar em uma linha analisada, é possível abrir um **detalhamento em tela cheia** com os findings daquele arquivo.

---

## Como usar

### 1) Modo Único

1. Acesse a página **/auditar**.
2. Na aba **Único**:

   * Cole o conteúdo do XML no textarea **ou** selecione o arquivo `.xml`.
3. Clique em **Analisar**.
4. Veja:

   * Resumo (itens, presença de `nfeProc`, chave, emitente/destinatário etc.)
   * Blocos de totais (quando presentes)
   * Lista de findings com filtros e busca
5. Ações:

   * **Exportar JSON** (resultado completo)
   * **Copiar JSON**
   * **Copiar chave** (se existir)

### 2) Modo Lote

1. Vá para a aba **Lote**.
2. Clique em **Selecionar XMLs** e selecione vários arquivos.
3. Clique em **Analisar lote**.
4. A tabela mostra:

   * Status (OK / Com alertas)
   * Erros/Alertas
   * Emitente/Destinatário
   * nNF e vNF
   * Chave com botão **Copiar** (por linha)
5. Exportações:

   * **Exportar CSV** (resumo)
   * **Exportar JSON** (estrutura completa por arquivo)

### 3) Detalhes do lote (Tela cheia)

* Após analisar, clique em qualquer linha com resultado.
* Abre um modal em **tela cheia** com:

  * Resumo do arquivo + ações
  * Totais/Composição (quando presentes)
  * Filtros e busca nos findings
  * Botões por finding: copiar / JSON / caminho

---

## O que é validado hoje

### Estrutura

* Presença de `infNFe`
* Presença de itens (`det`)

### Chave de acesso

* Extração da chave (`infNFe.@Id` ou `protNFe.infProt.chNFe`)
* Tamanho (44 dígitos)
* Cálculo e validação do **DV**

### Campos essenciais

* `ide`, `emit`, `dest` (com avisos quando ausentes)

### Documentos e endereços

* Validação de **CPF/CNPJ** (emitente e destinatário)
* UF emitente/destinatário
* Validação de **CEP** (8 dígitos)

### Totais x Itens

* Soma de itens (vProd, vDesc, vFrete, vSeg, vOutro)
* Comparação com `ICMSTot`
* Heurística do `vNF` (composição esperada)

### Por item

* Quantidade `qCom` > 0
* Valor unitário `vUnCom` > 0 (aviso)
* CFOP x UF (heurística interna x interestadual)
* NCM (existência e tamanho 8 dígitos)

---

## API

### Endpoint

* `POST /api/audit`

### Payload

```json
{ "xml": "<conteudo_xml_aqui>" }
```

### Resposta (AuditResult)

* `ok`: boolean
* `meta`: informações agregadas (itens, chave, totais, etc.)
* `summary`: contagem de erros/alertas/infos
* `findings`: lista detalhada

---

## Estrutura de dados

### Finding

* `severity`: `error | warning | info`
* `code`: código único
* `title`: título curto
* `message`: explicação
* `path` (opcional): caminho no XML
* `hint` (opcional): dica prática

### BatchRow

* `fileName`, `size`
* `result` (AuditResult, quando analisado)
* `error` (string, quando falha)

---

## Exportações

### Único

* JSON do resultado completo.

### Lote

* **CSV**: resumo por arquivo.
* **JSON**: lista completa com `result` por arquivo.

---

## UX/UI (decisões)

* Modo Lote com seleção de arquivos via botão (input escondido)
* Progresso de execução: `done/total`
* Linha do lote clicável somente quando já existe `result`
* Modal **tela cheia** para detalhes do arquivo (melhor leitura e responsividade)
* Busca e filtros em ambos os modos

---

## Próximas features (roadmap)

### Curto prazo (alto impacto)

* **Rodar lote em paralelo com limite de concorrência** (ex.: 3-5 por vez) para acelerar.
* **Cancelar lote** (stop) e retomar.
* **Persistir resultados no localStorage** (manter ao recarregar a página).
* **Agrupar findings por categoria** (Estrutura, Documentos, Totais, Itens, Tributação, etc.).
* **Ações rápidas por severidade** (ex.: “copiar todos erros”).

### Médio prazo

* **Painel de estatísticas do lote**:

  * total de arquivos OK / com alertas
  * top 10 códigos de erro
  * percentuais por tipo
* **Exportar CSV estendido** com campos extras (UFs, modelo, série, dhEmi, etc.).
* **Clique no item da tabela** para ver **prévia do XML** (trecho relevante do path).

### Tributação / regras avançadas

* Validações de **ICMS/PIS/COFINS** conforme CST/CSOSN.
* Validação de **IBS/CBS** (grupos UB/totalização) e possíveis divergências.
* Validações específicas por **CFOP / finalidade / operação**.
* Validações de **NCM x CEST** (quando aplicável) e regras por UF.

### Qualidade e arquitetura

* Suite de testes com amostras de XML (fixtures) e regressões.
* Performance: parsing mais eficiente e melhor tratamento de memória.
* Logs e rastreabilidade de execuções (especialmente no lote).

---

## Observações

* As validações são **pré-checagens**: ajudam a achar inconsistências, mas não substituem as regras completas da SEFAZ.
* Sempre que possível, use XML com `nfeProc` (com protocolo), pois facilita extração de chave e metadados.
