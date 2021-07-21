// Require imports needs to happen in a specific order.
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-var-requires */

import { Block } from "@wordpress/blocks"
import { addFilter } from "@wordpress/hooks"
import fs from "fs"
import { compile } from "json-schema-to-typescript"
import { JSONSchemaTypeName } from "json-schema-to-typescript/dist/src/types/JSONSchema"

import { modifyBlockAttributes } from "../src/utils/Gutenberg/modifyBlockAttributes"

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
global.navigator = dom.window.navigator

// The following import order matters and are dependant on above window definition.
const blockLibrary = require("@wordpress/block-library")
const blocks = require("@wordpress/blocks")

addFilter("blocks.registerBlockType", "moocfi/cms/modify-blockAttributes", modifyBlockAttributes)
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
  const jsonSchemaTypes = blockTypes.map((block) => {
    return {
      title: sanitizeNames(block.name),
      type: "object" as JSONSchemaTypeName,
      properties: { ...block.attributes },
      additionalProperties: false,
      required: Object.entries(block.attributes)
        .filter(([_key, value]) => (value as { default: unknown }).default !== undefined)
        .map(([key, _value]) => key),
    }
  })

  const typescriptTypes = await Promise.all(
    jsonSchemaTypes.map(async (schema) => {
      return await compile(schema, schema.title, { bannerComment: "" })
    }),
  )

  const types =
    "/* eslint-disable @typescript-eslint/no-empty-interface */" + "\n" + typescriptTypes.join("\n")
  await fs.promises.writeFile("../course-material/src/types/GutenbergBlockAttributes.ts", types)
}
main()
