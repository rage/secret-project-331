import { deepStrictEqual } from "assert"
import { readFile } from "fs/promises"

import { extractTarZstd } from "@/util/helpers"
import { ExerciseFile } from "@/util/stateInterfaces"

test("Supports long file names in archives", async () => {
  const testArchive = await readFile("./tests/util/test.tar.zst")
  const res = await extractTarZstd(testArchive)

  const expected: ExerciseFile = {
    filepath:
      "test data directory with an unnecessarily long name that may cause issues for some libraries that do not support long names. this test data directory exists to ensure that the library we use supports long names and that it will not cause issues/another directory with an unnecessarily long name that may cause issues for some libraries that do not support long names. this test data directory exists to ensure that the library we use supports long names and that it will not cause issues/yet another directory with an unnecessarily long name that may cause issues for some libraries that do not support long names. this test data directory exists to ensure that the library we use supports long names and that it will not cause issues/the final directory with an unnecessarily long name that may cause issues for some libraries that do not support long names. this test data directory exists to ensure that the library we use supports long names and that it will not cause issues/test data text file with an unnecessarily long name that may cause issues for some libraries that do not support long names. this test data directory exists to ensure that the library we use supports long names and that it will not cause issues",
    contents: "hello!\n",
  }
  deepStrictEqual(res, [expected])
})
