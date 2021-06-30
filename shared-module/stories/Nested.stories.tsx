import React from "react"
import { Story, Meta } from "@storybook/react"
import Nested from "../src/components/Nested"

export default {
  title: "Components/Nested",
  component: Nested,
} as Meta

const Component = Nested

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {}
