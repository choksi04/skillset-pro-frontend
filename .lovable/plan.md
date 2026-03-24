

## Plan: Azure AD SSO + Proper RBAC

### Overview
Implement Microsoft Azure AD authentication using MSAL.js (`@azure/msal-browser`) on the frontend, with an edge function to validate tokens and match Azure AD users to the existing `users` table. Then enforce RBAC properly with route-level guards and component-level permission checks.

### Architecture

```text
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Login Page  │────>│  Azure AD    │────>│  Edge Function   │
│  (MSAL.js)   │<────│  (OAuth2)    │     │  validate-token  │
└─────────────┘     └──────────────┘     │  ↓ match email   │
                                          │  ↓ return user   │
                                          └─────────────────┘
```

### What You'll Need to Provide
- Azure AD **Tenant ID**
- Azure AD **Client ID** (Application ID)
- **Redirect URI** (will be your app URL, e.g. `https://skillset-pro.lovable.app`)

These will be stored as secrets accessible to the edge function and as environment variables for the frontend.

---

### Step 1: Add MSAL.js dependency
Install `@azure/msal-browser` for frontend Azure AD authentication.

### Step 2: Create Azure AD configuration
New file `src/config/msalConfig.ts` — MSAL configuration using environment variables (`VITE_AZURE_CLIENT_ID`, `VITE_AZURE_TENANT_ID`) for the public client app. Scopes: `openid`, `profile`, `email`.

### Step 3: Create edge function `validate-azure-token`
- Receives the Azure AD access token / ID token from the frontend
- Validates token claims (issuer, audience, expiry)
- Extracts user email from token
- Looks up email in `users` table
- If found and active: returns user record with role
- If not found: returns 403 (user must be pre-provisioned by admin)
- Uses `SUPABASE_SERVICE_ROLE_KEY` for DB access

### Step 4: Rewrite `AuthContext.tsx`
- Add two login methods:
  - `loginWithAzure()` — triggers MSAL popup/redirect, sends token to edge function, receives user record
  - `login(email)` — keep existing email-only login as fallback for demo mode
- On mount: check localStorage for session, revalidate with DB
- Store auth state (user object, role) in context
- `logout()` clears both MSAL cache and local session

### Step 5: Redesign `LoginPage.tsx`
- Primary: "Sign in with Microsoft" button (Azure AD SSO)
- Secondary: collapsible "Demo login" section with email field (for testing)
- Clean card layout with Microsoft branding icon

### Step 6: Implement proper RBAC

**Route-level guards** — Update `App.tsx`:
- Create `RoleGuard` component that checks `currentRole` against allowed roles
- Wrap each route with appropriate role requirements:
  - Admin-only: `/organization`, `/users`, `/skill-analytics`, `/ai-generate`
  - Admin + Manager: `/skills`, `/domains`, `/questions`, `/reviews`
  - All roles: `/`, `/registry`, `/assessments`, `/assessment-exec`, `/guide`
- Unauthorized access redirects to dashboard with a toast notification

**Sidebar enforcement** — Already implemented via `sidebarItems` role filtering (no changes needed).

**Component-level checks** — Already implemented via `isAdmin` / `currentRole` checks in pages (no changes needed).

### Step 7: Store secrets
- `VITE_AZURE_CLIENT_ID` and `VITE_AZURE_TENANT_ID` — stored in codebase (public client config, safe to expose)
- No server-side Azure secret needed (public client flow with PKCE)

---

### Files Changed
- **New:** `src/config/msalConfig.ts`, `supabase/functions/validate-azure-token/index.ts`
- **Modified:** `src/contexts/AuthContext.tsx`, `src/pages/LoginPage.tsx`, `src/App.tsx`
- **Dependencies:** `@azure/msal-browser`

### What Won't Change
- Existing role checks across pages (already use `currentRole` / `isAdmin`)
- Sidebar role filtering (already works)
- User management page (admin pre-provisions users, Azure AD just authenticates)

