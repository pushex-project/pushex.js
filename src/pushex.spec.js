import { Socket } from "phoenix"

import { Pushex } from "./pushex"

it("defines a Phoenix Socket to the current URL", () => {
  const pushex = new Pushex("wss://test.com", {})
  expect(pushex.socket).toEqual(expect.any(Socket))
  expect(pushex.socket.endPoint).toEqual("wss://test.com/websocket")
})

it("uses a default reconnectAfterMs strategy", () => {
  const pushex = new Pushex("wss://test.com", {})
  expect(pushex.socket.reconnectAfterMs(1)).toEqual(3000)
  expect(pushex.socket.reconnectAfterMs(2)).toEqual(6000)
  expect(pushex.socket.reconnectAfterMs(3)).toEqual(10000)
  expect(pushex.socket.reconnectAfterMs(4)).toEqual(20000)
  expect(pushex.socket.reconnectAfterMs(5)).toEqual(30000)
  expect(pushex.socket.reconnectAfterMs(6)).toEqual(30000)
  expect(pushex.socket.reconnectAfterMs(7)).toEqual(30000)
})

it("invokes onConnect when the socket becomes connected", done => {
  const getParams = () => Promise.resolve({ a: 1 })
  const onConnect = () => {
    done()
  }

  const pushex = new Pushex("wss://test.com", { onConnect, getParams })
  // Simulate a socket conn open, but setup the socket first
  pushex.connect().then(() => {
    pushex.socket.conn.onopen()
  })
})

it("invokes onConnectionError when the socket encounters an error", done => {
  const getParams = () => Promise.resolve({ a: 1 })
  const onConnectionError = () => {
    done()
  }

  const pushex = new Pushex("wss://test.com", { onConnectionError, getParams })
  // Simulate a socket conn error, but setup the socket first
  pushex.connect().then(() => {
    pushex.socket.conn.onerror()
  })
})

describe("connect", () => {
  it("fetches params before connecting the socket, if it is not already connected", () => {
    let counter = 0
    const getParams = () => {
      return Promise.resolve({ counter: counter++ })
    }

    const pushex = new Pushex("wss://test.com", { getParams })
    return pushex.connect().then(() => {
      expect(pushex.socket.conn.url).toEqual("wss://test.com/websocket?counter=0&vsn=2.0.0")

      return pushex.disconnect().then(() => {
        return pushex.connect().then(() => {
          expect(pushex.socket.conn.url).toEqual("wss://test.com/websocket?counter=1&vsn=2.0.0")
        })
      })
    })
  })

  it("does not change the socket params if the socket was already connected", () => {
    let counter = 0
    const getParams = () => {
      return Promise.resolve({ counter: counter++ })
    }

    const pushex = new Pushex("wss://test.com", { getParams })
    return pushex.connect().then(() => {
      expect(pushex.socket.conn.url).toEqual("wss://test.com/websocket?counter=0&vsn=2.0.0")

      return pushex.connect().then(() => {
        expect(pushex.socket.conn.url).toEqual("wss://test.com/websocket?counter=0&vsn=2.0.0")
      })
    })
  })
})

describe("disconnect", () => {
  it("disconnects the socket", () => {
    const pushex = new Pushex("wss://test.com", {})
    return pushex.connect().then(() => {
      expect(pushex.socket.conn).toBeInstanceOf(window.WebSocket)

      return pushex.disconnect().then(() => {
        expect(pushex.socket.conn).toEqual(null)
      })
    })
  })
})

describe("resetParams", () => {
  it("fetches and sets params on the socket, without changing the connected socket", () => {
    let counter = 0
    const getParams = () => {
      return Promise.resolve({ counter: counter++ })
    }

    const pushex = new Pushex("wss://test.com", { getParams })
    return pushex.connect().then(() => {
      expect(pushex.socket.conn.url).toEqual("wss://test.com/websocket?counter=0&vsn=2.0.0")
      expect(pushex.socket.params()).toEqual({ counter: 0 })

      return pushex.resetParams().then(() => {
        expect(pushex.socket.params()).toEqual({ counter: 1 })
        expect(pushex.socket.conn.url).toEqual("wss://test.com/websocket?counter=0&vsn=2.0.0")
      })
    })
  })
})

describe("subscribe", () => {
  it("defines, sets up, and returns a Subscription instance", () => {
    const pushex = new Pushex("wss://test.com", {})
    const sub = pushex.subscribe("chName")

    expect(sub.channelName).toEqual("chName")
    expect(sub.pushEx).toEqual(pushex)
    expect(sub.channel).not.toBeUndefined()
  })

  it("can be called multiple times to return the same Subscription instance", () => {
    const pushex = new Pushex("wss://test.com", {})
    const sub = pushex.subscribe("chName")
    const sameSub = pushex.subscribe("chName")
    const sub2 = pushex.subscribe("other")

    expect(sub).toEqual(sameSub)
    expect(sub).not.toEqual(sub2)
  })
})
