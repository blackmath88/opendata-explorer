---
name: Public Service Intelligence
colors:
  surface: '#fcf9f2'
  surface-dim: '#dcdad3'
  surface-bright: '#fcf9f2'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3ec'
  surface-container: '#f1eee7'
  surface-container-high: '#ebe8e1'
  surface-container-highest: '#e5e2db'
  on-surface: '#1c1c18'
  on-surface-variant: '#414944'
  inverse-surface: '#31312c'
  inverse-on-surface: '#f3f0e9'
  outline: '#717974'
  outline-variant: '#c0c8c2'
  surface-tint: '#396755'
  primary: '#134333'
  on-primary: '#ffffff'
  primary-container: '#2d5b49'
  on-primary-container: '#a0d1ba'
  inverse-primary: '#a0d1ba'
  secondary: '#5f5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2dfde'
  on-secondary-container: '#636262'
  tertiary: '#3e3b34'
  on-tertiary: '#ffffff'
  tertiary-container: '#55524b'
  on-tertiary-container: '#cbc5bc'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bcedd6'
  primary-fixed-dim: '#a0d1ba'
  on-primary-fixed: '#002116'
  on-primary-fixed-variant: '#204f3e'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#e8e2d8'
  tertiary-fixed-dim: '#cbc6bc'
  on-tertiary-fixed: '#1e1b16'
  on-tertiary-fixed-variant: '#4a463f'
  background: '#fcf9f2'
  on-background: '#1c1c18'
  surface-variant: '#e5e2db'
  panel-surface: '#fbfaf7'
  ui-border: '#d9d5cc'
  divider-soft: '#ece8df'
  accent-wash: '#dfe9e3'
  status-warn: '#8a5f2d'
  status-danger: '#7f443a'
  gov-slate: '#334155'
typography:
  headline-page: { fontFamily: Inter, fontSize: 20px, fontWeight: '650', lineHeight: '1.2', letterSpacing: -0.01em }
  headline-section: { fontFamily: Inter, fontSize: 16px, fontWeight: '650', lineHeight: '1.3' }
  headline-card: { fontFamily: Inter, fontSize: 14px, fontWeight: '700', lineHeight: '1.4' }
  body-strong: { fontFamily: Inter, fontSize: 13px, fontWeight: '650', lineHeight: '1.45' }
  body-base: { fontFamily: Inter, fontSize: 13px, fontWeight: '400', lineHeight: '1.45' }
  label-ui: { fontFamily: Inter, fontSize: 12px, fontWeight: '500', lineHeight: '1.2' }
  caption-meta: { fontFamily: Inter, fontSize: 11px, fontWeight: '400', lineHeight: '1.3' }
  eyebrow-caps: { fontFamily: Inter, fontSize: 10px, fontWeight: '600', lineHeight: '1.0', letterSpacing: 0.1em }
  utility-data: { fontFamily: Inter, fontSize: 10px, fontWeight: '400', lineHeight: '1.0' }
  viz-label: { fontFamily: Inter, fontSize: 10px, fontWeight: '500', lineHeight: '1.0' }
  viz-sub: { fontFamily: Inter, fontSize: 8px, fontWeight: '400', lineHeight: '1.0' }
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gap-xs: 4px
  gap-sm: 8px
  gap-md: 12px
  gap-lg: 18px
  gap-xl: 24px
  margin-page: 24px
  header-height: 72px
  rail-width: 72px
  sidebar-width: 380px
---

## Brand & Style

The design system is anchored in a **Premium Public Service SaaS** aesthetic—a high-fidelity evolution of Swiss design principles tailored for modern data governance. The brand personality is **reliable, transparent, and authoritative**, moving away from "tech-startup" whimsy toward a "Government Slate" discipline.

The visual style is a hybrid of **Minimalism** and **Tactile Paper**, utilizing layered backgrounds and crisp, fine-lined borders to create depth. It prioritizes clarity and institutional trust, ensuring that complex data feels accessible but serious. Every element is designed to evoke the feeling of a well-organized digital workbench where precision is the primary value.

## Colors

The palette is rooted in **Basel-inspired neutrals**, providing a calm, non-fatiguing environment for deep data analysis.

- **Primary Action:** Forest Green (`#2d5b49`) is reserved for high-intent actions, signaling growth, stability, and institutional approval.
- **Surface Strategy:** The system uses a layered approach. The base background is the warm `#f4f1ea`, while active panels and interactive surfaces use the lighter `#fbfaf7` to "lift" content toward the user.
- **Government Slate:** A structured neutral (`#334155`) is used for high-contrast text and UI boundaries where absolute clarity is required.
- **Categorical Colors:** Environmental and infrastructure data use desaturated, earthy tones to maintain a cohesive professional aesthetic.

## Typography

Use a disciplined **Inter** type stack. Establish hierarchy through precise weight variations and subtle scale shifts rather than dramatic size changes.

- Most interface copy lives between 11px and 14px.
- Use `viz-label` and `viz-sub` for dense visualization labels.
- Use `eyebrow-caps` for structural category labels.

## Layout & Spacing

Use a fixed-viewport grid with internal scrolling containers for professional workflows.

- **Primary Structure:** 72px side rail, 380px contextual sidebar, fluid visualization canvas.
- **Rhythm:** Favor 12px, 18px and 24px increments.
- **Breakpoints:** Narrow rail/sidebar on tablets; sidebar may become an overlay on mobile.

## Elevation & Depth

Avoid heavy shadows. Use tonal layering, subtle blur and 1px borders (`#d9d5cc`) to indicate depth and focus.

## Shapes

- Large wrappers: 16–18px radius.
- Buttons/cards: 12–16px radius.
- Status and system tags: pill shapes.
- Borders: consistent 1px technical-drawing stroke.

## Components

- Primary buttons: `#2d5b49` with white text.
- Secondary buttons: 1px dark border.
- Sidebar cards: `#fbfaf7`, subtle dividers/borders.
- Inputs: rounded wrapper with primary-green inset focus.
- Side rail: 18px stroke glyphs in 48×48px hit targets.
- Status badges: `accent-wash` for positive states; warn/danger tints when semantic.
- Iconography: geometric, minimalist, consistent 1–1.5px stroke.
