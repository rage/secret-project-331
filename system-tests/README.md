# System tests

In project root execute `bin/test` to start test environment.<br />
Run test suites with command `npm run test` or `npm run test-debug` for debugging tests.<br />
Tests can be found in `src/tests/`.

## Running tests

Start test environment from project root with `bin/test`.

The tests can be ran using the following command in the `system-tests` folder:

```sh
npm run test
```

Also, following alternatives are available:

```sh
npm run test-headed # runs tests with with a visible browser
npm run test-slowmo # runs tests in slow motion
npm run test-video # runs tests and records a video to `system-tests/test-results`
npm run test-debug # see https://playwright.dev/docs/debug#run-in-debug-mode
npm run open # opens playwright without running tests
```

## Writing tests

Record new tests with Playwright by changing directory, `cd system-tests`, and run `npm run create-login-states`.<br />
To start recording, run one of the following:

- `npm run record-test` &mdash; Record without login state
- `npm run record-test-admin` &mdash; Record as admin
- `npm run record-test-teacher` &mdash; Record as teacher
- `npm run record-test-user` &mdash; Record as user

Create a new test file somewhere in `src/tests/` named e.g. `foo.spec.ts`.<br />
Once you've recorded, copy the code automatically written by the recorder to your newly created test file and manually insert assertions where necessary.

### Example tests

- [login.spec.ts](src/tests/login/login.spec.ts) &mdash; Basic examples
- [mediaUpload.spec.ts](src/tests/cms/mediaUpload.spec.ts) &mdash; Screenshot comparison example

### Visual comparison

If you are using [visual comparison](https://playwright.dev/docs/test-snapshots/), for example as following or making changes that affect visual comparison:

```js
const screenshot = await newPage.screenshot()
expect(screenshot).toMatchSnapshot(`picture.png`, { threshold: 0.2 })
```

Remember to update Playwright snapshots with `npm run update-snapshots` and commit these to Git.

### Tracing test results

In order to trace the test results, run the `npm run view-trace` with the `trace.zip` file as a parameter

```sh
npm run view-trace test-results/src-tests-latex-latex-block-renders-chromium/trace.zip
```

This should open a window where you can see each step of test.

## Useful links

- [Playwright](https://playwright.dev/docs/intro/)
- [Playwright test runner](https://playwright.dev/docs/test-intro)
