# Rebuild Branch Preparation Notes

## Branch purpose
This branch is reserved for the calculator rebuild effort. The immediate objective is not to finish the engine in one pass, but to create a disciplined path for replacing the current single-file prototype with a modular, testable implementation.

## Proposed branch workflow
- Keep this branch focused on rebuild infrastructure and engine refactors.
- Avoid mixing cosmetic UI changes with core engine changes unless needed for parity.
- Land the rebuild in small, reviewable commits.
- Preserve the current calculator until engine parity tests exist.

## First coding tranche
1. Add a test harness.
2. Extract `runModel` and related helpers into a pure engine module.
3. Add regression fixtures covering the current calculator outputs.
4. Introduce a normalized input schema.
5. Replace the rendering layer so the UI consumes engine outputs rather than owning the formulas.

## Definition of done for branch kickoff
- Rebuild backlog is documented.
- Branch naming is set.
- The next implementation commit can start with infrastructure rather than more analysis.
