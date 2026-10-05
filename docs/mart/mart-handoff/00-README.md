# Vocksy Mart — Developer Package

You are building **Vocksy Mart**, a parts marketplace feature inside the existing Vocksy app (`backend/` Express + Prisma, `mobile/` Expo). Everything you need is in this folder. **You should not need to ask questions.** Where something is not covered, make the simplest choice that matches the existing code, and note it in `docs/mart/DECISIONS-MADE.md`.

## Reading order
1. `01-product-spec.md` — what Mart is, rules, scope (10 min)
2. `02-data-model.md` — tables, fields, status rules, validation, constants (source of truth)
3. `03-api.md` — every endpoint, request/response, gates, errors
4. `04-screens.md` + `designs/chosen/*.png` — every screen
5. `05-build-plan.md` — what to build in what order, with done checks. **Start at Step 0.**

Precedence if two files disagree: `02` > `03` > `04` text > pictures > `01`. (Tell Vikum about any conflict you find; do not wait for an answer.)

The older design-discussion files are in `history/` (`vocksy-marketplace-spec-draft-v1.md`, `vocksy-mart-screen-specs.md`). They are for background only (the full decision history and design links). **This package supersedes them; if they disagree, the numbered files win.**

## Existing app facts you must respect (short)
- Backend: Express 5 + TypeScript + Prisma 6 + Postgres (Neon free); Render free; `prisma db push` is run manually, there are no migrations and no tests. People are keyed by **phone number**; JWT carries `phoneNumber`. IDs are `cuid()`. No Prisma enums (string statuses). Errors are `{ error }`. Text is capped with `capText`. Rate limits use `checkRateLimit(scope, key, max, windowMs)`.
- Mobile: Expo 54 / RN 0.81. **No navigation library**: screens are a manual `Screen` union + `backMap` + `TAB_SCREENS` in `App.tsx`. Theme tokens in `mobile/src/theme/colors.ts` (`useColors()`, dark mode). i18n en/si/ta. App v1.0.3, Play internal testing, OTA updates with `runtimeVersion: appVersion`.
- No deep links, email, websockets, offline queue, staging, API versioning, admin role.
- The repository code is the source of truth for existing behavior (`capText`, `LONG_TEXT_LEN`, `MAX_AMOUNT`, `Garage` fields, `createNotification` and `sendPush` signatures). Log any assumption in `docs/mart/DECISIONS-MADE.md`.

## Decisions already made (do not re-open)
Mart tab `My Vehicles | Garage | Mart`. Any user can sell. Off-platform payment. Seller tag Shop/Casual is automatic and separate from `Garage.verified`. Ratings need a confirmed deal. Offers not bidding. Block, Report, Mart rules in the first release. Private phone numbers (public id = `User.id`). Make/model validated against a backend catalog. Beta gate `MART_BETA_PHONES`. Manual backup before the first `db push`. Daily backup job. In-app account deletion. Code palette is the brand truth (navy `#1d3a5f`, amber `#e3a008`). Play Console status unclear: not a blocker.

### Answers confirmed 2026-10-05 (open questions closed)
| # | Question | Answer |
|---|---|---|
| 1 | Parts categories | The 12-category draft in `02` §8.3 is approved. Ids are final. |
| 2 | Mart rules wording | Use the draft in `04` §20.4 for beta. Vikum reviews before public launch. Version bump re-asks users. |
| 3 | Account deletion data | Delete the user's Mart data; keep reports. |
| 4 | Rating uniqueness | One rating per buyer–seller pair, ever. Revisit later. |
| 5 | Customer Service number | None yet. Row hidden while `MART_SUPPORT_WHATSAPP` is empty. |
| 6 | Release plan | Three milestones (see `05`). All behind the beta gate. |
| 7 | Sinhala/Tamil labels | Developer writes first drafts; English fallback; Vikum corrects from a list (Sinhala first). |
| 8 | Remove bad ads | Add small `POST /admin/mart/listings/:id/remove`. Other account actions stay manual SQL. |
| 9 | Design export | PNGs of chosen screens are in `designs/chosen/`. |
| 10 | Brand name | The app is **Vocksy**. (The Claude Project's own instructions still mention DriveVault; Vikum will update that line.) |

## Still open (not blockers; use the default)
- Final **Sinhala/Tamil** wording (placeholder = English).
- **Rules text** legal review.
- **Customer Service** WhatsApp number.
- **Play Console** production status (affects only how the app is released, not the build).

## Folder
```
00-README.md  01-product-spec.md  02-data-model.md  03-api.md
04-screens.md  05-build-plan.md  history/ (old specs, background only)  designs/chosen/*.png  designs/alternatives/*.png (do not build)
```
