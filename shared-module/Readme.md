# Shared module

This project consists of multiple programs that sometimes need to share code. The shared code is placed in shared module. Also, some programs are not a part of this repository, but they still need access to some parts of the shared module. Due to different programs needing access to slightly different kinds of code, the shared module has been split into multiple packages. The packages needed by external programs are published to NPM.

The programs in the repository will use direct copies of the packages instead of the NPM packages. This is done to make it easier to develop the shared module and the programs at the same time. This is accomplished with a program synchronizes hard links of the shared modules into the programs `src` directory. The reason why we do this way is this method works well with the build and bundle our applications.

To ensure that the syncing is up-to-date, you can use the following command on the root of the repository:

```bash
bin/shared-module-sync-watch
```

See `sync.ts` for implementation details.
