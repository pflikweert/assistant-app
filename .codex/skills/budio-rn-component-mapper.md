# Budio RN Component Mapper Skill

Gebruik deze skill om Stitch-schermstructuur te vertalen naar React Native/Expo componentmapping voor Budio.

## Doel

- `stitch screen -> RN component-structuur + mapping-notes`
- Geen web-first defaults zoals Tailwind of Framer Motion als uitgangspunt.

## Input

- Stitch referentie:
  - project id
  - screen id
  - optioneel html/screenshot
- Schermcontext:
  - hoofdscherm of utility/detail/modal

## Output

- `design_refs/proposals/{screen}/{variant}/rn-component-mapping.md`
- Inhoud bevat:
  - shell-keuze
  - componenthierarchie
  - mapping naar bestaande Budio componenten
  - lijst van eventuele ontbrekende generieke componenten
  - implementatierisico's

## Mappingregels

- Gebruik bestaande Budio componenten eerst.
- Map naar React Native/Expo patterns, niet naar web utility classes.
- Houd businesslogica buiten UI-mapping.
- Respecteer design tokens uit `constants/theme.ts`.
- Zichtbare copy standaard Nederlands.

## Outputformat (vast)

1. Schermtype + shell.
2. Hoofdblokken top/midden/onder.
3. Component mapping tabel:
   - Stitch blok
   - Budio component
   - status (`canoniek`, `in gebruik`, `legacy`)
4. Gaps:
   - alleen generieke, herbruikbare componentkandidaten
5. Risico's en handmatige verificatie.

## Wat we geleerd hebben

- 1-op-1 HTML-overname geeft ruis; structurele mapping naar bestaande primitives werkt beter.
- RN output blijft consistenter als shell-keuze eerst wordt vastgezet.
- Web-specifieke animatie- of stylingterminologie veroorzaakt onnodige implementatieafwijking.
