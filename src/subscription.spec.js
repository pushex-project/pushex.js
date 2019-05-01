import { Subscription } from "./subscription"

let mockChannel, mockSocket, mockPushEx

beforeEach(() => {
  mockChannel = {
    join: jest.fn(),
    on: jest.fn(),
    leave: jest.fn()
  }

  mockSocket = {
    channel: jest.fn(() => mockChannel)
  }

  mockPushEx = {
    getSocket: jest.fn(() => mockSocket)
  }
})

describe("setup", () => {
  it("creates/joins a channel through the socket", () => {
    const subscription = new Subscription("chName", { pushEx: mockPushEx })
    expect(subscription.setup()).toEqual(subscription)

    expect(mockSocket.channel.mock.calls).toEqual([["chName"]])
    expect(mockChannel.join.mock.calls).toEqual([[]])
  })

  it("sets up the msg callback of the channel", () => {
    const subscription = new Subscription("chName", { pushEx: mockPushEx })
    subscription.setup()

    expect(mockChannel.on.mock.calls).toEqual([["msg", expect.any(Function)]])
  })
})

describe("msg handler", () => {
  it("runs all bindings for the event", () => {
    const subscription = new Subscription("chName", { pushEx: mockPushEx })
    subscription.setup()

    const args = []
    let called = ""
    subscription.bind("event", (data, event) => {
      args.push([data, event])((called += "a"))
    })

    subscription.bind("event", () => (called += "b"))
    subscription.bind("eventx", () => fail("should not match"))

    mockChannel.on.mock.calls[0][1]({ data: "data", event: "event" })
    expect(args).toEqual([["data", "event"]])
    expect(called).toEqual("ab")

    mockChannel.on.mock.calls[0][1]({ data: "data", event: "event" })
    expect(args).toEqual([["data", "event"], ["data", "event"]])
    expect(called).toEqual("abab")

    mockChannel.on.mock.calls[0][1]({ data: "data", event: "nope" })
    expect(called).toEqual("abab")
  })

  it("runs * bindings as all messages", () => {
    const subscription = new Subscription("chName", { pushEx: mockPushEx })
    subscription.setup()

    const args = []
    let called = ""
    subscription.bind("event", () => (called += "a"))
    subscription.bind("*", (data, event) => {
      args.push([data, event])((called += "w"))
    })
    subscription.bind("eventx", () => fail("should not match"))

    mockChannel.on.mock.calls[0][1]({ data: "data", event: "event" })
    expect(args).toEqual([["data", "event"]])
    expect(called).toEqual("aw")

    mockChannel.on.mock.calls[0][1]({ data: "data", event: "event" })
    expect(called).toEqual("awaw")

    mockChannel.on.mock.calls[0][1]({ data: "data", event: "only the wildcard" })
    expect(called).toEqual("awaww")
  })

  it("swallows errors into a timeout to allow future subscriptions to be invoked while preserving the error stack", () => {
    jest.useFakeTimers()
    const subscription = new Subscription("chName", { pushEx: mockPushEx })
    subscription.setup()

    let called = ""
    subscription.bind("event", () => (called += "a"))
    subscription.bind("event", () => {
      throw new Error("x")
    })
    subscription.bind("event", () => (called += "b"))

    mockChannel.on.mock.calls[0][1]({ data: "fake", event: "event" })

    expect(called).toEqual("ab")
    expect(() => {
      jest.runAllTimers()
    }).toThrowError(new Error("x"))
  })

  it("can remove bindings", () => {
    const subscription = new Subscription("chName", { pushEx: mockPushEx })
    subscription.setup()

    let called = ""
    const unsubA = subscription.bind("event", () => (called += "a"))
    const unsubB = subscription.bind("event", () => (called += "b"))

    mockChannel.on.mock.calls[0][1]({ data: "fake", event: "event" })
    expect(called).toEqual("ab")

    unsubB()

    mockChannel.on.mock.calls[0][1]({ data: "fake", event: "event" })
    expect(called).toEqual("aba")

    unsubA()

    mockChannel.on.mock.calls[0][1]({ data: "fake", event: "event" })
    expect(called).toEqual("aba")
  })
})

describe("unbind", () => {
  it("works with no existing bindings", () => {
    const subscription = new Subscription("chName", { pushEx: mockPushEx })
    expect(subscription.bindings["test"]).toEqual(undefined)
    subscription.unbind("test")
    expect(subscription.bindings["test"]).toEqual([])
  })

  it("removes all current bindings for this event only", () => {
    const subscription = new Subscription("chName", { pushEx: mockPushEx })
    expect(subscription.bindings["test"]).toEqual(undefined)
    const unsubA = subscription.bind("test", () => (called += "a"))
    const unsubB = subscription.bind("test", () => (called += "b"))
    const other = subscription.bind("other", () => (called += "c"))
    expect(subscription.bindings["test"].length).toEqual(2)
    subscription.unbind("test")
    expect(subscription.bindings["test"]).toEqual([])
    expect(subscription.bindings["other"].length).toEqual(1)
  })
})

describe("unbindAll", () => {
  it("works with no existing bindings", () => {
    const subscription = new Subscription("chName", { pushEx: mockPushEx })
    expect(subscription.bindings).toEqual({})
    subscription.unbindAll()
    expect(subscription.bindings).toEqual({})
  })

  it("removes all current bindings", () => {
    const subscription = new Subscription("chName", { pushEx: mockPushEx })
    expect(subscription.bindings["test"]).toEqual(undefined)
    const unsubA = subscription.bind("test", () => (called += "a"))
    const unsubB = subscription.bind("other", () => (called += "b"))
    subscription.unbindAll()
    expect(subscription.bindings).toEqual({})
  })
})

describe("close", () => {
  function generateReceiveMock(eventToCallback) {
    const receiveMock = {
      receive: (event, fn) => {
        if (event === eventToCallback) {
          fn()
        }

        return receiveMock
      }
    }
    return receiveMock
  }

  it("resolves once closed", done => {
    const subscription = new Subscription("chName", { pushEx: mockPushEx })
    subscription.setup()

    const receiveMock = generateReceiveMock("ok")
    mockChannel.leave.mockReturnValue(receiveMock)

    subscription.close().then(done)
  })

  it("rejects if error", done => {
    const subscription = new Subscription("chName", { pushEx: mockPushEx })
    subscription.setup()

    const receiveMock = generateReceiveMock("error")
    mockChannel.leave.mockReturnValue(receiveMock)

    subscription.close().catch(done)
  })

  it("rejects if timeout", done => {
    const subscription = new Subscription("chName", { pushEx: mockPushEx })
    subscription.setup()

    const receiveMock = generateReceiveMock("timeout")
    mockChannel.leave.mockReturnValue(receiveMock)

    subscription.close().catch(done)
  })

  it("resolves without a channel", done => {
    const subscription = new Subscription("chName", { pushEx: mockPushEx })
    subscription.close().then(done)
  })
})
