# All41 Hub — UX Deep Dive and Theme Migration Plan
Date: 2026-11-19
Branch: `feat/all41-hub-design-system`
Production: unchanged. Use review/preview before merging.

## Goal and non-negotiables
- Bring every Hub surface at `thescaleup.xyz/hub` into the same visual identity as `all41.app`.
- **Preserve the bottom navigation**: customizable four phone slots + More, tablet/desktop menu, URL/access filtering, safe-area clearance, hide-on-scroll, keyboard Escape, focus, active states.
- Do not change authentication, data access, customer records, subscription behavior, tasks/CRM/messaging/finance workflows or database schema.
- **Design via CSS variables/tokens, not scattered color literals in components.**
- Keep warm Airbnb-style spacing and Notion-like clarity; avoid excessive sticker illustrations in the actual work UI.
- Unauthenticated Hub pages remain fully functional. Never leak workspace data into marketing.

## Audit: what already existed
- `app/globals.css` had a sizeable Paper/Ink/Brand token system, utility styles, type sizes, status colors, radius and shadow tokens; legacy global marketing theme was dark.
- `components/brand/styles.ts` and `components/brand/primitives.tsx` provide shared buttons, cards, tags, fields, table helpers, alerts and page headers.
- `components/hub/brand-tabs.tsx` implements robust bottom navigation and must be left behaviorally intact.
- `components/hub/panels.tsx`, `components/hub/finance/views.tsx`, `components/hub/settings-shell.tsx`, `components/hub/section-list.tsx` are reusable module building blocks.
- The existing Hub uses **Bricolage Grotesque / Instrument Sans / JetBrains Mono**, legacy TheScaleUp logo, Paper-100 background and module-specific bright accent palettes.
- Existing `app/hub/b/[slug]/page.tsx` home uses permission-filtered signals (task due dates, unread mail, inventory, CRM follow-ups) and per-module tiles. We must not replace these with mock data.
- `app/hub/b/[slug]/layout.tsx` reads and enforces brand authorization on the server, and applies client-side `AccentScope`.
- No conventional automated tests were found in earlier repo audit; build completion is not complete browser acceptance.

## Changes in this branch (design-only)
1. `app/hub/all41-hub.css` creates Hub-scoped semantic tokens for four brand families and maps old Tailwind token names to the new values, preventing mass edits across existing modules.
2. `lib/all41-fonts.ts` loads Manrope (title), DM Sans (body), IBM Plex Mono (mono), Fraunces (editorial accent) **within the Hub only**.
3. `components/hub/all41-logo.tsx` adds a shared mark and wordmark, leaving unrelated product/archived logos untouched.
4. `app/hub/layout.tsx` switches Hub metadata/fonts and wraps scoped theme in `all41-hub` while preserving existing scroll container and iPhone viewport fit.
5. `components/hub/frame.tsx` uses All41 identity and new shell/toolbar styles; login logo updated too.
6. `components/hub/brand-tabs.tsx` receives only `all41-bottom-menu` presentation class; **no changes to menu behavior, menu order, routing, per-user choices, or permission logic**.
7. `components/hub/all41-ui.tsx` adds semantic, presentation-only `HubSection`, `HubSurface`, `HubKpi` that other modules can use progressively.
8. `app/hub/b/[slug]/page.tsx` turns Home into a warm workspace dashboard with real, pre-existing data and permission checks.
9. `app/hub/page.tsx` refreshes workspace picker using the same components.

## Final design contract
| Family | Canonical token | Hex |
|---|---|---|
| Identity | `--all41-identity` | `#F9703E` |
| Light | `--all41-light` | `#FAF9F6` |
| Dark | `--all41-dark` | `#262626` |
| Accent | `--all41-accent` | `#B8E4D1` |

Use semantic variants, not raw colors, to style component markup: `all41-surface`, `all41-module-card`, `all41-section-eyebrow`, existing `cardCls`, `btnCls`, `inputCls`, `Chip`. Color exceptions are legitimate warning/success/error states (semantic statuses, not brand families).

- Borders: token `--all41-hairline`
- Card radius: token `--all41-radius-card`
- Subtle card shadow: token `--all41-shadow-card`
- Floating bottom menu: token `--all41-shadow-float`
- Reduced motion must disable non-essential transforms/animations.
- Text and buttons must meet accessibility contrast. Don't use the light coral for body text on ivory.
- Stickers should be rare and non-interactive in productivity screens; icon clarity comes first.
- Tabs and permissions must remain identical across phone/tablet/desktop.

## Claude Code next steps: prioritised module refinements
1. **P0:** Test real login/account switcher, workspace navigation and mobile bottom bar on 320/375/390/768/1024/1440 widths, iOS safe area and browser back/forward. Fix any auth/font regressions before merge.
2. **P0:** Validate Tasks, CRM, Leads Finder, Email Campaigns, Inbox and Content on at least two isolated test tenants and distinct role permissions; test blocked routes and forbidden actions.
3. **P1:** Replace remaining module-local hardcoded CSS colors, sizes and radii with token-backed helpers *only after inspecting each module*. Run code searches for hex/rgb/inline style literals and generate a migration inventory; prioritize high-traffic modules.
4. **P1:** Standardize complex lists, filter toolbars, empty states, modals, calendar cells, emails and forms with existing shared styles and `HubSection/HubSurface`. Do not flatten specialized UX.
5. **P1:** Extract repeatable KPI and activity views and provide an optional Founder Daily Brief with real data only; never display unverified metrics.
6. **P1:** Tablet/mobile table overflow and inset padding; CTA and input hit targets >=44px; keyboard support and focus indicators.
7. **P1:** Visual QA against the first All41 website reference on real pages, including sticky toolbars, scroll position, dark-mode inheritance, overlay z-index, and loading states.
8. **P2:** Optional sticker/illustration treatment in onboarding and empty states only; no sticker saturation in data-heavy views.
9. **P2:** Route and metadata transition to All41 domain separately when auth, callbacks, custom domain routing and 3rd-party redirects have E2E coverage.

## Release / QA gate
- Vercel branch Preview READY; pnpm build and typecheck if possible.
- Auth protected routes: anonymous must redirect to login; role-based menus and permissions unchanged; cross-tenant access denied.
- Desktop and mobile screenshots reviewed by the owner.
- Test bottom bar navigation, edit menu selection, More, hide-on-scroll, keyboard Escape/focus, safe-area.
- Test email/password/login-code, invite, token expiry; do not assume prior email issues resolved.
- Verify no new Supabase migrations and no server-side fetch changes in this visual pass.
- Test task creation, CRM, sends/inbox and finance smoke paths after theme changes.
- Only merge after explicit readiness. No production deploy in this branch until validated.

## Known limitations
- This branch is an initial **foundation + Home + shell refresh**, not a verified pixel-perfect redesign of every route.
- Some legacy pages use their own local accents/layouts and require a deliberate migration audit.
- Brand-wide four-font token inheritance needs browser screenshots across representative pages; compilation alone cannot prove proper typography.
- User-supplied sticker art belongs on the public marketing site; Hub uses compact icons to preserve workspace usability.
