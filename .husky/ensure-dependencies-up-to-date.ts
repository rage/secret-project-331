import path from "path"
import { exec as execOriginal, spawn } from "child_process"
import { promisify } from "util"
import { readFile, writeFile, mkdir } from "fs/promises"

const exec = promisify(execOriginal)

const currentDir = __dirname
const projectRoot = path.resolve(currentDir, "..")
const savedCommitHashesPath = `${projectRoot}/.husky/_/saved-hashes`

async function main(): Promise<void> {
  await mkdir(savedCommitHashesPath, { recursive: true })
  await detectChange("package-lock.json", "package-lock", async () => {
    console.log("Running npm ci to install latest dependencies.")
    console.log(`> npm ci`)
    await runCommandWithVisibleOutput("npm", ["ci"])
  })
  await detectChange("shared-module/src", "shared-module", async () => {
    console.log("Installing the shared module again.")
    console.log(`> npm run postinstall`)
    await runCommandWithVisibleOutput("npm", ["run", "postinstall"])
  })
}

async function detectChange(
  relativePath: string,
  key: string,
  onChangeDetected: () => Promise<void>,
): Promise<void> {
  const hash = await getLatestCommitHash(relativePath)
  const savedHash = await getSavedCommitHash(key)
  if (hash === savedHash) {
    return
  }
  console.log(`Detected a change in '${relativePath}'. (Saved hash: '${savedHash}', New hash: '${hash}')`)
  await onChangeDetected()
  await writeFile(`${savedCommitHashesPath}/${key}`, hash)
}

async function getSavedCommitHash(key: string): Promise<string | null> {
  try {
    return await readFile(`${savedCommitHashesPath}/${key}`, "utf-8")
  } catch (e) {
    // Happens usually when we have not written yet
    return null
  }
}

function runCommandWithVisibleOutput(program: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const handle = spawn(program, args, { cwd: process.cwd(), detached: false, stdio: "inherit" })
    handle.on("close", (code) => {
      if (code !== 0) {
        reject()
        return
      }
      resolve()
    })
  })
}

async function getLatestCommitHash(relativePath: string): Promise<string> {
  const res = await exec(`git log -n 1 --pretty=format:%H -- '${projectRoot}/${relativePath}'`)
  return res.stdout.trim()
}

main()
