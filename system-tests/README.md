# System tests

In project root execute `bin/test`.

Run test suites with command `npm run test`.

Tests can be found in `src/tests/`.

## Writing tests

Start test environment from project root with `bin/test`.

> NB! Always setup the database by running before each test `bin/setup-system-test-db`.

Record new tests with Playwright by changing directory, `cd system-tests`, and run `npm run create-login-states`.  
To start recoding, run one of the following:

- `npm run record-test` &mdash; Record without login state
- `npm run record-test-admin` &mdash; Record as admin
- `npm run record-test-teacher` &mdash; Record as teacher
- `npm run record-test-user` &mdash; Record as user

Once you've recorded, copy the code automatically written by the recorder and manually insert assertions where necessary.

### Visual comparison

If you are using [visual comparison](https://playwright.dev/docs/test-snapshots/) e.g. as following / making changes that affect visual comparison:

```js
const screenshot = await picture.screenshot()
expect(screenshot).toMatchSnapshot(`picture.png`, { threshold: 0.2 })
```

Remember to update Playwright snapshots with `npm run update-snapshots` and commit these to Git.

## Useful links

- [Playwright](https://playwright.dev/docs/intro/)
- [Playwright test runner](https://playwright.dev/docs/test-intro)
