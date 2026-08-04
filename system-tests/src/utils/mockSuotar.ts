/**
 * Client for the mock Suotar's world and fault control (`/api/v0/mock-suotar/control/command`).
 * Hand-written because the mock's DTOs are deliberately not exported to `bindings.ts`, the same way
 * `mock_sisu`'s are not. `suotarControl.ts` is the tick client.
 *
 * Only the commands a spec has a reason to send are wrapped; `GET /control/commands` lists the rest.
 * A command is parallel-safe only for arguments naming data the calling spec owns.
 */

import type { APIRequestContext } from "@playwright/test"

import { CONTROL_BASE_URL } from "./suotarControl"

export type MockSuotarEndpoint =
  | "resolve_persons"
  | "resolve_enrolments"
  | "import_attainments"
  | "verify_attainments"
  | "product_access_tokens"
  | "list_by_course"

/** Required on every fault. A post-commit stage means something different from a pre-write one. */
export type MockSuotarStage =
  | "auth"
  | "requestGate"
  | "parse"
  | "resolve"
  | "afterWrite"
  | "respond"

export type MockSuotarEnrolmentState = "ENROLLED" | "PROCESSING" | "REJECTED" | "ABORTED"

export type MockSuotarRealisationKind = "degree" | "openUniversity"

export interface MockSuotarOwnerRef {
  user?: string
  course?: string
}

export interface MockSuotarDatePeriod {
  startDate: string
  endDate: string
}

export interface MockSuotarEnrolmentUpsert {
  id?: string
  studentNumber: string
  courseCode: string
  realisationId?: string
  kind?: MockSuotarRealisationKind
  state: MockSuotarEnrolmentState
  studyRightId?: string
  studyRightValidityPeriod: MockSuotarDatePeriod
  enrolmentDateTime?: string
}

export type MockSuotarPredicate =
  | { endpoint: MockSuotarEndpoint }
  | { stage: MockSuotarStage }
  | { studentNumber: string }
  | { courseCode: string }
  | { owner: MockSuotarOwnerRef }

export type MockSuotarEffect =
  | {
      kind: "itemLevel"
      code: string
      message?: string
      discloseSubmittedAttainmentId?: boolean
    }
  | { kind: "requestLevel"; status: number; code: string; message?: string }
  | { kind: "connectionReset" }

/** Omitted means until disarmed. */
export interface MockSuotarLifetime {
  matchingCalls?: number
  matchingItems?: number
}

export interface MockSuotarFaultSpec {
  /** Caller-supplied, so re-arming replaces rather than duplicates. */
  id: string
  when: MockSuotarPredicate[]
  then: MockSuotarEffect
  lifetime?: MockSuotarLifetime
  /**
   * Required to arm a retryable code on `import` after the write has committed, which only a spec
   * proving the double submission has a reason to do.
   */
  provesDoubleSubmission?: boolean
}

export interface MockSuotarCallFilter {
  endpoint?: MockSuotarEndpoint
  studentNumber?: string
  courseCode?: string
  requestItemId?: string
  faultId?: string
  correlationId?: string
  limit?: number
}

export type MockSuotarSubmissionTarget =
  | "registered"
  | "misregistered"
  | "notRegistered"
  | "timedOutButLanded"
  | "timedOutNothingLanded"

export type MockSuotarCommandResult =
  | { status: "ok"; command: string; result: Record<string, unknown> }
  | { status: "error"; command: string | null; code: string; message: string }
  | { status: "notImplemented"; command: string }

const sendCommand = async (
  request: APIRequestContext,
  command: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const response = await request.post(`${CONTROL_BASE_URL}/command`, { data: command })
  // A 404 means the mock is not enabled and the whole spec is invalid.
  if (![200, 400, 500, 501].includes(response.status())) {
    throw new Error(
      `Unexpected status ${response.status()} from the mock Suotar control command ${JSON.stringify(
        command.command,
      )}. Is USE_MOCK_SUOTAR_ENDPOINT on? Body: ${await response.text()}`,
    )
  }
  const body = (await response.json()) as MockSuotarCommandResult
  if (body.status !== "ok") {
    throw new Error(
      `Mock Suotar refused ${JSON.stringify(command.command)}: ${JSON.stringify(body)}`,
    )
  }
  return body.result
}

const get = async (request: APIRequestContext, path: string): Promise<Record<string, unknown>> => {
  const response = await request.get(`${CONTROL_BASE_URL}/${path}`)
  if (!response.ok()) {
    throw new Error(
      `Unexpected status ${response.status()} from mock Suotar ${path}. Is USE_MOCK_SUOTAR_ENDPOINT on? Body: ${await response.text()}`,
    )
  }
  return (await response.json()) as Record<string, unknown>
}

export const upsertMockSuotarEnrolments = (
  request: APIRequestContext,
  enrolments: MockSuotarEnrolmentUpsert[],
) => sendCommand(request, { command: "upsertEnrolments", enrolments })

/** A spec owns a student number, not the mock-side `hy-kur-…` id the client holds in the database. */
export const transitionMockSuotarSubmissionsFor = (
  request: APIRequestContext,
  studentNumber: string,
  to: MockSuotarSubmissionTarget,
  courseCode?: string,
) =>
  sendCommand(request, {
    command: "transitionSubmissionsFor",
    studentNumber,
    courseCode,
    to,
  })

export const armMockSuotarFault = (request: APIRequestContext, fault: MockSuotarFaultSpec) =>
  sendCommand(request, { command: "armFault", ...fault })

export const disarmMockSuotarFault = (request: APIRequestContext, id: string) =>
  sendCommand(request, { command: "disarmFault", id })

export const applyMockSuotarScenario = (
  request: APIRequestContext,
  name: string,
  args: {
    studentNumber?: string
    courseCode?: string
    realisationKind?: MockSuotarRealisationKind
    owner?: MockSuotarOwnerRef
    primaryEmail?: string
    secondaryEmail?: string
    firstNames?: string
    lastName?: string
  } = {},
) => sendCommand(request, { command: "applyScenario", name, args })

/** Bounded: a list has no index, so a filter is always a scan of the newest `limit` entries. */
export const listMockSuotarCalls = (
  request: APIRequestContext,
  filter: MockSuotarCallFilter = {},
) => sendCommand(request, { command: "listCalls", ...filter })

export const getMockSuotarWorld = (request: APIRequestContext) => get(request, "world")
