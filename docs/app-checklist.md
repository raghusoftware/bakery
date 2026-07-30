# What a Successful App Is Made Of — Checklist

A practical, end-to-end checklist. `[x]` = FastBill already has it, `[ ]` = worth adding.

## 1. Product & scope
- [x] A clear problem for a specific user (bakery/restaurant billing & stock)
- [x] Core "job" the app nails (take a sale, track money & stock)
- [x] Defined must-have features vs. nice-to-have
- [ ] Written one-line value proposition & target user persona
- [ ] Success metrics defined (e.g. sales/day recorded, active shops)

## 2. Core features (done)
- [x] Sales / POS with cart, discounts, tax, payment modes
- [x] Inventory (raw materials + products) with adjustments
- [x] Production/recipes with auto ingredient deduction
- [x] Suppliers, stock inward, payables
- [x] Staff, attendance, advances, salary slips
- [x] Cash/bank accounts + ledger, receivables, expenses (schema)
- [x] Dine-in tables, receipts/PDF

## 3. UX & design
- [x] Consistent design system (one accent, tokens, dark mode)
- [x] Mobile-first, thumb-friendly, safe-area aware
- [x] Fast primary flow (few taps to bill)
- [x] Empty states, toasts, loading/verbs on buttons
- [ ] Onboarding / first-run guide for a brand-new shop
- [ ] Accessibility pass (contrast, font scaling, screen-reader labels)
- [ ] Localization / multiple currencies & languages

## 4. Data & backend
- [x] Database schema with clear relationships
- [x] Auth (per-user accounts)
- [x] Row-level security / tenant isolation
- [x] Server-side integrity for critical ops (atomic production RPC)
- [ ] Automated backups & a tested restore
- [ ] Data export/import (partial: JSON export)
- [ ] Migrations tracked in version control (schema.sql exists; formalize)

## 5. Reliability & correctness
- [x] Money math centralized & consistent
- [x] Reversible actions (edit/delete with stock & ledger reversal)
- [ ] Automated tests (unit for calc, e2e for sale flow)
- [ ] Error logging/monitoring (capture failed saves centrally)
- [ ] Offline handling or a clear "you're offline" state
- [ ] Idempotency on sale submit (avoid double-charge on retry)

## 6. Security & privacy
- [x] Secrets are publishable-key only on the client; no service keys shipped
- [x] Access scoped by authenticated user
- [ ] Password reset / account recovery flow
- [ ] Rate limiting & abuse protection on auth
- [ ] Privacy policy + clear data ownership/deletion
- [ ] Security review of RLS policies before launch (run advisors)

## 7. Performance
- [x] Small, self-contained client; local library bundling
- [ ] Pagination/lazy load for large sales/history
- [ ] Image compression for product photos (partial: done on upload)
- [ ] Cold-start & interaction budgets measured on a low-end device

## 8. Build, release & ops
- [x] Reproducible CI build (GitHub Actions → APK)
- [x] Versioned, named app (FastBill)
- [ ] Signed release build (not just debug APK) for Play Store
- [ ] Store listing: icon, screenshots, description, privacy form
- [ ] Crash reporting + update path (versioning / auto-update)
- [ ] Staging vs production separation

## 9. Growth & business
- [ ] Analytics on key funnels (sales recorded, retention)
- [ ] Feedback channel in-app
- [ ] Pricing/monetization plan (if commercial)
- [ ] Support docs / FAQ
- [ ] Roadmap & changelog

## 10. Launch readiness (go/no-go)
- [ ] Real device testing on 2–3 phones
- [ ] Back button, deep links, permissions behave correctly
- [ ] Data survives logout/login and reinstall
- [ ] "Reset all data" and account deletion verified
- [ ] Legal: terms, privacy, store policies met

---
### Top next steps for FastBill
1. Signed release APK + Play Store listing (or keep as internal APK).
2. Password reset + onboarding for new shops.
3. Automated test for the sale flow + central error logging.
4. Backups/restore and run Supabase security advisors before real use.
