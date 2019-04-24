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

import { isEmpty, forEach, map, every, reject, keys, flatten, mapKeys, camelCase } from 'lodash'

import { isValidNodeURI } from './utils/network'
import { isValidProofHandle } from './utils/proofs'
import { isSecureOrigin, isValidUUID, fetchEndpoints, testArrayArg } from './utils/helpers'
import { NODE_PROXY_URI } from './constants'

/**
 * Retrieve a collection of proofs for one or more hash IDs from the appropriate Node(s)
 * The output of `submitProofs()` can be passed directly as the `proofHandles` arg to
 * this function.
 *
 * @param {Array<{uri: String, hashIdNode: String}>} proofHandles - An Array of Objects, each Object containing
 * all info needed to retrieve a proof from a specific Node.
 * @param {function} callback - An optional callback function.
 * @return {Array<{uri: String, hashIdNode: String, proof: String}>} - An Array of Objects, each returning the
 * URI the proof was returned from and the Proof in Base64 encoded binary form.
 */
async function getProofs(proofHandles) {
  // Validate all proofHandles provided
  testArrayArg(proofHandles)
  if (
    !every(proofHandles, h => {
      return isValidProofHandle(h)
    })
  )
    throw new Error('proofHandles Array contains invalid Objects')
  if (proofHandles.length > 250) throw new Error('proofHandles arg must be an Array with <= 250 elements')

  // Validate that *all* URI's provided are valid or throw
  let badHandleURIs = reject(proofHandles, function(u) {
    return isValidNodeURI(u.uri)
  })
  if (!isEmpty(badHandleURIs))
    throw new Error(
      `some proof handles contain invalid URI values : ${map(badHandleURIs, h => {
        return h.uri
      }).join(', ')}`
    )

  // Validate that *all* hashIdNode's provided are valid or throw
  let badHandleUUIDs = reject(proofHandles, function(u) {
    return isValidUUID(u.hashIdNode)
  })
  if (!isEmpty(badHandleUUIDs))
    throw new Error(
      `some proof handles contain invalid hashIdNode UUID values : ${map(badHandleUUIDs, h => {
        return h.hashIdNode
      }).join(', ')}`
    )

  try {
    // Collect together all proof UUIDs destined for a single Node
    // so they can be submitted to the Node in a single request.
    let uuidsByNode = {}
    forEach(proofHandles, handle => {
      if (isEmpty(uuidsByNode[handle.uri])) {
        uuidsByNode[handle.uri] = []
      }
      uuidsByNode[handle.uri].push(handle.hashIdNode)
    })

    // For each Node construct a set of GET options including
    // the `hashids` header with a list of all hash ID's to retrieve
    // proofs for from that Node.
    let nodesWithGetOpts = map(keys(uuidsByNode), node => {
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
    const parsedBody = await fetchEndpoints(nodesWithGetOpts)

    // fetchEndpoints returns an Array entry for each host it submits to.
    let flatParsedBody = flatten(parsedBody)

    let proofsResponse = []

    forEach(flatParsedBody, proofResp => {
      // Set to empty Array if unset of null
      proofResp.anchors_complete = proofResp.anchors_complete || []
      // Camel case object keys
      let proofRespCamel = mapKeys(proofResp, (v, k) => camelCase(k))
      proofsResponse.push(proofRespCamel)
    })
    return proofsResponse
  } catch (err) {
    console.error(err.message)
    throw err
  }
}

export default getProofs
