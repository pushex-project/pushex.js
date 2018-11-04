import { Socket } from "phoenix"
import { Subscription } from "./subscription"

const NO_OP = () => {}

const DEFAULT_SOCKET_RECONNECT_ALGORITHM = tries => {
  return [1000, 3000, 6000, 12000, 20000][tries - 1] || 30000
}

export class Pushex {
  constructor(url, { getParams, onConnect, onConnectionError, socketReconnectAlgorithm }) {
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
    this.socket.realDisconnect()
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

    return this.subscriptions[channelName].setup({
      reconnectAlgorithm: this.channelReconnectAlgorithm
    })
  }

  getSocket() {
    return this.socket
  }

  // private

  _setupSocket(url) {
    this.socket = new Socket(url, {
      reconnectAfterMs: this.reconnectAlgorithm
    })
    implementPhoenixBugfix(this.socket)

    this.socket.onOpen(() => {
      this.socket.channels.forEach((ch) => {
        ch.rejoinTimer.reset()
        ch.rejoinTimer.scheduleTimeout()
      })
      this.onConnect(this)
    })

    this.socket.onError(() => {
      this.onConnectionError(this)
    })
  }
}

function implementPhoenixBugfix(socket) {
  // HACK UNTIL  https://github.com/phoenixframework/phoenix/issues/2857 IS SHIPPED
  // Invert teardown / disconnect since I can't mess with the Timer callback

  socket.disconnect = function teardown(callback, code, reason) {
    if (this.conn) {
      this.conn.onclose = NO_OP
      if (code) {
        this.conn.close(code, reason || "")
      } else {
        this.conn.close()
      }
      this.conn = null
    }
    return callback && callback()
  }.bind(socket)

  socket.realDisconnect = function disconnect(callback, code, reason) {
    this.reconnectTimer.reset()
    this.disconnect(callback, code, reason)
  }.bind(socket)
}
