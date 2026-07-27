import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, test } from "node:test"

import { scaffoldReactProject, type ExercisePackageName } from "../src/index.ts"

// tests -> create-exercise-service -> packages -> shared-module -> repository root
const TEMPLATE_DIR = join(import.meta.dirname, "../../../..", "services", "example-exercise")
const ALL_EXERCISE_PACKAGES = [
  "@moocfi/exercise-protocol",
  "@moocfi/exercise-client",
  "@moocfi/exercise-react",
  "@moocfi/exercise-service-test-utils",
] as const satisfies readonly ExercisePackageName[]

type AssertNever<T extends never> = T
type _HostPackageIsNotAPluginDependency = AssertNever<
  Extract<ExercisePackageName, "@moocfi/exercise-iframe-host">
>
type _ScaffolderIsNotAPluginDependency = AssertNever<
  Extract<ExercisePackageName, "@moocfi/create-exercise-service">
>

async function withTemporaryProject(
  run: (base: string, projectPath: string) => Promise<void>,
): Promise<void> {
  const base = await mkdtemp(join(tmpdir(), "ces-package-specifiers-"))
  const projectPath = join(base, "specifier-exercise")
  try {
    await run(base, projectPath)
  } finally {
    await rm(base, { recursive: true, force: true })
  }
}

describe("npm exercise package specifiers", () => {
  test("defaults every package to the CLI version when no overrides are supplied", async () => {
    await withTemporaryProject(async (_base, projectPath) => {
      await scaffoldReactProject({
        projectName: "specifier-exercise",
        absoluteProjectPath: projectPath,
        port: 4567,
        sharedModule: "npm",
        templateDir: TEMPLATE_DIR,
      })

      const cliPackage = JSON.parse(
        await readFile(join(import.meta.dirname, "..", "package.json"), "utf8"),
      ) as { version: string }
      const pkg = JSON.parse(await readFile(join(projectPath, "package.json"), "utf8")) as {
        dependencies: Record<string, string>
        devDependencies: Record<string, string>
      }
      for (const packageName of ALL_EXERCISE_PACKAGES) {
        const section =
          packageName === "@moocfi/exercise-service-test-utils"
            ? pkg.devDependencies
            : pkg.dependencies
        assert.equal(section[packageName], `^${cliPackage.version}`)
      }
    })
  })

  test("preserves relative directories and tarballs in their correct dependency sections", async () => {
    await withTemporaryProject(async (_base, projectPath) => {
      await scaffoldReactProject({
        projectName: "specifier-exercise",
        absoluteProjectPath: projectPath,
        port: 4567,
        sharedModule: "npm",
        templateDir: TEMPLATE_DIR,
        exercisePackagesVersion: "9.9.9",
        exercisePackageSpecifiers: {
          "@moocfi/exercise-protocol": "file:../packages/exercise-protocol",
          "@moocfi/exercise-client": "file:../packages/exercise-client-0.0.0.tgz",
          "@moocfi/exercise-service-test-utils": "file:../packages/test-utils-0.0.0.tgz",
        },
      })

      const pkg = JSON.parse(await readFile(join(projectPath, "package.json"), "utf8")) as {
        dependencies: Record<string, string>
        devDependencies: Record<string, string>
      }
      assert.equal(
        pkg.dependencies["@moocfi/exercise-protocol"],
        "file:../packages/exercise-protocol",
      )
      assert.equal(
        pkg.dependencies["@moocfi/exercise-client"],
        "file:../packages/exercise-client-0.0.0.tgz",
      )
      assert.equal(pkg.dependencies["@moocfi/exercise-react"], "^9.9.9")
      assert.equal(
        pkg.devDependencies["@moocfi/exercise-service-test-utils"],
        "file:../packages/test-utils-0.0.0.tgz",
      )
      assert.equal(pkg.dependencies["@moocfi/exercise-service-test-utils"], undefined)
    })
  })

  test("rejects absolute POSIX and Windows file specifiers before creating a project", async (t) => {
    const absoluteSpecifiers = [
      "file:/opt/packages/exercise-protocol",
      "file:///opt/packages/exercise-protocol.tgz",
      "file:C:\\packages\\exercise-protocol.tgz",
      "file:C:/packages/exercise-protocol.tgz",
      "file:/C:/packages/exercise-protocol.tgz",
      "file:\\\\server\\packages\\exercise-protocol.tgz",
    ]

    for (const specifier of absoluteSpecifiers) {
      await t.test(specifier, async () => {
        await withTemporaryProject(async (_base, projectPath) => {
          await assert.rejects(
            scaffoldReactProject({
              projectName: "specifier-exercise",
              absoluteProjectPath: projectPath,
              port: 4567,
              sharedModule: "npm",
              templateDir: TEMPLATE_DIR,
              exercisePackageSpecifiers: {
                "@moocfi/exercise-protocol": specifier,
              },
            }),
            /Absolute file: specifier.*not portable/,
          )
          await assert.rejects(
            stat(projectPath),
            "validation should run before copying the template",
          )
        })
      })
    }
  })

  test("rejects absolute link and portal specifiers before creating a project", async (t) => {
    const absoluteSpecifiers = [
      "link:/opt/packages/exercise-protocol",
      "link:C:\\packages\\exercise-protocol",
      "portal:/opt/packages/exercise-protocol",
      "portal:C:/packages/exercise-protocol",
    ]

    for (const specifier of absoluteSpecifiers) {
      await t.test(specifier, async () => {
        await withTemporaryProject(async (_base, projectPath) => {
          await assert.rejects(
            scaffoldReactProject({
              projectName: "specifier-exercise",
              absoluteProjectPath: projectPath,
              port: 4567,
              sharedModule: "npm",
              templateDir: TEMPLATE_DIR,
              exercisePackageSpecifiers: {
                "@moocfi/exercise-protocol": specifier,
              },
            }),
            /Absolute (link:|portal:) specifier.*not portable/,
          )
          await assert.rejects(
            stat(projectPath),
            "validation should run before copying the template",
          )
        })
      })
    }
  })

  test("ignores overrides in vendor mode", async () => {
    await withTemporaryProject(async (_base, projectPath) => {
      await scaffoldReactProject({
        projectName: "specifier-exercise",
        absoluteProjectPath: projectPath,
        port: 4567,
        sharedModule: "vendor",
        templateDir: TEMPLATE_DIR,
        exercisePackageSpecifiers: Object.fromEntries(
          ALL_EXERCISE_PACKAGES.map((packageName) => [packageName, "file:/machine-only/package"]),
        ),
      })

      const pkg = JSON.parse(await readFile(join(projectPath, "package.json"), "utf8")) as {
        dependencies: Record<string, string>
        devDependencies: Record<string, string>
      }
      for (const packageName of ALL_EXERCISE_PACKAGES) {
        assert.equal(pkg.dependencies[packageName], undefined)
        assert.equal(pkg.devDependencies[packageName], undefined)
      }
    })
  })
})
