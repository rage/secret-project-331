import watcher from "@parcel/watcher"

async function main() {
  // Subscribe to events
  let subscription: watcher.AsyncSubscription | null = null
  try {
    subscription = await watcher.subscribe(process.cwd(), (err, events) => {
      if (err) {
        console.error(`Error occurred while watching:`)
        console.error(err)
      }
      console.log(events)
    })
  } finally {
    if (subscription) {
      subscription.unsubscribe()
    }
  }
}

main()
