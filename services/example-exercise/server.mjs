// Production server. Zero deps (only node: builtins) so the slim image ships no node_modules.
//   1. Serve dist/client static assets under the base path.
//   2. Forward /{base}/api/* and /{base}/_serverFn/* to the TanStack Start server-entry fetch
//      handler with the base stripped: server routes are declared at logical paths (/api/grade),
//      don't inherit the router basepath (TanStack/router #4888), and so need them unprefixed.
//   3. Serve the prerendered SPA shell (dist/client/_shell.html) for other GET navigations; the
//      client router (with basepath) renders the matched route.
//   4. Stamp the iframe/CORS/CSP headers on EVERY response, including static assets and @fontsource
//      fonts the opaque-origin iframe fetches cross-origin — Start middleware skips static
//      responses, which is why this server exists.
//   5. Bind 0.0.0.0:$PORT.
import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { createServer } from "node:http"
import { extname, join, normalize } from "node:path"
import { Readable } from "node:stream"

// Built server-entry: { fetch(request) => Response }.
import serverEntry from "./dist/server/index.js"
import { IFRAME_HEADERS } from "./iframe-headers.mjs"

const ROOT = import.meta.dirname
const CLIENT_DIR = join(ROOT, "dist", "client")
const SHELL = join(CLIENT_DIR, "_shell.html")
const PORT = Number(process.env.PORT) || 3002
// Trailing slash trimmed.
const BASE_PATH = (process.env.PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "")

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
}

/** Remove the base prefix from a URL pathname (so it maps to files / logical routes). */
function stripBase(pathname) {
  if (!BASE_PATH) {
    return pathname
  }
  if (pathname === BASE_PATH) {
    return "/"
  }
  if (pathname.startsWith(BASE_PATH + "/")) {
    return pathname.slice(BASE_PATH.length)
  }
  return pathname
}

/** Resolve a URL pathname to a file inside dist/client, or null if missing / escaping the root. */
async function resolveStatic(pathname) {
  let rel
  try {
    rel = decodeURIComponent(stripBase(pathname))
  } catch {
    return null
  }
  const full = normalize(join(CLIENT_DIR, rel))
  if (full !== CLIENT_DIR && !full.startsWith(CLIENT_DIR + "/")) {
    return null
  }
  try {
    const stats = await stat(full)
    if (stats.isFile()) {
      return full
    }
  } catch {
    /* not a file */
  }
  return null
}

function isApiRequest(pathname) {
  const rel = stripBase(pathname)
  return rel === "/api" || rel.startsWith("/api/") || rel.startsWith("/_serverFn")
}

function sendFile(res, filePath, { status = 200, cache = "no-cache" } = {}) {
  res.writeHead(status, {
    ...IFRAME_HEADERS,
    "Content-Type": MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": cache,
  })
  createReadStream(filePath).pipe(res)
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
    const isGet = req.method === "GET" || req.method === "HEAD"

    // 1) static assets
    if (isGet) {
      const file = await resolveStatic(url.pathname)
      if (file) {
        const cache = stripBase(url.pathname).includes("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache"
        sendFile(res, file, { cache })
        return
      }
    }

    // 2) server routes (/api/*, server functions): strip the base and forward to the fetch handler.
    if (isApiRequest(url.pathname)) {
      const forwardUrl = new URL(url)
      forwardUrl.pathname = stripBase(url.pathname)
      const request = new Request(forwardUrl.toString(), {
        method: req.method,
        headers: req.headers,
        body: isGet ? undefined : Readable.toWeb(req),
        duplex: isGet ? undefined : "half",
      })
      const response = await serverEntry.fetch(request)
      const headers = new Headers(response.headers)
      for (const [k, v] of Object.entries(IFRAME_HEADERS)) {
        headers.set(k, v)
      }
      const outHeaders = Object.fromEntries(headers.entries())
      // Headers.entries() comma-joins duplicate headers, which corrupts multiple Set-Cookie
      // values; restore them as an array so Node emits a separate Set-Cookie line per cookie.
      const setCookies = headers.getSetCookie()
      if (setCookies.length > 0) {
        outHeaders["set-cookie"] = setCookies
      }
      res.writeHead(response.status, outHeaders)
      if (response.body) {
        Readable.fromWeb(response.body).pipe(res)
      } else {
        res.end()
      }
      return
    }

    // 3) SPA shell for navigation routes. A GET that looks like a file (has an extension) but was
    // not found in step 1 is a missing asset — return 404, not the shell (the browser would try to
    // parse it as JS/CSS).
    if (isGet && !extname(stripBase(url.pathname))) {
      sendFile(res, SHELL)
      return
    }

    res.writeHead(404, { ...IFRAME_HEADERS, "Content-Type": "text/plain; charset=utf-8" })
    res.end("Not found")
  } catch (error) {
    console.error("server.mjs error:", error)
    res.writeHead(500, { ...IFRAME_HEADERS, "Content-Type": "text/plain; charset=utf-8" })
    res.end("Internal server error")
  }
})

server.listen(PORT, "0.0.0.0", () => {
  console.log(`example-exercise listening on http://0.0.0.0:${PORT}${BASE_PATH || ""}`)
})
