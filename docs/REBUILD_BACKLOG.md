# Calculator Rebuild Backlog

## Objective
Rebuild the FLIP NIM-CRUT / DAF / NING Trust calculator into a production-quality planning application with a testable calculation engine, auditable assumptions, and materially accurate actuarial and tax workflows.

## Scope Principles
- Separate UI rendering from calculation logic.
- Replace approximation-based actuarial logic with data-driven IRS-based workflows.
- Make every visible input either functional, validated, or removed.
- Treat state-tax and NIIT assumptions explicitly when rules are jurisdiction-dependent.
- Ship in milestones that preserve a usable app at every step.

## Milestone 0 — Foundation and guardrails

### Task 0.1 — Establish engine architecture
**Description**
Create a modular structure for calculations so the browser UI is no longer the source of truth.

**Deliverables**
- `src/engine/` folder structure.
- Clear module boundaries for validation, actuarial data, projection, tax, and reporting.
- Shared input/output type definitions.

**Acceptance criteria**
- Core calculations can run without the DOM.
- The UI calls a single public `runIllustration(inputs)` function.
- Engine modules have no direct dependency on `document` or browser rendering APIs.

### Task 0.2 — Define supported scenarios
**Description**
Write a calculation policy that defines exactly which trust structures and tax assumptions are supported.

**Deliverables**
- Supported/unsupported combinations matrix.
- Explicit treatment of FLIP year, makeup handling, deduction assumptions, and state-tax assumptions.

**Acceptance criteria**
- Every UI option maps to a documented rule.
- Unsupported combinations surface warnings or validation errors.

### Task 0.3 — Add automated test harness
**Description**
Introduce unit and regression testing before large engine rewrites.

**Deliverables**
- Test runner configured for pure engine tests.
- Golden scenario fixtures.
- CI-ready command for local verification.

**Acceptance criteria**
- At least 10 baseline tests execute locally.
- Regression fixtures cover current baseline behavior and future corrected behavior.

---

## Milestone 1 — Input model and validation

### Task 1.1 — Normalize input schema
**Description**
Create a canonical input schema independent of HTML control names.

**Deliverables**
- Normalized input model.
- Parsing and coercion layer from form inputs to engine inputs.
- Default assumptions object with version tag.

**Acceptance criteria**
- The engine accepts a single validated object.
- Numeric percentages are normalized consistently.
- Optional inputs have explicit defaults.

### Task 1.2 — Add validation rules
**Description**
Prevent unsupported or invalid scenarios from being projected.

**Validation targets**
- Asset basis cannot exceed asset value.
- Payout rate must be within supported bounds.
- Flip year must be within the trust term.
- Additional contribution year must be valid.
- DAF percentage cannot reduce CRUT contribution below a supported threshold.

**Acceptance criteria**
- Invalid combinations return structured validation errors.
- UI displays validation messages before rendering summary/projection output.

---

## Milestone 2 — Actuarial and qualification engine

### Task 2.1 — Replace charitable remainder approximation
**Description**
Remove the custom remainder-factor approximation and implement an actuarial lookup workflow.

**Deliverables**
- Data format for actuarial factors and payout frequency factors.
- Lookup functions keyed by rate selection, life/term structure, and payout frequency.
- Transparent calculation trace for remainder factor and deduction basis.

**Acceptance criteria**
- 10% remainder testing is driven by authoritative actuarial inputs.
- The selected rate month is stored in outputs and reports.
- Projection results include a qualification audit section.

### Task 2.2 — Implement Section 7520 rate selection workflow
**Description**
Replace the single raw slider with an explicit month-selection workflow plus optional manual override.

**Deliverables**
- Current month / prior 2 months selector.
- Manual override with warning state.
- Versioned rate source metadata.

**Acceptance criteria**
- Outputs show the exact selected month and rate.
- Reports disclose whether the rate was sourced or manually overridden.

### Task 2.3 — Upgrade life expectancy handling
**Description**
Eliminate the coarse hardcoded age map.

**Deliverables**
- Life-based factor support using the same actuarial data source as the qualification engine.
- Separate handling for term-of-years versus life-based structures.

**Acceptance criteria**
- No nearest-age shortcut remains in the calculation engine.
- Life-based runs are reproducible from data tables.

---

## Milestone 3 — FLIP NIM-CRUT projection engine

### Task 3.1 — Implement explicit trust phase state machine
**Description**
Encode pre-flip, trigger, and post-flip states directly instead of inferring them from loose year comparisons.

**Deliverables**
- Trust phase enum/state representation.
- Per-year ledger fields for income, appreciation, target payout, payment ceiling, deficit, makeup accrued, makeup paid, and makeup forfeited.

**Acceptance criteria**
- The annual ledger shows phase and reason for each payout.
- Flip timing and makeup behavior are configurable to the documented policy.

### Task 3.2 — Reconcile payout base methodology
**Description**
Choose and document the correct valuation basis for annual unitrust payouts.

**Deliverables**
- Documented payout-base convention.
- Updated formulas in engine and UI methodology notes.

