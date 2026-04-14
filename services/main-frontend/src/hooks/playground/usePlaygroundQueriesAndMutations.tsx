"use client"

import { isServer, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { v4 } from "uuid"

import { UseParsedPrivateSpecResult } from "./useParsedPrivateSpec"

import type {
  GetPlaygroundViewsWebsocketData,
  ReceivePlaygroundGradingData,
} from "@/generated/api/types.generated"
import { GradingRequest } from "@/shared-module/common/exercise-service-protocol-types-2"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { buildGeneratedApiUrl, buildGeneratedWebSocketUrl } from "@/utils/generatedApiUrl"
import {
  ExerciseServiceInfoApi,
  ExerciseTaskGradingResult,
  parseExerciseServiceInfoApi,
  parseExerciseTaskGradingResult,
  parsePlaygroundViewsMessage,
  SpecRequest,
} from "@/utils/playgroundSchemas"

const PUBLIC_ADDRESS = isServer ? "https://courses.mooc.fi" : new URL(window.location.href).origin
const PLAYGROUND_VIEWS_WEBSOCKET_PATH: GetPlaygroundViewsWebsocketData["url"] =
  "/api/v0/main-frontend/playground-views/ws"
const PLAYGROUND_VIEWS_GRADING_PATH: ReceivePlaygroundGradingData["url"] =
  "/api/v0/main-frontend/playground-views/grading/{websocket_id}"

async function readJsonResponse(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

interface UsePlaygroundQueriesArguments {
  url: string
  parsedPrivateSpec: UseParsedPrivateSpecResult
  setUserAnswer: (data: unknown) => void
}

const usePlaygroundQueriesAndMutations = (args: UsePlaygroundQueriesArguments) => {
  let exerciseServiceHost = ""
  try {
    const parsedUrl = new URL(args.url)
    exerciseServiceHost = `${parsedUrl.protocol}//${parsedUrl.host}`
  } catch {
    console.warn("Could not parse URL")
  }

  // Queries
  const serviceInfoQuery = useQuery({
    queryKey: [`iframe-view-playground-service-info-${args.url}`],
    queryFn: async (): Promise<ExerciseServiceInfoApi> => {
      const res = await fetch(args.url)
      if (!res.ok) {
        throw new Error(`Failed to load service info (${res.status})`)
      }
      const data = await readJsonResponse(res)
      return parseExerciseServiceInfoApi(data)
    },
  })

  const isValidServiceInfo = serviceInfoQuery.isSuccess

  useEffect(() => {
    if (isValidServiceInfo) {
      localStorage.setItem("service-info-url", args.url)
    }
  }, [isValidServiceInfo, args.url])

  const publicSpecQuery = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: [
      `iframe-view-playground-public-spec-${args.url}-${serviceInfoQuery.data}-${args.parsedPrivateSpec.rawPrivateSpec}`,
      isValidServiceInfo,
      args.parsedPrivateSpec.rawPrivateSpec,
      exerciseServiceHost,
    ],
    queryFn: async (): Promise<unknown> => {
      if (
        !serviceInfoQuery.data ||
        !isValidServiceInfo ||
        !args.parsedPrivateSpec.privateSpecValidJson
      ) {
        throw new Error("This query should be disabled.")
      }
      const payload: SpecRequest = {
        request_id: v4(),
        private_spec: args.parsedPrivateSpec.parsedPrivateSpec,
        upload_url: `${PUBLIC_ADDRESS}/api/v0/files/playground`,
      }
      const res = await fetch(
        `${exerciseServiceHost}${serviceInfoQuery.data.public_spec_endpoint_path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      if (!res.ok) {
        throw new Error(`Failed to load public spec (${res.status})`)
      }
      return readJsonResponse(res)
    },
    enabled:
      serviceInfoQuery.isSuccess &&
      Boolean(serviceInfoQuery.data) &&
      isValidServiceInfo &&
      args.parsedPrivateSpec.privateSpecValidJson,
    retry: false,
  })

  const modelSolutionSpecQuery = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: [
      `iframe-view-playground-model-solution-spec-${args.url}-${serviceInfoQuery.data}-${args.parsedPrivateSpec.rawPrivateSpec}`,
      isValidServiceInfo,
      args.parsedPrivateSpec.rawPrivateSpec,
      exerciseServiceHost,
    ],
    queryFn: async (): Promise<unknown> => {
      if (
        !serviceInfoQuery.data ||
        !isValidServiceInfo ||
        !args.parsedPrivateSpec.privateSpecValidJson
      ) {
        throw new Error("This query should be disabled.")
      }
      const payload: SpecRequest = {
        request_id: v4(),
        private_spec: args.parsedPrivateSpec.parsedPrivateSpec,
        upload_url: `${PUBLIC_ADDRESS}/api/v0/files/playground`,
      }
      const res = await fetch(
        `${exerciseServiceHost}${serviceInfoQuery.data.model_solution_spec_endpoint_path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      if (!res.ok) {
        throw new Error(`Failed to load model solution spec (${res.status})`)
      }
      return readJsonResponse(res)
    },
    enabled:
      serviceInfoQuery.isSuccess &&
      Boolean(serviceInfoQuery.data) &&
      isValidServiceInfo &&
      args.parsedPrivateSpec.privateSpecValidJson,
    retry: false,
  })

  // Mutations
  type submitAnswerMutationParam =
    // Submits the data to the exercise service and sets the returned grading as the data
    | { type: "submit"; data: unknown }
    // Directly sets the grading received from a websocket as the mutation's data
    | { type: "fromWebsocket"; data: ExerciseTaskGradingResult }
  const submitAnswerMutation = useToastMutation<
    ExerciseTaskGradingResult,
    unknown,
    submitAnswerMutationParam,
    unknown
  >(
    async (param) => {
      if (param.type === "submit") {
        if (
          !serviceInfoQuery.data ||
          !isValidServiceInfo ||
          !args.parsedPrivateSpec.privateSpecValidJson
        ) {
          throw new Error("Requirements for the mutation not satisfied.")
        }
        const gradingRequest: GradingRequest = {
          // eslint-disable-next-line i18next/no-literal-string
          grading_update_url: buildGeneratedApiUrl(PLAYGROUND_VIEWS_GRADING_PATH, {
            websocket_id: String(websocketId),
          }),
          exercise_spec: args.parsedPrivateSpec.parsedPrivateSpec,
          submission_data: param.data,
        }
        args.setUserAnswer(param.data)
        const res = await fetch(
          `${exerciseServiceHost}${serviceInfoQuery.data.grade_endpoint_path}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(gradingRequest),
          },
        )
        if (!res.ok) {
          throw new Error(`Grading request failed (${res.status})`)
        }
        const gradingJson = await readJsonResponse(res)
        return parseExerciseTaskGradingResult(gradingJson)
      } else if (param.type === "fromWebsocket") {
        return param.data
      } else {
        throw new Error("unreachable")
      }
    },
    { notify: true, method: "POST" },
  )

  const [websocket, setWebsocket] = useState<WebSocket | null>(null)
  const [websocketId, setWebsocketId] = useState<string | null>(null)
  useEffect(() => {
    // prevent creating unnecessary websocket connections
    if (websocket === null) {
      setWebsocket(new WebSocket(buildGeneratedWebSocketUrl(PLAYGROUND_VIEWS_WEBSOCKET_PATH)))
      return
    }
    const ws = websocket
    ws.onmessage = (ev) => {
      const msg = parsePlaygroundViewsMessage(JSON.parse(ev.data))
      if (msg.tag == "TimedOut") {
        console.error("websocket timed out")
      } else if (msg.tag == "Registered") {
        console.info("Registered websocket", msg.data)
        setWebsocketId(msg.data)
      } else if (msg.tag == "ExerciseTaskGradingResult") {
        submitAnswerMutation.mutate({ type: "fromWebsocket", data: msg.data })
      } else {
        throw new Error(`Unexpected websocket message: ${ev}`)
      }
    }
    ws.onclose = (ev) => {
      console.error("websocket closed unexpectedly", ev)
    }
    ws.onerror = (err) => {
      console.error("websocket error", err)
    }
  }, [websocket, submitAnswerMutation])

  return {
    serviceInfoQuery,
    isValidServiceInfo,
    publicSpecQuery,
    modelSolutionSpecQuery,
    submitAnswerMutation,
    exerciseServiceHost,
  }
}

export default usePlaygroundQueriesAndMutations
