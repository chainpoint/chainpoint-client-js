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

import cpp from 'chainpoint-parse'
import uuidv1 from 'uuid/v1'
import { isJSON, isBase64 } from 'validator'
import { isEmpty, isString, isArray, has, isObject, forEach, map, isBuffer } from 'lodash'
import { isHex } from './helpers'

/**
 * Map the JSON API response from submitting a hash to a Node to a
 * more accessible form that can also be used as the input arg to
 * getProofs function.
 *
 * @param {Array} respArray - An Array of responses, one for each Node submitted to
 * @returns {Array<{uri: String, hash: String, hashIdNode: String}>} An Array of proofHandles
 */
export function mapSubmitHashesRespToProofHandles(respArray) {
  if (!isArray(respArray) && !respArray.length)
    throw new Error('mapSubmitHashesRespToProofHandles arg must be an Array')

  let proofHandles = []
  let groupIdList = []
  if (respArray[0] && respArray[0].hashes) {
    forEach(respArray[0].hashes, () => {
      groupIdList.push(uuidv1())
    })
  }

  forEach(respArray, resp => {
    forEach(resp.hashes, (hash, idx) => {
      let handle = {}

      handle.uri = resp.meta.submitted_to
      handle.hash = hash.hash
      handle.hashIdNode = hash.hash_id_node
      handle.groupId = groupIdList[idx]
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
export function parseProofs(proofs) {
  if (!isArray(proofs)) throw new Error('proofs arg must be an Array')
  if (isEmpty(proofs)) throw new Error('proofs arg must be a non-empty Array')

  let parsedProofs = []

  forEach(proofs, proof => {
    if (isObject(proof)) {
      // OBJECT
      parsedProofs.push(cpp.parse(proof))
    } else if (isJSON(proof)) {
      // JSON-LD
      parsedProofs.push(cpp.parse(JSON.parse(proof)))
    } else if (isBase64(proof) || isBuffer(proof) || isHex(proof)) {
      // BINARY
      parsedProofs.push(cpp.parse(proof))
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
export function flattenProofs(parsedProofs) {
  if (!isArray(parsedProofs)) throw new Error('parsedProofs arg must be an Array')
  if (isEmpty(parsedProofs)) throw new Error('parsedProofs arg must be a non-empty Array')

  let flatProofAnchors = []

  forEach(parsedProofs, parsedProof => {
    let proofAnchors = flattenProofBranches(parsedProof.branches)
    forEach(proofAnchors, proofAnchor => {
      let flatProofAnchor = {}
      flatProofAnchor.hash = parsedProof.hash
      flatProofAnchor.hash_id_node = parsedProof.hash_id_node
      flatProofAnchor.hash_id_core = parsedProof.hash_id_core
      flatProofAnchor.hash_submitted_node_at = parsedProof.hash_submitted_node_at
      flatProofAnchor.hash_submitted_core_at = parsedProof.hash_submitted_core_at
      flatProofAnchor.branch = proofAnchor.branch
      flatProofAnchor.uri = proofAnchor.uri
      flatProofAnchor.type = proofAnchor.type
      flatProofAnchor.anchor_id = proofAnchor.anchor_id
      flatProofAnchor.expected_value = proofAnchor.expected_value
      flatProofAnchors.push(flatProofAnchor)
    })
  })

  return flatProofAnchors
}

/**
 * Flatten an Array of proof branches where each proof anchor in
 * each branch is represented as an Object with all relevant data for that anchor.
 *
 * @param {Array} proofBranchArray - An Array of branches for a given level in a proof
 * @returns {Array} An Array of flattened proof anchor objects for each branch
 */
export function flattenProofBranches(proofBranchArray) {
  let flatProofAnchors = []

  forEach(proofBranchArray, proofBranch => {
    let anchors = proofBranch.anchors
    forEach(anchors, anchor => {
      let flatAnchor = {}
      flatAnchor.branch = proofBranch.label || undefined
      flatAnchor.uri = anchor.uris[0]
      flatAnchor.type = anchor.type
      flatAnchor.anchor_id = anchor.anchor_id
      flatAnchor.expected_value = anchor.expected_value
      flatProofAnchors.push(flatAnchor)
    })
    if (proofBranch.branches) {
      flatProofAnchors = flatProofAnchors.concat(flattenProofBranches(proofBranch.branches))
    }
  })
  return flatProofAnchors
}

/**
 * Get raw btc transactions for each hash_id_node
 * @param {Array} proofs - array of previously parsed proofs
 * @return {Obect[]} - an array of objects with hash_id_node and raw btc tx
 */
export function flattenBtcBranches(proofs) {
  let flattenedBranches = []

  forEach(proofs, proof => {
    let btcAnchor = {}
    btcAnchor.hash_id_node = proof.hash_id_node

    if (proof.branches) {
      forEach(proof.branches, branch => {
        // sub branches indicate other anchors
        // we want to find the sub-branch that anchors to btc
        if (branch.branches) {
          // get the raw tx from the btc_anchor_branch
          let btcBranch = branch.branches.find(element => element.label === 'btc_anchor_branch')
          btcAnchor.raw_btc_tx = btcBranch.rawTx
          // get the btc anchor
          let anchor = btcBranch.anchors.find(anchor => anchor.type === 'btc')
          // add expected_value (i.e. the merkle root of anchored block)
          btcAnchor.expected_value = anchor.expected_value
          // add anchor_id (i.e. the anchored block height)
          btcAnchor.anchor_id = anchor.anchor_id
        }
      })
    }

    flattenedBranches.push(btcAnchor)
  })

  return flattenedBranches
}

/**
 * validate and normalize proofs for actions such as parsing
 * @param {Array} proofs - An Array of String, or Object proofs from getProofs(), to be verified. Proofs can be in any of the supported JSON-LD or Binary formats.
 @return {Array<Object>} - An Array of Objects, one for each proof submitted.
 */
export function normalizeProofs(proofs) {
  // Validate proofs arg
  if (!isArray(proofs)) throw new Error('proofs arg must be an Array')
  if (isEmpty(proofs)) throw new Error('proofs arg must be a non-empty Array')

  // If any entry in the proofs Array is an Object, process
  // it assuming the same form as the output of getProofs().
  return map(proofs, proof => {
    if (isObject(proof) && has(proof, 'proof') && isString(proof.proof)) {
      // Probably result of `submitProofs()` call. Extract proof String
      return proof.proof
    } else if (isObject(proof) && has(proof, 'type') && proof.type === 'Chainpoint') {
      // Probably a JS Object Proof
      return proof
    } else if (isString(proof) && (isJSON(proof) || isBase64(proof))) {
      // Probably a JSON String or Base64 encoded binary proof
      return proof
    } else {
      throw new Error('proofs arg Array has elements that are not Objects or Strings')
    }
  })
}
