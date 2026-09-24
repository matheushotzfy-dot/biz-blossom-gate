# Refinar o dashboard sem excesso de cartões

## Objetivo
Recuperar a hierarquia limpa da versão anterior e eliminar a sensação de “grade de quadrados”. O painel continuará completo, mas com menos contornos, mais respiro e uma leitura financeira clara.

## Direção visual
- Manter o tema escuro VENXPAY, azul elétrico controlado, Sora + Manrope e superfícies sólidas.
- Remover o fundo pontilhado e qualquer decoração que deixe a tela carregada.
- Usar bordas apenas onde ajudam a separar informação; nada de card para cada pequeno dado.
- Preservar o menu, os fluxos, os períodos, a privacidade e os dados reais existentes.

## Estrutura proposta
1. **Cabeçalho contínuo**
   - Saudação curta e contexto da operação à esquerda.
   - Período e privacidade integrados à direita, sem formar outro bloco visual pesado.

2. **Resumo financeiro principal**
   - Uma única faixa ampla com saldo disponível em destaque.
   - Recebido hoje, volume do período, aprovação e reembolsos como indicadores compactos separados por divisórias.
   - Reduzir os oito cartões atuais para uma composição única e hierárquica.

3. **Ações rápidas discretas**
   - Gerar PIX, saque, transações e credenciais como linha compacta de atalhos.
   - Ícones menores, área de clique clara e estados de interação refinados, sem quatro caixas grandes.

4. **Área analítica principal**
   - Gráfico de faturamento como protagonista da tela.
   - Resumo lateral integrado com conversão PIX, taxa de estorno e pedidos, sem empilhar múltiplos cartões.
   - Estados vazios bem resolvidos para contas sem movimento.

5. **Transações recentes**
   - Manter a tabela existente, simplificando cabeçalho, linhas e status.
   - Melhorar leitura no celular sem transformar cada transação em um bloco enorme.

6. **Mobile**
   - Saldo principal primeiro; indicadores secundários em faixa horizontal compacta.
   - Ações rápidas acessíveis e gráfico adaptado sem cortes.
   - Garantir que o aviso de privacidade não impeça a avaliação da tela após a interação.

## Validação
- Conferir desktop e celular em execução real.
- Validar ausência de rolagem horizontal, sobreposições e erros no console.
- Confirmar tipos, compilação e funcionamento dos atalhos, período e privacidade.

## Detalhes técnicos
- Reorganizar os componentes atuais do dashboard, sem alterar banco, regras financeiras ou integrações.
- Reutilizar os tokens semânticos do projeto; nenhuma cor fixa nos componentes.
- Remover os componentes auxiliares criados apenas para a grade excessiva quando deixarem de ser necessários.
