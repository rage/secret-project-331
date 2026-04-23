import { NextResponse } from "next/server"

import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { isSpecRequest, SpecRequest } from "@/util/exerciseServiceApi"
import { Alternative, ModelSolutionApi } from "@/util/stateInterfaces"

const methodNotFound = () => NextResponse.json({ message: "Not found" }, { status: 404 })

const SERVICE = "example-exercise"

async function postImpl(req: Request) {
  let body
  try {
    body = await req.json()
  } catch (jsonError) {
    const bodyText = await req.text()

    const contentType = req.headers.get("content-type")
    if (!contentType || !contentType.includes("application/json")) {
      console.error("Model solution request failed: Invalid Content-Type", {
        contentType,
        bodyText,
      })
      return NextResponse.json(
        { message: "Content-Type must be application/json" },
        { status: 400 },
      )
    }

    if (!bodyText || bodyText.trim() === "") {
      console.error("Model solution request failed: Empty request body", {
        bodyText,
      })
      return NextResponse.json({ message: "Request body is empty" }, { status: 400 })
    }

    console.error("Model solution request failed: Invalid JSON", {
      bodyText,
      parseError: jsonError instanceof Error ? jsonError.message : String(jsonError),
    })
    return NextResponse.json({ message: "Invalid JSON in request body" }, { status: 400 })
  }

  if (!isSpecRequest(body)) {
    console.error("Model solution request failed: Invalid spec request", {
      body,
    })
    return NextResponse.json({ message: "Request was not valid." }, { status: 400 })
  }
  return handlePost(body)
}

const handlePost = (specRequest: SpecRequest) => {
  const uncheckedAlternatives: unknown = specRequest.private_spec
  if (!Array.isArray(uncheckedAlternatives)) {
    return NextResponse.json(
      { message: "Malformed data:" + JSON.stringify(uncheckedAlternatives) },
      { status: 400 },
    )
  }

  const correctAlternatives: ModelSolutionApi = {
    correctOptionIds: (uncheckedAlternatives as Alternative[])
      .filter((alt) => Boolean(alt.correct))
      .map<string>((x: Alternative) => x.id),
  }

  return NextResponse.json(correctAlternatives, { status: 200 })
}

export const POST = wrapRouteHandler(postImpl, {
  service: SERVICE,
  operation: "POST /model-solution",
})
export const GET = wrapRouteHandler(methodNotFound, {
  service: SERVICE,
  operation: "GET /model-solution",
})
export const PUT = wrapRouteHandler(methodNotFound, {
  service: SERVICE,
  operation: "PUT /model-solution",
})
export const PATCH = wrapRouteHandler(methodNotFound, {
  service: SERVICE,
  operation: "PATCH /model-solution",
})
export const DELETE = wrapRouteHandler(methodNotFound, {
  service: SERVICE,
  operation: "DELETE /model-solution",
})
export const OPTIONS = wrapRouteHandler(methodNotFound, {
  service: SERVICE,
  operation: "OPTIONS /model-solution",
})
export const HEAD = wrapRouteHandler(() => new Response(null, { status: 404 }), {
  service: SERVICE,
  operation: "HEAD /model-solution",
})
