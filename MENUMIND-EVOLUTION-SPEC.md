# MenuMind Platform Evolution Spec

## For: Claude Code implementation
## Owner: Dr. Claw / Work Local (tim@worklocal.ca)
## Live URL: https://menumindx.netlify.app/
## Stack: React + Tailwind, Netlify, Groq API, Supabase (existing infra across ecosystem)

---

## Executive Context

MenuMind currently exists as a single-purpose tool: upload a restaurant menu, get an AI-powered audit (menu engineering matrix, pricing recommendations, description rewrites, design psychology tips). It captures an email at the end.

We need to evolve it into a **restaurant growth platform** that:

1. Delivers genuinely useful free tools to our existing Menu.ca/MenuAI restaurant customers (value-first, no paywall on core features)
2. Acts as a natural gateway to upsell them into paid Work Local services (consulting, managed campaigns, premium modules)
3. Builds a first-party data asset (order patterns, menu structures, customer behavior) that compounds over time and becomes our competitive moat

The 10% commission on online orders through our POS/ordering system is the baseline. MenuMind becomes the intelligence layer that justifies that commission and opens doors to additional revenue.

---

## Architecture Decisions

### Keep
- React + Tailwind frontend on Netlify
- Groq API for AI inference (llama-3.3-70b-versatile for text, llama-4-scout for vision)
- Single-page app feel with client-side routing
- The existing menu audit flow (it works, don't break it)

### Add
- Supabase backend (use existing `railclaw` project or create dedicated `menumind` project — implementer's call based on row limits)
- Supabase Auth (magic link email, matching the email capture that already exists)
- Supabase Edge Functions for any server-side AI calls that shouldn't expose API keys
- localStorage for anonymous session state, synced to Supabase on account creation
- A simple dashboard shell that hosts multiple tools as tabs/sections

### Do NOT Add (yet)
- Stripe payments (the upsell path is to human sales conversations, not self-serve checkout)
- Mobile app or PWA wrapper
- Real-time collaboration
- Any dependency on proprietary hardware or payment processors

---

## Information Architecture

The app should feel like a **free toolkit** with a persistent dashboard, not a gated SaaS product. The mental model is: "MenuMind gives me tools to run my restaurant smarter. When I want more, Work Local handles it."

### Navigation Structure

```
MenuMind Dashboard
├── Menu Audit (existing feature, promoted to first tab)
├── Upsell Simulator
├── Promo Calendar
├── Customer Pulse (placeholder/teaser)
├── Direct vs. Marketplace Calculator
└── My Restaurant (profile/settings)
```

### Auth Model

- **Anonymous**: Can use Menu Audit and Direct vs. Marketplace Calculator with no login. Results stored in localStorage.
- **Free Account** (email magic link): Unlocks Upsell Simulator, Promo Calendar, saved audit history, and PDF export. Syncs localStorage data on signup.
- **Upsell Touchpoints**: Customer Pulse shows a teaser with "Talk to us about unlocking your customer data" CTA. Any feature that references "your POS data" or "your order history" becomes the natural bridge to a sales conversation about the full MenuAI/Work Local ecosystem.

---

## Feature Specs

### 1. Menu Audit (Existing — Enhance)

**Current state**: Upload menu photo or paste text → AI extracts items → user provides restaurant context → generates audit report with matrix, pricing, descriptions, design tips. Email capture at end.

**Enhancements**:

- **Save to account**: If logged in, save audit to Supabase. Show audit history with dates. Allow re-running audits to track changes over time.
- **Competitor benchmark**: After the audit, offer "Want to see how your prices compare to similar restaurants nearby?" This triggers a second AI call that uses the cuisine type + postal code to generate realistic benchmark ranges. This is NOT real competitor data (we don't have it) — clearly label it as "AI-estimated regional benchmarks for [cuisine] restaurants in [region]."
- **Action checklist**: Convert each audit recommendation into a toggleable checklist item. Persist completion state. This turns a one-time report into an ongoing improvement tracker.
- **Share link**: Generate a shareable read-only URL for each audit (Supabase row with public flag). Restaurant owners share these with partners, chefs, or managers.
- **PDF export**: Already referenced in the UI but ensure it works cleanly. Use the browser print/PDF approach or a lightweight client-side PDF library. Include MenuMind branding and a "Powered by Work Local" footer with contact info (this is the subtle upsell).

**Upsell hook on audit report**: At the bottom of every audit, include a section:
> "Want us to implement these changes for you? Work Local's restaurant growth team can redesign your menu, optimize your online ordering, and manage your promotions. [Book a free 15-minute call]"

Link goes to a Calendly or similar scheduling page.

---

### 2. Upsell Simulator (NEW — High Value)

**Purpose**: Let restaurant owners model "what if we added upsell prompts to our online ordering?" This directly demonstrates the value of our ordering system's upsell capabilities.

**Flow**:

1. User inputs (or imports from a saved audit):
   - Average order value (AOV)
   - Monthly online order count
   - A few popular menu items with prices
2. AI generates realistic upsell scenarios:
   - "Add a drink" prompt at checkout → estimated X% acceptance rate → projected monthly revenue lift
   - "Make it a combo" bundle → estimated Y% acceptance rate → projected lift
   - "Frequently ordered together" suggestions → estimated Z% acceptance
   - Dessert/side add-on prompt → estimated lift
3. Output: A visual dashboard showing:
   - Current monthly revenue from online orders
   - Projected revenue with upsells enabled
   - Net gain after our 10% commission
   - **Key message**: "Even with our 10% commission, you'd net $X more per month with smart upsells than you do today without them"

**Implementation notes**:
- Acceptance rates should use conservative, defensible ranges (cite industry averages in tooltips: "Industry data shows drink add-on prompts convert at 15-25% of orders")
- Make the inputs adjustable with sliders so owners can play with scenarios
- This is the single most important upsell feature because it directly justifies the 10% commission AND sells the value of enabling upsell modules

**Upsell hook**:
> "Ready to turn these projections into real revenue? Our ordering system can add these upsell prompts to your online menu today. [Talk to our team]"

---

### 3. Promo Calendar (NEW — Retention Tool)

**Purpose**: A simple AI-generated promotional calendar that gives restaurant owners ready-to-use promo ideas for each week/month.

**Flow**:

1. User inputs (or pulls from profile):
   - Cuisine type
   - Rough busy/slow days
   - Any existing promos they run
2. AI generates a 30-day promo calendar with:
   - Daily/weekly promotion ideas (e.g., "Taco Tuesday: 15% off all tacos, promote via social post at 10am")
   - Seasonal tie-ins (holidays, local events, weather-based suggestions)
   - Social media post drafts for each promo (one-liner + suggested image description)
   - Suggested discount percentages that protect margins (tie to food cost % from their profile)

**Display**: Calendar view (month grid) where each day with a promo is clickable to see details. Also available as a list view.

**Implementation notes**:
- Generate the full month in one AI call with structured JSON output
- Cache the generated calendar in Supabase so it persists
- Allow regenerating individual days or the full month
- Include a "Copy to clipboard" button for each social post draft

**Upsell hook**:
> "Want these promos to go out automatically to your customers via SMS and email? Our marketing automation can handle that. [Learn more]"

---

### 4. Direct vs. Marketplace Calculator (NEW — Conversion Tool)

**Purpose**: Show restaurant owners exactly how much they lose to third-party marketplace commissions vs. direct ordering through our system.

**Flow**:

1. User inputs:
   - Monthly revenue from Uber Eats / DoorDash / Skip (or combined third-party total)
   - Commission rate they're paying (default 30%, adjustable)
   - Monthly revenue from direct online orders (if any)
2. Calculator shows:
   - Current marketplace cost per month (revenue × commission rate)
   - What they'd pay through our system at 10% on those same orders
   - Monthly savings from switching
   - Annual savings
   - "What you could do with $X/year in saved commissions" (e.g., "That's equivalent to hiring a part-time staff member" or "That covers a year of targeted local advertising")

**Display**: Side-by-side comparison with clear visual treatment. Green for savings, red for marketplace costs.

**Implementation notes**:
- This is entirely client-side math, no AI needed
- Make it shareable (URL with encoded params)
- Include a disclaimer: "Actual savings depend on order volume and successful customer migration to direct ordering"

**Upsell hook**:
> "We help restaurants shift customers from marketplace apps to direct ordering. Our team can set up your branded ordering page and run a migration campaign. [Get started]"

---

### 5. Customer Pulse (TEASER — Future Feature)

**Purpose**: This is a placeholder that previews what's possible when a restaurant connects their POS/ordering data. It serves purely as an upsell gateway to the full MenuAI platform.

**Display**: A locked/greyed-out dashboard mockup showing:
- "Your top 10 customers this month" (blurred fake data)
- "Repeat order rate: XX%" (blurred)
- "Customers at risk of churning" (blurred)
- "Best day to send a win-back offer" (blurred)

**CTA**: "Customer Pulse connects to your ordering data to show you who your best customers are, who's about to leave, and what to do about it. This feature is available to restaurants on our ordering platform. [Connect your restaurant]"

**Implementation notes**:
- This is a static mockup with blurred/fake data, NOT a functional feature
- The entire point is to make owners think "I want that" and start a conversation
- Design it to look polished and real — the mockup IS the sales pitch
- Use realistic-looking but obviously fake data (e.g., "Customer #1: J. Smith — 12 orders this month, avg $47.50")

---

### 6. My Restaurant (Profile/Settings)

**Purpose**: Central place to store restaurant details that feed into all other tools.

**Fields**:
- Restaurant name
- Cuisine type (dropdown matching the audit flow)
- Postal code / city
- Monthly customer count (approximate)
- Target food cost %
- Average order value
- Monthly online order count
- Current marketplace usage (yes/no, which ones, approximate monthly revenue through them)
- Busy/slow days of the week

**Notes**:
- Pre-populate from audit data if they've already completed one
- All fields optional — tools work with whatever's provided and use sensible defaults for the rest
- This profile data is what makes every other tool smarter over time (personalized benchmarks, tailored promo ideas, accurate calculations)
- Store in Supabase `restaurants` table, linked to auth user

---

## Database Schema (Supabase)

```sql
-- Users are handled by Supabase Auth (magic link)

create table restaurants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text,
  cuisine_type text,
  postal_code text,
  monthly_customers int,
  food_cost_pct numeric(4,2),
  avg_order_value numeric(8,2),
  monthly_online_orders int,
  uses_marketplace boolean default false,
  marketplace_names text[], -- e.g., {'uber_eats', 'doordash', 'skip'}
  marketplace_monthly_revenue numeric(10,2),
  busy_days text[], -- e.g., {'friday', 'saturday'}
  slow_days text[], -- e.g., {'monday', 'tuesday'}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table audits (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  menu_items jsonb not null, -- extracted items array
  audit_result jsonb not null, -- full AI audit response
  checklist jsonb, -- action items with completion state
  share_token text unique, -- for public share links
  is_public boolean default false,
  created_at timestamptz default now()
);

create table promo_calendars (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  month_year text not null, -- e.g., '2026-06'
  calendar_data jsonb not null, -- full month of promo data
  created_at timestamptz default now()
);

create table upsell_simulations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  inputs jsonb not null,
  results jsonb not null,
  created_at timestamptz default now()
);

-- RLS policies: users can only read/write their own restaurant's data
-- Audits with is_public=true AND matching share_token are readable by anyone
```

---

## UI/UX Direction

### Design Language
- Keep the existing MenuMind dark theme and brand feel
- Dashboard should use a left sidebar navigation on desktop, bottom tab bar on mobile
- Each tool gets its own "card" in the dashboard with a clear icon and one-line description
- Free tools are fully accessible; teaser features (Customer Pulse) use a frosted-glass blur effect over the mockup data
- All upsell CTAs should be a consistent color (suggest a warm amber/gold to stand out from the teal/blue primary palette) and always feel helpful, never pushy. Tone: "Here's what's possible" not "Buy now."

### Upsell CTA Design Pattern
Every upsell touchpoint follows the same structure:
1. The tool delivers real, useful output first (the audit, the simulation, the calendar)
2. Below the output, a subtle divider
3. A "Next step" card with: one sentence of context, one clear action button, Work Local branding
4. Never gate the free output behind the upsell. The value comes first, always.

---

## AI Prompt Architecture

All AI calls go through Groq. Structure each feature's prompts as system + user messages.

### Menu Audit (existing — keep working prompts, add):
- **Competitor benchmark prompt**: System sets the role as a restaurant pricing analyst. User message includes cuisine type, postal code region, and the menu items with current prices. Ask for estimated regional price ranges per category (appetizers, mains, drinks, desserts) and flag items that are significantly above or below the range.

### Upsell Simulator:
- **System prompt**: "You are a restaurant revenue optimization expert. Given a restaurant's menu items, average order value, and monthly order volume, generate realistic upsell scenarios with conservative acceptance rates based on industry data. Return structured JSON."
- **User message**: Restaurant profile + menu items
- **Expected JSON output**:
```json
{
  "scenarios": [
    {
      "name": "Drink add-on prompt",
      "description": "Suggest a beverage when none is in the cart",
      "avg_upsell_value": 4.50,
      "estimated_acceptance_rate": 0.18,
      "monthly_additional_revenue": 810,
      "industry_benchmark_note": "Beverage prompts typically convert at 15-25%"
    }
  ],
  "total_monthly_lift": 2340,
  "total_annual_lift": 28080,
  "net_after_commission": 25272
}
```

### Promo Calendar:
- **System prompt**: "You are a restaurant marketing strategist. Generate a 30-day promotional calendar. Each promo should include: the date, promo name, discount or offer details, a one-sentence social media post, suggested posting time, and a brief rationale. Respect the restaurant's food cost target. Return structured JSON."
- **User message**: Restaurant profile including cuisine, busy/slow days, food cost %, and the target month.

---

## Implementation Sequence

Build in this order. Each phase should be deployable independently.

### Phase 1: Dashboard Shell + Auth
- Add Supabase Auth (magic link)
- Create the dashboard layout with sidebar/tabs
- Move the existing menu audit into the first tab
- Add the "My Restaurant" profile page
- Pre-populate profile from audit data when available
- Add audit history (list of past audits, saved to Supabase)
- Wire up localStorage → Supabase sync on login

### Phase 2: Direct vs. Marketplace Calculator
- Pure client-side, no AI needed
- Fastest to build, immediately compelling
- Add share link functionality

### Phase 3: Upsell Simulator
- Groq AI integration for scenario generation
- Interactive sliders for inputs
- Visual revenue comparison output
- Save simulations to Supabase

### Phase 4: Promo Calendar
- Groq AI integration for calendar generation
- Calendar grid + list view
- Copy-to-clipboard for social posts
- Save/regenerate functionality

### Phase 5: Customer Pulse Teaser
- Static mockup with blurred fake data
- CTA linking to Work Local contact/booking page
- This is a design task, not an engineering task

### Phase 6: Polish + Upsell CTAs
- Add all upsell hooks to each feature
- PDF export for audits
- Share links for audits
- Action checklist on audit reports
- Competitor benchmark add-on to audits
- Review all copy for consistent tone

---

## Upsell Funnel Map

```
Free Tool Usage
    │
    ├── Menu Audit → "Want us to implement these changes?" → Book a call
    ├── Upsell Simulator → "Ready to enable these upsells?" → Sales conversation about ordering platform
    ├── Promo Calendar → "Want automated campaigns?" → Marketing automation package
    ├── Marketplace Calculator → "Ready to shift to direct ordering?" → Ordering platform setup
    └── Customer Pulse teaser → "Connect your data" → Full MenuAI platform onboarding
                                                           │
                                                    Revenue Streams:
                                                    ├── 10% online order commission (baseline)
                                                    ├── Monthly SaaS for premium modules (loyalty, CRM, SMS)
                                                    ├── Setup fees for menu redesign + ordering migration
                                                    └── Managed campaign retainers
```

---

## Success Metrics

Track these in Supabase (simple event logging table or use Supabase Analytics):

- **Audits completed** per week (existing metric, keep it)
- **Accounts created** (email captures → actual signups)
- **Tool engagement** by feature (which tools get used most)
- **Upsell CTA clicks** (which hooks convert to booking/contact page visits)
- **Repeat visits** (do owners come back to check their promo calendar, re-run simulations?)
- **Share link usage** (are owners sharing audit reports?)

---

## What NOT to Build

- **Payment processing**: All upsells route to human sales conversations, not self-serve checkout. The deals are too high-touch and variable for self-serve pricing right now.
- **Real POS integration**: Customer Pulse is a teaser. Don't build actual data ingestion until there's a clear path to connecting real order data.
- **Native mobile app**: The web app should be mobile-responsive. No app store distribution needed.
- **Multi-restaurant accounts**: Keep it one restaurant per account for now. Chain/franchise support is a future problem.
- **A/B testing infrastructure**: Too early. Ship features, watch usage manually, iterate.

---

## File Structure (Expected)

```
menumind/
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── DashboardLayout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── MobileTabBar.jsx
│   │   ├── audit/
│   │   │   ├── MenuAudit.jsx          (existing, refactored)
│   │   │   ├── AuditHistory.jsx
│   │   │   ├── AuditReport.jsx        (existing, enhanced)
│   │   │   ├── ActionChecklist.jsx
│   │   │   └── CompetitorBenchmark.jsx
│   │   ├── upsell-sim/
│   │   │   ├── UpsellSimulator.jsx
│   │   │   ├── ScenarioCard.jsx
│   │   │   └── RevenueChart.jsx
│   │   ├── promo/
│   │   │   ├── PromoCalendar.jsx
│   │   │   ├── CalendarGrid.jsx
│   │   │   ├── PromoDetail.jsx
│   │   │   └── SocialPostCopy.jsx
│   │   ├── calculator/
│   │   │   └── MarketplaceCalculator.jsx
│   │   ├── pulse/
│   │   │   └── CustomerPulseTeaser.jsx
│   │   ├── profile/
│   │   │   └── MyRestaurant.jsx
│   │   └── shared/
│   │       ├── UpsellCTA.jsx          (reusable upsell card component)
│   │       ├── AuthGate.jsx           (wrapper for login-required features)
│   │       └── LoadingStates.jsx
│   ├── lib/
│   │   ├── supabase.js
│   │   ├── groq.js                    (AI call helpers)
│   │   └── localStorage.js           (session persistence + sync)
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useRestaurant.js
│   │   └── useAudit.js
│   └── App.jsx
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── functions/
│       └── ai-proxy/                  (edge function to hide Groq key)
├── netlify.toml
├── CLAUDE.md                          (Claude Code persistent context)
└── package.json
```

---

## CLAUDE.md (For Claude Code Sessions)

Paste this into the project's `CLAUDE.md` so every Claude Code session has context:

```markdown
# MenuMind — Restaurant Growth Platform

## What This Is
MenuMind is a free restaurant toolkit that delivers AI-powered menu audits, upsell simulations, promo calendars, and marketplace cost comparisons. It serves as both a value tool for existing Menu.ca/MenuAI customers and an upsell gateway to Work Local's paid services.

## Stack
- React + Tailwind CSS, deployed to Netlify
- Supabase (auth, database, edge functions)
- Groq API (llama-3.3-70b-versatile for text, llama-4-scout for vision/OCR)
- No paid dependencies beyond Groq API usage

## Key Design Principles
- Free-first: every tool delivers real value before any upsell appears
- Upsell CTAs are helpful, not pushy — tone is "here's what's possible"
- Mobile-responsive, dark theme, existing MenuMind brand
- All AI calls go through Supabase Edge Functions (never expose API keys client-side)
- Conservative estimates in all calculators/simulators — credibility over hype

## Owner
Dr. Claw / Work Local — tim@worklocal.ca
```

---

## Final Notes for Implementer

- The Perplexity research document attached to this spec outlines the broader strategic thinking. The three-tier upsell model (customer-facing checkout upsells, restaurant-facing premium modules, managed services) is the north star. MenuMind addresses the "restaurant-facing" layer — giving owners tools and insights that make them want the full platform.
- The 10% commission model is our baseline. Everything in MenuMind should reinforce the message: "direct ordering through our system is more profitable than marketplaces, and gets smarter over time."
- Don't over-engineer. Ship Phase 1-2 fast, get it in front of restaurant owners, and iterate based on what they actually click on.
