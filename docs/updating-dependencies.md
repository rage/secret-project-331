# Updating dependencies

## Node version update

Check if we are using the current node LTS version from by comparing a `.nvmcrc` and https://nodejs.org/en/. If a newer LTS version is available do the following steps:

1. Open all `.nvmrc` files by running command: `find -name '.nvmrc' | grep --invert-match node_modules | xargs code`
2. Update all files to contain the new version number
3. Go to the root of the project and install the new version of node by running command `nvm install`
4. Open all Dockerfiles with command: `find -iname '*dockerfile' | grep --invert-match node_modules | xargs code`
5. Replace node version in the FROM statements

## Rust version update

1. Run `bin/update-rust`
2. cd to `services/headless-lms`
3. Run command: `docker pull rust:bullseye && docker build . -f DockerfileBase.dockerfile -t eu.gcr.io/moocfi-public/project-331-headless-lms-dev-base && docker push eu.gcr.io/moocfi-public/project-331-headless-lms-dev-base`

## Updating node dependencies

When updating dependencies, you need to pay special attention to the cms service. It includes the gutenberg dependency, you **must"** always read the changelog for it so that you can determine if it breaks backwards compatibility in some way. Tests won't catch all backwards incompatible changes.

One by one cd to a service and run `npx npm-check --update`. Read the changelogs for breaking dependencies if necessary and select all updates. After update is done, run `npx tsc --noEmit` to catch new type errors and then commit the results.

You can get a list of targets that need updating by running: `find -name 'package.json' | grep --invert-match 'node_modules'`.
