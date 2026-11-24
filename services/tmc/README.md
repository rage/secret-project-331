The TestMyCode exercise service is used for programming exercises. Handles exercises of the `"tmc"` exercise type.

## Setup

Run `bin/tmc-langs-setup` in the project root directory.

## Update langs

Run `bin/tmc-langs-update {version}` in the project root directory, for example `bin/tmc-langs-update 0.25.1`.

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

## Sandbox images

Submissions are tested in a pod running the image tmc-langs picks for the exercise (`prepare-submission` returns it). The images are built outside this repository.

| Exercise type      | Default image                                       |
| ------------------ | --------------------------------------------------- |
| Python 3, no-tests | `eu.gcr.io/moocfi-public/tmc-sandbox-python:latest` |
| Java (Maven, Ant)  | `eu.gcr.io/moocfi-public/tmc-sandbox-java:latest`   |
| C (make)           | `eu.gcr.io/moocfi-public/tmc-sandbox-make:latest`   |
| C#                 | `eu.gcr.io/moocfi-public/tmc-sandbox-csharp:latest` |
| R                  | `eu.gcr.io/moocfi-public/tmc-sandbox-r:latest`      |

An exercise overrides its image with `sandbox_image` in its `.tmcproject.yml`, for example `sandbox_image: eu.gcr.io/moocfi-public/tmc-sandbox-csharp:latest`.

A C# exercise builds with the .NET SDK in its image, so its target framework (for example an old `netcoreapp`) must be one that SDK supports; otherwise the build fails and the submission gets a compile or generic error. Point `sandbox_image` at an image with the SDK the exercise needs.

The time a test run may take is the exercise's `tests_timeout_ms` (tmc-langs' default when unset) plus build overhead, at most 15 minutes.
