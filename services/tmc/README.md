The TestMyCode exercise service is used for programming exercises. Handles exercises of the `"tmc"` exercise type.

## Setup

1. Run `bin/download-tmc-langs` in the project root directory.

## Update to langs version using 0.25.1 as an example

1. Update the contents of the `tmc-langs-version` file to `0.25.1`
2. Run `bin/download-tmc-langs` in the project root directory.
3. Update `src/components/tmc/cli.d.ts` and the comment inside
4. Run `npx ts-auto-guard --project services/tmc/tsconfig.json --paths services/tmc/src/tmc/cli.d.ts --export-all` to update the type guard

## Sample private spec

```json
{
  "id": "1234",
  "repository_id": "1234",
  "part": "part01",
  "name": "ex01",
  "repository_url": "https://github.com/testmycode/tmc-testcourse",
  "checksum": [1, 2, 3, 4],
  "download_url": "project-331.local/api/v0/files/repository_exercises/e48717c3-fd7d-41e9-a2e5-36ce06fcd943/4d24291f-dd61-43cc-83e2-4707a7278425"
}
```

upload url: post project-331.local/api/v0/files/upload
