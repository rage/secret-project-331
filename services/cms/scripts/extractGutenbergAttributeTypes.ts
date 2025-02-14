// Require imports needs to happen in a specific order.
/* eslint-disable import/order */

import * as jsdom from "jsdom"
import type { JSONSchemaTypeName } from "json-schema-to-typescript/dist/src/types/JSONSchema"
import type { JSONSchema } from "json-schema-to-typescript"
import type { Block } from "@wordpress/blocks"
import fs from "fs"
import { compile } from "json-schema-to-typescript"

// -------- Make the script (node) enviroment to look enough like a browser environment for the operation to succeed --------
const { JSDOM } = jsdom
const dom = new JSDOM(`<body>
<script>document.body.appendChild(document.createElement("hr"));</script>
</body>`)
const mock = () => {
  // No op
}
Object.defineProperty(dom.window, "matchMedia", {
  writable: true,
  value: (query: unknown) => {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: mock,
      removeListener: mock,
      addEventListener: mock,
      removeEventListener: mock,
      dispatchEvent: mock,
    }
  },
})

// @ts-expect-error: Just to prevent a crash, not used
global.window = dom.window
global.document = dom.window.document
// @ts-expect-error: Just to prevent a crash, not used
global.CSS = {}
global.location = dom.window.location
global.navigator = {
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
} as Navigator

const OriginalURL = global.URL

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const urlThatDoesntCrashWithPaths = function (...args: any[]) {
  if (args[0].startsWith("/")) {
    return new OriginalURL(`https://example.com${args[0]}`)
  }
  // @ts-expect-error: mirrors the function
  return new OriginalURL(...args)
}
urlThatDoesntCrashWithPaths.prototype = URL.prototype
// @ts-expect-error: fake constructor
global.URL = urlThatDoesntCrashWithPaths

class FakeMutationObserver {
  observe() {
    // No op
  }
}

// @ts-expect-error: Just to prevent a crash, not used
global.MutationObserver = FakeMutationObserver

