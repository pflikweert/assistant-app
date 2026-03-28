# Logic Leakage Audit (PR-B Start)

Deze inventaris markeert render-logica die in vervolg-PR's naar `services/ui-formatters/*` moet verplaatsen.

## Scope

- `app/(tabs)/index.tsx`
- `app/(tabs)/budget.tsx`
- `app/(tabs)/insights.tsx`
- `screens/TransactionsScreen.tsx`

## Gevonden lekkages (samenvatting)

- **Dashboard (`index.tsx`)**
  - Lokale valuta-formatter (`Intl.NumberFormat`) voor transactierijen.
  - Lokale datumlabel-formatting (`toLocaleDateString`) voor korte datums.
- **Budget (`budget.tsx`)**
  - Veel lokale `Math.round` en percentage-/tempo-opbouw in rendergerelateerde helpers.
  - Lokale valuta-formatting met gedeelde `fmt` instance.
  - Lokale datum- en weeklabel-formatting.
- **Insights (`insights.tsx`)**
  - Lokale valuta-formatting (`formatAmount`, `formatSignedAmount`).
  - Lokale datum-labels voor uitleg/footers (`formatSheetDate`).
- **Transactions (`TransactionsScreen.tsx`)**
  - Lokale datumperiode-labels (`formatSectionDateLabel`).

## Vervolgcontract

- Gebruik in vervolg-PR's:
  - `services/ui-formatters/currency.ts`
  - `services/ui-formatters/dates.ts`
  - `services/ui-formatters/percentages.ts`
  - `services/ui-formatters/labels.ts`
- UI-componenten blijven render-only; formattering wordt servicegedreven.
