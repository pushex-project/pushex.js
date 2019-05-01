# Pushex.js

[![npm](https://img.shields.io/npm/v/pushex.svg)](https://npmjs.com/package/pushex)
[![Hex.pm](https://img.shields.io/hexpm/l/push_ex.svg)](https://github.com/pushex-project/pushex.js/blob/master/LICENSE)
[![Build Status](https://travis-ci.org/pushex-project/pushex.js.svg?branch=master)](https://travis-ci.org/pushex-project/pushex.js)

[PushEx](https://github.com/pushex-project/pushex) is an Elixir based push-only websocket implementation. Pushex.js is the
JS client to the server.

## Links

- [Hexdocs.pm](https://hexdocs.pm/push_ex)
- [Pushex Github](https://github.com/pushex-project/pushex)
- [Pushex.js npm](https://www.npmjs.com/package/pushex)

## Installation

You can install Pushex.js by using [npm](https://www.npmjs.com/package/pushex):

```
npm install --save pushex
```

## Documentation ToC

- [Pushex#constructor/2](#pushexconstructor)
- [Pushex#connect/0](#pushexconnect)
- [Pushex#disconnect/0](#pushexdisconnect)
- [Pushex#resetParams/0](#pushexresetparams)
- [Pushex#subscribe/1](#pushexsubscribe)
- [Pushex#unsubscribe/1](#pushexunsubscribe)
- [Pushex#getExistingSubscription/1](#pushexgetexistingsubscription)
- [Subscription#bind/2](#subscriptionbind)
- [Subscription#unbind/1](#subscriptionunbind)
- [Subscription#unbindAll/0](#subscriptionunbindall)
- [Subscription#hasBindings/0](#subscriptionhasbindings)

## Usage

Pushex is exposed via an exported class `Pushex`:

```js
import { Pushex } from 'pushex'
```

This class can be used to create an instance of Pushex. Each instance of Pushex maintains its own state and does not share any state with other Pushex instances. Thus, it's possible to run multiple Pushex clients on the same webpage.

```js
const pushex = new Pushex('wss://example.myserver.com/push_socket', {})
pushex.subscribe('user-1').bind('*', (event, data) => {
  console.log('user-1 channel received event/data', event, data)
})
```

Pushex constructor can accept several optional parameters that are important for extending the library for any use case:

```js
const pushex = new Pushex('wss://example.myserver.com/push_socket', {
  getParams: () => Promise.resolve({ token: 'myToken' }),
  onConnect: (pushEx) => {},
  onConnectionError: (pushEx) => {},
  socketReconnectAlgorithm: (tries) => {
    return [3000, 6000, 10000, 20000][tries - 1] || 30000
  }
})
```

## Authentication

All authentication / authorization occurs on your hosted server running PushEx during the lifecycle points `socket_connect` and `channel_join`.

## Methods

All public methods are detailed below.

### Pushex#constructor

```js
constructor(url, { getParams, onConnect, onConnectionError, socketReconnectAlgorithm })
```

* getParams - Function that returns a promise resolving parameters passed to the server on connection. This is only ever invoked in `connect` or explicit using `resetParams`.
* onConnect - This is invoked when the socket is opened
* onConnectionError - This is invoked when the socket encounters an error
* socketReconnectAlgorithm - This is invoked when the socket is determining how it should back off. The return value is in `ms`. The default implementation is `[3000, 6000, 10000, 20000][tries - 1] || 30000` and does not need specified

### Pushex#connect

```js
connect()
```

Resolves connection params and connects to the push socket. If the socket is already connected, the socket will **not** be disconnected.

### Pushex#disconnect

```js
disconnect()
```

Disconnects the push socket.

### Pushex#resetParams

```js
resetParams()
```

Fetches params using the provided `getParams` function and sets the params on the socket. This will not change the connected socket, but will affect future connection attempts, including reconnection attempts.

### Pushex#subscribe

```js
subscribe(channelName)
```

This is the main interface to accessing push data. A Subscription will be created and memoized for future usage. The `channelName` is used to connect as a Phoenix channel. In PushEx, any channel name you want to use is valid, and the authorization layer can be used to deny invalid channels.

### Pushex#unsubscribe

```js
unsubscribe(channelName)
```

If a Subscription exists for this name it will be left gracefully and closed. The subscription is removed from the list of PushEx subscriptions so that calling `subscribe/1` again will create a new Subscription. This resolves a promise because you are not guaranteed the Subscription is closed until a message is delivered to the server.

### Pushex#getExistingSubscription

```js
getExistingSubscription(channelName)
```

Returns the subscription if it already exists. Does not create a new subscription.

### Subscription#bind

```js
bind(eventName, callbackFn)
```

A subscription channel can have events bound to it, with the callbackFn being invoked when a message is received from the server.

In order to capture all events on a given cahnnel, use the special channelName `'*'`. The callbackFn will be invoked on every channel event, regardless of the name.

The `callbackFn` is invoked as `callbackFn(data, event)`.

`bind` returns a function which can be used to unsubscribe the event:

```js
const unsub = pushex.subscribe('myCh').bind('*', myCallback)
// myCallback is invoked when myCh receives any event
unsub()
// myCallback will not be invoked through this callback
```

### Subscription#unbind

```js
unbindAll(eventName)
```

All event bindings for the provided name will be removed. The Subscription still remains open and alive, so you could rebind events and it would work.

### Subscription#unbindAll

```js
unbindAll()
```

All event bindings for the entire subscription will be removed. The Subscription still remains open and alive, so you could rebind events and it would work.

### Subscription#hasBindings

```js
hasBindings()
```

Returns true/false indicating whether there are active bindings for this subscription.
