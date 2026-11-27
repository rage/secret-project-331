/** Where submissions are graded: `pod` in a Kubernetes pod per submission, `remote` on the shared sandbox servers. */
export type GradingSandboxMode = "pod" | "remote"

/** Why `/api/test` and `/api/testrun` answer 501: they run on pods, which remote mode has no rights to create. */
export const REMOTE_TEST_RUNS_UNAVAILABLE =
  "Test runs are not available when the service grades on remote sandboxes (TMC_GRADING_SANDBOX=remote)"

/** One sandbox server. */
export interface SandboxServer {
  /** Base URL without credentials or a trailing slash. */
  baseUrl: string
  /** `Authorization` header for the credentials the configured URL carried; fetch refuses URLs with userinfo. */
  authorization: string | null
}

export interface RemoteSandboxConfig {
  servers: SandboxServer[]
  /** The public URL of this service's `/api/sandbox-results`, which the sandbox calls back. */
  notifyUrl: string
  /** The sandbox's `SANDBOX_CALLBACK_SECRET`; null sends requests unsigned. */
  notifySecret: string | null
  /** AES-256 keys for the callback token: the first seals, all of them open. */
  tokenKeys: Buffer[]
  /** The Redis that holds pending gradings, shared by every replica. */
  redisUrl: string
}

/** The grading sandbox configuration is invalid. */
export class GradingConfigError extends Error {
  public constructor(problems: string[]) {
    super(`Invalid grading sandbox configuration: ${problems.join("; ")}`)
    this.name = "GradingConfigError"
  }
}

type Env = Record<string, string | undefined>

/** @throws GradingConfigError on a value other than `pod` or `remote`. */
export function gradingSandboxMode(env: Env = process.env): GradingSandboxMode {
  const mode = env.TMC_GRADING_SANDBOX?.trim() || "pod"
  if (mode !== "pod" && mode !== "remote") {
    throw new GradingConfigError([`TMC_GRADING_SANDBOX must be "pod" or "remote", got "${mode}"`])
  }
  return mode
}

const TOKEN_KEY_BYTES = 32

/** @throws GradingConfigError listing every missing or malformed variable. */
export function parseRemoteSandboxConfig(env: Env): RemoteSandboxConfig {
  const problems: string[] = []

  const servers: SandboxServer[] = []
  for (const raw of splitList(env.TMC_REMOTE_SANDBOX_URLS)) {
    const server = parseServer(raw)
    if (server) {
      servers.push(server)
    } else {
      // The raw value can carry credentials.
      problems.push(`TMC_REMOTE_SANDBOX_URLS has an entry that is not an http(s) URL`)
    }
  }
  if (servers.length === 0 && problems.length === 0) {
    problems.push("TMC_REMOTE_SANDBOX_URLS must list at least one URL")
  }

  const notifyUrl = env.TMC_REMOTE_SANDBOX_NOTIFY_URL?.trim() ?? ""
  const parsedNotifyUrl = URL.parse(notifyUrl)
  if (
    !parsedNotifyUrl ||
    !isHttp(parsedNotifyUrl) ||
    parsedNotifyUrl.username ||
    parsedNotifyUrl.password
  ) {
    problems.push("TMC_REMOTE_SANDBOX_NOTIFY_URL must be an http(s) URL without credentials")
  }

  const tokenKeys = splitList(env.TMC_REMOTE_SANDBOX_TOKEN_KEY).map((key) =>
    Buffer.from(key, "base64"),
  )
  if (tokenKeys.length === 0 || tokenKeys.some((key) => key.length !== TOKEN_KEY_BYTES)) {
    problems.push(
      `TMC_REMOTE_SANDBOX_TOKEN_KEY must be one or more comma-separated base64 keys of ${TOKEN_KEY_BYTES.toString()} bytes`,
    )
  }

  const redisUrl = env.TMC_REMOTE_SANDBOX_REDIS_URL?.trim() ?? ""
  const parsedRedisUrl = URL.parse(redisUrl)
  if (
    !parsedRedisUrl ||
    (parsedRedisUrl.protocol !== "redis:" && parsedRedisUrl.protocol !== "rediss:")
  ) {
    problems.push("TMC_REMOTE_SANDBOX_REDIS_URL must be a redis:// or rediss:// URL")
  }

  if (problems.length > 0) {
    throw new GradingConfigError(problems)
  }
  return {
    servers,
    notifyUrl,
    notifySecret: env.TMC_REMOTE_SANDBOX_NOTIFY_SECRET?.trim() || null,
    tokenKeys,
    redisUrl,
  }
}

let cachedConfig: RemoteSandboxConfig | null = null

/** The remote sandbox configuration from the environment, parsed once. */
export function remoteSandboxConfig(): RemoteSandboxConfig {
  cachedConfig ??= parseRemoteSandboxConfig(process.env)
  return cachedConfig
}

/**
 * Checks the grading configuration so a misconfigured service fails to start rather than at its
 * first submission.
 *
 * @throws GradingConfigError
 */
export function validateGradingConfig(env: Env = process.env): void {
  if (gradingSandboxMode(env) === "remote") {
    parseRemoteSandboxConfig(env)
  }
}

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "")
}

function isHttp(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:"
}

function parseServer(raw: string): SandboxServer | null {
  const url = URL.parse(raw)
  if (!url || !isHttp(url)) {
    return null
  }
  let authorization: string | null = null
  if (url.username || url.password) {
    const credentials = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`
    authorization = `Basic ${Buffer.from(credentials).toString("base64")}`
    url.username = ""
    url.password = ""
  }
  return { baseUrl: url.toString().replace(/\/+$/, ""), authorization }
}
