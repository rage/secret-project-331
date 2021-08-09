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
    "system-tests/src/shared-module",
  ]

  const typesTargetFolders = [
    "services/cms/types",
    "services/course-material/types",
    "services/example-exercise/types",
    "services/headless-lms/types",
    "services/main-frontend/types",
    "system-tests/types",
  ]

  const promises = targetFolders.map(async (targetFolder) => {
    // Cleanup to make sure deleted files get deleted. Will not fail if the
    // folder does not exist
    await exec(`rm -rf '${projectRoot}/${targetFolder}'`)
    const command = `cp -r '${projectRoot}/shared-module/src' '${projectRoot}/${targetFolder}'`
    console.log(`> ${command}`)
    await exec(command)
  })
  const promiseTypes = typesTargetFolders.map(async (typeTargetFolder) => {
    await exec(`rm -rf '${projectRoot}/${typeTargetFolder}'`)
    const command = `cp -r '${projectRoot}/shared-module/types' '${projectRoot}/${typeTargetFolder}'`
    console.log(`> ${command}`)
    await exec(command)
  })

  await Promise.all(promises)
  await Promise.all(promiseTypes)
}

main()
