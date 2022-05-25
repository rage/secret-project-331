/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import AttemptTracker from "../src/components/AttemptTracker"

export default {
  title: "Components/AttemptTracker",
  component: AttemptTracker,
} as Meta

const Component = AttemptTracker

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "AttemptTracker",
}
