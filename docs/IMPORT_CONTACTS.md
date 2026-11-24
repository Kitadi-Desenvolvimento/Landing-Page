# 📥 Importação de Contactos do Excel para CRM

## Como Funciona

O sistema permite importar contactos do seu antigo CRM (Excel) diretamente para o novo CRM da Kitadi, com validação completa e preview antes de confirmar.

### Fluxo de Importação

1. **Upload do Ficheiro**
   - Seleccione um ficheiro Excel (.xlsx, .xls) ou CSV
   - Máximo: 5MB
   - Primeira linha: cabeçalhos (nomes das colunas)

2. **Mapeamento de Colunas**
   - O sistema detecta automaticamente as colunas conhecidas
   - Pode remapear manualmente se necessário
   - Campos obrigatórios: **Nome**, **Email**, **Telefone**
   - Campos opcionais: Empresa, Área, Notas

3. **Pré-visualização**
   - Vê quantos registos serão importados
   - Verifica o mapeamento das primeiras linhas
   - Volta para ajustar se necessário

4. **Confirmação e Importação**
   - Valida cada registo:
     - ✅ Email válido (formato correto)
     - ✅ Telefone válido (formato Angola)
     - ✅ Detecta duplicatas dentro da importação
   - Salva na tabela de oportunidades (`crm_opportunities`)
   - Cada contacto entra com stage **"new"** (nova oportunidade)

## Formato do Excel

### Estrutura Esperada

```
Nome | Email | Telefone | Empresa | Área | Notas
------|-------|----------|---------|------|-------
João Silva | joao@empresa.com | 923123456 | ABC Corp | Vendas | Cliente importante
Maria Santos | maria@company.pt | 924567890 | XYZ Lda | Operações | Contacto da CEO
```

### Regras de Validação

**Email:**
- Deve ter formato válido: `name@domain.com`
- Será armazenado em minúsculas

**Telefone:**
- Aceitável com formatos:
  - `923123456` (9 dígitos)
  - `+244923123456` (com código país)
  - `0923123456` (com 0 inicial)
  - Será normalizado para: `+244923123456`

**Duplicatas:**
- Se um email aparecer múltiplas vezes no ficheiro, apenas a primeira será importada
- Se um email já existe no CRM, será tratado como update (futuro)

## Acesso

**Localização:** Back office → Comercial → Botão "📥 Importar do Excel"

**Permissões:** Apenas utilizadores com role **admin** ou **manager** podem importar

## Dados Capturados na Importação

Quando um contacto é importado, o sistema cria automaticamente:

```typescript
{
  name: "João Silva",           // Nome do contacto
  email: "joao@empresa.com",    // Email (minúsculas)
  phone: "+244923123456",       // Telefone normalizado
  company: "ABC Corp",          // Empresa (se fornecida)
  area: "Vendas",               // Área de negócio (se fornecida)
  notes: "[Importado] Notas aqui", // Notas com marcador [Importado]
  stage: "new",                 // Sempre começa como oportunidade nova
  probability: 0,               // Sem probabilidade inicialmente
  amount_kz: 0,                 // Sem valor inicialmente
  created_by: "user_id",        // Quem fez a importação
  created_at: "2026-11-24T15:00:00Z"  // Quando foi importado
}
```

## Tratamento de Erros

Após a importação, o sistema mostra:

- ✅ **Total importado:** X contacto(s) com sucesso
- ⚠️ **Erros de validação:** Linhas que falharam com motivo específico
- 🔁 **Duplicatas detectadas:** Emails repetidos dentro do ficheiro

Exemplo de error:
```
Linha 5: Email inválido: joao@
Linha 7: Formato de telefone inválido: 123456
Linha 9: joao@empresa.com aparece múltiplas vezes
```

## Dicas de Uso

1. **Preparar dados:** Revise o Excel antes de importar
   - Remova linhas em branco
   - Corrija emails inválidos
   - Use formato padrão para telefones

2. **Teste com pequeno ficheiro:** Comece com 5-10 contactos para verificar
   - Ajuste mapeamento se necessário
   - Veja como os dados aparecem no CRM

3. **Importações em massa:** Pode importar centenas de contactos por vez
   - Sistema valida cada linha antes de salvar
   - Se há erro numa linha, apenas essa falha

4. **Depois da importação:**
   - Contactos aparecem no funil com status "new"
   - Pode adicionar mais dados (valor, probabilidade, etc)
   - Pode mover para outras etapas conforme trabalha

## API Endpoint (Para Developers)

```
POST /api/backoffice/contacts/import

Body:
{
  file: File (multipart/form-data)
  mapping: {
    name: "Nome",
    email: "Email", 
    phone: "Telefone",
    company?: "Empresa",
    area?: "Área",
    notes?: "Notas"
  }
}

Response:
{
  success: true,
  message: "5 contacto(s) importado(s) com sucesso",
  imported: 5,
  validationErrors: [],
  duplicatesWithinImport: []
}
```

## Fichas de Teste Recomendadas

### Teste 1: Importação Simples
```
Nome,Email,Telefone
João Silva,joao@test.com,923123456
Maria Santos,maria@test.com,924567890
```
**Esperado:** 2 contactos importados com sucesso

### Teste 2: Com Empresa e Notas
```
Nome,Email,Telefone,Empresa,Notas
Pedro Costa,pedro@empresa.com,925123456,ABC Corp,VIP Cliente
Ana Martins,ana@company.pt,926567890,XYZ Lda,Novo lead
```
**Esperado:** 2 contactos com empresa e notas preenchidas

### Teste 3: Validação de Erros
```
Nome,Email,Telefone
João,email_invalido,123456
,maria@test.com,924567890
Silva,silva@test.com,923123456
```
**Esperado:** 1 erro (email inválido), 1 erro (nome vazio), 1 sucesso

---

**Versão:** 1.0  
**Data de Implementação:** 24-11-2026  
**Mantido por:** Kitadi CRM Team
