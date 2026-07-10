import type { DialogCapableMessagePort } from "../../src/client/parentDialog"
import { ParentDialogClient } from "../../src/client/parentDialog"

import type {
  DialogResponseMessage,
  OpenDialogMessage,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

/**
 * A fake of the subset of MessagePort the client uses. Captures the registered listener so the test
 * can simulate the parent replying, and records posted messages.
 */
function createFakePort() {
  let listener: ((event: MessageEvent) => void) | null = null
  const posted: unknown[] = []
  const port: DialogCapableMessagePort = {
    postMessage: (message: unknown) => {
      posted.push(message)
    },
    addEventListener: (_type, l) => {
      listener = l
    },
    removeEventListener: (_type, l) => {
      if (listener === l) {
        listener = null
      }
    },
  }
  return {
    port,
    posted,
    hasListener: () => listener !== null,
    /** Simulate the parent posting a message back over the port. */
    reply: (data: unknown) => {
      listener?.({ data } as MessageEvent)
    },
  }
}

const lastPostedOpenDialog = (posted: unknown[]): OpenDialogMessage =>
  posted[posted.length - 1] as OpenDialogMessage

describe("ParentDialogClient", () => {
  it("posts an open-dialog message with the given options and a string requestId", () => {
    const fake = createFakePort()
    const client = new ParentDialogClient(fake.port)

    void client.openDialog({
      dialogType: "warning",
      title: "Title",
      body: ["Body"],
      confirmButtonLabel: "OK",
    })

    expect(fake.posted).toHaveLength(1)
    const message = lastPostedOpenDialog(fake.posted)
    expect(message.message).toBe("open-dialog")
    expect(message.dialogType).toBe("warning")
    expect(message.title).toBe("Title")
    expect(message.body).toEqual(["Body"])
    expect(message.confirmButtonLabel).toBe("OK")
    // omitted labels default to null rather than undefined
    expect(message.cancelButtonLabel).toBeNull()
    expect(typeof message.requestId).toBe("string")
    expect(message.requestId.length).toBeGreaterThan(0)
  })

  it("resolves with the confirmed value when the matching response arrives", async () => {
    const fake = createFakePort()
    const client = new ParentDialogClient(fake.port)

    const confirmedPromise = client.openDialog({ dialogType: "confirm", title: "t", body: ["b"] })
    const { requestId } = lastPostedOpenDialog(fake.posted)
    const response: DialogResponseMessage = {
      message: "dialog-response",
      requestId,
      confirmed: true,
    }
    fake.reply(response)

    await expect(confirmedPromise).resolves.toBe(true)
  })

  it("resolves false when the user cancels", async () => {
    const fake = createFakePort()
    const client = new ParentDialogClient(fake.port)

    const promise = client.openDialog({ dialogType: "confirm", title: "t", body: ["b"] })
    const { requestId } = lastPostedOpenDialog(fake.posted)
    fake.reply({ message: "dialog-response", requestId, confirmed: false })

    await expect(promise).resolves.toBe(false)
  })

  it("ignores responses with an unknown requestId and resolves only on the matching one", async () => {
    const fake = createFakePort()
    const client = new ParentDialogClient(fake.port)

    const promise = client.openDialog({ dialogType: "confirm", title: "t", body: ["b"] })
    const { requestId } = lastPostedOpenDialog(fake.posted)

    // Wrong id: must not resolve the promise.
    fake.reply({ message: "dialog-response", requestId: "some-other-id", confirmed: true })
    let settled = false
    void promise.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    // Correct id resolves it.
    fake.reply({ message: "dialog-response", requestId, confirmed: true })
    await expect(promise).resolves.toBe(true)
  })

  it("ignores non-dialog-response messages without throwing", () => {
    const fake = createFakePort()
    new ParentDialogClient(fake.port)

    expect(() => {
      fake.reply({ message: "set-state", data: {} })
      fake.reply("ready")
      fake.reply(null)
      fake.reply(undefined)
    }).not.toThrow()
  })

  it("supports multiple concurrent dialogs, correlating each response by id", async () => {
    const fake = createFakePort()
    const client = new ParentDialogClient(fake.port)

    const first = client.openDialog({ dialogType: "confirm", title: "first", body: ["b"] })
    const second = client.openDialog({ dialogType: "warning", title: "second", body: ["b"] })

    const firstId = (fake.posted[0] as OpenDialogMessage).requestId
    const secondId = (fake.posted[1] as OpenDialogMessage).requestId
    expect(firstId).not.toBe(secondId)

    // Reply out of order: second first.
    fake.reply({ message: "dialog-response", requestId: secondId, confirmed: true })
    fake.reply({ message: "dialog-response", requestId: firstId, confirmed: false })

    await expect(first).resolves.toBe(false)
    await expect(second).resolves.toBe(true)
  })

  it("dispose detaches the listener and resolves pending dialogs as not confirmed", async () => {
    const fake = createFakePort()
    const client = new ParentDialogClient(fake.port)

    const pending = client.openDialog({ dialogType: "confirm", title: "t", body: ["b"] })
    expect(fake.hasListener()).toBe(true)

    client.dispose()

    expect(fake.hasListener()).toBe(false)
    await expect(pending).resolves.toBe(false)
    // openDialog after dispose resolves false and posts nothing new
    const postedCount = fake.posted.length
    await expect(
      client.openDialog({ dialogType: "confirm", title: "t", body: ["b"] }),
    ).resolves.toBe(false)
    expect(fake.posted).toHaveLength(postedCount)
  })
})
