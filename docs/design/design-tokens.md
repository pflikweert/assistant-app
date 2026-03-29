# Design Tokens

Dit document documenteert de design tokens die nu werkelijk in de codebase bestaan. De primaire bron is `constants/theme.ts`.

## Bron van waarheid

- primaire bron:
  - `constants/theme.ts`
- primaire exports:
  - `FinTokens`
  - `FinColors`
  - `FinSpacing`
  - `FinRadius`
  - `FinTypography`
  - `FinFontWeight`
  - `FinIconSize`
  - `FinSurfaces`

## Kleurensysteem

### Basis en surfaces

| token | waarde | gebruik |
| --- | --- | --- |
| `bgBase` | `#f6f5f2` | app-basisachtergrond |
| `topBarBg` | `#f7f9fb` | topbars en translucent header-shells |
| `bgCard` | `#ffffff` | primaire kaarten en elevated surfaces |
| `bgElevated` | `#efede7` | zachte elevated sections en hero-achtergronden |
| `bgInput` | `#f1efea` | inputs, subtiele keuzevlakken, icon wraps |
| `bgCardSoftCool` | `#f1f4f6` | grotere gekleurde kaarten op hoofdschermen |
| `surface` | alias van `bgCard` | canonieke surface-token |
| `surfaceSoft` | alias van `bgElevated` | zachte surface |
| `surfaceMuted` | alias van `bgInput` | subtiele surface |
| `surfaceSoftCool` | alias van `bgCardSoftCool` | koel getinte hoofdkaart |

### Tekst

| token | waarde | gebruik |
| --- | --- | --- |
| `textPrimary` | `#111111` | primaire titels, bedragen, CTA-tekst |
| `textSecondary` | `#5f5a54` | secundaire context en uitleg |
| `textMuted` | `#6f6a63` | ondersteunende metadata |

### Accent en semantiek

| token | waarde | gebruik |
| --- | --- | --- |
| `yellow` | `#f2c94c` | accent, primaire CTA, focus |
| `yellowSoft` | `#fff5cc` | zachte accentachtergrond |
| `warningBg` | `#fff8dd` | waarschuwing-achtergrond |
| `warningBorder` | `rgba(242,201,76,0.34)` | warning-border |
| `warningText` | `#8a6400` | warning/accent tekst |
| `green` | `#2f7d57` | success |
| `greenBg` | `rgba(47,125,87,0.10)` | success-background |
| `greenBorder` | `rgba(47,125,87,0.18)` | success-border |
| `red` | `#c55d4c` | danger |
| `redBg` | `rgba(197,93,76,0.10)` | danger-background |
| `redBorder` | `rgba(197,93,76,0.18)` | danger-border |
| `accent` | alias van `yellow` | functioneel accent |
| `accentText` | alias van `warningText` | accent-tekst |
| `success` | alias van `green` | success |
| `warning` | alias van `warningText` | warning |
| `danger` | alias van `red` | danger |
| `info` | `#4f73b8` | beperkt aanwezig, nog geen breed productpatroon |
| `statusGoodBg` | `#e7f3a8` | positive status-chip achtergrond |
| `statusGoodText` | `#5b6a1b` | positive status-chip tekst |

### Borders, overlays en navigatie

| token | waarde | gebruik |
| --- | --- | --- |
| `border` | `#dedad2` | zichtbare border |
| `borderSubtle` | `rgba(17,17,17,0.08)` | subtiele scheiding |
| `overlayBackdrop` | `rgba(17,17,17,0.28)` | lichte overlay/backdrop |
| `overlayStrong` | `rgba(17,17,17,0.45)` | sterkere overlay |
| `surfaceOverlay` | `rgba(17,17,17,0.04)` | subtiele overlay op oppervlak |
| `tabBg` | `#ffffff` | tab-oppervlak |
| `tabActive` | `#111111` | actieve tab-icon/tekst |
| `tabInactive` | `#8f8a83` | inactieve tab-icon/tekst |

### Budget-specifieke kleurcontracten

| token | waarde |
| --- | --- |
| `budgetProgressTrack` | `#e3e9ec` |
| `budgetProgressGood` | `#10b981` |
| `budgetProgressWatch` | `#f9e287` |
| `budgetProgressCritical` | `#c55d4c` |
| `budgetProgressNeutral` | `#6f6a63` |

### Switch-kleuren

| token | waarde |
| --- | --- |
| `switchTrackOff` | `#d7d7d7` |
| `switchTrackOn` | `#f1d96a` |
| `switchThumbOff` | `#f4f4f4` |

## Light en dark

- `Colors.light` en `Colors.dark` zijn momenteel functioneel gelijk.
- Er is dus op dit moment **geen echt apart dark-mode designcontract**.
- Nieuwe product-UI moet dit niet lezen als “twee uitgewerkte thema’s”, maar als één light-first systeem met een placeholder-achtige dark export.

