# Slim Budget Instellen Engine v1

Status: voorstel voor implementatie (fase 1, truth-safe)  
Datum: 29-03-2026  
Scope: engine, datastromen en OpenAI-orchestratie voor budgetvoorstel (geen UI-design)

## 0. Doel en randvoorwaarden

We bouwen een voorstelgestuurde budget-setup flow:

- Budio maakt eerst een maandvoorstel
- gebruiker kan toepassen, aanpassen of opnieuw laten verdelen
- handmatig blijft mogelijk, maar secundair

Guardrails:

- geen tweede budgetwaarheid
- harde data > afgeleide data > forecast > AI-uitleg
- AI schrijft nooit direct naar de database
- hergebruik bestaande budget/forecast/services; minimale uitbreidingen
- budget blijft motorlaag, geen los AI-product

## 1. Architectuurvoorstel (één scherpe richting)

Kern: een dunne `BudgetSetupOrchestrator` bovenop bestaande services.

1. `BudgetSetupOrchestrator` haalt compacte basiscontext op.
2. Model krijgt alleen deze context + kleine toolset om extra context op te vragen.
3. Model retourneert strikt structured proposal output.
4. Proposal gaat door server-side validatie + mapping.
5. Pas na validatie: gecontroleerde persist via bestaande budget repository-flow.

Geen rule-explosion:

- geen grote if/else-beslisboom in frontend
- geen aparte budget-engine naast `computeBudgetPlan`
- model kiest zelf welke aanvullende contexttools nodig zijn

## 2. Dataflow (end-to-end)

1. Frontend start `startBudgetSetupSession({ monthStart, strategyHint? })`.
2. Orchestrator laadt `getBudgetSetupBaseContext` (compact).
3. Orchestrator start OpenAI run met tools.
4. Model doet 0..N tool-calls voor extra context.
5. Model levert `BudgetSetupProposalV1` (strict schema).
6. Backend valideert voorstel:
   - schema-validatie
   - geldige categorieën
   - non-negative bedragen
   - budgetbalans guardrails
   - confidence/needsReview flags
7. Backend maakt `ApplyPayload` (server-side mapping).
8. Bij `apply`:
   - `upsertBudgetPlanSettings(...)`
   - `resetMonthlyBudgetValues(...)`
   - `upsertMonthlyBudgetValue(...)` per categorie
   - `markForecastDirty("budget_save")`
9. Backend retourneert `applyResult + postApplySummary` (wat ingesteld is / wat aangepast werd / wat nog te finetunen is).

Idempotentie:

- gebruik `proposalId` + `applyIdempotencyKey`
- bij duplicate apply hetzelfde resultaat teruggeven i.p.v. dubbel schrijven

## 3. A. Context bootstrap (compact en truth-safe)

Doel: genoeg context voor eerste voorstel zonder data-dump.

`getBudgetSetupBaseContext` bevat:

- `month`: actieve maand (`monthStartIso`, progress)
- `scope`: `moneyViewScope`
- `incomeSnapshot`: bekende inkomsten samenvatting (inclusion-aware)
- `fixedAndSubscriptionsSnapshot`: bekende vaste lasten + abonnementen totaal
- `reservesSnapshot`: reserves/buffer/jaarlijkse lasten doelen (samengevat)
- `existingBudgetSnapshot`: bestaand mode + relevante overrides
- `variableTrendSnapshot`: top variabele categorieën 1-3 maanden (geaggregeerd, compact)
- `safetySnapshot`: safe-to-spend / aankomende risico-indicatie / confidence band
- `dataQualitySnapshot`: ontbrekende data, onzekerheden, confidence-indicators

Bronnen (bestaand):

- `services/budget-plan.ts` (`computeBudgetPlan`)
- `services/budget-plan-surface.ts` (`loadBudgetPlanForSurface`)
- `services/month-forecast-summary.ts`
- `services/safety-spend-window.ts`
- `services/reserve-surface.ts`
- bestaande budget repository read-routes

## 4. B. Toolingmodel (kleine set, model beslist)

Toolset v1:

- `getBudgetSetupBaseContext`
- `getIncomeBudgetContext`
- `getFixedCostsAndReservesContext`
- `getVariableCategoryTrendContext`
- `getBudgetStrategyContext`
- `getForecastSafetyContext`
- `getExistingBudgetPlanContext`
- `previewBudgetAllocation`
- `applyBudgetSetupProposal` (alleen via gecontroleerde apply-endpoint, niet door model direct)

Regel:

- frontend triggert alleen sessie/start + apply
- model vraagt aanvullende context via tools
- backend bepaalt toegestane tool-input, rate/limits en redactie

Toolcontract (compact):

