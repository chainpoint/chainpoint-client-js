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

import { isFunction, isArray, isEmpty, reject, uniq, map, forEach } from 'lodash'
import fetch from 'node-fetch'

import { isHex, isSecureOrigin, promiseMap, getFileHashes } from './utils/helpers'
import { isValidNodeURI, getNodes } from './utils/network'
import { mapSubmitHashesRespToProofHandles } from './utils/proofs'
import { NODE_PROXY_URI } from './constants'

/**
 * Submit hash(es) to one or more Nodes, returning an Array of proof handle objects, one for each submitted hash and Node combination.
 * @param {Array<String>} hashes - An Array of String Hashes in Hexadecimal form.
 * @param {Array<String>} uris - An Array of String URI's. Each hash will be submitted to each Node URI provided. If none provided three will be chosen at random using service discovery.
 * @return {Array<{uri: String, hash: String, hashIdNode: String, groupId: String}>} An Array of Objects, each a handle that contains all info needed to retrieve a proof.
 */
function submitHashes(hashes, uris, callback) {
  uris = uris || []
  callback = callback || function() {}
  let nodesPromise

  // Validate callback is a function
  if (!isFunction(callback)) throw new Error('callback arg must be a function')

  // Validate all hashes provided
  if (!isArray(hashes)) throw new Error('hashes arg must be an Array')
  if (isEmpty(hashes)) throw new Error('hashes arg must be a non-empty Array')
  if (hashes.length > 250) throw new Error('hashes arg must be an Array with <= 250 elements')
  let rejects = reject(hashes, function(h) {
    return isHex(h)
  })
  if (!isEmpty(rejects)) throw new Error(`hashes arg contains invalid hashes : ${rejects.join(', ')}`)

  // Validate all Node URIs provided
  if (!isArray(uris)) throw new Error('uris arg must be an Array of String URIs')
  if (uris.length > 5) throw new Error('uris arg must be an Array with <= 5 elements')

  if (isEmpty(uris)) {
    // get a list of nodes via service discovery
    nodesPromise = getNodes(3)
  } else {
    // eliminate duplicate URIs
    uris = uniq(uris)

    // non-empty, check that *all* are valid or throw
    let badURIs = reject(uris, function(h) {
      return isValidNodeURI(h)
    })
    if (!isEmpty(badURIs)) throw new Error(`uris arg contains invalid URIs : ${badURIs.join(', ')}`)
    // all provided URIs were valid
    nodesPromise = Promise.resolve(uris)
  }

  return new Promise(function(resolve, reject) {
    // Resolve an Array of Nodes from service discovery or the arg provided
    nodesPromise
      .then(nodes => {
        // Setup an options Object for each Node we'll submit hashes to.
        // Each Node will then be sent the full Array of hashes.
        let nodesWithPostOpts = map(nodes, node => {
          let uri = isSecureOrigin() ? NODE_PROXY_URI : node
          let headers = Object.assign(
            {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            isSecureOrigin()
              ? {
                  'X-Node-Uri': node
                }
              : {}
          )

          let postOptions = {
            method: 'POST',
            uri: uri + '/hashes',
            body: {
              hashes: hashes
            },
            headers,
            timeout: 10000
          }
          return postOptions
        })

        // All requests succeed in parallel or all fail.
        promiseMap(nodesWithPostOpts, fetch, {
          concurrency: 25
        }).then(
          parsedBody => {
            // Nodes cannot be guaranteed to know what IP address they are reachable
            // at, so we need to amend each result with the Node URI it was submitted
            // to so that proofs may later be retrieved from the appropriate Node(s).
            // This mapping relies on that fact that promiseMap returns results in the
            // same order that options were passed to it so the results can be mapped to
            // the Nodes submitted to.
            forEach(nodes, (uri, index) => {
              parsedBody[index].meta.submitted_to = uri
            })

            // Map the API response to a form easily consumable by getProofs
            let proofHandles = mapSubmitHashesRespToProofHandles(parsedBody)

            resolve(proofHandles)
            return callback(null, proofHandles)
          },
          function(err) {
            reject(err)
            return callback(err)
          }
        )
      })
      .catch(err => {
        console.error(err.message)
        throw err
      })
  })
}

/**
 * Submit hash(es) of selected file(s) to one or more Nodes, returning an Array of proof handle objects, one for each submitted hash and Node combination.
 * @param {Array<String>} paths - An Array of paths of the files to be hashed.
 * @param {Array<String>} uris - An Array of String URI's. Each hash will be submitted to each Node URI provided. If none provided three will be chosen at random using service discovery.
 * @return {Array<{path: String, uri: String, hash: String, hashIdNode: String, groupId: String}>} An Array of Objects, each a handle that contains all info needed to retrieve a proof.
 */
export async function submitFileHashes(paths, uris) {
  const hashObjs = await getFileHashes(paths, uris)
  const hashes = hashObjs.map(hashObj => hashObj.hash)
  const proofHandles = await submitHashes(hashes, uris)
  return proofHandles.map(proofHandle => {
    proofHandle.path = hashObjs.find(hashObj => hashObj.hash === proofHandle.hash).path
    return proofHandle
  })
}

// Expose functions
export default submitHashes
