/* Copyright 2017 Tierion
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*     http://www.apache.org/licenses/LICENSE-2.0
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict'

const Promise = require('bluebird')
const _ = require('lodash')
const dns = require('dns')
const url = require('url')
const validator = require('validator')
const cpb = require('chainpoint-binary')
const cpp = require('chainpoint-parse')
const request = require('request')
const rp = require('request-promise')

const DNS_CORE_DISCOVERY_ADDR = '_core.addr.chainpoint.org'

/**
 * Check if valid Core URI
 *
 * @param {string} coreAddr - The URI to check
 * @returns {bool} true if value is a valid Core URI, otherwise false
 */
function _isValidCoreAddr (coreAddr) {
  if (_.isEmpty(coreAddr) || !_.isString(coreAddr)) return false

  try {
    return validator.isURL(coreAddr, {
      host_whitelist: [/^[a-z]\.chainpoint\.org$/]
    })
  } catch (error) {
    return false
  }
}

/**
 * Retrieve the URI for a DNS discoverable Core API endpoint.
 *
 * @param {function} callback - An optional callback function.
 * @returns {string} - Returns either a callback or a Promise with a Core URI string
 */
function getCore (callback) {
  callback = callback || function () {}

  return new Promise(function (resolve, reject) {
    dns.resolveTxt(DNS_CORE_DISCOVERY_ADDR, (err, records) => {
      if (err) {
        reject(err)
        return callback(err)
      }

      if (_.isEmpty(records)) {
        let err = new Error('no core addresses available')
        reject(err)
        return callback(err)
      }

      // Pick a discoverd Core at random and return it as string
      let core = _.head(_.sample(records))

      // Verify that the discovered Core is valid
      if (_isValidCoreAddr(core)) {
        let coreURI = 'https://' + core
        resolve(coreURI)
        return callback(null, coreURI)
      } else {
        let err = new Error(`invalid core address : ${core}`)
        reject(err)
        return callback(err)
      }
    })
  })
}

/**
 * Check if valid Node URI
 *
 * @param {string} nodeURI - The value to check
 * @returns {bool} true if value is a valid Node URI, otherwise false
 */
function _isValidNodeURI (nodeURI) {
  if (!_.isString(nodeURI)) return false

  try {
    let isValidURI = validator.isURL(nodeURI, {
      protocols: ['http', 'https'],
      require_protocol: true,
      host_blacklist: ['0.0.0.0']
    })

    let parsedURI = url.parse(nodeURI).hostname

    // Valid URI w/ IPv4 address?
    return isValidURI && validator.isIP(parsedURI, 4)
  } catch (error) {
    return false
  }
}

/**
 * Retrieve an Array of discovered Node URIs.
 *
 * @param {function} callback - An optional callback function.
 * @returns {Array<String>} - Returns either a callback or a Promise with an Array of Node URI strings
 */
function getNodes (callback) {
  callback = callback || function () {}

  return new Promise(function (resolve, reject) {
    getCore().then(coreURI => {
      let getNodeURI = coreURI + '/nodes/random'
      request({ uri: getNodeURI, json: true }, (err, response, body) => {
        if (err) {
          reject(err)
          return callback(err)
        }

        // extract public_uri from each node object
        let nodes = _.map(body, 'public_uri')
        // randomize the order
        let shuffledNodes = _.shuffle(nodes)
        // only return nodes with valid addresses (should be all)
        let filteredNodes = _.filter(shuffledNodes, function (n) { return _isValidNodeURI(n) })
        // only return three nodes
        let threeNodes = _.slice(filteredNodes, 0, 3)

        resolve(threeNodes)
        return callback(null, threeNodes)
      })
    }).catch(err => {
      reject(err)
      return callback(err)
    })
  })
}

/**
 * Checks if value is a hexadecimal string
 *
 * @param {string} value - The value to check
 * @returns {bool} true if value is a hexadecimal string, otherwise false
 */
function _isHex (value) {
  var hexRegex = /^[0-9a-f]{2,}$/i
  var isHex = hexRegex.test(value) && !(value.length % 2)
  return isHex
}

/**
 * Checks if param is a function
 *
 * @param {string} parm - The param to check
 * @returns {bool} true if value is a function, otherwise false
 */
function _isFunction (param) {
  if (typeof param === 'function') {
    return true
  }
}

/**
 * Submit hash(es) to one or more Nodes, returning an Array of result objects, one for each Node.
 * @param {Array<String>} hashes - An Array of String Hashes in Hexadecimal form.
 * @param {Array<String>} uris - An Array of String URI's. Each hash will be submitted to each Node URI provided. If none provided three will be chosen at random using service discovery.
 * @return {Array<Object>} An Array of Objects, each Object representing submission to a single Node. Each Node's results contain all info needed to retrieve all proof.
 */
