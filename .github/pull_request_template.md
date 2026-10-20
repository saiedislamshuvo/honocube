## What this changes

<!-- One or two sentences. Which issue does this fix? -->

Closes #<!-- issue number -->

## Why

<!-- The problem, in plain language. What breaks, for whom, and how. -->

## How

<!-- The approach taken, and why this approach over the alternatives. -->

## Verification

<!-- Be specific and honest. What did you actually run? -->

- [ ] `yarn turbo run build` passes
- [ ] `yarn turbo run check-types` passes
- [ ] `yarn turbo run lint` passes *(if the touched package is linted)*
- [ ] Behaviour verified, not just types — describe how:

<!-- If any box is unchecked, say why. A partially verified PR is fine; a falsely
     verified one is not. -->

## Notes for the reviewer

<!-- Anything non-obvious: a risky area, a deliberate trade-off, a follow-up
     deliberately left out of scope, or a place where the implementation
     deliberately deviates from the issue's suggestion. -->

## Checklist

- [ ] One issue only — no unrelated changes
- [ ] No version bump, no publish, no merge
- [ ] Commit message follows `type(scope): summary`
- [ ] Docs updated if behaviour changed (`apps/docs`)