```ts
type BudgetSetupToolContext = {
  userId: string;
  planKey: string; // default
  monthStartIso: string; // YYYY-MM-01
  moneyViewScope: "personal" | "household";
};

type PreviewBudgetAllocationInput = BudgetSetupToolContext & {
  strategy: "standaard" | "balans" | "bespaarmodus" | "handmatig";
  variableCategoryTargets: Array<{ categoryKey: string; amount: number }>;
  savingsTargetMonthly?: number | null;
};
```

## 5. C. Structured output contract (proposal)

`BudgetSetupProposalV1`:

```ts
type BudgetSetupStrategy = "standaard" | "balans" | "bespaarmodus" | "handmatig";

type SuggestedCategory = {
  categoryKey: string;
  suggestedAmount: number;
  basedOnTrend: boolean;
  trendWindowMonths: 1 | 2 | 3 | null;
  note?: string | null;
};

type BudgetSetupProposalV1 = {
  proposalId: string;
  selectedMode: BudgetSetupStrategy;
  rationale: string[]; // max 4 korte bullets
  expectedIncomeTotal: number;
  protectedAmounts: {
    fixedCosts: number;
    subscriptions: number;
    reserves: number;
    annualized: number;
  };
  reserveAdvice: {
    monthlyReserveTarget: number;
    reason: string;
  };
  variableBudgetPool: number;
  suggestedCategories: SuggestedCategory[];
  adjustmentNotes: string[];
  needsReviewFlags: Array<
    | "income_uncertain"
    | "high_fixed_ratio"
    | "low_buffer"
    | "missing_subscription_signal"
    | "thin_trend_data"
  >;
  confidence: {
    score: number; // 0..1
    level: "hoog" | "middel" | "laag";
    reasons: string[];
  };
  userSummary: string; // kort, menselijk, geen hypecopy
  applyPayload: {
    // gecontroleerd mappable equivalent, geen directe SQL-velden
    planSettings: {
      strategy: BudgetSetupStrategy;
      includeIncome: {
        salary: boolean;
        childBudget: boolean;
        structuralOther: boolean;
        variable: boolean;
      };
      savingsTargetMonthly: number | null;
      applySavingsTargetToVariableBudget: boolean;
    };
    monthlyVariableBudgets: Array<{ categoryKey: string; amount: number }>;
  };
};
```

Contractregels:

- `selectedMode="handmatig"` => geen autonome allocatiebeslissing; alleen suggesties indien gevraagd
- alle bedragen `>= 0`
- som `monthlyVariableBudgets.amount` = `variableBudgetPool` (na afronding)
- onbekende categorieën worden geweigerd vóór apply

## 6. D. Apply/commit flow (veilig en controleerbaar)

Nooit:

- model -> direct DB write

Altijd:

1. `validateBudgetSetupProposal(...)`
2. `mapProposalToBudgetPlanWriteModel(...)`
3. `persistBudgetSetup(...)` via bestaande repository calls

Concreet mappingpad naar bestaande waarheid:

- `strategy -> BudgetPlanMode`:
  - `standaard` -> `balanced`
  - `balans` -> `balanced` + hogere beschermings/sparen instellingen
  - `bespaarmodus` -> `active_savings`
  - `handmatig` -> `custom` (of bestaande custom-flow behouden)
- persist:
  - `upsertBudgetPlanSettings`
  - `resetMonthlyBudgetValues`
  - `upsertMonthlyBudgetValue` (variabel + evt. savings target waar passend)
  - `markForecastDirty("budget_save")`

Idempotentie:

- tabel/opslag voor `proposalId + monthStart + planKey + payloadHash`
- bij herhaalcall met zelfde hash: return eerder `applyResult`

## 7. E. Componentniveau support (zelfde patroon)

Zelfde orchestratorpatroon, kleinere scopes:

- slim inkomsten instellen:
  - tools focussen op inkomenstrend + inclusion settings
  - output alleen `includeIncome` + income assumptions voorstel
- slim vaste lasten/reserves instellen:
  - tools focussen op fixed/subscriptions/reserves
  - output alleen protected amounts + reserve advies
- slim budgetverdeling instellen:
  - tools focussen op variable pool + categorieverdeling
  - output alleen categorieallocatie + review flags

Voordeel:

- één contractfamilie
- één validatie/apply-pad
- geen parallelle “mini-engines”

## 8. F. Strategie-semantiek (lichtgewicht, geen zware regelengine)

`standaard`

- intentie: redelijk en stabiel, niet streng
- guardrail: laat voldoende variabele ruimte voor normale maand

`balans`

- intentie: meer bescherming voor buffer/reserves
- guardrail: iets conservatievere variabele allocatie

