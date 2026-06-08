# Dashboard Financeiro

Aplicação React (Vite) para planejar salário, despesas fixas, assinaturas, compras no cartão e parcelamentos. Todos os dados são salvos automaticamente no `localStorage` do navegador.

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço que o Vite mostrar (normalmente http://localhost:5173).

## Build de produção

```bash
npm run build      # gera a pasta dist/
npm run preview    # serve a build localmente para conferir
```

## Estrutura

```
src/
  main.jsx                  # ponto de entrada (monta o React)
  App.jsx                   # estado global + roteamento de abas
  state.js                  # estado padrão, chave do storage e lista de abas
  money.js                  # helpers de moeda e cálculos (compute, computeParcela)
  hooks/
    usePersistentState.js   # useState + persistência em localStorage
  components/
    Sidebar.jsx
    MoneyField.jsx          # input de dinheiro com máscara
    ItemRow.jsx             # linha nome + valor + remover
    EditableList.jsx        # lista de ItemRow + botão adicionar
    PlanejamentoPanel.jsx
    DespesasPanel.jsx
    AssinaturasPanel.jsx
    CartaoPanel.jsx
    ParcelamentosPanel.jsx
  styles.css                # todo o estilo (idêntico ao protótipo original)
```

> O arquivo `dashboard-financeiro.html` (versão antiga em HTML/JS puro) continua na pasta acima apenas como referência.