## Spacing-schaal

De spacing is 4px-grid-afgeleid.

### Canonieke schaal

| token | waarde |
| --- | --- |
| `none` | `0` |
| `xxs` | `4` |
| `xs` | `8` |
| `xs-plus` | `10` |
| `s` | `12` |
| `s-plus` | `14` |
| `m` | `16` |
| `m-plus` | `20` |
| `l` | `24` |
| `l-plus` | `28` |
| `xl` | `32` |
| `2xl` | `40` |
| `3xl` | `48` |
| `4xl` | `64` |

### Backward-compatible aliases

| alias | waarde |
| --- | --- |
| `x0` | `0` |
| `x1` | `4` |
| `x2` | `8` |
| `x3` | `12` |
| `x4` | `16` |
| `x5` | `20` |
| `x6` | `24` |
| `x7` | `28` |
| `x8` | `32` |
| `x9` | `36` |
| `x10` | `40` |
| `x12` | `48` |
| `x14` | `56` |
| `x16` | `64` |
| `x20` | `80` |
| `x32` | `128` |

## Radius-schaal

| token | waarde | gebruik |
| --- | --- | --- |
| `sm` | `8` | compacte elementen |
| `md` | `12` | kleine controls |
| `lg` | `16` | kleinere cards en icon-wraps |
| `xl` | `20` | middelgrote cards |
| `xxl` | `24` | grotere cards |
| `sheet` | `34` | bottom-sheet top corners |
| `pill` | `999` | pills, chips, ronde CTA’s |

## Typography

### Type scale

| token | fontSize | lineHeight | letterSpacing |
| --- | --- | --- | --- |
| `label` | `12` | `16` | `1.2` |
| `caption` | `12` | `16` | `0.2` |
| `body-sm` | `14` | `20` | `0.1` |
| `body` | `16` | `24` | `0.1` |
| `body-lg` | `18` | `26` | `0` |
| `title-sm` | `20` | `28` | `-0.2` |
| `title` | `24` | `32` | `-0.4` |
| `h3` | `28` | `36` | `-0.6` |
| `h2` | `34` | `42` | `-0.8` |
| `h1` | `44` | `52` | `-1.1` |

### Font weights

| token | waarde |
| --- | --- |
| `regular` | `400` |
| `medium` | `500` |
| `semibold` | `600` |
| `bold` | `700` |
| `extrabold` | `800` |
| `black` | `900` |

### Interpretatie

- `FinanceText` volgt deze schaal en is de canonieke tekstprimitive.
- Grote hero- en metric-teksten gebruiken in de codebase soms nog grotere route-specifieke waarden. Die zijn `in gebruik`, maar maken nog geen formeel tokenonderdeel uit.

## Icon sizing

| token | waarde |
| --- | --- |
| `xs` | `12` |
| `sm` | `16` |
| `md` | `20` |
| `lg` | `24` |
| `xl` | `28` |

### Interpretatie

- `AppIcon` is de gedeelde icon primitive.
- In de codebase komen daarnaast ook veel handmatige icon sizes zoals `18`, `22` en `30` voor.
- Die maten zijn breed in gebruik, maar niet formeel getokenized. Behandel ze als `legacy token debt` of als toekomstige normalisatiekandidaat.

## Shadows en elevation

### Gedeelde surfaces

| token/pattern | waarde |
| --- | --- |
| `FinSurfaces.topLevelCard` | `0px 6px 12px rgba(17,17,17,0.03)`, `elevation: 1` |
| `FinSurfaces.mainPageTintedCard` | `0px 5px 12px rgba(17,17,17,0.04)`, `elevation: 1` |

### Terugkerende shell shadows

| pattern | waarde |
| --- | --- |
| topbars/detail-topbars | `0px 10px 20px rgba(17,17,17,0.06)` |
| bottom sheet | `0px -12px 32px rgba(17,17,17,0.10)` |
| quick menu | `0px 10px 22px rgba(17,17,17,0.12)` |

### Interpretatie

- Schaduwen zijn subtiel en ondersteunend.
- Als een oppervlak al duidelijk genoeg is via kleur en radius, heeft het meestal geen zware shadow nodig.

## Legacy token debt

De volgende categorieën horen niet bij het formele tokencontract, ook al komen ze in de codebase voor:

- ruwe hex-kleuren in schermen en componenten
- route-specifieke `rgba(...)` waarden
- eigen card-kleuren in insight-, auth-, modal- en helperblokken
- handmatige text sizes buiten `FinTokens.typography`
- handmatige icon sizes buiten `FinTokens.icon`

Gebruik ze niet als nieuwe standaard. Documenteer ze als bestaand gedrag dat later genormaliseerd kan worden.
