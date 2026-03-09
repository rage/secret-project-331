import { NextResponse } from "next/server"

import { UserAnswer, UserItemAnswer } from "../../../../types/quizTypes/answer"
import { ItemAnswerFeedback } from "../../../../types/quizTypes/grading"
import { PrivateSpecQuiz } from "../../../../types/quizTypes/privateSpec"
import { handlePrivateSpecMigration, handleUserAnswerMigration } from "../../../grading/utils"

type CsvScalar = string | number | boolean | null

interface CsvExportColumn {
  key: string
  header: string
}

interface CsvExportResult {
  rows: Array<Record<string, CsvScalar>>
}

interface CsvExportResponse {
  columns: CsvExportColumn[]
  results: CsvExportResult[]
}

interface CsvExportAnswersRequestItem {
  private_spec: unknown
  answer: unknown
  grading: unknown
  model_solution_spec: unknown
}

interface CsvExportAnswersRequest {
  items: CsvExportAnswersRequestItem[]
}

function parseRequest(body: unknown): CsvExportAnswersRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body")
  }
  if (!Array.isArray((body as Record<string, unknown>).items)) {
    throw new Error("Invalid request body: items must be an array")
  }
  return body as CsvExportAnswersRequest
}

function answerToScalarValue(itemAnswer: UserItemAnswer): CsvScalar {
  switch (itemAnswer.type) {
    case "multiple-choice":
      return itemAnswer.selectedOptionIds.join("; ")
    case "essay":
      return itemAnswer.textData
    case "scale":
      return itemAnswer.intData
    case "checkbox":
      return itemAnswer.checked
    case "closed-ended-question":
      return itemAnswer.textData
    case "matrix":
      return JSON.stringify(itemAnswer.matrix)
    case "timeline":
      return JSON.stringify(itemAnswer.timelineChoices)
    case "choose-n":
      return itemAnswer.selectedOptionIds.join("; ")
    case "multiple-choice-dropdown":
      return itemAnswer.selectedOptionIds.join("; ")
    default:
      return JSON.stringify(itemAnswer)
  }
}

function getNumberField(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const typedValue = value as Record<string, unknown>
  return typeof typedValue[key] === "number" ? (typedValue[key] as number) : null
}

function getStringField(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const typedValue = value as Record<string, unknown>
  return typeof typedValue[key] === "string" ? (typedValue[key] as string) : null
}

function getFeedbackByQuizItemId(grading: unknown): Map<string, number | null> {
  const result = new Map<string, number | null>()
  if (!grading || typeof grading !== "object") {
    return result
  }
  const typedGrading = grading as Record<string, unknown>
  if (!Array.isArray(typedGrading.feedback_json)) {
    return result
  }

  for (const feedback of typedGrading.feedback_json) {
    if (!feedback || typeof feedback !== "object") {
      continue
    }
    const typedFeedback = feedback as ItemAnswerFeedback
    if (typeof typedFeedback.quiz_item_id !== "string") {
      continue
    }
    if (typeof typedFeedback.correctnessCoefficient === "number") {
      result.set(typedFeedback.quiz_item_id, typedFeedback.correctnessCoefficient)
    } else {
      result.set(typedFeedback.quiz_item_id, null)
    }
  }

  return result
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = parseRequest(body)

    const response: CsvExportResponse = {
      columns: [
        { key: "quiz_item_id", header: "Quiz item id" },
        { key: "answer_type", header: "Answer type" },
        { key: "answer_value", header: "Answer value" },
        { key: "correctness_coefficient", header: "Correctness coefficient" },
        { key: "score_given", header: "Score given" },
        { key: "grading_progress", header: "Grading progress" },
      ],
      results: parsed.items.map((item) => {
        const privateSpecQuiz = handlePrivateSpecMigration(item.private_spec as PrivateSpecQuiz)
        const userAnswer = handleUserAnswerMigration(privateSpecQuiz, item.answer as UserAnswer)
        const feedbackByQuizItemId = getFeedbackByQuizItemId(item.grading)
        const scoreGiven = getNumberField(item.grading, "score_given")
        const gradingProgress = getStringField(item.grading, "grading_progress")

        return {
          rows: userAnswer.itemAnswers.map((itemAnswer) => ({
            quiz_item_id: itemAnswer.quizItemId,
            answer_type: itemAnswer.type,
            answer_value: answerToScalarValue(itemAnswer),
            correctness_coefficient: feedbackByQuizItemId.get(itemAnswer.quizItemId) ?? null,
            score_given: scoreGiven,
            grading_progress: gradingProgress,
          })),
        }
      }),
    }

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 400 })
    }
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 })
  }
}

function notFound() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

export const GET = notFound
export const PUT = notFound
export const PATCH = notFound
export const DELETE = notFound
export const OPTIONS = notFound
export const HEAD = notFound
