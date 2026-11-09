# GSpace development conventions

## Consistent UI (required)

- Reuse established shared components across modules. A control with the same purpose must have the same appearance, interaction patterns, hover and focus states across the application.
- Use the shared `Input`, `NumberInput`, `SearchInput`, `Textarea`, `Select`, and `Button` components from `apps/web/src/components/ui.tsx` when implementing forms. Extend those components centrally for new common variants rather than creating browser-native dropdowns or one-off copies.
- For all numeric fields (prices, money, quantity, lifetime, budgets and other numbers), use `NumberInput`, not native `<input type="number">` or `<Input type="number">`. It preserves native numeric semantics (including `min`, `max`, `step` and keyboard validation) but hides browser spin controls and displays a single, thin theme-aware focus border without an extra outline or glow.
- Dropdown options must use the application's custom themed menu, not the browser's native `<select>` popup. Menus must stay visible above dialogs, not be clipped by scrolling containers, and work with keyboard and mouse.
- Inputs use thin, theme-aware borders and restrained focus indicators. Do not add thick double borders or browser-default visual styling.
- Match the existing GSpace color tokens, typography, spacing, responsiveness, and accessibility patterns. Keep modal layouts and footers consistent with approved reference designs.
- Changes to common control styling must be checked in the Resources catalog filters and Add Resource wizard to avoid regressions.

## Workflow

- Implement and test new features on a dedicated feature branch based on `GSpace-production`.
- Do not merge into `GSpace-production` before the user's explicit approval.
- UI preview data and actions must not claim persistence or upload files until an authenticated API is implemented.
