import { NextResponse } from "next/server"

import { OldQuiz } from "../../../../types/oldQuizTypes"
import { PrivateSpecQuiz } from "../../../../types/quizTypes/privateSpec"

import { isSpecRequest } from "@/shared-module/common/bindings.guard"
import { convertPublicSpecFromPrivateSpec } from "@/util/converter"
import { isOldQuiz } from "@/util/migration/migrationSettings"
import { migratePrivateSpecQuiz } from "@/util/migration/privateSpecQuiz"

export async function POST(req: Request) {
  try {
    const specRequest = await req.json()
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
    throw new Error("Invalid request")
  }
  const request = specRequest as { private_spec: unknown }
  if (!isSpecRequest(request.private_spec)) {
    throw new Error("Invalid request")
  }
  const quiz = request.private_spec as unknown as OldQuiz | PrivateSpecQuiz | null
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
