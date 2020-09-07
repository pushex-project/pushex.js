import { Channel } from "phoenix"
import { Pushex } from "./pushex"

export type SubscriptionFunction<T = any> = (data: T, event: string) => void

export class Subscription {
  private channelName: string
  private pushEx: Pushex
  private bindings: Record<string, SubscriptionFunction[]>
  private channel?: Channel

  constructor(channelName: string, { pushEx }: { pushEx: Pushex }) {
    this.channelName = channelName
    this.pushEx = pushEx
    this.bindings = {}
  }

  public hasBindings() {
    return (
      Object.keys(this.bindings).filter(key => {
        return this.bindings[key].length > 0
      }).length > 0
    )
  }

  public bind(eventName: string, fn: SubscriptionFunction) {
    this.bindings[eventName] = this.bindings[eventName] || []
    this.bindings[eventName].push(fn)

    return () => {
      this.bindings[eventName] = this.bindings[eventName].filter(testFn => testFn !== fn)
    }
  }

  public unbind(eventName: string) {
    this.bindings[eventName] = []
  }

  public unbindAll() {
    this.bindings = {}
  }

  // Public, but for internal use
  public setup() {
    if (!this.channel) {
      this.channel = this.pushEx.getSocket().channel(this.channelName)
      this.channel.join()
      this.channel.on("msg", this.handleMessage.bind(this))
    }

    return this
  }

  // Public, but for internal use
  public close() {
    return new Promise((resolve, reject) => {
      if (this.channel) {
        this.channel
          .leave()
          .receive("ok", () => {
            this.channel = undefined
            resolve()
          })
          .receive("error", reject)
          .receive("timeout", reject)
      } else {
        resolve()
      }
    })
  }

  // private

  private handleMessage({ data, event }: { data: any; event: string }) {
    this.runBindings(event, [data, event])
    this.runBindings("*", [data, event])
  }

  private runBindings(eventName: string, args: [any, string]) {
    const bindings = this.bindings[eventName] || []
    bindings.forEach(bindingFn => {
      this.invokeFunctionWithAsyncErrorHandling(bindingFn, args)
    })
  }

  private invokeFunctionWithAsyncErrorHandling(fn: SubscriptionFunction, args: [any, string]) {
    try {
      fn.apply(fn, args)
    } catch (e) {
      setTimeout(() => {
        throw e
      }, 0)
    }
  }
}
