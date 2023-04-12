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
npm run test-nohtml # runs tests without the html report
npm run test-headed # runs tests with with a visible browser
npm run test-slowmo # runs tests in slow motion
npm run test-video # runs tests and records a video to `system-tests/test-results`
npm run test-debug # For debuggin a test https://playwright.dev/docs/debug#run-in-debug-mode
npm run test-ui # opens the playwright ui
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

## Helper functions

- getLocatorForNthExerciseServiceIframe - Locator for either interacting with an exercise service iframe or for taking a screenshot of the iframe. See [example](https://github.com/rage/secret-project-331/blob/11f8dc9ff998277618eb77f4f0d2830da9e6344a/system-tests/src/tests/quizzes/feedback/multiple-choice.spec.ts#L41-L57).
- selectCourseInstanceIfPrompted - Selects course instance in course material if the prompt appears. Useful if there are many tests that access the same course using the same user because every user gets the dialog only the first time they access the course. Always select the course instance using this funciton instead of writing custom code to interact with the dialog.
- showToastInfinitely / showToastNormally

  Sometimes we want to take a screenshot that has a toast notfication. However, this causes a race condition because by default toasts disappear automatically. To avoid this, one can call `showToastInfinetly` before clicking the thing that causes the notification to appear and then call `showToastNormally` afterwar the screenshot has been taken.

### Example tests

- [login.spec.ts](src/tests/login/login.spec.ts) &mdash; Basic examples
- [mediaUpload.spec.ts](src/tests/cms/mediaUpload.spec.ts) &mdash; Screenshot comparison example

### Screenshots / Visual snapshots

For all UI parts of the application it is important to take screenshots in the tests so that we can track how the application looks like. We have a custom function `expectScreenshotsToMatchSnapshots` for taking these, which does the following:

- Waits for the desired content to appear and waits it to stop moving in case the view has animations.
- Takes a screenshot of the current page in multiple screen sizes
- Records the taken image to version control so that we can make comparisons to the images in the future and so that it's easy to look at the UI changes during code review.
- Compares the taken image to a previously taken image and fails the test if they don't match
- Runs accessibility checks on the page being screenshotted

If you have changed how the UI looks like, you can update the image snapshots with `npm run update-snapshots` and commit these to Git. If you accidentally overwrite some snapshots that you didn't intend to change in your branch, please revert the changes with the script `bin/git-restore-screenshots-from-origin-master` from the repo root.

Example usage of `expectScreenshotsToMatchSnapshots`:

```js
test("test with screenshots", async ({ headless, page }, testInfo) => {
  // navigate somewhere, do actions until we want to take a screenshot
    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      testInfo
      headless,
      // a unique name for the image
      snapshotName: "model-solutions-in-submissions",
      // an array of locators
      // that need to be visible and not moving before taking the screenshot
      // it is important to choose this carefully, because otherwise we might take the screenshot
      // before the UI is ready for it
      waitForTheseToBeVisibleAndStable: [page.getByText("Welcome to the course")],
    })

}
```

### Tracing test results

In order to trace the test results, run the `npm run view-trace` with the `trace.zip` file as a parameter

```sh
npm run view-trace test-results/path_to/trace.zip
```

This should open a window where you can see each step of test.

### Debugging tests / selectors

The recommended way to debug tests is to use the [playwright-vscode](https://github.com/microsoft/playwright-vscode) extension. It should be already installed since it's a recommended extension in the project's workspace. See the extension's README for more information.

Alternatives: `npm run test-debug` or `npm run open`.

## Useful links

- [Playwright](https://playwright.dev/docs/intro/)
- [Playwright test runner](https://playwright.dev/docs/test-intro)
