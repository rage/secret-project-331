import { NextResponse } from "next/server"

export function GET() {
  return NextResponse.json<boolean>(true, { status: 200 })
}
