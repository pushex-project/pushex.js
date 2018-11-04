export class Subscription {
  constructor(channelName, { pushEx }) {
    this.channelName = channelName
    this.pushEx = pushEx
    this.bindings = {}
  }

  setup({ reconnectAlgorithm }) {
    if (!this.channel) {
      this.channel = this.pushEx.getSocket().channel(this.channelName)
      this.channel.join()
      this.channel.on("msg", this._handleMessage.bind(this))
      this.channel.rejoinTimer = new this.channel.rejoinTimer.constructor(
        () => this.channel.rejoinUntilConnected(),
        reconnectAlgorithm
      )
    }

    return this
  }

  bind(eventName, fn) {
    this.bindings[eventName] = this.bindings[eventName] || []
    this.bindings[eventName].push(fn)

    return () => {
      this.bindings[eventName] = this.bindings[eventName].filter(testFn => testFn !== fn)
    }
  }

  // private

  _handleMessage({ data, event }) {
    this._runBindings(event, [event, data])
    this._runBindings("*", [event, data])
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
