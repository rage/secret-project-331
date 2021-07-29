# Shared module

The src folder is copied to different services so that they can share the common code. The copied code is ignored in git so that we don't duplicate the code in version control.

The shared module is set up automatically when one runs `npm ci` in the repo root.

Whenever you change the code here, you need to run `npm run postinstall` in the project root to update the shared code to the different places of the project.

## Developing the modules

You can preview different components and develop them in isolation with storybook.

To start the development environment, run the following commands in the `shared-module`-folder:

```bash
npm ci
npm run storybook
```

To get new entries to the Storybook UI, add new stories to the `stories` folder. All the shared code needs to live in the `src` code.

Adding controls: https://storybook.js.org/docs/react/essentials/controls

## Type checking all packages when something changes here

Do this for example if typescript compilation fails in CI after changes.

In the root of the repo:

```bash
npm run postinstall
bin/npm-ci-all
bin/tsc-check-all
```

### Tests

Tests are located in the `tests`-folder. The tests are not inside the `src` folder because we don't want to copy the test files to all the services.
