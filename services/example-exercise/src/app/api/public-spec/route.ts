import { NextResponse } from "next/server"

import { SpecRequest } from "@/shared-module/common/bindings"
import { isSpecRequest } from "@/shared-module/common/bindings.guard"
import { Alternative, ClientErrorResponse, PublicAlternative } from "@/util/stateInterfaces"

function notFound() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json()
    if (!isSpecRequest(body)) {
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
