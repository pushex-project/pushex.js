import { Subscription } from './subscription'

const DEFAULT_CHANNEL_RECONNECT_ALGORITHM = () => 5000

class FakeTimer {}

let mockChannel, mockSocket, mockPushEx

beforeEach(() => {
  mockChannel = {
    join: jest.fn(),
    on: jest.fn(),
    rejoinTimer: new FakeTimer()
  }

  mockSocket = {
    channel: jest.fn(() => mockChannel)
  }

  mockPushEx = {
    getSocket: jest.fn(() => mockSocket)
  }
})

describe('setup', () => {
  it('creates/joins a channel through the socket', () => {
    const subscription = new Subscription('chName', { pushEx: mockPushEx })
    expect(subscription.setup({ reconnectAlgorithm: DEFAULT_CHANNEL_RECONNECT_ALGORITHM })).toEqual(subscription)

    expect(mockSocket.channel.mock.calls).toEqual([['chName']])
    expect(mockChannel.join.mock.calls).toEqual([[]])
  })

  it('redefines the reconnectTimer to work around slow reconnects', () => {
    const rejoinTimer = mockChannel.rejoinTimer
    rejoinTimer.sentinel = true

    const subscription = new Subscription('chName', { pushEx: mockPushEx })
    subscription.setup({ reconnectAlgorithm: DEFAULT_CHANNEL_RECONNECT_ALGORITHM })

    expect(mockChannel.rejoinTimer).not.toEqual(rejoinTimer)
    expect(mockChannel.rejoinTimer).toEqual(expect.any(FakeTimer))
  })

  it('sets up the msg callback of the channel', () => {
    const subscription = new Subscription('chName', { pushEx: mockPushEx })
    subscription.setup({ reconnectAlgorithm: DEFAULT_CHANNEL_RECONNECT_ALGORITHM })

    expect(mockChannel.on.mock.calls).toEqual([['msg', expect.any(Function)]])
  })
})

describe('msg handler', () => {
  it('runs all bindings for the event', () => {
    const subscription = new Subscription('chName', { pushEx: mockPushEx })
    subscription.setup({ reconnectAlgorithm: DEFAULT_CHANNEL_RECONNECT_ALGORITHM })

    let called = ''
    subscription.bind('event', () => called += 'a')
    subscription.bind('event', () => called += 'b')
    subscription.bind('eventx', () => fail('should not match'))

    mockChannel.on.mock.calls[0][1]({ data: 'fake', event: 'event' })
    expect(called).toEqual('ab')

    mockChannel.on.mock.calls[0][1]({ data: 'fake', event: 'event' })
    expect(called).toEqual('abab')

    mockChannel.on.mock.calls[0][1]({ data: 'fake', event: 'nope' })
    expect(called).toEqual('abab')
  })

  it('runs * bindings as all messages', () => {
    const subscription = new Subscription('chName', { pushEx: mockPushEx })
    subscription.setup({ reconnectAlgorithm: DEFAULT_CHANNEL_RECONNECT_ALGORITHM })

    let called = ''
    subscription.bind('event', () => called += 'a')
    subscription.bind('*', () => called += 'w')
    subscription.bind('eventx', () => fail('should not match'))

    mockChannel.on.mock.calls[0][1]({ data: 'fake', event: 'event' })
    expect(called).toEqual('aw')

    mockChannel.on.mock.calls[0][1]({ data: 'fake', event: 'event' })
    expect(called).toEqual('awaw')

    mockChannel.on.mock.calls[0][1]({ data: 'fake', event: 'only the wildcard' })
    expect(called).toEqual('awaww')
  })

  it('swallows errors into a timeout to allow future subscriptions to be invoked while preserving the error stack', () => {
    jest.useFakeTimers()
    const subscription = new Subscription('chName', { pushEx: mockPushEx })
    subscription.setup({ reconnectAlgorithm: DEFAULT_CHANNEL_RECONNECT_ALGORITHM })

    let called = ''
    subscription.bind('event', () => called += 'a')
    subscription.bind('event', () => {
      throw new Error('x')
    })
    subscription.bind('event', () => called += 'b')

    mockChannel.on.mock.calls[0][1]({ data: 'fake', event: 'event' })

    expect(called).toEqual('ab')
    expect(() => {
      jest.runAllTimers()
    }).toThrowError(new Error('x'))
  })

  it('can remove bindings', () => {
    const subscription = new Subscription('chName', { pushEx: mockPushEx })
    subscription.setup({ reconnectAlgorithm: DEFAULT_CHANNEL_RECONNECT_ALGORITHM })

    let called = ''
    const unsubA = subscription.bind('event', () => called += 'a')
    const unsubB = subscription.bind('event', () => called += 'b')

    mockChannel.on.mock.calls[0][1]({ data: 'fake', event: 'event' })
    expect(called).toEqual('ab')

    unsubB()

    mockChannel.on.mock.calls[0][1]({ data: 'fake', event: 'event' })
    expect(called).toEqual('aba')

    unsubA()

    mockChannel.on.mock.calls[0][1]({ data: 'fake', event: 'event' })
    expect(called).toEqual('aba')
  })
})
