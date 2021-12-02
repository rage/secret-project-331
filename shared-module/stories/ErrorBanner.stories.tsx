/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import ErrorBanner from "../src/components/ErrorBanner"

export default {
  title: "Components/ErrorBanner",
  component: ErrorBanner,
} as Meta

const Component = ErrorBanner

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

const PLACEHOLDER_TITLE = "Data Not Found"
const PLACEHOLDER_TEXT_ONE = "This is because one of our backend developers was sleeping on duty"
const PLACEHOLDER_TEXT_TWO = `
Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem
Ipsum has been the industrys standard dummy text ever since the 1500s, when an
unknown printer took a galley of type and scrambled it to make a type specimen book.
It has survived not only five centuries, but also the leap into electronic
typesetting, remaining essentially unchanged. It was popularised in the 1960s with
the release of Letraset sheets containing Lorem Ipsum passages, and more recently
with desktop publishing software like Aldus PageMaker including versions of Lorem
Ipsum
`

export const BackendErrorResponse: Story<ComponentProps> = Template.bind({})
BackendErrorResponse.args = {
  error: {
    data: {
      title: PLACEHOLDER_TITLE,
      message: PLACEHOLDER_TEXT_ONE,
      source: PLACEHOLDER_TEXT_TWO,
    },
  },
}

export const BackendError: Story<ComponentProps> = Template.bind({})
BackendError.args = {
  error: {
    status: 418,
    statusText: "Massive Error Occured",
    request: {
      responseURL: "http://project-331.local/org/og-cs/",
    },
    data: {
      titel: PLACEHOLDER_TITLE,
      mensaje: PLACEHOLDER_TEXT_ONE,
      source: PLACEHOLDER_TEXT_TWO,
    },
  },
}

export const UnknownError: Story<ComponentProps> = Template.bind({})
UnknownError.args = {
  error: {
    statusCode: 500,
    statusText: "Internal Server Occured",
    data: {
      unknown: "Unknown error type",
    },
    headers: {
      connection: "keep-alive",
      "content-length": "60",
      "content-type": "application/json",
      date: "Wed, 24 Nov 2021 16:20:01 GMT",
    },
  },
}
