# Notes on GIT

A good reference on GIT: https://git-scm.com/book/en/v2

## Tips

If you are having problems with git opening some things to be edited with vim, you can change the default editor to nano with: `git config --global core.editor "nano"`. Alternatively, you can make VS Code the default git editor: https://code.visualstudio.com/docs/editor/versioncontrol#_vs-code-as-git-editor. In this case note that you will need to close the VS Code window once you're ready to proceed.

## Helper scripts

The repo includes helper scripts to help with common tasks.

- `bin/merge-origin-master`: Allows you to merge the master to your current branch from GitHub without the requirement to switch branches.
- `bin/git-new-feature-branch <branch-name>`: Creates a new feature branch from the master branch on GitHub
- `bin/git-checkout-branch-from-github <branch-name>`: Checkouts a branch from GitHub. The branch name needs to exactly match the branch name on GitHub.
- `bin/git-push-new-branch-to-github`: Pushes the current branch to GitHub and configures it so that you can next time push the branch with just `git push`.
- `bin/git-status-short`: Prints git status but much cleaner and easier to read than the normal git status.
- `bin/git-restore-files-from-github-master <file1> <file2>...`: Restores the specified files from the master branch on GitHub. This discards changes from your local branch for the specified files. Example: `bin/git-restore-files-from-github-master ./README.md ./path/to/another-file/to/be/restored.md`.
