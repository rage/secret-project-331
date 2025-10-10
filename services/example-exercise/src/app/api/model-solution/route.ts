import { NextResponse } from "next/server"

import { SpecRequest } from "@/shared-module/common/bindings"
import { isSpecRequest } from "@/shared-module/common/bindings.guard"
import { ModelSolutionApi, PublicAlternative } from "@/util/stateInterfaces"

const methodNotFound = () => NextResponse.json({ message: "Not found" }, { status: 404 })

export async function GET() {
  return methodNotFound()
}

export async function PUT() {
  return methodNotFound()
}

export async function PATCH() {
  return methodNotFound()
}

export async function DELETE() {
  return methodNotFound()
}

export async function OPTIONS() {
  return methodNotFound()
}

export async function HEAD() {
  return new Response(null, { status: 404 })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!isSpecRequest(body)) {
      throw new Error("Request was not valid.")
    }
    return handlePost(body)
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
    }
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 })
  }
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
    correctOptionIds: uncheckedAlternatives
      .filter((alt) => Boolean((alt as any).correct))
      .map<string>((x: PublicAlternative) => x.id),
  }

  return NextResponse.json(correctAlternatives, { status: 200 })
}
