# Navigatie Migratieplan

Dit plan consolideert bestaande routes naar de hiërarchische URL-structuur zonder big-bang rewrite.

## Doel

- Eén logische parent-child navigatie.
- Geen losse utility-routes buiten `/settings`, `/accounts`, `/transactions` en `/admin`.
- Shell-keuze per route blijft voorspelbaar en testbaar.

## Gefaseerde Migratie

1. **Compat-fase**
- Huidige routes blijven bestaan.
- Nieuwe doelroutes worden toegevoegd.
- Legacy routes doen alleen `redirect` naar doelroute.

2. **Parent-child fase**
- Detailroutes verhuizen onder parent:
  - `/transaction-detail` -> `/transactions/:id`
  - `/analysis-detail` -> `/insights/:analysisId`
  - `/account/change-password` -> `/settings/security/password`
  - `/rekeningen-koppelen` -> `/accounts/link`
- `onBack` gaat altijd naar parentroute.

3. **Opschonen**
- Oude paden markeren als deprecated.
- Na 1 release-cycle verwijderen.

## Vergeten Subschermen (prioriteit)

| huidige route | doelroute | shell | actie |
| --- | --- | --- | --- |
| `/rekeningen-koppelen` | `/accounts/link` | `FinanceSheetShell` | verplaatsen naar accountsdomein |
| `/account/change-password` | `/settings/security/password` | `FinanceUtilityShell` | onder settings/security hangen |
| `/import-control` | `/transactions/import/control` | `FinanceSheetShell` | importflow onder transactions groeperen |
| `/import-afronden` | `/transactions/import/review` | `FinanceDetailShell` | afronding onder importflow |
| `/category-budget-groups` | `/budget/categories/groups` | `FinanceDetailShell` | budgetbeheer hiërarchisch maken |

## Validatie-checklist

- Elke detailroute heeft een parent in de URL.
- Elke detailroute heeft verplichte `onBack` naar die parent.
- Utility-menu gebruikt `FinanceSettingsGroup` + `FinanceSettingsRow`.
- Admin blijft exclusief `FinanceAdminShell`.
