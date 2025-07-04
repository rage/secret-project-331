# Updating dependencies

Do these steps in order and commit between steps:

## Node version update

Check if we are using the current node LTS version from by comparing a `.nvmcrc` and https://nodejs.org/en/. If a newer LTS version is available do the following steps:

1. Open all `.nvmrc` files by running command: `find -name '.nvmrc' | grep --invert-match node_modules | xargs code`
2. Update all files to contain the new version number
3. Go to the root of the project and install the new version of node by running command `nvm install`
4. Open all Dockerfiles with command: `find -iname '*dockerfile' | grep --invert-match node_modules | xargs code`
5. Replace node version in the FROM statements
6. Update the pull command in `bin/build-dockerfile-node-base`

## Updating node dependencies

When updating dependencies, you need to pay special attention to the cms service. It includes the gutenberg dependency, you **must"** always read the changelog for it so that you can determine if it breaks backwards compatibility in some way. Tests won't catch all backwards incompatible changes.

Before you start: Run this: `npm ci && bin/npm-ci-all`

One by one cd to a service and run `npx npm-check --update`. Read the changelogs for breaking dependencies if necessary and select all updates. After update is done, run `npx tsc --noEmit` to catch new type errors and then commit the results. Finally, you can run `npm audit fix`.

You can get a list of targets that need updating by running: `find -name 'package.json' | grep --invert-match 'node_modules\|.next'`.

Start by upgrading the dependencies in the root of the repo and run `npm run eslint` to catch new changes to ESLint rules / prettier formatting. You can also use `npm run eslint:open:vscode` if you want to open all the files with ESLint problems.

## Update rust dependencies

Update the `channel` in `rust-toolchain.toml` to the latest stable version (https://forge.rust-lang.org/).

Make sure you have [cargo-edit](https://github.com/killercup/cargo-edit) installed. After that, run the following commands:

```bash
cd services/headless-lms
cargo upgrade --incompatible allow --pinned allow --recursive true
cargo update
```

Next, we will check if the code still compiles and works. Here's how to setup it correctly:

First, start `bin/dev-only-db` in one terminal. Once the database if fully up, run the following:

```bash
bin/sqlx-database-reset
bin/sqlx-prepare
bin/cargo-check
bin/cargo-clippy-fix
bin/cargo-fmt
```

Then start `bin/dev` in another terminal. Once it's running, you can run:

```bash
bin/cargo-test
```

## Updating autogenerated types

Run the following commands in the root of the repo:

```bash
bin/extract-gutenberg-types
```

Then, assuming you still have the `bin/dev` or `bin/dev-only-db` open in another terminal, run:

```bash
bin/generate-bindings
bin/generate-doc-files
```

## Testing the system

Compile the system with `bin/dev` and `bin/test`. Try to use the different parts of the applications and see if anything looks funny. Try also running the system tests. Pay special attention to the `cms` service.

## Base image updates

1. Run command: `bin/build-dockerfile-development-base && docker push eu.gcr.io/moocfi-public/project-331-headless-lms-dev-base && bin/build-dockerfile-production-base && docker push eu.gcr.io/moocfi-public/project-331-headless-lms-production-base`
2. Run command: `bin/build-dockerfile-node-base && docker push eu.gcr.io/moocfi-public/project-331-node-base`

Run `bin/minikube-pull-images` on your host and instruct others to run this command as well once your update PR is merged.