`bespaarmodus`

- intentie: scherper op terugbrengen variabele uitgaven
- guardrail: hogere voorkeur voor sparen/protectie, maar niet onder minimale leefruimte

`handmatig`

- intentie: gebruiker beslist
- guardrail: AI geeft alleen assistieve suggesties/uitleg, geen autonoom allocatiebesluit

Belangrijk:

- semantiek stuurt “houding”, niet nieuwe financiële waarheid
- berekeningen blijven in bestaande budget/forecast services

## 9. G. Default variabele categorieën

Selectie v1:

1. data-first: top variabele categorieën met stabiele uitgaven in laatste 1-3 maanden
2. shortlist fallback (indien te weinig data): `boodschappen`, `vervoer/brandstof`, `overig variabel`
3. max categorieën in voorstel: 4-6 (geen wildgroei)

Regels:

- alleen categorieën uit bestaande budgetgroep/categorie-mapping
- geen nieuwe categorie-taxonomie in orchestrator
- ontbrekende trenddata => `needsReviewFlags += thin_trend_data`

## 10. H. Risico’s en niet doen (fase 1)

Risico’s:

- mode-semantiek mismatch tussen productlabels en technische `BudgetPlanMode`
- te rijke contextpayload kan promptkosten/latency verhogen
- foutieve categorie-mapping kan tot ongeldige writes leiden
- gebruikersverwachting van “AI zekerheid” bij lage datakwaliteit

Mitigaties:

- duidelijke strategy->mode mappinglaag in één plek
- compacte bootstrap + on-demand tools
- strikte validator vóór persist
- expliciete `needsReviewFlags` + confidence reasons

Niet doen in fase 1:

- geen nieuwe budgetberekeningsengine
- geen autonome model-writes
- geen extra route/service renames puur voor copy
- geen complexe rule graph of policy DSL
- geen uitbreiding naar nieuwe financiële waarheid buiten bestaande services

## 11. Mapping naar bestaande services / bestanden

Leidend (hergebruik):

- `services/budget-plan.ts`
- `services/budget-plan-surface.ts`
- `services/budget-plan-repository.ts`
- `services/forecast-refresh.ts`
- `services/help-assistant-planner.ts`
- `services/help-assistant-hydration.ts`
- `services/help-assistant-orchestration-shared.ts`
- `services/budget-coach.ts` (json schema + retries patroon)
- `types/categorization.ts`
- `app/(tabs)/budget.tsx` (huidige apply-volgorde als referentie)

Minimale nieuwe bestanden (voorstel):

- `services/budget-setup-orchestrator.ts`
- `services/budget-setup-tools.ts`
- `services/budget-setup-proposal-schema.ts`
- `services/budget-setup-apply.ts`
- `services/budget-setup-orchestrator.test.ts`
- `services/budget-setup-apply.test.ts`

Minimale uitbreidingen:

- `types/categorization.ts` (alleen waar nodig voor voorsteltypes/strategy-union)
- openai-proxy/help-assistant integratiepunt voor tool-runner hergebruik

## 12. Handmatige teststrategie (engine)

1. Basispad: voorstel voor huidige maand met voldoende data
   - verwacht: valide proposal, heldere rationale, apply succesvol
2. Weinig data pad:
   - verwacht: fallback categorieën + `thin_trend_data` flag
3. Lage safety/buffer:
   - verwacht: balans/bespaarmodus adviseert meer bescherming
4. Handmatig pad:
   - verwacht: geen autonome allocatie, alleen assistieve suggestie
5. Idempotentie:
   - 2x apply met zelfde `proposalId/payloadHash` => geen dubbele writes
6. Recompute na apply:
   - budget/forecast worden refresh-marked en tonen consistent resultaat

## 13. Implementatieplan in kleine stappen

1. Contracts toevoegen
   - voorsteltype + validator + tool input/output types
2. Base context tool bouwen
   - compact snapshot via bestaande budget-plan-surface data
3. Extra contexttools bouwen
   - income, fixed/reserves, variable trends, forecast safety
4. Proposal run integreren
   - OpenAI tool orchestration + strict structured output
5. Apply pipeline bouwen
   - validate -> map -> persist -> markForecastDirty
6. Idempotentie toevoegen
   - opslag/check op `proposalId + payloadHash`
7. Tests
   - contracttests, mappingtests, apply/idempotentie, error paths
8. Feature toggle + rollout
   - eerst intern/beta, daarna gefaseerd openen

---

Dit ontwerp houdt budgettruth in de bestaande budget/forecast/services, gebruikt AI alleen voor voorstel/uitleg en blijft bewust klein voor fase 1.
