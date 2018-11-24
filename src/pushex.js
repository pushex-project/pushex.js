import { Socket } from "phoenix"
import { Subscription } from "./subscription"

const NO_OP = () => {}

const DEFAULT_SOCKET_RECONNECT_ALGORITHM = tries => {
  return [3000, 6000, 10000, 20000][tries - 1] || 30000
}

export class Pushex {
  constructor(url, { getParams, onConnect, onConnectionError, socketReconnectAlgorithm, channelReconnectAlgorithm }) {
    if (!url) {
      throw new Error("URL is not valid")
    }

    this.reconnectAlgorithm = socketReconnectAlgorithm || DEFAULT_SOCKET_RECONNECT_ALGORITHM
    this.getParams = getParams || (() => ({}))
    this.onConnect = onConnect || NO_OP
    this.onConnectionError = onConnectionError || NO_OP
    this.subscriptions = {}
    this._setupSocket(url)
  }

  connect() {
    return this.resetParams().then(() => {
      this.socket.connect()
    })
  }

  disconnect() {
    this.socket.disconnect()
  }

  resetParams() {
    return this.getParams().then(params => {
      this.socket.params = params
      return this
    })
  }

  subscribe(channelName) {
    if (!this.subscriptions[channelName]) {
      const subscription = new Subscription(channelName, { pushEx: this })
      this.subscriptions[channelName] = subscription
    }

    return this.subscriptions[channelName].setup()
  }

  getSocket() {
    return this.socket
  }

  // private

  _setupSocket(url) {
    this.socket = new Socket(url, {
      reconnectAfterMs: this.reconnectAlgorithm
    })

    this.socket.onOpen(() => {
      this.onConnect(this)
    })

    this.socket.onError(() => {
      this.onConnectionError(this)
    })
  }
}
