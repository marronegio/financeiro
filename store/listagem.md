# Ficha da Play Store — DinPrev

Textos prontos para colar no Play Console (Presença na loja → Detalhes do app).

## Nome do app (máx. 30 caracteres)

```
DinPrev: Finanças Pessoais
```

## Descrição curta (máx. 80 caracteres)

```
Distribua seu salário antes de gastar. Com assistente de IA e lembretes.
```

## Descrição completa (máx. 4000 caracteres)

```
Você não ganha pouco. Só não sabe para onde vai.

O DinPrev distribui seu salário antes de você gastar. Configure o mês uma vez
— salário, despesas fixas, assinaturas, limite do cartão — e veja em tempo
real quanto ainda sobra. Quando a fatura fecha, não tem surpresa: você já
sabia o número desde o começo do mês.

SEIS PAINÉIS, UM PANORAMA COMPLETO
💰 Planejamento — defina o salário e veja quanto sobra depois de cada gasto
🏠 Despesas fixas — aluguel, energia, internet, tudo que sai todo mês
🎬 Assinaturas — streaming, academia, apps: o total que debita automático
💳 Cartão de crédito — quanto ainda cabe na fatura antes de o mês fechar
📦 Parcelamentos — cada compra parcelada, a parcela do mês e quanto falta
📊 Histórico — compare mês a mês e veja sua evolução

ASSISTENTE COM IA
Esqueça formulários. Fale, escreva ou mande uma foto:
• "gastei 45 no mercado" — e já entrou na fatura
• mande um áudio, tipo WhatsApp, e ele transcreve e lança
• fotografe um comprovante ou nota e ele registra sozinho

LEMBRETES DE VENCIMENTO
O DinPrev avisa antes de cada conta vencer — no app e por e-mail. Marque como
paga num toque e nunca mais pague juros à toa.

PLANO A DOIS
No plano Duo, você e seu parceiro(a) têm dois perfis independentes na mesma
assinatura — cada um com seus painéis, protegidos por PIN.

SEUS DADOS SEGUROS E NA NUVEM
Acesse do celular ou do computador: tudo sincronizado. Tráfego criptografado
e dados visíveis somente para você.

Assinatura a partir de R$ 19,90/mês. Pague no cartão ou PIX. Cancele quando
quiser.
```

## Outros campos

| Campo | Valor |
| --- | --- |
| Categoria | Finanças |
| Tags | finanças pessoais, orçamento, controle de gastos |
| E-mail de contato | (seu e-mail de suporte) |
| Política de privacidade | https://SEU-DOMINIO/privacidade.html |

## Assets

- `feature-graphic.png` — banner 1024×500 (obrigatório)
- Ícone 512×512: exportar de `assets/icon-only.png` (redimensionar para 512)
- `screenshots/` — mínimo 2, ideal 4–8, em 1080×1920 (pendente: capturar com
  dados fictícios — nunca com dados reais)

## Data Safety (formulário do Console) — resumo honesto

- Coleta: e-mail, CPF (identificadores), dados financeiros digitados pelo
  usuário, mensagens/áudio/fotos enviados ao assistente de IA.
- Compartilhamento com operadores: Supabase (hospedagem), ASAAS/Stripe
  (pagamento), OpenAI (assistente).
- Dados criptografados em trânsito: sim. Exclusão: o usuário pode excluir a
  conta no app.
- O app NÃO coleta localização, contatos ou histórico de navegação.
