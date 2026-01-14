import { NextResponse } from "next/server"

import { SpecRequest } from "@/shared-module/common/bindings"
import { isSpecRequest } from "@/shared-module/common/bindings.guard"
import { Alternative, ClientErrorResponse, PublicAlternative } from "@/util/stateInterfaces"

function notFound() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

export async function POST(req: Request): Promise<Response> {
  try {
    let body
    try {
      body = await req.json()
    } catch (jsonError) {
      const bodyText = await req.text()

      const contentType = req.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Public spec request failed: Invalid Content-Type", {
          contentType,
          bodyText,
        })
        return NextResponse.json(
          { message: "Content-Type must be application/json" },
          { status: 400 },
        )
      }

      if (!bodyText || bodyText.trim() === "") {
        console.error("Public spec request failed: Empty request body", {
          bodyText,
        })
        return NextResponse.json({ message: "Request body is empty" }, { status: 400 })
      }

      console.error("Public spec request failed: Invalid JSON", {
        bodyText,
        parseError: jsonError instanceof Error ? jsonError.message : String(jsonError),
      })
      return NextResponse.json({ message: "Invalid JSON in request body" }, { status: 400 })
    }

    if (!isSpecRequest(body)) {
      console.error("Public spec request failed: Invalid spec request", {
        body,
      })
      throw new Error("Request was not valid.")
    }
    return handlePost(body as SpecRequest)
  } catch (e) {
    console.error("Public spec request failed:", e)
    if (e instanceof Error) {
      const err: ClientErrorResponse = {
        message: e.message,
      }
      return NextResponse.json(err, { status: 500 })
    }
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 })
  }
}

function handlePost(specRequest: SpecRequest): Response {
  const uncheckedAlternatives: unknown = specRequest.private_spec
  if (!Array.isArray(uncheckedAlternatives)) {
    return NextResponse.json(
      { message: "Malformed data:" + JSON.stringify(uncheckedAlternatives) },
      { status: 400 },
    )
  }

  const publicAlternatives = uncheckedAlternatives.map<PublicAlternative>((x: Alternative) => ({
    id: x.id,
    name: x.name,
  }))
  return NextResponse.json(publicAlternatives, { status: 200 })
}

export async function GET(): Promise<Response> {
  return notFound()
}

export async function PUT(): Promise<Response> {
  return notFound()
}

export async function PATCH(): Promise<Response> {
  return notFound()
}

export async function DELETE(): Promise<Response> {
  return notFound()
}

export async function OPTIONS(): Promise<Response> {
  return notFound()
}

export async function HEAD(): Promise<Response> {
  return notFound()
}
