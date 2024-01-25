import { isServer, useQuery } from "@tanstack/react-query"
import axios from "axios"
import { useEffect, useState } from "react"
import { v4 } from "uuid"

import {
  ExerciseServiceInfoApi,
  ExerciseTaskGradingResult,
  PlaygroundViewsMessage,
  SpecRequest,
} from "../../shared-module/common/bindings"
import { isExerciseServiceInfoApi } from "../../shared-module/common/bindings.guard"
import { GradingRequest } from "../../shared-module/common/exercise-service-protocol-types-2"
import useToastMutation from "../../shared-module/common/hooks/useToastMutation"

import { UseParsedPrivateSpecResult } from "./useParsedPrivateSpec"

const PUBLIC_ADDRESS = isServer ? "https://courses.mooc.fi" : new URL(window.location.href).origin
const WEBSOCKET_ADDRESS = PUBLIC_ADDRESS?.replace("http://", "ws://").replace("https://", "wss://")

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
      const res = await axios.get(args.url)
      return res.data
    },
  })

  const isValidServiceInfo = isExerciseServiceInfoApi(serviceInfoQuery.data)

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
      const res = await axios.post(
        `${exerciseServiceHost}${serviceInfoQuery.data.public_spec_endpoint_path}`,
        payload,
      )
      return res.data
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
      const res = await axios.post(
        `${exerciseServiceHost}${serviceInfoQuery.data.model_solution_spec_endpoint_path}`,
        payload,
      )
      return res.data
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
          grading_update_url: `${PUBLIC_ADDRESS}/api/v0/main-frontend/playground-views/grading/${websocketId}`,
          exercise_spec: args.parsedPrivateSpec.parsedPrivateSpec,
          submission_data: param.data,
        }
        args.setUserAnswer(param.data)
        const res = await axios.post(
          `${exerciseServiceHost}${serviceInfoQuery.data.grade_endpoint_path}`,
          gradingRequest,
        )
        return res.data
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
      setWebsocket(new WebSocket(`${WEBSOCKET_ADDRESS}/api/v0/main-frontend/playground-views/ws`))
      return
    }
    const ws = websocket
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as PlaygroundViewsMessage
      if (msg.tag == "TimedOut") {
        console.error("websocket timed out")
      } else if (msg.tag == "Registered") {
        console.log("Registered websocket", msg.data)
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
