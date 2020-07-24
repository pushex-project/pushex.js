import { Socket } from "phoenix"
import { Subscription } from "./subscription"

const NO_OP = () => {}

const DEFAULT_SOCKET_RECONNECT_ALGORITHM = (tries: number) => {
  return [3000, 6000, 10000, 20000][tries - 1] || 30000
}

export class Pushex {
  private reconnectAlgorithm: typeof DEFAULT_SOCKET_RECONNECT_ALGORITHM
  private getParams: () => Promise<Record<string, any>>
  private onConnect: (instance: Pushex) => void
  private onConnectionError: (instance: Pushex) => void
  private subscriptions: Record<string, Subscription>
  private socket!: Socket

  constructor(
    url: string,
    {
      getParams,
      onConnect,
      onConnectionError,
      socketReconnectAlgorithm
    }: {
      getParams: () => Promise<Record<string, any>>
      onConnect: (instance: Pushex) => void
      onConnectionError: (instance: Pushex) => void
      socketReconnectAlgorithm: typeof DEFAULT_SOCKET_RECONNECT_ALGORITHM
    }
  ) {
    if (!url) {
      throw new Error("URL is not valid")
    }

    this.reconnectAlgorithm = socketReconnectAlgorithm || DEFAULT_SOCKET_RECONNECT_ALGORITHM
    this.getParams = getParams || (() => Promise.resolve({}))
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
    return new Promise(resolve => {
      this.socket.disconnect(() => resolve())
    })
  }

  resetParams() {
    return this.getParams().then(params => {
      // @ts-ignore
      this.socket.params = () => params
      return this
    })
  }

  getExistingSubscription(channelName: string) {
    return this.subscriptions[channelName]
  }

  subscribe(channelName: string) {
    if (!this.getExistingSubscription(channelName)) {
      const subscription = new Subscription(channelName, {
        pushEx: this
      })
      this.subscriptions[channelName] = subscription
    }

    return this.getExistingSubscription(channelName).setup()
  }

  unsubscribe(channelName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const subscription = this.subscriptions[channelName]

      if (subscription) {
        return subscription
          .close()
          .then(() => {
            delete this.subscriptions[channelName]
            resolve()
          })
          .catch(reject)
      } else {
        return resolve()
      }
    })
  }

  getSocket() {
    return this.socket
  }

  // private

  _setupSocket(url: string) {
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
