import { NextResponse } from "next/server"

import { OldQuiz } from "../../../../types/oldQuizTypes"
import { ModelSolutionQuiz } from "../../../../types/quizTypes/modelSolutionSpec"
import { PrivateSpecQuizItemClosedEndedQuestion } from "../../../../types/quizTypes/privateSpec"

import { isSpecRequest } from "@/shared-module/common/bindings.guard"
import { isOldQuiz } from "@/util/migration/migrationSettings"
import migrateModelSolutionSpecQuiz from "@/util/migration/modelSolutionSpecQuiz"

export async function POST(request: Request): Promise<Response> {
  try {
    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      const bodyText = await request.text()

      const contentType = request.headers.get("content-type")
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

    const modelSolution = handleModelSolutionGeneration(body)
    return NextResponse.json(modelSolution, { status: 200 })
  } catch (e) {
    console.error("Model solution request failed:", e)
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
      return NextResponse.json({ error_message: e }, { status: 500 })
    }
  }
}

function handleModelSolutionGeneration(body: unknown): ModelSolutionQuiz {
  if (!isSpecRequest(body)) {
    const errorInfo = {
      body,
      bodyKeys: Object.keys(body || {}),
      bodyType: typeof body,
      isArray: Array.isArray(body),
      hasPrivateSpec: body && typeof body === "object" && "private_spec" in body,
      privateSpecType:
        body && typeof body === "object" && "private_spec" in body
          ? typeof body.private_spec
          : "undefined",
      expectedKeys: ["request_id", "private_spec", "upload_url"],
    }
    console.error("Model solution request failed: Invalid spec request", errorInfo)
    throw new Error(`Invalid spec request: ${JSON.stringify(errorInfo)}`)
  }
  const specRequest = body
  const quiz = specRequest.private_spec as OldQuiz | null
  if (quiz === null) {
    throw new Error("Private spec cannot be null")
  }

  const modelSolution = createModelSolution(quiz)
  return modelSolution
}

function createModelSolution(quiz: OldQuiz | ModelSolutionQuiz): ModelSolutionQuiz {
  let modelSolution: ModelSolutionQuiz | null = null
  if (isOldQuiz(quiz)) {
    modelSolution = migrateModelSolutionSpecQuiz(quiz as OldQuiz)
  } else {
    modelSolution = quiz as ModelSolutionQuiz
  }
  if (modelSolution === null) {
    throw new Error("Model solution was null")
  }
  // Make sure we don't include illegal properties
  for (const quizItem of modelSolution.items) {
    if (quizItem.type === "closed-ended-question") {
      const asPrivateSpec = quizItem as PrivateSpecQuizItemClosedEndedQuestion
      if (asPrivateSpec.validityRegex !== undefined) {
        // @ts-expect-error: Deleting a property that should not exist
        delete asPrivateSpec.validityRegex
      }
    }
  }

  return modelSolution as ModelSolutionQuiz
}
