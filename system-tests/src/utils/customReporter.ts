import ListReporter from "@playwright/test/lib/reporters/list"
import type { FullResult } from "@playwright/test/types/testReporter"
import { readdir, stat } from "fs/promises"

class MyReporter extends ListReporter {
  async onEnd(results: FullResult): Promise<void> {
    await super.onEnd(results)
    if (results.status !== "failed") {
      return
    }

    try {
      await stat("test-results")
    } catch (e) {
      return
    }

    console.log("\x1b[2m")
    console.group("These result files can help with debugging the problem:")
    await printFiles("test-results")
    console.groupEnd()
    console.log("\x1b[0m")
  }
}

async function printFiles(dir: string): Promise<void> {
  const files = await readdir(dir)
  for (const file of files) {
    const filePath = `${dir}/${file}`
    const stats = await stat(filePath)
    if (stats.isDirectory()) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      await printFiles(filePath)
    } else {
      console.log(filePath)
    }
  }
}

export default MyReporter
