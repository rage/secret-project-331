/**
 * @vitest-environment node
 */

import testClient from "./utils/appRouterTestClient"

import { handleServiceInfo } from "@/server/serviceInfo"
import { ExerciseServiceInfoApi, isExerciseServiceInfoApi } from "@/utils/exerciseServiceApi"

describe("service-info", () => {
  it("exists", async () => {
    const client = testClient(handleServiceInfo)
    await client.get("/api/service-info").expect("Content-Type", /json/).expect(200)
  })

  it("gives correct format", async () => {
    const client = testClient(handleServiceInfo)
    const response = await client.get("/api/service-info")
    expect(isExerciseServiceInfoApi(JSON.parse(response.text)))
  })

  it("has correct name", async () => {
    const client = testClient(handleServiceInfo)
    const response = await client.get("/api/service-info")
    expect(isExerciseServiceInfoApi(JSON.parse(response.text)))
    const exerciseService = JSON.parse(response.text) as ExerciseServiceInfoApi
    expect(exerciseService.service_name).toMatch("Quizzes")
  })

  it("has correct paths", async () => {
    const client = testClient(handleServiceInfo)
    const response = await client.get("/api/service-info")
    expect(isExerciseServiceInfoApi(JSON.parse(response.text)))
    const exerciseService = JSON.parse(response.text) as ExerciseServiceInfoApi
    expect(exerciseService).toMatchObject({
      service_name: "Quizzes",
      user_interface_iframe_path: "/iframe",
      grade_endpoint_path: "/api/grade",
      public_spec_endpoint_path: "/api/public-spec",
      model_solution_spec_endpoint_path: "/api/model-solution",
      csv_export_definitions_endpoint_path: "/api/export-definitions",
      csv_export_answers_endpoint_path: "/api/export-answers",
    })
  })
})
