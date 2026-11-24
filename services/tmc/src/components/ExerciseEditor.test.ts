import { describe, expect, it } from "vitest"

import type { RepositoryExercise } from "@/util/exerciseServiceApi"

import { exercisePlugin, groupByPart } from "./ExerciseEditor"

const exercise = (part: string, name: string): RepositoryExercise => ({
  id: `${part}/${name}`,
  repository_id: "repository",
  part,
  name,
  repository_url: "https://github.com/example/course",
  checksum: [],
  download_url: "http://files.example/template.tar.zst",
})

describe("groupByPart", () => {
  const exercises = [
    exercise("part10", "ex01"),
    exercise("part2", "ex02"),
    exercise("part2", "ex01"),
  ]

  it("groups by part in natural order, sorting each part's exercises by name", () => {
    expect(
      groupByPart(exercises, "").map(([part, inPart]) => [part, inPart.map((e) => e.name)]),
    ).toEqual([
      ["part2", ["ex01", "ex02"]],
      ["part10", ["ex01"]],
    ])
  })

  it("filters case-insensitively across part, name and repository", () => {
    expect(groupByPart(exercises, "PART10").map(([part]) => part)).toEqual(["part10"])
    expect(groupByPart(exercises, "ex02").flatMap(([, inPart]) => inPart)).toHaveLength(1)
    expect(groupByPart(exercises, "nothing")).toEqual([])
  })
})

describe("exercisePlugin", () => {
  it("reads the plugin the service reported, and nothing from an exercise it has not", () => {
    expect(exercisePlugin({ ...exercise("p", "e"), details: { plugin: "python3" } })).toBe(
      "python3",
    )
    expect(exercisePlugin({ ...exercise("p", "e"), details: null })).toBeNull()
    expect(exercisePlugin(exercise("p", "e"))).toBeNull()
  })
})