function submitHashes (hashes, uris, callback) {
  uris = uris || []
  callback = callback || function () {}
  let nodesPromise

  // Validate callback is a function
  if (!_isFunction(callback)) throw new Error('callback arg must be a function')

  // Validate all hashes provided
  if (!_.isArray(hashes)) throw new Error('hashes arg must be an Array')
  if (_.isEmpty(hashes)) throw new Error('hashes arg must be a non-empty Array')
  let badHashes = _.reject(hashes, function (h) { return _isHex(h) })
  if (!_.isEmpty(badHashes)) throw new Error(`hashes arg contains invalid hashes : ${badHashes.join(', ')}`)

  // Validate all Node URIs provided
  if (!_.isArray(uris)) throw new Error('uris arg must be an Array of String URIs')

  if (_.isEmpty(uris)) {
    // empty : get a list of nodes via service discovery
    nodesPromise = getNodes()
  } else {
    // eliminate duplicate URIs
    uris = _.uniq(uris)

    // non-empty, check that *all* are valid or throw
    let badURIs = _.reject(uris, function (h) { return _isValidNodeURI(h) })
    if (!_.isEmpty(badURIs)) throw new Error(`uris arg contains invalid URIs : ${badURIs.join(', ')}`)
    // all provided URIs were valid
    nodesPromise = Promise.resolve(uris)
  }

  return new Promise(function (resolve, reject) {
    // Resolve an Array of Nodes from service discovery or the arg provided
    nodesPromise.then((nodes) => {
      // Setup an options Object for each Node we'll submit hashes to.
      // Each Node will then be sent the full Array of hashes.
      let nodesWithPostOpts = _.map(nodes, function (node) {
        let postOptions = {
          method: 'POST',
          uri: node + '/hashes',
          body: {
            hashes: hashes
          },
          headers: {
            'content-type': 'application/json'
          },
          json: true
        }
        return postOptions
      })

      Promise.map(nodesWithPostOpts, rp, {concurrency: 25}).then(function (parsedBody) {
        // urls fetched in order in parsedBody Array
        // console.log(parsedBody)
        resolve(parsedBody)
        return callback(null, parsedBody)
      }, function (err) {
        reject(err)
        return callback(err)
      })
    }).catch(err => {
      console.error(err.message)
      throw err
    })
  })
}

/**
 * Retrieve a collection of proofs for one or more hash IDs from the appropriate Node(s)
 * @param {Array<{uri: String, hashIDNode: String}>} proofHandles - An Array of Objects, each Object containing all info needed to retrieve a proof from a specific Node.
 * @param {function} callback - An optional callback function.
 * @return {Array<{uri: String, hashIDNode: String, proof: String}>} - An Array of Objects, each returning the URI the proof was returned from and the Proof in Base64 encoded binary form.
 */
function getProofs (proofHandles, callback) {
  callback = callback || function () {}

  // Validate callback is a function
  if (!_isFunction(callback)) throw new Error('callback arg must be a function')

  // TODO : Verify that proofHandles is an Array and non-empty
  // TODO : Verify that each item in proofHandles Array is an object that matches expected shape
  // TODO : Verify that each uri and each hashIDNode are valid

  return new Promise(function (resolve, reject) {
    try {
      // FIXME : INSERT ACTUAL FUNCTIONALITY HERE TO REPLACE SAMPLE
      let res = [{uri: '', hashIDNode: '', proof: ''}]
      resolve(res)
      return callback(null, res)
    } catch (err) {
      reject(err)
      return callback(err)
    }
  })
}

/**
 * Verify a collection of proofs using an optionally provided Node URI
 * @param {Array} proofs - An Array of proofs to be verified. Proofs can be in any format supported by chainpoint-binary.
 * @param {String} nodeURI - [Optional] The Node URI to submit a proofs to for verification. If not provided a Node will be selected at random.
 * @param {function} callback - An optional callback function.
 * @return {Array<Object>} - An Array of Objects, each returning the URI the proof was returned from along with the Proof.
 */
function verifyProofs (proofs, nodeURI, callback) {
  callback = callback || function () {}

  // Validate callback is a function
  if (!_isFunction(callback)) throw new Error('callback arg must be a function')

  // TODO : Verify that proofs is an Array and non-empty
  // TODO : Normalize each proof in the Array to JSON form and check its schema
  // TODO : If present verify that baseURI is a string and a valid Node URI
  // TODO : If baseURI is not present, perform discovery to find a valid Node

  return new Promise(function (resolve, reject) {
    try {
      // FIXME : INSERT ACTUAL FUNCTIONALITY HERE TO REPLACE SAMPLE
      let res = [{hashIDNode: '', valid: true, anchors: ['cal', 'btc']}]
      resolve(res)
      return callback(null, res)
    } catch (err) {
      reject(err)
      return callback(err)
    }
  })
}

module.exports = {
  getCore: getCore,
  getNodes: getNodes,
  submitHashes: submitHashes,
  getProofs: getProofs,
  verifyProofs: verifyProofs
}
