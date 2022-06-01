/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import Sponsor from "../src/components/Sponsor"

export default {
  title: "Components/Sponsor",
  component: Sponsor,
} as Meta

const Component = Sponsor

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "Sponsor",
}
