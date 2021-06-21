/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-var-requires */

import { BlockInstance } from "@wordpress/blocks"
import { compile } from "json-schema-to-typescript"
import fs from "fs"
import { JSONSchemaTypeName } from "json-schema-to-typescript/dist/src/types/JSONSchema"

const jsdom = require("jsdom")
const { JSDOM } = jsdom
const dom = new JSDOM(`<body>
<script>document.body.appendChild(document.createElement("hr"));</script>
</body>`)
const mock = () => {}
Object.defineProperty(dom.window, "matchMedia", {
  writable: true,
  value: (query) => {
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
const blockLibrary = require("@wordpress/block-library")
const blocks = require("@wordpress/blocks")
import { addFilter } from "@wordpress/hooks"
import { assign } from "lodash"

addFilter("blocks.registerBlockType", "moocfi/cms/modify-blockAtrributes", modifyBlockAttributes)

function modifyBlockAttributes(settings, name) {
  if (name !== "core/image") {
    return settings
  }

  settings.attributes.linkDestination.default = "media"
  settings.attributes = assign(settings.attributes, {
    blurDataUrl: {
      type: "string",
      default: "",
    },
  })

  return settings
}

async function main() {
  blockLibrary.registerCoreBlocks()

  const sanitizeNames = (name: string) => {
    const newName = name.replace("core/", "").replace(/-./g, (x) => x.toUpperCase()[1])
    return newName.charAt(0).toUpperCase() + newName.slice(1) + "Attributes"
  }

  const blockTypes: BlockInstance[] = blocks.getBlockTypes()
  const jsonSchemaTypes = blockTypes.map((block: BlockInstance) => {
    return {
      title: sanitizeNames(block.name),
      type: "object" as JSONSchemaTypeName,
      properties: { ...block.attributes },
      additionalProperties: false,
      required: Object.entries(block.attributes)
        .filter(([_key, value]) => value.default !== undefined)
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