//** Extract Gutenberg block attribute types */
async function main() {
  // We do these imports dynamically so that our patches above are applied before the imports are executed. (Normal imports would be hoisted.)
  const [blocks, { addFilter }, blockLibrary, { default: tableBlockJSON }] = await Promise.all([
    import("@wordpress/blocks"),
    import("@wordpress/hooks"),
    import("@wordpress/block-library"),
    import("@wordpress/block-library/src/table/block.json"),
  ])

  const { modifyEmbedBlockAttributes, modifyImageBlockAttributes } = await import(
    "../src/utils/Gutenberg/modifyBlockAttributes"
  )
  const { supportedCoreBlocks } = await import("../src/blocks/supportedGutenbergBlocks")

  blockLibrary.registerCoreBlocks()

  blocks.getBlockTypes().forEach((block: Block<Record<string, unknown>>) => {
    if (supportedCoreBlocks.indexOf(block.name) === -1) {
      blocks.unregisterBlockType(block.name)
    }
  })

  const sanitizeNames = (name: string) => {
    const newName = name.replace("core/", "").replace(/-./g, (x) => x.toUpperCase()[1])
    return newName.charAt(0).toUpperCase() + newName.slice(1) + "Attributes"
  }

  const blockTypes: Array<Block<Record<string, unknown>>> = blocks.getBlockTypes()
  const jsonSchemaTypes: JSONSchema[] = blockTypes
    .reverse()
    .map(addSupportsAttributes)
    .map((block) => {
      // Fetch core/table head, foot, body types
      if (block.name === "core/table") {
        const tableAttributes = fixProperties(tableBlockJSON.attributes)
        return {
          title: sanitizeNames(block.name),
          type: "object" as JSONSchemaTypeName,
          properties: {
            ...fixProperties(block.attributes),
            // We can use same cells ref, as they seem to be same for head, foot, body
            head: {
              items: {
                $ref: "#/$defs/cells",
              },
            },
            foot: {
              items: {
                $ref: "#/$defs/cells",
              },
            },
            body: {
              items: {
                $ref: "#/$defs/cells",
              },
            },
          },
          additionalProperties: false,
          required: Object.entries(block.attributes)
            .filter(([_key, value]) => (value as { default: unknown }).default !== undefined)
            .map(([key, _value]) => key),
          $defs: {
            // Cells and CellAttributes are equal for all three in block.json that is imported from block-library
            cells: {
              type: "object" as JSONSchemaTypeName,
              properties: {
                cells: {
                  ...tableAttributes.head.query.cells,
                  items: {
                    $ref: "#/$defs/cellAttributes",
                  },
                },
              },
              additionalProperties: false,
            },
            cellAttributes: {
              type: "object" as JSONSchemaTypeName,
              properties: fixProperties(tableAttributes.head.query.cells.query),
              additionalProperties: false,
            },
          },
        }
      }

      let res = [
        {
          title: sanitizeNames(block.name),
          type: "object" as JSONSchemaTypeName,
          properties: fixProperties(block.attributes),
          additionalProperties: false,
          required: Object.entries(block.attributes)
            .filter(([_key, value]) => (value as { default: unknown }).default !== undefined)
            .map(([key, _value]) => key),
          deprecated: false,
        },
      ]
      if (block.deprecated) {
        res = res.concat(
          block.deprecated?.map((deprecated, n) => {
            const blockName = sanitizeNames(block.name)
            let required: string[] = []
            if (deprecated.attributes !== null && deprecated.attributes !== undefined) {
              required = Object.entries(deprecated.attributes)
                .filter(([_key, value]) => (value as { default: unknown }).default !== undefined)
                .map(([key, _value]) => key)
            }
            return {
              title: blockName.replace("Attributes", `Deprecated${n + 1}Attributes`),
              type: "object" as JSONSchemaTypeName,
              properties: fixProperties(deprecated.attributes),
              additionalProperties: false,
              required: required,
              deprecated: true,
            }
          }),
        )
      }

      return res
    })

  const typescriptTypes = await Promise.all(
    jsonSchemaTypes
      .flat()
      .filter((o) => !!o)
      .filter((schema) => !schema.deprecated)
      // sort alphabetically
      .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""))
      .map(async (schema) => {
        const jsonSchema = schema as JSONSchema
        const title = jsonSchema.title ?? "SchemaWithoutName"

        return await compile(jsonSchema, title, {
          bannerComment: "",
        })
      }),
  )
  const deprecatedTypescriptTypes = await Promise.all(
    jsonSchemaTypes
      .flat()
      .filter((o) => !!o)
      .filter((schema) => schema.deprecated)
      .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""))
      .map(async (schema) => {
        const jsonSchema = schema as JSONSchema
        const title = jsonSchema.title ?? "SchemaWithoutName"
        return await compile(jsonSchema, title, {
          bannerComment: "",
        })
      }),
  )

  const banner = `
// ###########################################
// ## This file is autogenerated by running ##
// ## 'bin/extract-gutenberg-types'         ##
// ## in the root of the repo.              ##
// ##                                       ##
// ## Do not edit this file by hand.        ##
// ###########################################

import type { StringWithHTML } from "."

`

  await fs.promises.writeFile(
    "../course-material/types/GutenbergBlockAttributes.ts",
    banner + typescriptTypes.join("\n"),
  )
  await fs.promises.writeFile(
    "../course-material/types/DeprecatedGutenbergBlockAttributes.ts",
    banner + deprecatedTypescriptTypes.join("\n"),
  )
  console.info("Done!")
  process.exit(0)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fixProperties(properties: { readonly [x: string]: any }) {
  const res = { ...properties }
  if (properties === null || properties === undefined) {
    return properties
  }
  for (const [_key, value] of Object.entries(properties)) {
    if (value.type === "rich-text") {
      value.tsType = "StringWithHTML"
    }
  }
  return res
}

function addSupportsAttributes(block: Block): Block {
  const attributes = block.attributes
  const supports = block.supports

  if (!supports) {
    return block
  }

  if (supports.typography?.fontSize) {
    // @ts-expect-error: adding a new attribute
    attributes["fontSize"] = {
      type: "string",
    }
  }

  return { ...block, attributes: attributes }
}

main()
