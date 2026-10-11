# Local reader boundary validation

Run the application suite with `npm test`.
Run the independent authorization suite with `npm run test:rules`.

The Rules suite requires Firebase CLI and Java on PATH. Validated locally with
Node 20.19.4, npm 11.10.1, Firebase CLI 15.33.0, Java 21.0.12.1, Database Emulator
4.11.2 and the locked dev dependency `@firebase/rules-unit-testing` 5.0.0.
No new runtime dependency is required.

The command starts only the Database Emulator on `127.0.0.1:9000`, using the
`demo-reader-privacy` project. The test process fails closed unless that exact
emulator endpoint is supplied. Fixtures are synthetic; no production credentials,
data import, migration or deployment are involved. Expected permission-denied
warnings are denial assertions, not test failures.

The local Rules file is not evidence of deployed production protection. Local
emulator PASS and production authorization verification are separate gates.
Readers subscribe to independent SH, schedule and roster streams; delivery does
not establish an atomic cross-path snapshot or a server write acknowledgement.
