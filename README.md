# Chainpoint Client (JavaScript)

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![npm](https://img.shields.io/npm/l/chainpoint-client.svg)](https://www.npmjs.com/package/chainpoint-client)
[![npm](https://img.shields.io/npm/v/chainpoint-client.svg)](https://www.npmjs.com/package/chainpoint-client)
[![Build Status](https://travis-ci.com/chainpoint/chainpoint-client-js.svg?branch=master)](https://travis-ci.com/chainpoint/chainpoint-client-js)
[![Coverage Status](https://coveralls.io/repos/github/chainpoint/chainpoint-client-js/badge.svg?branch=master)](https://coveralls.io/github/chainpoint/chainpoint-client-js?branch=master)

## About

A client for creating and verifying [Chainpoint](https://chainpoint.org) proofs.

The Chainpoint Client handles communication with a distributed network of Nodes that make up the Chainpoint Network.

The Chainpoint Client lets you submit hashes to a Chainpoint Node on the Chainpoint Network. Nodes periodically aggregate hashes and send data to Core for anchoring the hash to public blockchains.

The Chainpoint Client lets you retrieve and verify a Chainpoint proof. Each proof cryptographically proves the integrity and existence of data at a point in time.

This client can be used in both Browser and Node.js based JavaScript applications using `callback` functions, Promises (using `.then`, `.catch`), or Promises (using `async`/`await`) functional styles.

**Important:** This library has been updated for v2 of the Chainpoint network. This means that it won't work for older proofs and instead interacts with nodes on the new network.
If you would like to still use this library for older proofs, please downgrade to v1.x.x

## Proof Creation and Verification Overview

Creating a Chainpoint proof is an asynchronous process. This client handles all the steps for submitting hashes, retrieving proofs, and verifying proofs.

### Submit Hash(es)

This is an HTTP request that passes an Array of hash(es) to a Node. The Node will return a Version 1 UUID for each hash submitted. This `hashidNode` is used later for retrieving a proof.

### Get Proof(s)

Proofs are first anchored to the 'Calendar' chain maintained by every Chainpoint Core. This takes up to ten seconds. Retrieving a `hashIdNode` at this stage returns a proof anchored to the Calendar.

Proofs are appended with data as they are anchored to additional blockchains. For example, it takes 60 - 90 minutes to anchor a proof to Bitcoin. Calling getProofs will now append the first proof with data that anchors it to the Bitcoin Blockchain.

Nodes retain proofs for 24 hours. Each client must retrieve and permanently store each Chainpoint proof.

### Verify Proof(s)

Anyone with a Chainpoint proof can verify that it cryptographically anchors to one or more of the public blockchains. The verification process performs the operations in the proof to re-create a Merkle root. This value is compared to a Merkle root stored in the public blockchain. If the values match, the proof is valid.

### Evaluate Proof(s)

This function is similar to the Verify function. The difference with this function is that it only calculates and returns the expected values for each anchor. This function does not verify that the expected values exist on the public blockchains. In most common cases, you will want to use Verify instead.

## TL;DR

[Try It Out with RunKit](https://runkit.com/grempe/tierion-chainpoint-client-async-example)

```javascript
const chp = require('chainpoint-client')

async function runIt() {
  // A few sample SHA-256 proofs to anchor
  let hashes = [
    '1d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a',
    '2d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a',
    '3d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a'
  ]

  // Submit each hash to three randomly selected Nodes
  let proofHandles = await chp.submitHashes(hashes)
  console.log('Submitted Proof Objects: Expand objects below to inspect.')
  console.log(proofHandles)

  // Wait for Calendar proofs to be available
  console.log('Sleeping 12 seconds to wait for proofs to generate...')
  await new Promise(resolve => setTimeout(resolve, 12000))

  // Retrieve a Calendar proof for each hash that was submitted
  let proofs = await chp.getProofs(proofHandles)
  console.log('Proof Objects: Expand objects below to inspect.')
  console.log(proofs)

  // Verify every anchor in every Calendar proof
  let verifiedProofs = await chp.verifyProofs(proofs)
  console.log('Verified Proof Objects: Expand objects below to inspect.')
  console.log(verifiedProofs)
}

runIt()
```

## Public API

The following public functions are exported from this client. All functions in the client library are written
using Promises in the async/await style where possible. Previous versions were written in the Nodejs callback
style, but that has since been deprecated.

Additionally, the output of each function in the process has been designed so that it can be used as the input to the next with no need to manipulate the data.

### `submitHashes(hashes, uris)`

#### Description

Use this function to submit an Array of hashes, and receive back the information needed to later retrieve a proof for each of those hashes using the `getProofs()` function.

By default hashes are submitted to three Nodes to help ensure a proof will become available at the appropriate time. Only one such proof need be permanently stored, the others provide redundancy.

#### Arguments

The `hashes` argument expects an Array of hashes, where each hash is a Hexadecimal String `[a-fA-F0-9]` between 160 bits (20 Bytes, 40 Hex characters) and 512 bits (64 Bytes, 128 Hex characters) in length. The Hex string must be an even length.

We recommend using the SHA-256 cryptographic one-way hash function for all hashes submitted.

The optional `uris` argument accepts an Array of Node URI's as returned by the `getNodes()` function. Each element of the returned Array is a full URI with `scheme://hostname[:port]` (e.g. `http://127.0.0.1` or `http://127.0.0.1:80`).

#### Return Values

The return value from this function is an Array of Objects, one for each hash submitted. Each result Object has the information needed to retrieve a proof for a submitted hash. There will be one Object for every Node a hash was submitted to.

The Array of Objects, referred to as `proofHandles` can also be submitted directly as the argument to the `getProofs()` function. It typically takes about 10 seconds for initial Calendar proofs to become available.

The Object will contain:

`uri` : The URI of the Node(s) the hash was submitted to. This is the only Node that can retrieve this particular proof.

`hash` : A copy of the hash that was originally submitted that will be embedded in a future proof. This allows for easier correlation between hashes submitted and the Hash ID handle needed to retrieve a proof.

`hashIdNode` : The Version 1 UUID that can be used to retrieve the proof for a submitted hash from the `/proofs/:id` endpoint of the Node it was submitted to.

`groupId` : A Version 1 UUID which is used to group Proof Handles that have the same corresponding hash. The groupId can later be used to optimize the proof retrieval process.

Example Return Value

```javascript
;[
  {
    uri: 'http://0.0.0.0',
    hash: '1d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a',
    proofId: 'df500460-d7d1-11e8-992b-0178d9540713',
    groupId: 'dfa4b410-d7d1-11e8-a6e3-c763418c848e'
  },
  {
    uri: 'http://0.0.0.0',
    hash: '2d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a',
    proofId: 'df502b70-d7d1-11e8-992b-0187b4b6e491',
    groupId: 'dfa4b411-d7d1-11e8-a6e3-c763418c848e'
  }
]
```

### `submitFileHashes(paths, uris)`

#### Description

Use this function to submit hashes calculated from an Array of file paths, and receive back the information needed to later retrieve a proof for each of those hashes using the `getProofs()` function.

By default hashes are submitted to three Nodes to help ensure a proof will become available at the appropriate time. Only one such proof need be permanently stored, the others provide redundancy.

#### Arguments

The `paths` argument expects an Array of valid file paths.

The SHA-256 cryptographic one-way hash function will be used on all files in the paths submitted.

The optional `uris` argument accepts an Array of Node URI's as returned by the `getNodes()` function. Each element of the returned Array is a full URI with `scheme://hostname[:port]` (e.g. `http://127.0.0.1` or `http://127.0.0.1:80`).

#### Return Values

The return value from this function is an Array of Objects, one for each hash submitted. Each result Object has the information needed to retrieve a proof for a submitted hash. There will be one Object for every Node a hash was submitted to.

The Array of Objects, referred to as `proofHandles` can also be submitted directly as the argument to the `getProofs()` function. It typically takes about 10 seconds for initial Calendar proofs to become available.

The Object will contain:

`uri` : The URI of the Node(s) the hash was submitted to. This is the only Node that can retrieve this particular proof.

`hash` : A copy of the hash that was originally submitted that will be embedded in a future proof. This allows for easier correlation between hashes submitted and the Hash ID handle needed to retrieve a proof.

`hashIdNode` : The Version 1 UUID that can be used to retrieve the proof for a submitted hash from the `/proofs/:id` endpoint of the Node it was submitted to.

`path` : The path of the file represented by this object.

`groupId` : A Version 1 UUID which is used to group Proof Handles that have the same corresponding hash. The groupId can later be used to optimize the proof retrieval process.

Example Return Value

```javascript
;[
  {
    uri: 'http://0.0.0.0',
    hash: '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a',
    proofId: 'a512e430-d3cb-11e7-aeb7-01eecbb37e34',
    path: './datafile.json',
    groupId: 'dc1c8cd0-d7d3-11e8-8a5c-7fe62f82e5c3'
  },
  {
    uri: 'http://0.0.0.0',
    hash: '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a',
    proofId: 'a4b6e180-d3cb-11e7-90bc-014342a27e15',
    path: './folder/otherfile.csv',
    groupId: 'dc1c8cd1-d7d3-11e8-8a5c-7fe62f82e5c3'
  }
]
```

### `getProofs(proofHandles)`

#### Description

This function is used to retrieve Chainpoint proofs from the Nodes that are responsible for creating each proof.

#### Arguments

The `proofHandles` argument accepts an Array of Objects. Each object must have the `uri` and `hashIdNode` properties. The argument is of the same form as the output from the `submitHashes()` function.

The `uri` property should be the base URI (e.g. `http://0.0.0.0`) of an online Node that is responsible for generating a particular proof.

The `hashIdNode` property is a valid Version 1 UUID as provided by the return of the `submitHashes()` function.

#### Return Values

This function will return an Array of Objects, each composed of the following properties:

```javascript
{
    hashIdNode: "",
    proof: "",
    anchorsComplete: []
}
```

`hashIdNode` : The Version 1 UUID used to retrieve the proof.

`proof` : The Base64 encoded binary form of the proof. See [https://github.com/chainpoint/chainpoint-binary](https://github.com/chainpoint/chainpoint-binary) for more information about proof formats. That library can also be used to convert from one form to another. If the proof is not yet available, or cannot be retrieved, this will be set to `null`.

`anchorsComplete` : An Array of Strings that indicates which blockchains the proof is anchored to at the time of retrieval. One or more of `cal` (Calendar), `btc` (Bitcoin), or `eth` (Ethereum) (you may also see `tcal` or `tbtc` for
testnet calendar anchors and testnet bitcoin anchors respectively). If the proof is not yet available, or cannot be retrieved, this will be set to `[]` (An empty Array).

Example Return Value

```javascript
;[
  {
    proofId: 'e47f00b0-d3fb-11e7-9dd9-015eb614885c',
    proof:
      'eJylVc1qZFUQ9jlcu+10VZ3/rAKCT+DKTahzqk7SENKhux3HZRRcO/oEo5EZB1wIrn2PgA/jdzMZBye9EDzQNPfce+vUV9/P/e712dheH/z54c/Lw+Fmf7pefxU2drLdXazHpW6ub7ab68P6Wbw7fH3jbz79Z+vuUveX92cTS4qITA85G/Xaau0lsIzcNZN7FIlcrUnPMmz0wtOlNXYvofHrm912O883dv9JcoohGK1iNl0xu660NF8Rl8ktJkmFf1tOPd/58M0ztz+EhFYkKwqfSzhlOpX6xeu+0+tx6fsX3/5ypd2v3ujFxc4v9LDd/by92X//5IHfh16dL1vb3fnbe8tzP96+vLr/4XqzPzyTU06VSuFIdGpJtcxpappm7m3kEgOuJabBJl2GBoCvjv+USubKo1aZpQwfpkEDRauucTYlaaEGppa4FhRLSh2VuVtp1oKpdDWLyW1Gwu3c2G5/2t682l/qSlK+ffW2bUB54OfuACi/PkLBTM8Kpza9JurZrCeeM5GNaDF2Vg0ZPFVPohbbFJ6Wa+dhNErRqTna3Ze7zf7FfV+0AWmEEw7pJMUTkbTGUX5tulv/30PWpgd9z8o3j6z0w3jKyl8ffXz7cgfdxSJubc5AENdE6WYFs7c6eY7SKI3Yi1DsOgTjJHTHKUBxrZah+V9TBNFnXQuVnspsrgapFsy/hcjFZuvoP1QAaD59cPIIdgc0nafW0lWotA8LHojp7WLOTCkPOCR0cJgwnjFnjR6oJ2MgIYtauIh2ibk76gaTisLSa31XB2s+Lsj+gyWS0cYyms+oOmwHwO/Oz/hFFfU0CP2Tt9BhNEmN2oxQbKylhJKxM8a7txY8bx7xrJ7Lw4wwuJGB2VKdnSquLJeStSpVgmAJ7A7vLoaThMOoLTt24JQ+Q9ZjNQOZxuGhSx6Jos/u8FVHY1181NnIK4dGwTKlJTtyVsCNM4DrPtuTmhCHyezchKMs7eYM1OitthkCmAsJUikt8yzRfUQei1o7DN47tIJkOlYzBsScLuFGGMCkwX2Bamla8bYYthVkHQQBpAHe56acyEchDNjisZo12GgKqI20gg1UcYytN4+Ihe5hlh7YJViKozLrAPTpS9dtQp7HaqJLR5MTIcTQCQIpDlbOyF1TpUixjp6RWAvkjkypHGud8C7AxTSP1SzuME9VnGo+Ug8jtw6CK/YlB1F2CIgKNyR1aosXuaWpHmJJedajHFGKnA0yQu5Dsci90BGqYXmTvWFkzXoVyLiARSmlGK4sFITlSPlYTWU4N9tMMLgoOKKJbgesBA/2aAKbxTLr4Iqp41ihNnpY1Kw08/iw5pN0RSS9T9dXnHOssf6njMTnDiKLCHumPvISB8IemuJjWQgx06pDB6CENKFj6DZQJoP78WXo5SEj/wbUW3Ki',
    anchorsComplete: ['tcal', 'tbtc']
  }
]
```

### `verifyProofs (proofs, uri)`

#### Description

This function is used to verify proofs by comparing the values arrived at by parsing and performing the operations in a proof against the Chainpoint calendar or public blockchains.

#### Arguments

The `proofs` argument accepts an Array of Strings or Objects.

If a String, it is expected to be a Chainpoint 4.0 proof in either Base64 encoded binary, or JSON-LD form.

If an Object it can be a Chainpoint 4.0 proof as an Object, or have a `proof` property containing a String proof as described above as is created by the output of `getProofs()`.

Proof types can be mixed freely in the `proofs` arg Array.

The `uri` property should be the base URI (e.g. `http://0.0.0.0`) of an online Node that will be responsible for providing a hash value from the Calendar block specified in the proof. The hash value provided will then be compared to the result of calculating all of the operations in the proof locally. If the locally calculated values matches the server provided value it verifies that the proof is valid.

At no time is the proof sent over the Internet during this process (although it is safe to do so).

#### Return Values

This function will return an Array of Objects. Each object represents an Anchor in a proof along with all of the relevant data.

For example, a single proof that is anchored to both the Chainpoint Calendar, and to the Bitcoin blockchain, will return two objects. One for each of those anchors.

Example Return Value

```javascript
;[
  {
    hash: 'daeaedcd320c0fb2adefaab15ec03a424bb7a89aa0ec918c6c4906c366c67e36',
    proof_id: "5e0433d0-46da-11ea-a79e-017f19452571",
    hash_received: "2020-02-03T23:10:28Z",
    uri: 'http://127.0.0.1/calendar/695928/hash',
    type: 'cal',
    anchorId: '695928',
    expectedValue: 'ff0fb5903d3b6deed2ee2ebc033813e7b0357de4af2e7b1d52784baad40a0d13',
    verified: true,
    verifiedAt: '2017-11-28T22:52:20Z'
  },
  {
    hash: 'daeaedcd320c0fb2adefaab15ec03a424bb7a89aa0ec918c6c4906c366c67e36',
    proof_id: "5e0433d0-46da-11ea-a79e-017f19452571",
    hash_received: "2020-02-03T23:10:28Z",
    uri: 'http://127.0.0.1/calendar/696030/data',
    type: 'btc',
    anchorId: '496469',
    expectedValue: 'de999f26afcdd855552ca91184aba496baa48bf59a7125180d7c1d7d520ea88b',
    verified: true,
    verifiedAt: '2017-11-28T22:52:20Z'
  }
]
```

### `evaluateProofs (proofs)`

#### Description

This function is used to evaluate proofs and returns the values arrived at by parsing and performing the operations in a proof.

For example, this can be used to easily verify that a proof that is anchored to the Bitcoin blockchain is valid, without trusting any other third party service. The only thing required is a copy of the Bitcoin block headers, available from any BTC full node or block explorer.

#### Arguments

The `proofs` argument accepts an Array of Strings or Objects.

If a String, it is expected to be a Chainpoint 4.0 proof in either Base64 encoded binary, or JSON-LD form.

If an Object it can be a Chainpoint 4.0 proof as an Object, or have a `proof` property containing a String proof as described above as is created by the output of `getProofs()`.

Proof types can be mixed freely in the `proofs` arg Array.

This process is handled entirely offline. At no time is the proof sent over the Internet during this process (although it is safe to do so).

#### Return Values

This function will return an Array of Objects. Each object represents an Anchor in a proof along with all of the relevant data.

For example, a single proof that is anchored to both the Chainpoint Calendar, and to the Bitcoin blockchain, will return two objects. One for each of those anchors.

Example Return Value

```javascript
;[
  {
    hash: 'daeaedcd320c0fb2adefaab15ec03a424bb7a89aa0ec918c6c4906c366c67e36',
    proof_id: "5e0433d0-46da-11ea-a79e-017f19452571",
    hash_received: "2020-02-03T23:10:28Z",
    uri: 'http://127.0.0.1/calendar/695928/hash',
    type: 'cal',
    anchorId: '695928',
    expectedValue: 'ff0fb5903d3b6deed2ee2ebc033813e7b0357de4af2e7b1d52784baad40a0d13'
  },
  {
    hash: 'daeaedcd320c0fb2adefaab15ec03a424bb7a89aa0ec918c6c4906c366c67e36',
    proof_id: "5e0433d0-46da-11ea-a79e-017f19452571",
    hash_received: "2020-02-03T23:10:28Z",
    uri: 'http://127.0.0.1/calendar/696030/data',
    type: 'btc',
    anchorId: '496469',
    expectedValue: 'de999f26afcdd855552ca91184aba496baa48bf59a7125180d7c1d7d520ea88b'
  }
]
```

In this case, you can use a block explorer to confirm that BTC block ID `496469` has a block Merkle root value (`expectedValue`) of `de999f26afcdd855552ca91184aba496baa48bf59a7125180d7c1d7d520ea88b`. If it does, that means this proof can be provably said to anchor its hash to that Bitcoin block.

### `getCores (num)`

#### Description

This is a utility function that allows you to perform DNS based auto-discovery of a available Core instance URI addresses.

This function is not required to be explicitly called when using the main functions of this library. It will be called internally as needed.

#### Arguments

The optional `num` argument determines the maximum number of Cores that should be returned in a single request in randomized order.

#### Return Values

This function returns an Array of String URIs.

### `getNodes (num)`

#### Description

This is a utility function that allows you to perform DNS based auto-discovery of Node URIs.

This function is not required to be explicitly called when using the main functions of this library. It will be called internally as needed.

#### Arguments

The optional `num` argument determines the maximum number of Nodes that should be returned in a single request in randomized order. The number of URI's returned are ultimately limited by the number of Nodes returned by Core's auto-discovery mechanism.

#### Return Values

This function returns an Array of String URIs. The list of Nodes returned are for Nodes that have recently been audited and found to be healthy.

## Usage : Functional Styles

This client can be used with several popular JavaScript API styles in both Node.js and the Browser.
The choice of API style is left to the developer and should be based on support for
each style in the intended runtime platform and the developer's preference.

The callback style is fully supported everywhere,
while Promises and `async/await` support will depend on the version of Node.js or Browser
being targetted. Each public API exported from this module supports each style equally.

### Callback Style Example [DEPRECATED]

```javascript
var cp = require('chainpoint-client')

let hashes = ['9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a']

cp.submitHashes(hashes, function(err, data) {
  if (err) {
    // `err` will contain any returned Error object and halt execution
    throw err
  }

  // If no error `data` will contain the returned values
  console.log(JSON.stringify(data, null, 2))
})
```

### Promises `.then/.catch` Style Example

```javascript
var cp = require('chainpoint-client')

let hashes = ['9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a']

cp.submitHashes(hashes, testNodesArray)
  .then(function(data) {
    // `data` will contain the returned values
    console.log(JSON.stringify(data, null, 2))
  })
  .catch(function(err) {
    // `err` will contain any returned Error object
    console.log(err)
  })
```

### Promises `async/await` Style Example

```javascript
var cp = require('chainpoint-client')

let hashes = ['9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a']

async function runIt() {
  let data = await cp.submitHashes(hashes)
  console.log(JSON.stringify(data, null, 2))
}

runIt()
```

### JavaScript Client-Side Frameworks Example

Note: If you are using any client-side JavaScript framework (ex. Angular, React, etc) remember to import chainpoint-client in the following manner:

```js
import chainpoint from 'chainpoint-client/dist/bundle.web'
```

or

```js
const chainpoint = require('chainpoint-client/dist/bundle.web')
```

### Browser Script Tag Example

You can copy `dist/bundle.web.js` into your app to be served from your own web server and included in a script tag.

Or install the `npm` package in a place available to your web server pages and set the `script src` tag as shown in the example below. A set of window global functions (e.g. `chainpointClient.submitHashes()`) will then be available for use in a fashion similar to that shown in the examples above.

```html
<script src="./node_modules/chainpoint-client/dist/bundle.web.js">
```

## License

[Apache License, Version 2.0](https://opensource.org/licenses/Apache-2.0)

```txt
Copyright (C) 2017-2018 Tierion

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
