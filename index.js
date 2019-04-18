/**
 * Copyright 2019 Tierion
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

import _isString from 'lodash/isString'
import _isEmpty from 'lodash/isEmpty'
import _isFunction from 'lodash/isFunction'
import _map from 'lodash/map'
import _first from 'lodash/first'
import _isArray from 'lodash/isArray'
import _forEach from 'lodash/forEach'
import _reject from 'lodash/reject'
import _uniq from 'lodash/uniq'
import _every from 'lodash/every'
import _keys from 'lodash/keys'
import _flatten from 'lodash/flatten'
import _mapKeys from 'lodash/mapKeys'
import _camelCase from 'lodash/camelCase'
import _uniqWith from 'lodash/uniqWith'
import _isEqual from 'lodash/isEqual'

const url = require('url')
const fetch = require('node-fetch')

import utils from './lib/utils'
import { NODE_PROXY_URI } from './lib/constants'
import _submitHashes, { submitFileHashes as _submitFileHashes } from './lib/submit'

const {
  isSecureOrigin,
  isValidNodeURI,
  isValidProofHandle,
  isValidUUID,
  flattenBtcBranches,
  flattenProofs,
  normalizeProofs,
  parseProofs,
  promiseMap,
  getCores,
  getNodes
} = utils

/**
 * Retrieve a collection of proofs for one or more hash IDs from the appropriate Node(s)
 * The output of `submitProofs()` can be passed directly as the `proofHandles` arg to
 * this function.
 *
 * @param {Array<{uri: String, hashIdNode: String}>} proofHandles - An Array of Objects, each Object containing all info needed to retrieve a proof from a specific Node.
 * @param {function} callback - An optional callback function.
 * @return {Array<{uri: String, hashIdNode: String, proof: String}>} - An Array of Objects, each returning the URI the proof was returned from and the Proof in Base64 encoded binary form.
 */
