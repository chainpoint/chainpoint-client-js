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
import _map from 'lodash/map'
import _first from 'lodash/first'
import _forEach from 'lodash/forEach'
import _uniq from 'lodash/uniq'
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
import _getProofs from './lib/get'

const {
  isSecureOrigin,
  isValidNodeURI,
  flattenBtcBranches,
  flattenProofs,
  normalizeProofs,
  parseProofs,
  promiseMap,
  getCores,
  getNodes
} = utils

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

// Need this to keep expected import structure for backwards compatibility
// with downstream dependencies
export const submitHashes = _submitHashes
export const submitFileHashes = _submitFileHashes
export const getProofs = _getProofs

export default {
  getCores,
  getNodes,
  submitHashes: _submitHashes,
  submitFileHashes: _submitFileHashes,
  getProofs: _getProofs,
  verifyProofs,
  evaluateProofs,
  getProofTxs
}
