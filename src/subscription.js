export class Subscription {
  constructor(channelName, { pushEx }) {
    this.channelName = channelName
    this.pushEx = pushEx
    this.bindings = {}
  }

  hasBindings() {
    return (
      Object.keys(this.bindings).filter(key => {
        return this.bindings[key].length > 0
      }).length > 0
    )
  }

  setup() {
    if (!this.channel) {
      this.channel = this.pushEx.getSocket().channel(this.channelName)
      this.channel.join()
      this.channel.on("msg", this._handleMessage.bind(this))
    }

    return this
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this.channel) {
        this.channel
          .leave()
          .receive("ok", () => {
            this.channel = null
            resolve()
          })
          .receive("error", reject)
          .receive("timeout", reject)
      } else {
        resolve()
      }
    })
  }

  bind(eventName, fn) {
    this.bindings[eventName] = this.bindings[eventName] || []
    this.bindings[eventName].push(fn)

    return () => {
      this.bindings[eventName] = this.bindings[eventName].filter(testFn => testFn !== fn)
    }
  }

  unbind(eventName) {
    this.bindings[eventName] = []
  }

  unbindAll() {
    this.bindings = {}
  }

  // private

  _handleMessage({ data, event }) {
    this._runBindings(event, [data, event])
    this._runBindings("*", [data, event])
  }

  _runBindings(eventName, args) {
    const bindings = this.bindings[eventName] || []
    bindings.forEach(bindingFn => {
      this._invokeFunctionWithAsyncErrorHandling(bindingFn, args)
    })
  }

  _invokeFunctionWithAsyncErrorHandling(fn, args) {
    try {
      fn.apply(fn, args)
    } catch (e) {
      setTimeout(() => {
        throw e
      }, 0)
    }
  }
}
