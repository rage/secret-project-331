/* eslint-disable i18next/no-literal-string */
// Require imports needs to happen in a specific order.
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-var-requires */

import { Block } from "@wordpress/blocks"
import { addFilter } from "@wordpress/hooks"
import fs from "fs"
import { compile } from "json-schema-to-typescript"
import { JSONSchema, JSONSchemaTypeName } from "json-schema-to-typescript/dist/src/types/JSONSchema"

import {
  modifyEmbedBlockAttributes,
  modifyImageBlockAttributes,
} from "../src/utils/Gutenberg/modifyBlockAttributes"

const jsdom = require("jsdom")
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
      addListener: mock, // deprecated
      removeListener: mock, // deprecated
      addEventListener: mock,
      removeEventListener: mock,
      dispatchEvent: mock,
    }
  },
})
global.window = dom.window
global.document = dom.window.document
// @ts-ignore: Just to prevent a crash, not used
global.CSS = {}
global.location = dom.window.location

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

// @ts-ignore: Just to prevent a crash, not used
global.MutationObserver = FakeMutationObserver

// The following import order matters and are dependant on above window definition.
const blockLibrary = require("@wordpress/block-library")
const blocks = require("@wordpress/blocks")

addFilter("blocks.registerBlockType", "moocfi/modifyImageAttributes", modifyImageBlockAttributes)
addFilter("blocks.registerBlockType", "moocfi/modifyEmbedAttributes", modifyEmbedBlockAttributes)
const { supportedCoreBlocks } = require("../src/blocks/supportedGutenbergBlocks")

async function main() {
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
        const tableBlockJSON = require("@wordpress/block-library/src/table/block.json")
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

  const banner = `/* eslint-disable @typescript-eslint/no-empty-interface */

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
