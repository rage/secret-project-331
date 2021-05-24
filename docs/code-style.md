# Code style

In this project code style is enforced with automatic tools. When developing in the codebase it is important to set them up in your git precommit hooks and in your editor so that the style of the code is consistent in every change and every commit you make.

## Setting up precommit hooks

Run `npm ci` in the repository root:

```bash
$ cd Code/secret-project-331/
$ npm ci
```

It will install lint-staged, which will ensure before committing your code passes code style checks.

## Configuring editors

### Visual Studio Code

Open Visual Studio Code in the repository root:

```bash
$ cd Code/secret-project-331/
$ code .
```

Then install the recommended extensions from the popup in the bottom right corner:

![Recommended extensions popup](img/recommended-extensions.png)

After this, your editor should show code style problems automatically and correct the problems that can be automatically corrected when saving files. This is enabled for all developers using this repository with this settings file: `.vscode/settings.json`. Don't edit these settings unless you want to change the default settings for all developers.

The same settings are also available when opening Visual Studio Code in the project subfolders thanks to strategically placed symbolic links.