export function getProofs(proofHandles, callback) {
  callback = callback || function() {}

  // Validate callback is a function
  if (!_isFunction(callback)) throw new Error('callback arg must be a function')

  // Validate all proofHandles provided
  if (!_isArray(proofHandles)) throw new Error('proofHandles arg must be an Array')
  if (_isEmpty(proofHandles)) throw new Error('proofHandles arg must be a non-empty Array')
  if (
    !_every(proofHandles, h => {
      return isValidProofHandle(h)
    })
  )
    throw new Error('proofHandles Array contains invalid Objects')
  if (proofHandles.length > 250) throw new Error('proofHandles arg must be an Array with <= 250 elements')

  // Validate that *all* URI's provided are valid or throw
  let badHandleURIs = _reject(proofHandles, function(u) {
    return isValidNodeURI(u.uri)
  })
  if (!_isEmpty(badHandleURIs))
    throw new Error(
      `some proof handles contain invalid URI values : ${_map(badHandleURIs, h => {
        return h.uri
      }).join(', ')}`
    )

  // Validate that *all* hashIdNode's provided are valid or throw
  let badHandleUUIDs = _reject(proofHandles, function(u) {
    return isValidUUID(u.hashIdNode)
  })
  if (!_isEmpty(badHandleUUIDs))
    throw new Error(
      `some proof handles contain invalid hashIdNode UUID values : ${_map(badHandleUUIDs, h => {
        return h.hashIdNode
      }).join(', ')}`
    )

  return new Promise(function(resolve, reject) {
    try {
      // Collect together all proof UUIDs destined for a single Node
      // so they can be submitted to the Node in a single request.
      let uuidsByNode = {}
      _forEach(proofHandles, handle => {
        if (_isEmpty(uuidsByNode[handle.uri])) {
          uuidsByNode[handle.uri] = []
        }
        uuidsByNode[handle.uri].push(handle.hashIdNode)
      })

      // For each Node construct a set of GET options including
      // the `hashids` header with a list of all hash ID's to retrieve
      // proofs for from that Node.
      let nodesWithGetOpts = _map(_keys(uuidsByNode), node => {
        let headers = Object.assign(
          {
            accept: 'application/json',
            'content-type': 'application/json'
          },
          {
            hashids: uuidsByNode[node].join(',')
          },
          isSecureOrigin()
            ? {
                'X-Node-Uri': node
              }
            : {}
        )
        let getOptions = {
          method: 'GET',
          uri: (isSecureOrigin() ? NODE_PROXY_URI : node) + '/proofs',
          body: {},
          headers,
          timeout: 10000
        }
        return getOptions
      })

      // Perform parallel GET requests to all Nodes with proofs
      promiseMap(nodesWithGetOpts, fetch, {
        concurrency: 25
      }).then(
        function(parsedBody) {
          // promiseMap returns an Array entry for each host it submits to.
          let flatParsedBody = _flatten(parsedBody)

          let proofsResponse = []

          try {
            _forEach(flatParsedBody, proofResp => {
              // Set to empty Array if unset of null
              proofResp.anchors_complete = proofResp.anchors_complete || []
              // Camel case object keys
              let proofRespCamel = _mapKeys(proofResp, (v, k) => _camelCase(k))
              proofsResponse.push(proofRespCamel)
            })
          } catch (err) {
            reject(err)
            return callback(err)
          }

          resolve(proofsResponse)
          return callback(null, proofsResponse)
        },
        function(err) {
          reject(err)
          return callback(err)
        }
      )
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
export function verifyProofs(proofs, uri, callback) {
  callback = callback || function() {}

  let evaluatedProofs = evaluateProofs(proofs)

  // Validate and return an Array with a single Node URI
  // if provided or get an Array of Nodes via service discovery.
  // In both cases return a Promise.
  let nodesPromise
  if (_isEmpty(uri)) {
    nodesPromise = getNodes(1)
  } else {
    if (!_isString(uri)) throw new Error('uri arg must be a String')
    if (!isValidNodeURI(uri)) throw new Error(`uri arg contains invalid Node URI : ${uri}`)
    nodesPromise = Promise.resolve([uri])
  }

  return new Promise(function(resolve, reject) {
    try {
      nodesPromise
        .then(nodes => {
          return _first(nodes)
        })
        .then(node => {
          // Assign all flat proofs to the same Node URI for verification
          let singleNodeFlatProofs = _map(evaluatedProofs, proof => {
            let oldProofURI = url.parse(proof.uri)
            proof.uri = node + oldProofURI.path
            return proof
          })

          let uniqSingleNodeFlatProofs = _uniqWith(singleNodeFlatProofs, _isEqual)

          return uniqSingleNodeFlatProofs
        })
        .then(flatProofs => {
          let anchorURIs = []
          _forEach(flatProofs, proof => {
            anchorURIs.push(proof.uri)
          })

          let uniqAnchorURIs = _uniq(anchorURIs)

          let nodesWithGetOpts = _map(uniqAnchorURIs, anchorURI => {
            let headers = Object.assign(
              {
                'Content-Type': 'application/json',
                Accept: 'application/json'
              },
              isSecureOrigin()
                ? {
                    'X-Node-Uri': url.parse(anchorURI).protocol + '//' + url.parse(anchorURI).host
                  }
                : {}
            )

            let uri = isSecureOrigin() ? NODE_PROXY_URI + url.parse(anchorURI).path : anchorURI

            return {
              method: 'GET',
              uri: uri,
              body: {},
              headers,
              timeout: 10000
            }
          })

          return [flatProofs, nodesWithGetOpts]
        })
        .then(([flatProofs, nodesWithGetOpts]) => {
          // Perform parallel GET requests to all Nodes with proofs
          let hashesByNodeURI = promiseMap(nodesWithGetOpts, fetch, {
            concurrency: 25
          })
            .then(parsedBody => {
              // promiseMap returns an Array entry for each host it submits to.
              let flatParsedBody = _flatten(parsedBody)

              let r = {}

              _forEach(nodesWithGetOpts, (getOpt, index) => {
                r[getOpt.uri] = flatParsedBody[index]
              })

              return r
            })
            .catch(err => {
              reject(err)
              return callback(err)
            })

          return [flatProofs, hashesByNodeURI]
        })
        .then(([flatProofs, hashesByNodeURI]) => {
          // Fulfill the Promise for all of the request results.
          hashesByNodeURI
            .then(hashesFound => {
              if (_isEmpty(hashesFound)) return Promise.reject(new Error('No hashes were found.'))
              let results = []

              _forEach(flatProofs, flatProof => {
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
                let flatProofCamel = _mapKeys(flatProof, (v, k) => _camelCase(k))

                results.push(flatProofCamel)
              })

              resolve(results)
              return callback(null, results)
            })
            .catch(err => {
              console.error(err.message)
              reject(err)
              return callback(err)
            })
        })
        .catch(err => {
          console.error(err.message)
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
 * Evaluates the expected anchor values for a collection of proofs
 *
 * @param {Array} proofs - An Array of String, or Object proofs from getProofs(), to be evaluated. Proofs can be in any of the supported JSON-LD or Binary formats.
 */
export function evaluateProofs(proofs) {
  let normalizedProofs = normalizeProofs(proofs)
  let parsedProofs = parseProofs(normalizedProofs)
  let flatProofs = flattenProofs(parsedProofs)

  return flatProofs
}

/**
 * retrieve raw btc tx objects for corresponding proofs
 * @param {Array} proofs - An Array of String, or Object proofs from getProofs(), to be evaluated. Proofs can be in any of the supported JSON-LD or Binary formats.
 * @returns {Object[]} - array of objects with relevant hash data
 */

export function getProofTxs(proofs) {
  let normalizedProofs = normalizeProofs(proofs)
  let parsedProofs = parseProofs(normalizedProofs)
  let flatProofs = flattenBtcBranches(parsedProofs)
  return flatProofs
}

// work to keep expected import structure to maintain backwards compatibility
// with downstream dependencies
export const submitHashes = _submitHashes
export const submitFileHashes = _submitFileHashes

export default {
  getCores,
  getNodes,
  submitHashes: _submitHashes,
  submitFileHashes: _submitFileHashes,
  getProofs,
  verifyProofs,
  evaluateProofs,
  getProofTxs
}
