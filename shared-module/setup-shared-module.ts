/* eslint-disable i18next/no-literal-string */
import { exec as execOriginal } from "child_process"
import path from "path"
import { promisify } from "util"

const exec = promisify(execOriginal)

async function main() {
  const currentDir = __dirname
  const projectRoot = path.resolve(currentDir, "..")

  // the final targets are in .gitignore
  const targetFolders = [
    "services/cms/src/shared-module",
    "services/course-material/src/shared-module",
    "services/example-exercise/src/shared-module",
    "services/headless-lms/shared-module",
    "services/main-frontend/src/shared-module",
    "services/quizzes/src/shared-module",
    "services/tmc/src/shared-module",
    "system-tests/src/shared-module",
  ]

  const promises = targetFolders.map(async (targetFolder) => {
    // rsync is better than cp because it handles deletions and does not trigger a full skaffold rebuild
    const command = `rsync -a --checksum --delete --link-dest='${projectRoot}/shared-module/src/'  '${projectRoot}/shared-module/src/' '${projectRoot}/${targetFolder}/'`
    console.log(`> ${command}`)
    await exec(command)
  })

  await Promise.all(promises)
}

main()
