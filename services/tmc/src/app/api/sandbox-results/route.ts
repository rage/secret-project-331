import { NextResponse } from "next/server"

/** Returns 404 for unsupported sandbox-results route. */
function notFound() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

export const GET = notFound
export const POST = notFound
export const PUT = notFound
export const PATCH = notFound
export const DELETE = notFound
export const OPTIONS = notFound
export const HEAD = notFound
