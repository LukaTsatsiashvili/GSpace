# GSpace development conventions

## Consistent UI (required)

- Reuse established shared components across modules. A control with the same purpose must have the same appearance, interaction patterns, hover and focus states across the application.
- Use the shared `Input`, `NumberInput`, `SearchInput`, `Textarea`, `Select`, `Checkbox`, and `Button` components from `apps/web/src/components/ui.tsx` when implementing forms. Extend those components centrally for new common variants rather than creating browser-native dropdowns or one-off copies.
- For all numeric fields (prices, money, quantity, lifetime, budgets and other numbers), use `NumberInput`, not native `<input type="number">` or `<Input type="number">`. It preserves native numeric semantics (including `min`, `max`, `step` and keyboard validation) but hides browser spin controls and displays a single, thin theme-aware focus border without an extra outline or glow.
- All checkbox controls must use the shared `Checkbox` component, preserving native checkbox semantics, label-click and keyboard interaction; do not style raw `input[type="checkbox"]` in individual modules. The global `ui-checkbox` style in `apps/web/src/styles.css` controls checked, unchecked, hover, focus and disabled states. List item selected states may still be styled per layout.
- Dropdown options must use the application's custom themed menu, not the browser's native `<select>` popup. Menus must stay visible above dialogs, not be clipped by scrolling containers, and work with keyboard and mouse.
- Ordinary text, email, date and other standard fields must use the existing shared `Input` component; multi-line fields must use shared `Textarea`. Do not create module-specific copies or use raw text inputs in forms.
- The shared `Input`/`Textarea` styling in `apps/web/src/styles.css` owns default, hover, focus, disabled and error states. Use `aria-invalid="true"` for an error border; focus must show exactly one thin accent border (no additional outline or box-shadow). Local form styles may set dimensions or layout only, never duplicate focus, border, background or shadow rules.
- Inputs use thin, theme-aware borders and restrained focus indicators. Do not add thick double borders or browser-default visual styling.
- Match the existing GSpace color tokens, typography, spacing, responsiveness, and accessibility patterns. Keep modal layouts and footers consistent with approved reference designs.
- Changes to common control styling must be checked in the Resources catalog filters and Add Resource wizard to avoid regressions.

## Workflow

- Implement and test new features on a dedicated feature branch based on `GSpace-production`.
- Do not merge into `GSpace-production` before the user's explicit approval.
- UI preview data and actions must not claim persistence or upload files until an authenticated API is implemented.
- Every transient application notification (success, error, warning, info) must use the shared `useToast` API in `apps/web/src/components/toast.tsx`. Do not introduce new full-width or module-specific success banners. Keep field validation errors inline, and preserve explicit modal confirmations where necessary.
