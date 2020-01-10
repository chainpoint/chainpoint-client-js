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

import utils from './lib/utils'
import _submitHashes from './lib/submit'
import _submitFileHashes from './lib/submitFiles'
import _getProofs from './lib/get'
import _verifyProofs from './lib/verify'
import _evaluateProofs from './lib/evaluate'

const { flattenBtcBranches, normalizeProofs, parseProofs, getCores: _getCores, getNodes: _getNodes } = utils

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
export const verifyProofs = _verifyProofs
export const evaluateProofs = _evaluateProofs
export const getNodes = _getNodes
export const getCores = _getCores

export default {
  getCores,
  getNodes,
  submitHashes,
  submitFileHashes,
  getProofs,
  verifyProofs,
  evaluateProofs,
  getProofTxs
}
