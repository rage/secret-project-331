import fs from "fs"
import path from "path"

const OAUTH_REDIRECT_PID_FILE = path.join(__dirname, "..", ".oauth-redirect-pid")

async function globalTeardown(): Promise<void> {
  try {
    const pid = Number(fs.readFileSync(OAUTH_REDIRECT_PID_FILE, "utf8").trim())
    if (pid > 0) {
      process.kill(pid, "SIGTERM")
    }
  } catch {
    // No pid file or already gone
  } finally {
    try {
      fs.unlinkSync(OAUTH_REDIRECT_PID_FILE)
    } catch {
      // ignore
    }
  }
}

export default globalTeardown
