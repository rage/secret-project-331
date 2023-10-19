import request from "supertest"

import handler from "../../src/pages/api/service-info"
import { ExerciseServiceInfoApi } from "../../src/shared-module/bindings"
import { isExerciseServiceInfoApi } from "../../src/shared-module/bindings.guard"

import testClient from "./utils/testClient"

describe("service-info", () => {
  it("exists", async () => {
    const client = testClient(handler)
    await client.get("/api/service-info").expect("Content-Type", /json/).expect(200)
  })

  it("gives correct format", async () => {
    const client = testClient(handler)
    const response: request.Response = await client.get("/api/service-info")
    expect(isExerciseServiceInfoApi(JSON.parse(response.text)))
  })

  it("has correct name", async () => {
    const client = testClient(handler)
    const response: request.Response = await client.get("/api/service-info")
    expect(isExerciseServiceInfoApi(JSON.parse(response.text)))
    const exerciseService = JSON.parse(response.text) as ExerciseServiceInfoApi
    expect(exerciseService.service_name).toMatch("Quizzes")
  })

  it("has correct paths", async () => {
    const client = testClient(handler)
    const response: request.Response = await client.get("/api/service-info")
    expect(isExerciseServiceInfoApi(JSON.parse(response.text)))
    const exerciseService = JSON.parse(response.text) as ExerciseServiceInfoApi
    expect(exerciseService).toMatchObject({
      service_name: "Quizzes",
      user_interface_iframe_path: "/iframe",
      grade_endpoint_path: "/api/grade",
      public_spec_endpoint_path: "/api/public-spec",
      model_solution_spec_endpoint_path: "/api/model-solution",
    })
  })
})
