import { confirm, input, select } from "@inquirer/prompts"
import { resolve } from "path"

async function main() {
  const projectName = await input({
    message: "Project name",
    validate: (value) => value.length > 0,
  })
  const projectPath = await input({
    message: "Path to the project",
    validate: (value) => value.length > 0,
    default: `${projectName}`,
  })
  const projectType = await select({
    message: "Project type",
    choices: [
      {
        name: "React",
        value: "react",
        description:
          "An exercise service built with React using the Next.js framework and using Typescript..",
      },
      {
        name: "Svelte",
        disabled: "Not implemented yet",
        value: "svelte",
        description: "Svelte with SvelteKit, using typescript",
      },
      {
        name: "No framework (not recommended)",
        disabled: "Not implemented yet",
        value: "no-framework",
        description:
          "No framework, just plain HTML, CSS and JS. This is a simplistic example that demonstrates that the exercise services are not tied to any frontend frameworks. Please choose some framework if you want to build something that is both usable and maintainable.",
      },
    ],
  })
  const packageManager = await select({
    message: "Package manager",
    choices: [
      { name: "npm", value: "npm" },
      { name: "yarn", value: "yarn" },
      { name: "pnpm", value: "pnpm" },
    ],
  })
  // convert projectPath to an absolute path
  const absoluteProjectPath = resolve(projectPath)
  const confirmation = await confirm({
    message: `The project will be created in ${absoluteProjectPath}. Continue?`,
    default: false,
  })
  if (!confirmation) {
    console.log("Aborting")
    return
  }
}

main()
