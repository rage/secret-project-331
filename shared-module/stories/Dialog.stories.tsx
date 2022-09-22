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

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
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
