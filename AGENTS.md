# Repository contract

## Scope and repository guard
- Validate repository identity with `git rev-parse --show-toplevel` before acting.
- Require `/Users/Jesus/Developer/dilan_editor_horario` as the expected checkout.
- Stop if the detected toplevel basename is not `dilan_editor_horario`.
- If `scripts/guard_repo.sh` exists, run it and require PASS before proceeding.
- Inspect the current branch and working tree before making changes.

## Product
This is a real operational schedule editor, not a demo.

## Architecture
- Preserve Vite + Vanilla JavaScript unless measurable evidence justifies a framework change.
- Do not introduce React by preference alone.
- Prefer the simplest implementation that satisfies the contract.
- Keep data flow explicit and side effects controlled.
- Prefer pure domain logic where practical.
- Do not refactor unrelated code.

## Evidence boundary
Use these implementation labels only:
- IMPLEMENTED
- DESIGNED
- SIMULATED
- PLANNED
- NOT_VERIFIED
- NOT_RUN

Never present inferred, planned, or designed behavior as implemented.
Attach reproducible evidence to implementation claims and gate results.
Preserve exact commands, tool versions, relevant inputs, checksums, and deterministic seeds where applicable.

## Definition of Done
Evaluate applicable work using these gates:
- DESIGN_REVIEW
- FUNCTIONAL_TESTS
- TYPECHECK
- LINT
- BUILD
- ACCESSIBILITY
- RESPONSIVE
- SECURITY
- PERFORMANCE
- BROWSER_VALIDATION
- MANUAL_VISUAL_ACCEPTANCE
- REGRESSION
- ROLLBACK_READINESS

Allowed gate states:
- PASS
- FAIL
- OPEN
- LIMITED
- NOT_RUN
- NOT_VERIFIED

NOT_RUN and NOT_VERIFIED can never be treated as PASS.
Record evidence and limitations for each applicable gate.

## Security
- The client is never the authorization authority.
- Firebase Rules must enforce read/write authorization.
- Client-side isAdmin state is not a security boundary.
- Persisted and remote data are untrusted input.
- Prevent stored and reflected DOM XSS.
- Never place secrets in VITE_* environment variables.
- Use OWASP ASVS 5.x and NIST SSDF as proportional references without claiming unverified compliance.

## Data integrity
- Navigation must not cause implicit persistence.
- Historical records must not change silently when current catalogs are edited.
- Destructive operations must validate all affected persisted data.
- Mutations must expose authoritative success/failure state.
- Concurrency conflicts must be handled explicitly.
- Schema migrations must be explicit, versioned, and recoverable where appropriate.

## Required UX states
General:
- idle
- loading
- success
- empty
- partial
- permission denied
- validation error
- network/server failure

Mutations:
- proposal
- confirmation required
- applying
- completed
- conflict
- expired
- cancelled
- failed

## Accessibility
Use WCAG 2.2 AA as the baseline:
- semantic HTML
- complete keyboard operation
- visible focus
- logical focus order
- accessible names and labels
- sufficient contrast
- reflow
- adequate touch targets
- accessible validation/errors
- reduced-motion support
- no critical hover-only interaction
- ARIA only when native HTML is insufficient

## Responsive
Support real use down to approximately 320 CSS pixels.
Do not replace useful operational tables with card layouts solely for mobile aesthetics.

## Performance
Targets:
- LCP <= 2.5 s
- INP <= 200 ms
- CLS <= 0.1

Do not claim performance improvements without measurement.

## Visual design
The final UI must be deliberately designed, operationally dense, and visually differentiated.

Use:
- strong hierarchy
- deliberate typography
- consistent spacing and alignment
- explicit design tokens
- controlled depth
- purposeful motion
- high information clarity

Avoid:
- generic SaaS composition
- unnecessary card grids
- gratuitous glassmorphism
- AI-neon aesthetics
- excessive gradients
- decorative shadows
- non-functional animation

The schedule table remains the primary product surface.

## Change protocol
Before modifying behavior:
1. Inspect current behavior.
2. Identify contracts and authority boundaries.
3. Identify regression-sensitive areas.
4. Preserve correct behavior.
5. Make the smallest coherent change.
6. Test it.
7. Inspect the diff.
8. Perform visual validation when applicable.

## Git discipline
- Work only on phronelis/stabilization-v1 or branches derived from it.
- Never modify main directly.
- Do not commit or push without explicit instruction.
- Keep changes small and auditable.
- Add regression tests for corrected defects.
- Require CI evidence before integration.
- Preserve rollback capability.

## Intervention order
1. P0 stabilization:
   - security/XSS
   - data integrity
   - schedule correctness
   - persistence/synchronization
   - destructive operations
   - regression tests
   - CI
2. Schema, history, and concurrency hardening.
3. UI/UX, accessibility, and responsive elevation.
4. Release validation.
