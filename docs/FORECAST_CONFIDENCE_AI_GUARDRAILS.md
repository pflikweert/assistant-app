# Forecast Confidence & Explainability: AI Guardrails

## Doel

Deze guardrails borgen dat de forecaststack rule-based, uitlegbaar en testbaar blijft.

## Waar AI later wel mag helpen

- labels verbeteren voor bestaande explanation-items
- mensentaal samenvattingen schrijven op basis van al berekende uitkomsten
- merchant/category clustering als suggestielaag
- suggesties voor mogelijke jaarlijkse lasten, nooit automatisch financieel leidend
- formulering verbeteren bovenop al berekende reserve- of zeldzame-abonnementssignalen

## Waar AI nooit de bron van waarheid is

- `expectedEndOperationalBalance` berekening
- `currentReservedBalance` berekening
- `freeToSpendNow` berekening
- `currentNetWorth` berekening
- confidence-levels als primaire financiële score
- anti-double-counting in forecast event-normalization
- keuze van `riskFlag` of `cashRiskFlag`
- `MoneyViewScope`, accountrollen of money-layer interpretatie
- reserve-rule bedragen of hun activestatus
- detectie-uitkomst die geboekte transacties of committed events overschrijft

## Verplichte pipeline

1. Rule-based detectie en berekening in services.
2. Rule-based confidence en provenance toekennen.
3. Canonieke summary produceren.
4. Optioneel AI gebruiken voor tekst- of labelverbetering bovenop die summary.

AI-output mag nooit direct financiële kernwaarden overschrijven.

## Extra guardrails voor de huidige forecaststack

- `forecast-event-normalization` blijft leidend voor canonical events, certainty en anti-dubbeltelling.
- `rare-subscriptions` mag alleen aanvullende signalen leveren; het mag geen geboekte waarheid vervangen.
- `reserve-rules` blijft een expliciete, rule-based laag die stil en defensief terugvalt bij ontbrekende storage.
- explainability-services mogen mensentaal genereren, maar alleen bovenop al berekende financiële uitkomsten.
