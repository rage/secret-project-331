/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import Threads from "../src/components/Forum/Threads"

export default {
  title: "Components/Forum/Threads",
  component: Threads,
} as Meta

const Component = Threads

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "Threads",
}
