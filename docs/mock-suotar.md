# Mock Suotar

A stand-in for the University of Helsinki Suotar study-registry API, so credit registration can be
developed and tested without the real service. It is mounted at `/api/v0/mock-suotar` only when
`TEST_MODE` and `USE_MOCK_SUOTAR_ENDPOINT` are both on, which is the case in the dev and test
overlays. With the flags off the routes are absent, not refusing.

Credit registrations made against the mock are **simulated and are not recorded in Sisu**. The
server logs a warning at startup when the mock is enabled.

## Where its state lives

In Redis, on its own database index (`MOCK_SUOTAR_REDIS_DB_INDEX`, default 2 — the cache uses 1).
The world survives recompiles and pod restarts. It is replaced by whatever replaces the database
under it: `bin/setup-system-test-db` and `bin/seed` reseed and the seed pushes a fresh world, while
`bin/setup-system-test-db-fast-but-wrong-timestamps` clears it so the next request rebuilds it.

Reach the index by hand with `kubectl exec -it <redis pod> -- redis-cli -n 2`, but prefer the
control command below: a script hardcoding the index silently stops matching.

## Zero setup

There is nothing to do. The first request to a contract endpoint installs the same world the seed
pushes. For a hands-free demo where a submission registers itself after one verify poll, apply the
`happy-path-auto` scenario.

## Contract endpoints

All `POST`, all batch endpoints taking a JSON array and answering with one item per request item in
request order. Per-item outcomes are HTTP 200; only request-level failures are 4xx/5xx.

| Path (under `/api/v0/mock-suotar/`)             |
| ----------------------------------------------- |
| `persons/resolve-by-student-numbers`            |
| `enrolments/resolve`                            |
| `enrolments/list-by-course`                     |
| `attainments/import`                            |
| `attainments/verify`                            |
| `open-university-product-access-tokens/resolve` |

Any auth scheme is accepted as long as the credential is `MOCK_SUOTAR_TOKEN`. The control surface
needs no credential.

## Control surface

`POST /api/v0/mock-suotar/control/command` takes a tagged command and answers with a
status-discriminated result. `GET /control/commands` lists every command with its argument shape and
whether the automated suite may call it. `GET /control/health` reports the world's size and whether
it belongs to this database. `GET /control/world` dumps the whole thing.

The two tick routes — `POST /control/run-tick?phase=` and `POST /control/run-registrar-tick` — drive
the pipeline rather than the world, and stay separate routes.

### The four calls worth knowing

Set up a student who can be registered end to end:

```bash
curl -sX POST http://project-331.local/api/v0/mock-suotar/control/command \
  -H 'Content-Type: application/json' \
  -d '{"command":"applyScenario","name":"happy-path",
       "args":{"studentNumber":"900000101","courseCode":"CRS-101"}}'
```

See what the world looks like right now:

```bash
curl -s http://project-331.local/api/v0/mock-suotar/control/world
```

See what the worker has actually been sending for one student:

```bash
curl -sX POST http://project-331.local/api/v0/mock-suotar/control/command \
  -H 'Content-Type: application/json' \
  -d '{"command":"listCalls","studentNumber":"900000101"}'
```

Stop waiting and register their submission now — nothing ripens on its own:

```bash
curl -sX POST http://project-331.local/api/v0/mock-suotar/control/command \
  -H 'Content-Type: application/json' \
  -d '{"command":"transitionSubmissionsFor","studentNumber":"900000101","to":"registered"}'
```

### Breaking Sisu on purpose

A fault names four things: the endpoint, the stage, what it matches and the effect. The stage is
required and there is no default, because a fault after the write has committed means something
entirely different from the same fault before it.

```bash
curl -sX POST http://project-331.local/api/v0/mock-suotar/control/command \
  -H 'Content-Type: application/json' \
  -d '{"command":"armFault","id":"outage-503",
       "when":[{"endpoint":"import_attainments"},{"stage":"requestGate"},
               {"studentNumber":"900000101"}],
       "then":{"kind":"requestLevel","status":503,"code":"sisuTemporarilyUnavailable"},
       "lifetime":{"matchingCalls":1}}'
```

If a fault never fires, ask why before reading the source. `explainFault` validates it without
arming it, and given a call pasted back from the log says per stage which predicate failed:

```bash
curl -sX POST http://project-331.local/api/v0/mock-suotar/control/command \
  -H 'Content-Type: application/json' \
  -d '{"command":"explainFault",
       "fault":{"id":"probe","when":[{"endpoint":"import_attainments"},{"stage":"resolve"},
                                     {"studentNumber":"900000101"}],
                "then":{"kind":"itemLevel","code":"sisuTimeout"}},
       "against":{"endpoint":"import_attainments",
                  "items":[{"requestItemId":"cr-1","studentNumber":"900000101",
                            "courseCode":"CRS-101"}]}}'
```

## Two logs, never conflated

`suotar_api_calls` is the audited log the client writes, scrubbed at write time and swept after 90
days. The mock keeps its own capped, unscrubbed list of what it received, which is a debugging view
only and never feeds the audited tables. The mock writes no database table at all; it reads exactly
one value, to tell which database its world belongs to.
