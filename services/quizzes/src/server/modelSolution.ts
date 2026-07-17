import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { revealableCorrectAnswers } from "@/util/converter"
import { migratePrivateSpecToLatest } from "@/util/migration/migrateToLatest"
import { isSpecRequest } from "@/utils/exerciseServiceApi"

import type {
  ModelSolutionQuiz,
  ModelSolutionQuizItem,
  ModelSolutionQuizItemClosedEndedQuestion,
} from "../../types/quizTypes/modelSolutionSpec"

const SERVICE = "quizzes"

async function postImpl(request: Request): Promise<Response> {
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
        return Response.json({ message: "Content-Type must be application/json" }, { status: 400 })
      }

      if (!bodyText || bodyText.trim() === "") {
        console.error("Model solution request failed: Empty request body", {
          bodyText,
        })
        return Response.json({ message: "Request body is empty" }, { status: 400 })
      }

      console.error("Model solution request failed: Invalid JSON", {
        bodyText,
        parseError: jsonError instanceof Error ? jsonError.message : String(jsonError),
      })
      return Response.json({ message: "Invalid JSON in request body" }, { status: 400 })
    }

    const modelSolution = handleModelSolutionGeneration(body)
    return Response.json(modelSolution, { status: 200 })
  } catch (e) {
    console.error("Model solution request failed:", e)
    if (e instanceof Error) {
      return Response.json(
        {
          error_name: e.name,
          error_message: e.message,
          error_stack: e.stack,
        },
        { status: 500 },
      )
    }
    return Response.json({ error_message: e }, { status: 500 })
  }
}

export const handleModelSolution = wrapRouteHandler(postImpl, {
  service: SERVICE,
  operation: "POST /model-solution",
})

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
  if (specRequest.private_spec === null || specRequest.private_spec === undefined) {
    throw new Error("Private spec cannot be null")
  }

  const modelSolution = createModelSolution(specRequest.private_spec)
  return modelSolution
}

/**
 * Derive the model solution from the (possibly old) private spec. The model solution is the private
 * spec minus what a finishing student / peer reviewer must not see. Item types other than
 * closed-ended are passed through as before; the closed-ended item gets an explicit projection
 * because its `gradingStrategy` is the acceptance rule (must be dropped) and instead it exposes a
 * readable correct answer via `correctAnswerDisplayTexts`.
 */
function createModelSolution(privateSpecInput: unknown): ModelSolutionQuiz {
  const privateSpec = migratePrivateSpecToLatest(privateSpecInput)
  const items = privateSpec.items.map((quizItem): ModelSolutionQuizItem => {
    if (quizItem.type !== "closed-ended-question") {
      return quizItem as unknown as ModelSolutionQuizItem
    }
    const { gradingStrategy, formatRegex, ...rest } = quizItem
    return {
      ...rest,
      formatRegex,
      correctAnswerDisplayTexts: revealableCorrectAnswers(gradingStrategy),
    } satisfies ModelSolutionQuizItemClosedEndedQuestion
  })
  return { ...privateSpec, items } as unknown as ModelSolutionQuiz
}
