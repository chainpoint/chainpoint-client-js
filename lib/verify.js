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

import url from 'url'
import fetch from 'node-fetch'
import { isEmpty, isString, forEach, map, first, uniqWith, isEqual, uniq, flatten, mapKeys, camelCase } from 'lodash'

import { isValidNodeURI, getNodes } from './utils/network'
import { promiseMap, isSecureOrigin } from './utils/helpers'
import evaluateProofs from './evaluate'
import { NODE_PROXY_URI } from './constants'

/**
 * Verify a collection of proofs using an optionally provided Node URI
 *
 * @param {Array} proofs - An Array of String, or Object proofs from getProofs(), to be verified. Proofs can be in any of the supported JSON-LD or Binary formats.
 * @param {String} uri - [Optional] The Node URI to submit proof(s) to for verification. If not provided a Node will be selected at random. All proofs will be verified by a single Node.
 * @param {function} callback - An optional callback function.
 * @return {Array<Object>} - An Array of Objects, one for each proof submitted, with vefification info.
 */
export default async function verifyProofs(proofs, uri) {
  let evaluatedProofs = evaluateProofs(proofs)

  // Validate and return an Array with a single Node URI
  // if provided or get an Array of Nodes via service discovery.
  // In both cases return a Promise.
  let nodes
  if (isEmpty(uri)) {
    nodes = await getNodes(1)
  } else {
    if (!isString(uri)) throw new Error('uri arg must be a String')
    if (!isValidNodeURI(uri)) throw new Error(`uri arg contains invalid Node URI : ${uri}`)
    nodes = [uri]
  }

  let node = first(nodes)

  // Assign all flat proofs to the same Node URI for verification
  let singleNodeFlatProofs = map(evaluatedProofs, proof => {
    let oldProofURI = url.parse(proof.uri)
    proof.uri = node + oldProofURI.path
    return proof
  })

  let flatProofs = uniqWith(singleNodeFlatProofs, isEqual)
  let anchorURIs = []
  forEach(flatProofs, proof => {
    anchorURIs.push(proof.uri)
  })

  let uniqAnchorURIs = uniq(anchorURIs)

  let nodesWithGetOpts = map(uniqAnchorURIs, anchorURI => {
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

  let parsedBody = await promiseMap(nodesWithGetOpts, fetch, { concurrency: 25 })
  // promiseMap returns an Array entry for each host it submits to.
  let flatParsedBody = flatten(parsedBody)

  let hashesFound = {}

  forEach(nodesWithGetOpts, (getOpt, index) => {
    hashesFound[getOpt.uri] = flatParsedBody[index]
  })

  if (isEmpty(hashesFound)) return Promise.reject(new Error('No hashes were found.'))
  let results = []

  forEach(flatProofs, flatProof => {
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
    let flatProofCamel = mapKeys(flatProof, (v, k) => camelCase(k))

    results.push(flatProofCamel)
  })
  return results
}
