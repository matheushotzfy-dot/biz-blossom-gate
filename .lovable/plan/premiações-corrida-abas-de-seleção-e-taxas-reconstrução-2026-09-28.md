# Premiações, Corrida, abas de seleção e Taxas: reconstrução

## 1. Abas de seleção (todo o site)
As barras de abas das suas capturas (Integrações/Webhooks, Perfil/Identidade, Premiações/Corrida) vêm todas do mesmo componente, então o redesign vale para todas de uma vez.
- Nova barra no estilo "segmentado": uma faixa fina de 1px, sem caixas grossas em volta de cada aba.
- Um indicador amarelo desliza entre as abas quando você clica (troca suave).
- Aba ativa em texto claro com o ícone amarelo; abas inativas discretas, que acendem quando o mouse passa por cima.
- Um contador opcional ao lado do nome (por exemplo, número de resgates pendentes).
- No celular a barra rola de lado com um leve esmaecido nas bordas.

## 2. Premiações e Corrida em tela cheia
- As duas páginas passam a ocupar a largura inteira, sem a coluna centralizada de 1280px.
- Premiações: palco maior, galeria de peças em trilha horizontal, linha do tempo dos marcos com a posição atual do seller, e um histórico de resgates com rastreio passo a passo (análise, aprovado, enviado, entregue).
- Corrida: pódio do top 3 em destaque, tabela do ranking com a posição do próprio seller fixada, contagem regressiva, cartões de prêmios e o banner e as regras definidos no admin.

## 3. Ligação com o painel admin
- Hoje os marcos de Premiações (10k até 10M) estão fixos no código. Eles passam a vir de uma tabela gerenciada no admin: nome, valor da meta, imagem, recompensas, ativo ou inativo e ordem.
- Na aba Premiações do admin entram: um editor de marcos, a lista de resgates com filtros, mudança de status, código de rastreio e uma observação que o seller vê.
- A Corrida já é controlada pelo admin (corridas, prêmios, ajustes de ranking, banner). Vai passar a mostrar ao seller tudo o que o admin preenche: regras, período, status e prêmios por posição. Também entra no admin uma prévia de como o seller vê a corrida.
- Atualização em tempo real: quando o admin muda um resgate ou o ranking, a tela do seller se atualiza sozinha.

## 4. Aba Taxas reconstruída
- Topo com as suas taxas atuais em destaque: PIX, cartão e saque, com a indicação de padrão ou personalizada.
- Simulador: você digita um valor de venda e vê o valor bruto, as taxas e quanto recebe.
- Tabela de prazos de liberação (PIX na hora, cartão em D+X) e das regras de saque.
- Mesmo visual preto e amarelo, compacto, com números em fonte tabular.

## Detalhes técnicos
- `HubTabs.tsx`: reescrito com o indicador em `motion` usando `layoutId`, apenas com tokens semânticos.
- `DashboardLayout`: uma opção de largura total por rota para `/premiacoes`.
- Nova tabela `award_tiers` com GRANTs, RLS (leitura pelos sellers autenticados, escrita só por admin via `has_role`) e carga inicial com os 7 marcos atuais. `use-awards.ts` passa a ler dessa tabela, com os dados atuais como reserva.
- `reward_claims`: adicionar `tracking_code` e `admin_note` caso não existam (confirmar antes).
- Realtime em `reward_claims` (filtrado pelo próprio usuário) e em `revenue_race_overrides`.
- Taxas: continua usando `useFees` e `custom_user_fees`, sem mudar a lógica de cobrança.
- Validação: compilação e Playwright no desktop e no celular.
