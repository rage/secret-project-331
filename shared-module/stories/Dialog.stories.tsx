/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import Dialog from "../src/components/Dialog"

export default {
  title: "Components/Dialog",
  component: Dialog,
} as Meta

const Component = Dialog

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => (
  <>
    <h1>Background heading</h1>

    <p>Background paragraph.</p>
    <Component {...args} />
  </>
)

export const Closeable: Story<ComponentProps> = Template.bind({})
Closeable.args = {
  open: true,
  onClose: () => {
    console.info("onClose")
  },
  children: (
    <>
      <h1>Heading inside dialog</h1>
      <p>Paragraph inside dialog</p>
    </>
  ),
}

export const NotCloseable: Story<ComponentProps> = Template.bind({})
NotCloseable.args = {
  open: true,
  closeable: false,
  onClose: () => {
    console.info("onClose")
  },
  children: (
    <>
      <h1>Heading inside dialog</h1>
      <p>Paragraph inside dialog</p>
    </>
  ),
}
