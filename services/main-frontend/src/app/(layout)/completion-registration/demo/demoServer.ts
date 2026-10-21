import type {
  CreditRegistrationEnrolmentRoute,
  MyCreditJustification,
  RequestCreditRegistrationEnrolmentRecheckResult,
} from "@/generated/api/types.generated"

import { DEMO_COURSE_MODULE_ID, type DemoState } from "./demoData"

const API = "/api/v0/main-frontend"
const MODULE = `${API}/credit-registrations/my/by-course-module/${DEMO_COURSE_MODULE_ID}`

/** The query ids the demo answers, so it can drop their cached fake answers on the way out. */
export const DEMO_QUERY_IDS: ReadonlySet<string> = new Set([
  "getCourseModuleUserCompletion",
  "getMyCreditRegistrationForCourseModule",
  "getMyEnrolmentRoute",
  "getMyVerifiedStudentNumber",
  "getCreditRegistrationSettings",
])

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

/**
 * A `fetch` that answers the registration page's requests from `state` and passes every other
 * request through, so the page runs its real code against made-up data and nothing it does is
 * saved.
 *
 * Answers the student-number and settings endpoints for whatever else is on screen too, which is
 * why the demo has to drop those cached answers when it goes.
 */
export const createDemoFetch =
  (state: DemoState, passThrough: typeof fetch) =>
  async (request: Request): Promise<Response> => {
    const path = new URL(request.url, window.location.origin).pathname
    const nowIso = new Date().toISOString()
    const respond = demoResponder(state, nowIso)
    const response = await respond(request.method, path, request)
    return response ?? passThrough(request)
  }

const demoResponder =
  (state: DemoState, nowIso: string) =>
  async (method: string, path: string, request: Request): Promise<Response | null> => {
    const route = state.enrolmentRoute
    switch (`${method} ${path}`) {
      case `GET ${API}/course-modules/${DEMO_COURSE_MODULE_ID}/user-completion`:
        return json(state.completion)
      case `GET ${MODULE}`:
        return json(state.registration)
      case `GET ${MODULE}/enrolment-route`:
        return json(route)
      case `PUT ${MODULE}/enrolment-route`: {
        const body = (await request.json()) as { route: CreditRegistrationEnrolmentRoute }
        state.enrolmentRoute = { ...route, route: body.route }
        return json(state.enrolmentRoute)
      }
      case `POST ${MODULE}/enrolment-route/confirm`:
        state.enrolmentRoute = { ...route, enrolment_confirmed_at: nowIso }
        return json(state.enrolmentRoute)
      case `DELETE ${MODULE}/enrolment-route/confirm`:
        state.enrolmentRoute = { ...route, enrolment_confirmed_at: null }
        return json(state.enrolmentRoute)
      case `PUT ${MODULE}/credit-justification`: {
        const body = (await request.json()) as { justification: string }
        state.completion = { ...state.completion, credit_justification: body.justification }
        return json({
          course_module_completion_id: state.completion.course_module_completion_id,
          justification: body.justification,
          updated_at: nowIso,
        } satisfies MyCreditJustification)
      }
      case `POST ${MODULE}/enrolment-page-visit`:
        return json(null)
      case `GET ${API}/credit-registrations/my/student-number`:
        return json(state.studentNumber)
      case `GET ${API}/credit-registrations/settings`:
        return json({ account_linking_enabled: true })
    }
    const registrationId = state.registration?.registration.id
    if (registrationId && method === "POST") {
      if (path === `${API}/credit-registrations/my/${registrationId}/recheck-enrolment`) {
        return json({
          recheck_started: true,
        } satisfies RequestCreditRegistrationEnrolmentRecheckResult)
      }
      if (path === `${API}/credit-registrations/my/${registrationId}/dismiss-enrolment-banner`) {
        return json(null)
      }
    }
    return null
  }
