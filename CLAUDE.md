# EstateLogic — Claude Instructions

## Project overview

EstateLogic is a React Native + Expo app for property management. It serves two roles:
- **Owner** — manages properties, tenants, finances, and maintenance issues
- **Tenant** — pays rent, raises maintenance requests, views their lease

Backend is **Supabase** (Postgres + Auth + RLS). The app uses Supabase JS v2.

## Running the app

```bash
npm start          # Expo dev server (scan QR with Expo Go)
npm run ios        # iOS simulator
npm run android    # Android emulator
```

## Project structure

```
src/
  context/AuthContext.js      # Auth + role state; provides user, role, refetchRole, clearRole
  lib/supabase.js             # Supabase client (singleton)
  navigation/
    RootNavigator.js          # Login → RoleSelection → OwnerNavigator | TenantNavigator
    OwnerNavigator.js         # Bottom tabs: Portfolio, Residents, Finance, Issues, Profile
    TenantNavigator.js        # Bottom tabs: Dashboard, Payments, Maintenance, Profile
  screens/
    auth/                     # LoginScreen, RoleSelectionScreen
    owner/                    # OwnerDashboard, ResidentDataScreen, TenantOnboardingScreen,
                              #   FinanceOverviewScreen, ResidentIssuesScreen
    tenant/                   # TenantDashboard, RentPaymentScreen, PaymentSuccessScreen,
                              #   MaintenanceRequestScreen, RentalAgreementScreen
    shared/                   # ProfileScreen
  components/                 # MetricCard, ScreenHeader, SectionHeader, StatusChip, PrimaryButton
  theme/
    colors.js                 # Design token "The Precision Atelier" — import as `colors`
    typography.js             # Font tokens (fonts) + scale (textStyles)
    spacing.js                # Spacing scale
    index.js                  # Re-exports all theme tokens
supabase/
  migrations/
    001_create_tables.sql     # Full schema
    002_seed_data.sql         # Dev seed — replace UUIDs with real auth UIDs before running
    003_fix_users_rls.sql     # RLS fixes
```

## Database schema (key tables)

| Table | Owner column | Notes |
|---|---|---|
| `properties` | `owner_id` | `total_units`, `avg_rent` |
| `tenants` | `owner_id` | Also has `user_id` (nullable) for tenant auth link |
| `leases` | via `property_id` | `status`: active / expired / pending_signature |
| `payments` | **no owner_id** | Link to owner via `tenants.owner_id` — always join through tenants |
| `transactions` | via `property_id` | Financial ledger entries for owner; types: rent / expense / maintenance_cost |
| `maintenance_requests` | via `property_id` | `status`: open / in_progress / resolved; `priority`: low / medium / high |
| `users` | `id` | Extends `auth.users`; `role`: owner / tenant |

**Critical:** `payments` has no `owner_id`. To filter payments by owner, always join through tenants:

```js
supabase
  .from('payments')
  .select('amount, tenants!inner(owner_id)')
  .eq('tenants.owner_id', user.id)
```

## Auth & role flow

1. `AuthContext` calls `supabase.auth.getSession()` on mount and subscribes to `onAuthStateChange`.
2. On session, it fetches `public.users.role` for that `user.id`.
3. `RootNavigator` gates on `user` (logged in?) then `role` (owner/tenant?) to decide which navigator to render.
4. After role selection, `RoleSelectionScreen` upserts `public.users` then calls `refetchRole()`.
5. `clearRole()` resets role in memory only — used for switching roles without signing out.

## Design system

**Colors** (`src/theme/colors.js`):
- `colors.primary` (#002045) — nav bars, dark hero backgrounds
- `colors.primaryContainer` (#1a365d) — hero sections
- `colors.surface` / `surfaceContainerLowest` — screen bg / card fills
- `colors.tertiaryFixedDim` (#68dba9) — accent green, **financial/positive signals only**
- `colors.error` — negative values, destructive actions
- No 1px borders — use background color shifts (`surfaceContainerLow` → `surfaceContainerLowest`) for separation

**Typography** (`src/theme/typography.js`):
- Headlines: **Manrope** (`fonts.manrope*`) — property names, large numbers
- Body/labels: **Inter** (`fonts.inter*`) — metadata, descriptions, amounts
- All-caps tracked labels use `fonts.interSemiBold` at 11px with `letterSpacing: 1.5`

**Icons:** `@expo/vector-icons` MaterialIcons throughout.

## Coding conventions

- Functional components only, hooks for all state/effects.
- All Supabase calls inside `useCallback` with `user?.id` dependency.
- Pattern for dashboard data: fetch in parallel with `Promise.all`, compute derived values after, store in a single `metrics` state object.
- Error state renders a centered error card with a Retry button.
- Loading state renders a centered `ActivityIndicator` with `colors.primary`.
- `formatCrore(n)` utility on OwnerDashboard converts raw rupee amounts → ₹X.X Cr / ₹X.X L / ₹X,XX,XXX.
- All numbers on screens must come from real Supabase queries — no hardcoded metric values.
- Trend text on MetricCards must be computed from real data or omitted entirely.

## Supabase project

- URL: `https://olswwdunaivwxefelasc.supabase.co`
- Dashboard: https://supabase.com/dashboard/project/olswwdunaivwxefelasc
- Anon key is in `src/lib/supabase.js` — safe to commit (RLS enforced on all tables).

## RLS summary

Every table has RLS enabled. Owners access their own rows via `owner_id = auth.uid()` or via property ownership chain. Tenants access their own rows via `user_id = auth.uid()`. Never bypass RLS by using a service key on the client.

## Seed data

`002_seed_data.sql` seeds:
- 2 properties (The Sterling Heights — 120 units Bangalore; Skyline Atrium — 45 units Mumbai)
- 4 tenants (3 active, 1 pending)
- 4 leases (3 active, 1 pending_signature)
- 8 payments (Oct–Nov 2023 history — not current month)
- 4 maintenance requests (2 in_progress, 1 open, 1 resolved)
- 10 transactions (Oct–Nov 2023)

Before running seed: replace `owner_uid` and `tenant1_uid` with real auth user UUIDs from Supabase Auth dashboard.
