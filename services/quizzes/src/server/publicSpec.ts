import { OldQuiz } from "../../types/oldQuizTypes"
import { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"

import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { convertPublicSpecFromPrivateSpec } from "@/util/converter"
import { isOldQuiz } from "@/util/migration/migrationSettings"
import { migratePrivateSpecQuiz } from "@/util/migration/privateSpecQuiz"
import { isSpecRequest } from "@/utils/exerciseServiceApi"

const SERVICE = "quizzes"

async function postImpl(req: Request) {
  const rawBody = await req.text()
  let specRequest: unknown
  try {
    specRequest = JSON.parse(rawBody)
  } catch (jsonError) {
    const contentType = req.headers.get("content-type")
    if (!contentType || !contentType.includes("application/json")) {
      console.error("Public spec request failed: Invalid Content-Type", {
        contentType,
        bodyLength: rawBody.length,
      })
      return Response.json({ message: "Content-Type must be application/json" }, { status: 400 })
    }

    if (!rawBody || rawBody.trim() === "") {
      console.error("Public spec request failed: Empty request body", {
        contentType,
        bodyLength: rawBody.length,
      })
      return Response.json({ message: "Request body is empty" }, { status: 400 })
    }

    console.error("Public spec request failed: Invalid JSON", {
      contentType,
      parseError: jsonError instanceof Error ? jsonError.message : String(jsonError),
    })
    return Response.json({ message: "Invalid JSON in request body" }, { status: 400 })
  }
  return handlePost(specRequest)
}

export const handlePublicSpec = wrapRouteHandler(postImpl, {
  service: SERVICE,
  operation: "POST /public-spec",
})

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
    return Response.json({ message: "Invalid request structure" }, { status: 400 })
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
    return Response.json({ message: "Invalid private_spec" }, { status: 400 })
  }
  const quiz = specRequest.private_spec as unknown as OldQuiz | PrivateSpecQuiz | null
  if (quiz === null) {
    return Response.json({ message: "Quiz cannot be null" }, { status: 400 })
  }
  const converted: PrivateSpecQuiz = isOldQuiz(quiz)
    ? migratePrivateSpecQuiz(quiz as OldQuiz)
    : (quiz as PrivateSpecQuiz)
  const publicSpecQuiz = convertPublicSpecFromPrivateSpec(converted)
  return Response.json(publicSpecQuiz, { status: 200 })
}
