# Budget Beheer — Variant B

## Stitch Preview

- project: `12076228720239525233`
- screen: `f2c70c0240464b53a9a67bffda473f2a` (gegenereerd als titel `Budget Beheer Variant B2`)
- preview: https://lh3.googleusercontent.com/aida/ADBb0uj_HgS3Tw4NbQxLzGOKOMxj_iSKnHRqW2YXvlYKLxJ1heB-ka3tnrTl6YR3G64esTfVCrIIyy0Cs-_8Md6XVexw2Z2DQXwiQhx_fX5jyHTXiNVZGA1HD1Tl39LXU8Cs2AfcF9dpupdoQHttEIChgv784gCz3mWeTECw6OIW8wqAk2hNjCDd3RlyKqpurwkjdQwM2dNyh50XgtIt2IFnE3DwRrsK4-PS9MXApFpy7uLnpCkHUTTUyfpVI38w

## Concept

Data-first / structuur-first.

Doel: gebruiker ziet eerst in één oogopslag of de maandverdeling klopt, en pas daarna de instelknoppen.

## Layout structuur

1. **Bovenste statusblok**
   - compacte “Beheerstatus” kaart:
     - inkomend budget
     - ingepland totaal
     - resterende ruimte
     - duidelijke statuslabel (`Op schema` / `Let op`)
2. **Instellingen kern**
   - Budgetmodus + spaardoel
   - Inkomstenbasis
3. **Categorieverdeling**
   - Categorie-inputs met bestaande lock/trend acties
   - `Herstel trendbedragen` in dezelfde sectie
4. **Reservebeheer**
   - Jaarlijkse lasten als aparte beheerkaart
5. **Primair slot**
   - vaste `Opslaan` actie

## Component gebruik

- Behouden:
  - bestaande summary rows, mode controls, income chips, category edit rows, reserve sheet
- Herordenen:
  - maandverdeling van midden naar topprioriteit
  - trenduitleg compacter in categorie-sectie
- Vereenvoudigen:
  - minder losse helperregels tussen kaarten

## Wat is beter

- Directe duidelijkheid over impact van instellingen.
- Minder kans dat gebruiker instellingen wijzigt zonder te zien wat het effect is.
- Betere scanbaarheid voor mensen die op maandruimte sturen.
