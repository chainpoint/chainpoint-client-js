/* Copyright 2017-2018 Tierion
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
const uuidValidate = require('uuid-validate')
const cpp = require('chainpoint-parse')
const request = require('request')
const rp = require('request-promise')

const DNS_CORE_DISCOVERY_ADDR = '_core.addr.chainpoint.org'

/**
 * Check if valid Core URI
 *
 * @param {string} coreURI - The Core URI to test for validity
 * @returns {bool} true if coreURI is a valid Core URI, otherwise false
 */
function _isValidCoreURI (coreURI) {
  if (_.isEmpty(coreURI) || !_.isString(coreURI)) return false

  try {
    return validator.isURL(coreURI, {
      protocols: ['https'],
      require_protocol: true,
      host_whitelist: [/^[a-z]\.chainpoint\.org$/]
    })
  } catch (error) {
    return false
  }
}

/**
 * Retrieve an Array of discovered Core URIs. Returns one Core URI by default.
 *
 * @param {Integer} num - Max number of Core URI's to return.
 * @param {function} callback - An optional callback function.
 * @returns {string} - Returns either a callback or a Promise with an Array of Core URI strings.
 */
function getCores (num, callback) {
  callback = callback || function () {}
  num = num || 1

  if (!_.isInteger(num) || num < 1) throw new Error('num arg must be an Integer >= 1')

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

      let cores = _.map(records, coreIP => {
        return 'https://' + coreIP
      })

      // randomize the order
      let shuffledCores = _.shuffle(cores)
      // only return cores with valid addresses (should be all)
      let filteredCores = _.filter(shuffledCores, function (c) { return _isValidCoreURI(c) })
      // only return num cores
      let slicedCores = _.slice(filteredCores, 0, num)

      resolve(slicedCores)
      return callback(null, slicedCores)
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
 * Retrieve an Array of discovered Node URIs. Returns three Node URIs by default.
 * Can only return up to the number of Nodes that Core provides.
 *
 * @param {Integer} num - Max number of Node URIs to return.
 * @param {function} callback - An optional callback function.
 * @returns {Array<String>} - Returns either a callback or a Promise with an Array of Node URI strings
 */
function getNodes (num, callback) {
  callback = callback || function () {}
  num = num || 3

  if (!_.isInteger(num) || num < 1) throw new Error('num arg must be an Integer >= 1')

  return new Promise(function (resolve, reject) {
    getCores(1).then(coreURI => {
      let getNodeURI = _.first(coreURI) + '/nodes/random'
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
        // only return maxNodes nodes
        let slicedNodes = _.slice(filteredNodes, 0, num)

        resolve(slicedNodes)
        return callback(null, slicedNodes)
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
 * Checks if a proof handle Object has valid params.
 *
 * @param {Object} handle - The proof handle to check
 * @returns {bool} true if handle is valid Object with expected params, otherwise false
 */
function _isValidProofHandle (handle) {
  if (!_.isEmpty(handle) &&
      _.isObject(handle) &&
      _.has(handle, 'uri') &&
      _.has(handle, 'hashIdNode')) {
    return true
  }
}

/**
 * Checks if a UUID is a valid v1 UUID.
 *
 * @param {string} uuid - The uuid to check
 * @returns {bool} true if uuid is valid, otherwise false
 */
function _isValidUUID (uuid) {
  if (uuidValidate(uuid, 1)) {
    return true
  }
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
 * Map the JSON API response from submitting a hash to a Node to a
 * more accessible form that can also be used as the input arg to
 * getProofs function.
 *
 * @param {Array} respArray - An Array of responses, one for each Node submitted to
 * @returns {Array<{uri: String, hash: String, hashIdNode: String}>} An Array of proofHandles
 */
function _mapSubmitHashesRespToProofHandles (respArray) {
  if (!_.isArray(respArray)) throw new Error('_mapSubmitHashesRespToProofHandles arg must be an Array')

  let proofHandles = []

  _.forEach(respArray, resp => {
    _.forEach(resp.hashes, hash => {
      let handle = {}
      handle.uri = resp.meta.submitted_to
      handle.hash = hash.hash
      handle.hashIdNode = hash.hash_id_node
      proofHandles.push(handle)
    })
  })

  return proofHandles
}

/**
 * Parse an Array of proofs, each of which can be in any supported format.
 *
 * @param {Array} proofs - An Array of proofs in any supported form
 * @returns {Array} An Array of parsed proofs
 */
function _parseProofs (proofs) {
  if (!_.isArray(proofs)) throw new Error('proofs arg must be an Array')
  if (_.isEmpty(proofs)) throw new Error('proofs arg must be a non-empty Array')

  let parsedProofs = []

  _.forEach(proofs, proof => {
    if (_.isObject(proof)) {
      // OBJECT
      parsedProofs.push(cpp.parseObjectSync(proof))
    } else if (validator.isJSON(proof)) {
      // JSON-LD
      parsedProofs.push(cpp.parseObjectSync(JSON.parse(proof)))
    } else if (validator.isBase64(proof) || _.isBuffer(proof) || _.isHex(proof)) {
      // BINARY
      parsedProofs.push(cpp.parseBinarySync(proof))
    } else {
      throw new Error('unknown proof format')
    }
  })

  return parsedProofs
}

/**
 * Flatten an Array of parsed proofs where each proof anchor is
 * represented as an Object with all relevant proof data.
 *
 * @param {Array} parsedProofs - An Array of previously parsed proofs
 * @returns {Array} An Array of flattened proof objects
 */
function _flattenProofs (parsedProofs) {
  if (!_.isArray(parsedProofs)) throw new Error('parsedProofs arg must be an Array')
  if (_.isEmpty(parsedProofs)) throw new Error('parsedProofs arg must be a non-empty Array')

  let flatProofAnchors = []

  _.forEach(parsedProofs, parsedProof => {
    _.forEach(parsedProof.branches, parsedProofTopBranch => {
      _.forEach(parsedProofTopBranch.anchors, topBranchAnchor => {
        let flatAnchor = {}
        flatAnchor.hash = parsedProof.hash
        flatAnchor.hash_id_node = parsedProof.hash_id_node
        flatAnchor.hash_id_core = parsedProof.hash_id_core
        flatAnchor.hash_submitted_node_at = parsedProof.hash_submitted_node_at
        flatAnchor.hash_submitted_core_at = parsedProof.hash_submitted_core_at
        flatAnchor.uri = topBranchAnchor.uris[0]
        flatAnchor.type = topBranchAnchor.type
        flatAnchor.anchor_id = topBranchAnchor.anchor_id
        flatAnchor.expected_value = topBranchAnchor.expected_value
        flatProofAnchors.push(flatAnchor)
      })

      _.forEach(parsedProofTopBranch.branches, parsedProofSubBranch => {
        _.forEach(parsedProofSubBranch.anchors, subBranchAnchor => {
          let flatInnerAnchor = {}
          flatInnerAnchor.hash = parsedProof.hash
          flatInnerAnchor.hash_id_node = parsedProof.hash_id_node
          flatInnerAnchor.hash_id_core = parsedProof.hash_id_core
          flatInnerAnchor.hash_submitted_node_at = parsedProof.hash_submitted_node_at
          flatInnerAnchor.hash_submitted_core_at = parsedProof.hash_submitted_core_at
          flatInnerAnchor.uri = subBranchAnchor.uris[0]
          flatInnerAnchor.type = subBranchAnchor.type
          flatInnerAnchor.anchor_id = subBranchAnchor.anchor_id
          flatInnerAnchor.expected_value = subBranchAnchor.expected_value
          flatProofAnchors.push(flatInnerAnchor)
        })
      })
    })
  })

  return flatProofAnchors
}

/**
 * Submit hash(es) to one or more Nodes, returning an Array of proof handle objects, one for each submitted hash and Node combination.
 * @param {Array<String>} hashes - An Array of String Hashes in Hexadecimal form.
 * @param {Array<String>} uris - An Array of String URI's. Each hash will be submitted to each Node URI provided. If none provided three will be chosen at random using service discovery.
 * @return {Array<{uri: String, hash: String, hashIdNode: String}>} An Array of Objects, each a handle that contains all info needed to retrieve a proof.
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
  let rejects = _.reject(hashes, function (h) { return _isHex(h) })
  if (!_.isEmpty(rejects)) throw new Error(`hashes arg contains invalid hashes : ${rejects.join(', ')}`)

  // Validate all Node URIs provided
  if (!_.isArray(uris)) throw new Error('uris arg must be an Array of String URIs')

  if (_.isEmpty(uris)) {
    // get a list of nodes via service discovery
    nodesPromise = getNodes(3)
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
      let nodesWithPostOpts = _.map(nodes, node => {
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

      // All requests succeed in parallel or all fail.
      Promise.map(nodesWithPostOpts, rp, {concurrency: 25}).then(parsedBody => {
        // Nodes cannot be guaranteed to know what IP address they are reachable
        // at, so we need to amend each result with the Node URI it was submitted
        // to so that proofs may later be retrieved from the appropriate Node(s).
        // This mapping relies on that fact that Promise.map returns results in the
        // same order that options were passed to it so the results can be mapped to
        // the Nodes submitted to.
        _.forEach(nodes, (uri, index) => {
          parsedBody[index].meta.submitted_to = uri
        })

        // Map the API response to a form easily consumable by getProofs
        let proofHandles = _mapSubmitHashesRespToProofHandles(parsedBody)

        resolve(proofHandles)
        return callback(null, proofHandles)
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
 * The output of `submitProofs()` can be passed directly as the `proofHandles` arg to
 * this function.
 *
 * @param {Array<{uri: String, hashIdNode: String}>} proofHandles - An Array of Objects, each Object containing all info needed to retrieve a proof from a specific Node.
 * @param {function} callback - An optional callback function.
 * @return {Array<{uri: String, hashIdNode: String, proof: String}>} - An Array of Objects, each returning the URI the proof was returned from and the Proof in Base64 encoded binary form.
 */
function getProofs (proofHandles, callback) {
  callback = callback || function () {}

  // Validate callback is a function
  if (!_isFunction(callback)) throw new Error('callback arg must be a function')

  // Validate all proofHandles provided
  if (!_.isArray(proofHandles)) throw new Error('proofHandles arg must be an Array')
  if (_.isEmpty(proofHandles)) throw new Error('proofHandles arg must be a non-empty Array')
  if (!_.every(proofHandles, h => { return _isValidProofHandle(h) })) throw new Error('proofHandles Array contains invalid Objects')

  // Validate that *all* URI's provided are valid or throw
  let badHandleURIs = _.reject(proofHandles, function (u) { return _isValidNodeURI(u.uri) })
  if (!_.isEmpty(badHandleURIs)) throw new Error(`some proof handles contain invalid URI values : ${(_.map(badHandleURIs, h => { return h.uri })).join(', ')}`)

  // Validate that *all* hashIdNode's provided are valid or throw
  let badHandleUUIDs = _.reject(proofHandles, function (u) { return _isValidUUID(u.hashIdNode) })
  if (!_.isEmpty(badHandleUUIDs)) throw new Error(`some proof handles contain invalid hashIdNode UUID values : ${(_.map(badHandleUUIDs, h => { return h.hashIdNode })).join(', ')}`)

  return new Promise(function (resolve, reject) {
    try {
      // Collect together all proof UUIDs destined for a single Node
      // so they can be submitted to the Node in a single request.
      let uuidsByNode = {}
      _.forEach(proofHandles, handle => {
        if (_.isEmpty(uuidsByNode[handle.uri])) {
          uuidsByNode[handle.uri] = []
        }
        uuidsByNode[handle.uri].push(handle.hashIdNode)
      })

      // For each Node construct a set of GET options including
      // the `hashids` header with a list of all hash ID's to retrieve
      // proofs for from that Node.
      let nodesWithGetOpts = _.map(_.keys(uuidsByNode), node => {
        let getOptions = {
          method: 'GET',
          uri: node + '/proofs',
          body: {},
          headers: {
            'content-type': 'application/json',
            hashids: uuidsByNode[node].join(',')
          },
          json: true
        }
        return getOptions
      })

      // Perform parallel GET requests to all Nodes with proofs
      Promise.map(nodesWithGetOpts, rp, {concurrency: 25}).then(function (parsedBody) {
        // Promise.map returns an Array entry for each host it submits to.
        let flatParsedBody = _.flatten(parsedBody)

        let proofsResponse = []

        try {
          _.forEach(flatParsedBody, proofResp => {
            // Set to empty Array if unset of null
            proofResp.anchors_complete = proofResp.anchors_complete || []
            // Camel case object keys
            let proofRespCamel = _.mapKeys(proofResp, (v, k) => _.camelCase(k))
            proofsResponse.push(proofRespCamel)
          })
        } catch (err) {
          reject(err)
          return callback(err)
        }

        resolve(proofsResponse)
        return callback(null, proofsResponse)
      }, function (err) {
        reject(err)
        return callback(err)
      })
    } catch (err) {
      reject(err)
      return callback(err)
    }
  })
}

/**
 * Verify a collection of proofs using an optionally provided Node URI
 *
 * @param {Array} proofs - An Array of String, or Object proofs from getProofs(), to be verified. Proofs can be in any of the supported JSON-LD or Binary formats.
 * @param {String} uri - [Optional] The Node URI to submit proof(s) to for verification. If not provided a Node will be selected at random. All proofs will be verified by a single Node.
 * @param {function} callback - An optional callback function.
 * @return {Array<Object>} - An Array of Objects, one for each proof submitted, with vefification info.
 */
function verifyProofs (proofs, uri, callback) {
  callback = callback || function () {}

  // Validate callback is a function
  if (!_isFunction(callback)) throw new Error('callback arg must be a function')

  // Validate proofs arg
  if (!_.isArray(proofs)) throw new Error('proofs arg must be an Array')
  if (_.isEmpty(proofs)) throw new Error('proofs arg must be a non-empty Array')

  // If any entry in the proofs Array is an Object, process
  // it assuming the same form as the output of getProofs().
  let normalizedProofs = _.map(proofs, proof => {
    if (_.isObject(proof) && _.has(proof, 'proof') && _.isString(proof.proof)) {
      // Probably result of `submitProofs()` call. Extract proof String
      return proof.proof
    } else if (_.isString(proof)) {
      return proof
    } else {
      throw new Error('proofs arg Array has elements that are not Objects or Strings')
    }
  })

  // Validate and return an Array with a single Node URI
  // if provided or get an Array of Nodes via service discovery.
  // In both cases return a Promise.
  let nodesPromise
  if (_.isEmpty(uri)) {
    nodesPromise = getNodes(1)
  } else {
    if (!_.isString(uri)) throw new Error('uri arg must be a String')
    if (!_isValidNodeURI(uri)) throw new Error(`uri arg contains invalid Node URI : ${uri}`)
    nodesPromise = Promise.resolve([uri])
  }

  return new Promise(function (resolve, reject) {
    try {
      nodesPromise.then((nodes) => {
        return _.first(nodes)
      }).then(node => {
        // Parse and validate all provided proofs. The hash that
        // results from parsing will be used to validate the proof.
        let parsedProofs = _parseProofs(normalizedProofs)
        let flatProofs = _flattenProofs(parsedProofs)

        // Assign all flat proofs to the same Node URI for verification
        let singleNodeFlatProofs = _.map(flatProofs, proof => {
          let oldProofURI = url.parse(proof.uri)
          proof.uri = node + oldProofURI.path
          return proof
        })

        let uniqSingleNodeFlatProofs = _.uniqWith(singleNodeFlatProofs, _.isEqual)

        return uniqSingleNodeFlatProofs
      }).then(flatProofs => {
        let anchorURIs = []
        _.forEach(flatProofs, proof => {
          anchorURIs.push(proof.uri)
        })

        let uniqAnchorURIs = _.uniq(anchorURIs)

        let nodesWithGetOpts = _.map(uniqAnchorURIs, anchorURI => {
          return {
            method: 'GET',
            uri: anchorURI,
            body: {},
            headers: {
              'content-type': 'application/json'
            },
            json: true
          }
        })

        return [flatProofs, nodesWithGetOpts]
      }).then(([flatProofs, nodesWithGetOpts]) => {
        // Perform parallel GET requests to all Nodes with proofs
        let hashesByNodeURI = Promise.map(nodesWithGetOpts, rp, {concurrency: 25}).then(parsedBody => {
          // Promise.map returns an Array entry for each host it submits to.
          let flatParsedBody = _.flatten(parsedBody)

          let r = {}

          _.forEach(nodesWithGetOpts, (getOpt, index) => {
            r[getOpt.uri] = flatParsedBody[index]
          })

          return r
        }).catch(err => {
          reject(err)
          return callback(err)
        })

        return [flatProofs, hashesByNodeURI]
      }).then(([flatProofs, hashesByNodeURI]) => {
        // Fulfill the Promise for all of the request results.
        hashesByNodeURI.then(hashesFound => {
          let results = []

          _.forEach(flatProofs, flatProof => {
            if (flatProof.expected_value === hashesFound[flatProof.uri]) {
              // IT'S GOOD!
              flatProof.verified = true
              flatProof.verified_at = new Date().toISOString().slice(0, 19) + 'Z'
            } else {
              // IT'S NO GOOD :-(
              flatProof.verified = false
              flatProof.verified_at = null
            }

            // Camel case object keys
            let flatProofCamel = _.mapKeys(flatProof, (v, k) => _.camelCase(k))

            results.push(flatProofCamel)
          })

          resolve(results)
          return callback(null, results)
        })
      }).catch(err => {
        console.error(err.message)
        throw err
      })
    } catch (err) {
      reject(err)
      return callback(err)
    }
  })
}

module.exports = {
  getCores: getCores,
  getNodes: getNodes,
  submitHashes: submitHashes,
  getProofs: getProofs,
  verifyProofs: verifyProofs
}
