# Correção do Bloco 1 — RLS e acesso a dados

## Objetivo
Fechar os riscos encontrados na auditoria sem interromper cadastro, checkout público, cupons, links de pagamento, corrida de faturamento ou telas do seller/admin.

## Alterações
1. **Cadastro e enumeração de dados**
   - Remover a consulta anônima direta que revela se e-mail, CPF/CNPJ ou telefone já existem.
   - Transferir a checagem para o fluxo seguro de cadastro, com resposta genérica e limitação de tentativas, preservando mensagens úteis sem expor qual dado existe.

2. **Corrida de faturamento**
   - Restringir corridas e prêmios visíveis aos sellers somente às temporadas ativas.
   - Reduzir o ranking público ao necessário para a experiência, sem expor faturamento nominal bruto de concorrentes; admins mantêm visão integral.

3. **Funções públicas sujeitas a abuso**
   - Aplicar rate limit no incremento de cliques e na validação de cupons, mantendo ambos funcionais no checkout público.
   - Revisar permissões de execução para garantir acesso apenas aos papéis necessários.

4. **Storage**
   - Trocar as policies de escrita/leitura privada de KYC e escrita de imagens para `authenticated`.
   - Manter somente a leitura realmente pública dos assets de vitrine.
   - Substituir o `LIKE` inseguro de capas de links por correspondência exata de caminho.

5. **Dados e frontend**
   - Remover `admin_user_id` da projeção entregue ao seller por meio de uma interface segura.
   - Trocar leituras frontend de tabelas administrativas por funções públicas mínimas já existentes ou health-check seguro.
   - Corrigir o prefetch de taxas para usar a mesma função segura da tela.

6. **Defesa em profundidade**
   - Não aplicar `FORCE ROW LEVEL SECURITY` indiscriminadamente: o owner do banco e funções internas precisam executar rotinas financeiras e administrativas. Em vez disso, validar grants, roles e guards das funções privilegiadas, que é a barreira efetiva neste ambiente.

## Validação
- Executar migration única e revisar policies, grants e definições finais.
- Testar cadastro, leitura da corrida, cupom, link público e telas financeiras.
- Testar acesso anônimo, seller e admin separadamente.
- Rodar linter e scanner de segurança após a correção.

## Detalhes técnicos
- Toda mudança estrutural será aplicada pela migration aprovada do Lovable Cloud.
- Fluxos públicos continuarão anônimos apenas onde são requisito do produto; mutações terão limitação por chave de requisição e janela de tempo.
- Nenhum segredo ou identificador interno será movido para o frontend.