**Acceptance criteria**
- The unitrust amount formula is consistent across code, docs, and reports.
- Tests cover beginning-value and value-before-payment edge cases as applicable.

### Task 3.3 — Add support for pre-flip trust accounting income assumptions
**Description**
Allow pre-flip scenarios that are not strictly zero-income.

**Deliverables**
- Inputs for pre-flip accounting income yield and appreciation.
- Optional preset for zero-income illiquid-asset scenarios.

**Acceptance criteria**
- Users can model both no-income and income-producing pre-flip assets.
- Makeup behavior updates correctly based on actual pre-flip income.

### Task 3.4 — Clarify contribution handling
**Description**
Define how additional contributions affect the trust ledger and qualification outputs.

**Deliverables**
- Policy for contribution treatment.
- Updated projection logic and disclosures.

**Acceptance criteria**
- Additional contributions are either fully supported with documented behavior or removed from the UI until ready.

---

## Milestone 4 — Tax engine

### Task 4.1 — Rebuild DAF deduction logic
**Description**
Replace the current simplified deduction handling with a rules-based deduction model.

**Deliverables**
- Inputs for property type, donee type, and applicable limitation assumptions.
- Carryforward tracking model.
- Breakdown of deduction requested, used, and carried forward by year.

**Acceptance criteria**
- Reports distinguish deduction generated from deduction currently usable.
- Carryforward outputs are deterministic and tested.

### Task 4.2 — Add CRT distribution character tiers
**Description**
Track distribution character instead of only total cash paid.

**Deliverables**
- Tier ledgers for ordinary income, capital gain, other income, and corpus.
- Year-by-year tax character summary.

**Acceptance criteria**
- Each annual payment has a character breakdown.
- Summary output can show estimated taxable versus non-taxable distributions.

### Task 4.3 — Replace NIIT placeholder logic
**Description**
Make the NIIT module either truly functional or explicitly assumption-driven.

**Deliverables**
- NIIT mode selector: off / simplified / advanced.
- Logic that actually uses threshold-related inputs when applicable.
- Disclosure language for unresolved trust-structure nuances.

**Acceptance criteria**
- No NIIT-related input remains unused.
- The report clearly states how NIIT was modeled.

### Task 4.4 — Rework NING state-tax module
**Description**
Stop assuming 100% elimination of state tax and move to differential or explicit effective-rate modeling.

**Deliverables**
- Effective-state-tax-without-planning input.
- Effective-state-tax-with-NING input or rules-based differential engine.
- Scenario disclosure notes.

**Acceptance criteria**
- `ningStateTaxRate` or its replacement affects outputs directly.
- State-tax savings are derived from an explicit differential, not a one-sided assumption.

---

## Milestone 5 — Reporting and UX

### Task 5.1 — Expand annual projection output
**Description**
Expose the full calculation ledger instead of a compressed “Growth” line.

**Deliverables**
- Detailed projection columns.
- Export-friendly JSON/CSV structure.
- Phase markers and exception notes.

**Acceptance criteria**
- Advisors can audit how each year’s result was produced.
- Projection exports reconcile to the summary report.

### Task 5.2 — Add benchmark comparison outputs
**Description**
Implement the missing outright-sale comparison and related analytics.

**Deliverables**
- Outright sale benchmark.
- Comparative summary metrics.
- Optional after-tax benchmark outputs.

**Acceptance criteria**
- Summary report includes trust-strategy versus outright-sale comparison.
- Benchmark assumptions are listed next to results.

### Task 5.3 — Add methodology and assumption disclosures
**Description**
Make the calculator auditable to end users.

**Deliverables**
- Methodology panel.
- Data-source metadata section.
- Warnings for manual overrides and unsupported combinations.

**Acceptance criteria**
- A user can see which rates, assumptions, and rule modes were applied.
- Print/export output includes assumption and disclaimer sections.

---

## Milestone 6 — Delivery hardening

### Task 6.1 — Scenario fixture library
**Description**
Build a library of reviewed example cases for QA and demos.

**Deliverables**
- Canonical scenarios covering CRUT-only, FLIP NIM-CRUT, DAF overlay, NING overlay, and AGI-limited cases.

**Acceptance criteria**
- Every release is checked against the fixture library.
- Major formula changes require fixture review.

### Task 6.2 — Release checklist
**Description**
Create a pre-release review process for future model updates.

**Deliverables**
- Checklist for rate-table refreshes.
- QA signoff steps.
- Tax/legal review placeholders.

**Acceptance criteria**
- A future maintainer can update rates and rerun validation without reverse-engineering the app.

---

## Suggested execution order
1. Foundation and tests.
2. Input schema and validation.
3. Actuarial/qualification engine.
4. FLIP NIM-CRUT projection state machine.
5. Tax engine rebuild.
6. Reporting and benchmark comparison.
7. Delivery hardening.

## Recommended first implementation slice
The first code slice should be intentionally narrow:
- Extract the engine from `index.html`.
- Add tests for the existing behavior.
- Replace unused-input behavior with explicit warnings.
- Implement a new annual ledger model.
- Land the framework before correcting actuarial and tax logic.
