# Design System Strategy: Soft Tech & Tactile Premium

## 1. Overview & Creative North Star: "The Human Algorithm"
This design system rejects the cold, sterile nature of traditional technology interfaces in favor of "The Human Algorithm." Our North Star is a digital environment that feels like a high-end physical object—soft to the touch, responsive to light, and inherently approachable. 

We break the "template" look by abandoning rigid boxes and harsh dividers. Instead, we use **organic layering**, **intentional asymmetry** in image placement, and **dramatic typographic scale** to create an editorial experience. The interface doesn't just display data; it curates an atmosphere of 'spaarzaamheid' (mindfulness/thrift) and growth, where the vibrant yellow accent serves as a sun-like catalyst for action against a serene, misty backdrop.

---

## 2. Colors & Surface Philosophy
The palette is rooted in a "High-Value Neutral" foundation, using subtle shifts in temperature to guide the eye.

### The "No-Line" Rule
**Explicit Instruction:** 1px solid borders are strictly prohibited for sectioning. Definition must be achieved through background shifts. For example, a section using `surface-container-low` (#eff1f2) should sit directly against the `surface` (#f5f6f7) background. This creates a "molded" look rather than a "drawn" one.

### Surface Hierarchy & Nesting
Treat the UI as a series of nested, physical layers. 
- **Base:** `surface` (#f5f6f7)
- **Secondary Content:** `surface-container-low` (#eff1f2)
- **Interactive Elevated Cards:** `surface-container-lowest` (#ffffff)
- **Deep Insets:** `surface-dim` (#d1d5d7) for search bars or footer areas to create a sense of groundedness.

### The "Glass & Gradient" Rule
To achieve the "Soft Tech" feel, use **Backdrop Blurs** (20px–40px) on navigation bars and floating modals using `surface` at 80% opacity. 
*   **Signature Texture:** Use a linear gradient for primary CTAs: `primary` (#6d5a00) to `primary_dim` (#5f4e00) at a 135-degree angle. This adds a subtle "sheen" that flat colors lack, suggesting a tactile, satin-finish material.

---

## 3. Typography: Editorial Authority
We pair the geometric precision of **Plus Jakarta Sans** with the functional warmth of **Manrope**.

*   **The Power Scale:** Use `display-lg` (3.5rem) for hero moments to create a "magazine cover" feel. High contrast between a `display-lg` headline and `body-md` description is essential for the premium aesthetic.
*   **Headlines (Plus Jakarta Sans):** These are our "Voice." They should feel bold and intentional. Use `headline-lg` for section headers to establish clear hierarchy without needing lines.
*   **Body & Labels (Manrope):** Chosen for its high legibility and friendly terminals. `body-lg` is your workhorse for storytelling, while `label-md` (0.75rem) should be used for metadata, always in `on-surface-variant` (#595c5d) to maintain a soft visual noise level.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are too "digital." We use light and tone to imply three-dimensionality.

*   **The Layering Principle:** Depth is achieved by "stacking." A card using `surface-container-lowest` (#ffffff) placed on a `surface-container` (#e6e8ea) background creates a natural, soft lift.
*   **Ambient Shadows:** If a floating element (like a FAB or Popover) requires a shadow, use a "Ghost Shadow": `color: #0c0f10 (on-surface)`, `opacity: 4%`, `blur: 40px`, `y-offset: 12px`. It should feel like a soft glow of occlusion, not a dark smudge.
*   **The "Ghost Border" Fallback:** For accessibility in form fields, use `outline-variant` (#abadae) at **20% opacity**. It should be barely perceptible, serving as a hint rather than a wall.
*   **Glassmorphism:** Use for "floating" navigation. Use `surface-container-lowest` at 70% opacity with a `saturate(180%) blur(20px)` filter.

---

## 5. Components: Tactile Interactivity

### Buttons: The "Soft Press"
*   **Primary:** Uses `primary` (#6d5a00) with `on-primary` (#fff2ce) text. Corner radius must be `full` (9999px) for a "pill" shape that feels friendly.
*   **Secondary:** No background. Use a `surface-container-highest` (#dadddf) background on hover only.

### Cards: The "Molded" Look
*   **Constraint:** Zero borders.
*   **Style:** Use `rounded-xl` (3rem) for large layout containers and `rounded-lg` (2rem) for standard cards. 
*   **Separation:** Use Spacing `10` (3.5rem) to separate card groups. Do not use dividers.

### Input Fields: Soft Insets
*   **Background:** `surface-container-low` (#eff1f2).
*   **Shape:** `rounded-md` (1.5rem).
*   **State:** On focus, transition the background to `surface-container-lowest` (#ffffff) and apply the "Ghost Border" at 40% opacity.

### Additional Signature Component: The "Growth Progressor"
Given the focus on 'spaarzaamheid' (growth/thrift), use a custom progress bar:
*   **Track:** `surface-container-highest` (#dadddf), height: 8px, `rounded-full`.
*   **Indicator:** A gradient from `primary` (#6d5a00) to `inverse_primary` (#fdd404).

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical margins (e.g., 10% left, 15% right) for editorial layouts.
*   **Do** use the Dutch language with a tone of "Warm Professionalism" (e.g., use "Laten we beginnen" instead of "Starten").
*   **Do** allow the yellow `primary_container` (#fdd404) to breathe; it is a highlight, not a flood.

### Don’t:
*   **Don’t** use black (#000000). Use `inverse-surface` (#0c0f10) for maximum contrast moments.
*   **Don’t** use sharp corners. Even the smallest elements should have at least `rounded-sm` (0.5rem).
*   **Don’t** use dividers (`<hr>`). Use a background color shift or a Spacing `8` (2.75rem) gap to define "New Thought."
*   **Don’t** crowd the interface. If it feels busy, increase the spacing token by two levels.