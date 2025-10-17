import { NextResponse } from "next/server"

import { OldQuiz } from "../../../../types/oldQuizTypes"
import { PrivateSpecQuiz } from "../../../../types/quizTypes/privateSpec"

import { isSpecRequest } from "@/shared-module/common/bindings.guard"
import { convertPublicSpecFromPrivateSpec } from "@/util/converter"
import { isOldQuiz } from "@/util/migration/migrationSettings"
import { migratePrivateSpecQuiz } from "@/util/migration/privateSpecQuiz"

export async function POST(req: Request) {
  try {
    let specRequest
    try {
      specRequest = await req.json()
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

    return handlePost(specRequest)
  } catch (e) {
    console.error("Public spec request failed:", e)
    if (e instanceof Error) {
      return NextResponse.json(
        {
          error_name: e.name,
          error_message: e.message,
          error_stack: e.stack,
        },
        { status: 500 },
      )
    } else {
      return NextResponse.json({ error_message: String(e) }, { status: 500 })
    }
  }
}

export function GET() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

export function PUT() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

export function PATCH() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

export function DELETE() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

export function OPTIONS() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

export function HEAD() {
  return new Response(null, { status: 404 })
}

function handlePost(specRequest: unknown) {
  if (typeof specRequest !== "object" || specRequest === null || !("private_spec" in specRequest)) {
    const errorInfo = {
      specRequest,
      specRequestType: typeof specRequest,
      specRequestKeys:
        specRequest && typeof specRequest === "object" ? Object.keys(specRequest) : [],
      hasPrivateSpec:
        specRequest && typeof specRequest === "object" && "private_spec" in specRequest,
    }
    console.error("Public spec request failed: Invalid request structure", errorInfo)
    throw new Error(`Invalid request structure: ${JSON.stringify(errorInfo)}`)
  }
  if (!isSpecRequest(specRequest)) {
    const errorInfo = {
      privateSpec: specRequest.private_spec,
      privateSpecType: typeof specRequest.private_spec,
      privateSpecKeys:
        specRequest.private_spec && typeof specRequest.private_spec === "object"
          ? Object.keys(specRequest.private_spec)
          : [],
    }
    console.error("Public spec request failed: Invalid private_spec", errorInfo)
    throw new Error(`Invalid private_spec: ${JSON.stringify(errorInfo)}`)
  }
  const quiz = specRequest.private_spec as unknown as OldQuiz | PrivateSpecQuiz | null
  if (quiz === null) {
    throw new Error("Quiz cannot be null")
  }
  let converted: PrivateSpecQuiz | null = null
  if (isOldQuiz(quiz)) {
    converted = migratePrivateSpecQuiz(quiz as OldQuiz)
  } else {
    converted = quiz as PrivateSpecQuiz
  }
  const publicSpecQuiz = convertPublicSpecFromPrivateSpec(converted)
  return NextResponse.json(publicSpecQuiz, { status: 200 })
}
