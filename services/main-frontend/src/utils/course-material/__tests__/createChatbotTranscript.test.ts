import { createChatbotTranscript } from "../createChatbotTranscript"

import { ChatbotConversationInfo } from "@/shared-module/common/bindings"

describe("getChatbotTranscript", () => {
  const info1: ChatbotConversationInfo = {
    current_conversation: {
      id: "",
      created_at: "",
      updated_at: "",
      deleted_at: null,
      course_id: "",
      user_id: "",
      chatbot_configuration_id: "",
    },
    current_conversation_messages: [
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: "How can I help you?",
        message_role: "assistant",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 0,
        tool_output: null,
        tool_call_fields: [],
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: "Hi? What time is it?",
        message_role: "user",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 1,
        tool_output: null,
        tool_call_fields: [],
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: null,
        message_role: "assistant",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 2,
        tool_output: null,
        tool_call_fields: [
          {
            id: "",
            created_at: "",
            updated_at: "",
            deleted_at: null,
            message_id: "",
            tool_name: "what_time",
            tool_arguments: {},
            tool_call_id: "",
          },
        ],
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: null,
        message_role: "tool",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 3,
        tool_output: {
          id: "",
          created_at: "",
          updated_at: "",
          deleted_at: null,
          message_id: "",
          tool_name: "what_time",
          tool_output: "Tool result: It's 12:32 pm.",
          tool_call_id: "",
        },
        tool_call_fields: [],
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: "Right now it's 12:32 pm. Any further questions?",
        message_role: "assistant",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 4,
        tool_output: null,
        tool_call_fields: [],
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: "No, thank u :)",
        message_role: "user",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 5,
        tool_output: null,
        tool_call_fields: [],
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: "Great. Any further questions?",
        message_role: "assistant",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 6,
        tool_output: null,
        tool_call_fields: [],
      },
    ],
    current_conversation_message_citations: [],
    chatbot_name: "Test bot",
    hide_citations: true,
  }

  const info2: ChatbotConversationInfo = {
    current_conversation: {
      id: "",
      created_at: "",
      updated_at: "",
      deleted_at: null,
      course_id: "",
      user_id: "",
      chatbot_configuration_id: "",
    },
    current_conversation_messages: [
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: "How can I help you?",
        message_role: "assistant",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 0,
        tool_output: null,
        tool_call_fields: [],
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: "Hi? What is the abacus?",
        message_role: "user",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 1,
        tool_output: null,
        tool_call_fields: [],
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: null,
        message_role: "assistant",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 2,
        tool_output: null,
        tool_call_fields: [
          {
            id: "",
            created_at: "",
            updated_at: "",
            deleted_at: null,
            message_id: "",
            tool_name: "what_abacus",
            tool_arguments: {},
            tool_call_id: "",
          },
        ],
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: null,
        message_role: "tool",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 3,
        tool_output: {
          id: "",
          created_at: "",
          updated_at: "",
          deleted_at: null,
          message_id: "",
          tool_name: "what_abacus",
          tool_output: "Tool result: Just google it.",
          tool_call_id: "",
        },
        tool_call_fields: [],
      },
      {
        id: "long-abacus-message",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: `Here is a short essay about the abacus. I hope you enjoy it.

# The History of the Abacus: Humanity's First Calculator

Long before the digital age and even before the invention of written numerals, humans needed a way to count, calculate, and trade [doc1]. This necessity led to the creation of one of the world’s earliest and most enduring mathematical tools: the **abacus**. Often referred to as the **world's first calculator**, the abacus is not just a relic of the past but a symbol of human ingenuity in the pursuit of numerical understanding. [doc3]

## Origins: The Dawn of Counting

The exact origins of the abacus are difficult to pinpoint due to the scarcity of early physical evidence. However, historians believe that the concept of the abacus evolved gradually as early humans transitioned from primitive counting methods—like tally marks and using fingers or stones—to more sophisticated systems.

### Prehistoric Counting Tools

Before the invention of formal writing systems, humans used **counting boards**, **knotted ropes**, or lines drawn in the dirt to represent quantities. The **Ishango bone**, dated to around 20,000 years ago [doc3] and found in Central Africa, features carved notches that some archaeologists believe represent a rudimentary counting system. While not an abacus in the traditional sense, it illustrates the human need to record and manipulate numbers.

## The Mesopotamian and Egyptian Influence

The **earliest true abacus-like devices** may have emerged in **Mesopotamia** around 2300 BCE. Sumerians used small pebbles or tokens (called **calculi**) on flat surfaces to perform basic arithmetic, especially for commerce and taxation. These were often used in conjunction with **clay tablets**, making them a precursor to what would become the abacus [doc5].

Similarly, in **Ancient Egypt**, records suggest the use of counting boards with grooves and stones to assist in calculations. Although no physical abacuses from these periods survive, descriptions and artwork hint at their existence.

Any further questions?`,
        message_role: "assistant",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 4,
        tool_output: null,
        tool_call_fields: [],
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: "Yeah, what is abacus made of?",
        message_role: "user",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 5,
        tool_output: null,
        tool_call_fields: [],
      },
      {
        id: "abacus-material-message",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message:
          "Abaci are usually made of wooden beads and metallic rods [doc1]. Sometimes other materials can be used [doc5]. Any other questions?",
        message_role: "assistant",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 6,
        tool_output: null,
        tool_call_fields: [],
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: "No, thank u :)",
        message_role: "user",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 7,
        tool_output: null,
        tool_call_fields: [],
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: "Great. Any further questions?",
        message_role: "assistant",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 8,
        tool_output: null,
        tool_call_fields: [],
      },
    ],
    current_conversation_message_citations: [
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        conversation_message_id: "long-abacus-message",
        course_material_chapter_number: 0,
        title: "Abacus 1",
        content: "Blah blah",
        citation_number: 1,
        document_url: "https://example.com/abacus1",
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        conversation_message_id: "long-abacus-message",
        course_material_chapter_number: 0,
        title: "Irrelevant",
        content: "Blah blah",
        citation_number: 2,
        document_url: "https://example.com/irrelevant",
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        conversation_message_id: "long-abacus-message",
        course_material_chapter_number: 0,
        title: "Abacus 3",
        content: "Blah blah",
        citation_number: 3,
        document_url: "https://example.com/abacus3",
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        conversation_message_id: "long-abacus-message",
        course_material_chapter_number: 0,
        title: "Irrelevant content",
        content: "Blah blah",
        citation_number: 4,
        document_url: "https://example.com/irrelevant2",
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        conversation_message_id: "long-abacus-message",
        course_material_chapter_number: 0,
        title: "Abacus 5",
        content: "Blah blah",
        citation_number: 5,
        document_url: "https://example.com/abacus5",
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        conversation_message_id: "long-abacus-message",
        course_material_chapter_number: 0,
        title: "Cool bug facts",
        content: "Blah blah",
        citation_number: 6,
        document_url: "https://example.com/bug-facts",
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        conversation_message_id: "abacus-material-message",
        course_material_chapter_number: 0,
        title: "Abacus materials: Typical materials",
        content: "Blah blah",
        citation_number: 1,
        document_url: "https://example.com/abc",
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        conversation_message_id: "abacus-material-message",
        course_material_chapter_number: 0,
        title: "Irrelevant content",
        content: "Blah blah",
        citation_number: 2,
        document_url: "https://example.com/irrelevant",
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        conversation_message_id: "abacus-material-message",
        course_material_chapter_number: 0,
        title: "Generic article",
        content: "Blah blah",
        citation_number: 5,
        document_url: "https://example.com/article",
      },
    ],
    chatbot_name: "Test bot",
    hide_citations: true,
  }
  const info3: ChatbotConversationInfo = {
    current_conversation: {
      id: "",
      created_at: "",
      updated_at: "",
      deleted_at: null,
      course_id: "",
      user_id: "",
      chatbot_configuration_id: "",
    },
    current_conversation_messages: [
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: "How can I help you?",
        message_role: "assistant",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 0,
        tool_output: null,
        tool_call_fields: [],
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: "Hi? What is the abacus?",
        message_role: "user",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 1,
        tool_output: null,
        tool_call_fields: [],
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: null,
        message_role: "assistant",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 2,
        tool_output: null,
        tool_call_fields: [
          {
            id: "",
            created_at: "",
            updated_at: "",
            deleted_at: null,
            message_id: "",
            tool_name: "what_abacus",
            tool_arguments: {},
            tool_call_id: "",
          },
        ],
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: null,
        message_role: "tool",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 3,
        tool_output: {
          id: "",
          created_at: "",
          updated_at: "",
          deleted_at: null,
          message_id: "",
          tool_name: "what_abacus",
          tool_output: "Tool result: Just google it.",
          tool_call_id: "",
        },
        tool_call_fields: [],
      },
      {
        id: "long-abacus-message",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: `Here is a short essay about the abacus. I hope you enjoy it.

Blah blah.

Any further questions?`,
        message_role: "assistant",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 4,
        tool_output: null,
        tool_call_fields: [],
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: "No, thank u :)",
        message_role: "user",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 5,
        tool_output: null,
        tool_call_fields: [],
      },
      {
        id: "",
        created_at: "",
        updated_at: "",
        deleted_at: null,
        conversation_id: "",
        message: "Great. Any further questions?",
        message_role: "assistant",
        message_is_complete: true,
        used_tokens: 0,
        order_number: 6,
        tool_output: null,
        tool_call_fields: [],
      },
    ],
    current_conversation_message_citations: [],
    chatbot_name: "Test bot",
    hide_citations: false,
  }

  it("works in simple case with tool call", () => {
    let transcript = createChatbotTranscript(info1)
    expect(transcript).toStrictEqual(
      `[Test bot said:]
How can I help you?

[You said:]
Hi? What time is it?

[Test bot said:]
Right now it's 12:32 pm. Any further questions?

[You said:]
No, thank u :)

[Test bot said:]
Great. Any further questions?`,
    )
  })

  it("works with citations and tool call, hide citations", () => {
    let transcript = createChatbotTranscript(info2)
    expect(transcript).toStrictEqual(
      `[Test bot said:]
How can I help you?

[You said:]
Hi? What is the abacus?

[Test bot said:]
Here is a short essay about the abacus. I hope you enjoy it.

# The History of the Abacus: Humanity's First Calculator

Long before the digital age and even before the invention of written numerals, humans needed a way to count, calculate, and trade. This necessity led to the creation of one of the world’s earliest and most enduring mathematical tools: the **abacus**. Often referred to as the **world's first calculator**, the abacus is not just a relic of the past but a symbol of human ingenuity in the pursuit of numerical understanding.

## Origins: The Dawn of Counting

The exact origins of the abacus are difficult to pinpoint due to the scarcity of early physical evidence. However, historians believe that the concept of the abacus evolved gradually as early humans transitioned from primitive counting methods—like tally marks and using fingers or stones—to more sophisticated systems.

### Prehistoric Counting Tools

Before the invention of formal writing systems, humans used **counting boards**, **knotted ropes**, or lines drawn in the dirt to represent quantities. The **Ishango bone**, dated to around 20,000 years ago and found in Central Africa, features carved notches that some archaeologists believe represent a rudimentary counting system. While not an abacus in the traditional sense, it illustrates the human need to record and manipulate numbers.

## The Mesopotamian and Egyptian Influence

The **earliest true abacus-like devices** may have emerged in **Mesopotamia** around 2300 BCE. Sumerians used small pebbles or tokens (called **calculi**) on flat surfaces to perform basic arithmetic, especially for commerce and taxation. These were often used in conjunction with **clay tablets**, making them a precursor to what would become the abacus.

Similarly, in **Ancient Egypt**, records suggest the use of counting boards with grooves and stones to assist in calculations. Although no physical abacuses from these periods survive, descriptions and artwork hint at their existence.

Any further questions?

[You said:]
Yeah, what is abacus made of?

[Test bot said:]
Abaci are usually made of wooden beads and metallic rods. Sometimes other materials can be used. Any other questions?

[You said:]
No, thank u :)

[Test bot said:]
Great. Any further questions?`,
    )
  })

  it("works with citations and tool call, show citations", () => {
    let info2a = { ...info2, hide_citations: false }
    let transcript = createChatbotTranscript(info2a)
    expect(transcript).toStrictEqual(
      `[Test bot said:]
How can I help you?

[You said:]
Hi? What is the abacus?

[Test bot said:]
Here is a short essay about the abacus. I hope you enjoy it.

# The History of the Abacus: Humanity's First Calculator

Long before the digital age and even before the invention of written numerals, humans needed a way to count, calculate, and trade [doc1]. This necessity led to the creation of one of the world’s earliest and most enduring mathematical tools: the **abacus**. Often referred to as the **world's first calculator**, the abacus is not just a relic of the past but a symbol of human ingenuity in the pursuit of numerical understanding. [doc2]

## Origins: The Dawn of Counting

The exact origins of the abacus are difficult to pinpoint due to the scarcity of early physical evidence. However, historians believe that the concept of the abacus evolved gradually as early humans transitioned from primitive counting methods—like tally marks and using fingers or stones—to more sophisticated systems.

### Prehistoric Counting Tools

Before the invention of formal writing systems, humans used **counting boards**, **knotted ropes**, or lines drawn in the dirt to represent quantities. The **Ishango bone**, dated to around 20,000 years ago [doc2] and found in Central Africa, features carved notches that some archaeologists believe represent a rudimentary counting system. While not an abacus in the traditional sense, it illustrates the human need to record and manipulate numbers.

## The Mesopotamian and Egyptian Influence

The **earliest true abacus-like devices** may have emerged in **Mesopotamia** around 2300 BCE. Sumerians used small pebbles or tokens (called **calculi**) on flat surfaces to perform basic arithmetic, especially for commerce and taxation. These were often used in conjunction with **clay tablets**, making them a precursor to what would become the abacus [doc3].

Similarly, in **Ancient Egypt**, records suggest the use of counting boards with grooves and stones to assist in calculations. Although no physical abacuses from these periods survive, descriptions and artwork hint at their existence.

Any further questions?

[You said:]
Yeah, what is abacus made of?

[Test bot said:]
Abaci are usually made of wooden beads and metallic rods [doc4]. Sometimes other materials can be used [doc5]. Any other questions?

[You said:]
No, thank u :)

[Test bot said:]
Great. Any further questions?

________________________________________________________

References

[doc1] Abacus 1, https://example.com/abacus1
[doc2] Abacus 3, https://example.com/abacus3
[doc3] Abacus 5, https://example.com/abacus5
[doc4] Abacus materials: Typical materials, https://example.com/abc
[doc5] Generic article, https://example.com/article`,
    )
  })

  it("works when show citations but there are no citations", () => {
    let transcript = createChatbotTranscript(info3)
    expect(transcript).toStrictEqual(`[Test bot said:]
How can I help you?

[You said:]
Hi? What is the abacus?

[Test bot said:]
Here is a short essay about the abacus. I hope you enjoy it.

Blah blah.

Any further questions?

[You said:]
No, thank u :)

[Test bot said:]
Great. Any further questions?`)
  })
})
