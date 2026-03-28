# Forecast Confidence & Explainability: AI Guardrails

## Doel
Deze guardrails borgen dat Fase F rule-based en testbaar blijft.

## Waar AI later wel mag helpen
- labels verbeteren voor bestaande explanation-items
- mensentaal samenvattingen schrijven op basis van al berekende uitkomsten
- merchant/category clustering als suggestielaag
- suggesties voor mogelijke jaarlijkse lasten (nooit automatisch financieel leidend)

## Waar AI nooit de bron van waarheid is
- `expectedEndOperationalBalance` berekening
- `currentReservedBalance` berekening
- `freeToSpendNow` berekening
- `currentNetWorth` berekening
- confidence-levels (`high|medium|low`) als primaire score
- anti-double-counting in forecast event-normalization

## Verplichte pipeline
1. Rule-based detectie en berekening in services.
2. Rule-based confidence en provenance toekennen.
3. Canonieke summary produceren.
4. Optioneel AI gebruiken voor tekst/label-verbetering bovenop die summary.

AI-output mag nooit direct financiële kernwaarden overschrijven.
