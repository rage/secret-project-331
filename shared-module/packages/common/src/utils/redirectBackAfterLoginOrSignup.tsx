"use client"
import useQueryParameter from "../hooks/useQueryParameter"

function figureOutWhichReturnToPathToUse(
  returnPath: string | undefined,
  defaultPath: string,
): string {
  if (!returnPath) {
    return defaultPath
  }

  // Only match paths like /asd, /asd/dfg, ...
  const match = returnPath.match(/^(\/\S+)+/)
  if (match === null) {
    return defaultPath
  }

  // Don't allow "returning" to login or to the signup page
  if (returnPath === "/login" || returnPath === "/signup") {
    return defaultPath
  }

  // Don't allow loops
  if (returnPath.indexOf("return_to") !== -1) {
    return defaultPath
  }

  return returnPath
}

export function validateReturnToRouteOrDefault(
  returnPath: string | undefined,
  defaultPath: string,
): string {
  const res = figureOutWhichReturnToPathToUse(returnPath, defaultPath)

  // Parse the path we're about to return to double check we return only paths and not urls which could redirect to other sites.
  try {
    const parsedUrl = new URL(res, "https://example.com")

    // If we are coming from oauth endpoint, keep query parameters. Still drop any origin to make sure we always return within our site.
    if (parsedUrl.pathname === "/api/v0/main-frontend/oauth/authorize") {
      return parsedUrl.pathname + parsedUrl.search
    }

    // Return pathname with search parameters and hash preserved
    return parsedUrl.pathname + parsedUrl.search + parsedUrl.hash
  } catch (e) {
    console.error(`Could not parse return_to path: ${res}`, e)
  }
  return "/"
}

export function useCurrentPagePathForReturnTo(currentPagePath: string): string {
  const uncheckedReturnTo = useQueryParameter("return_to")
  if (currentPagePath.startsWith("/login") || currentPagePath.startsWith("/signup")) {
    if (uncheckedReturnTo && uncheckedReturnTo !== "") {
      return uncheckedReturnTo
    }
    return "/"
  }
  return process.env.NEXT_PUBLIC_BASE_PATH + currentPagePath
}
