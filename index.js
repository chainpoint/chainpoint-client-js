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

const utils = require('./lib/utils')
const _submitHashes = require('./lib/submit')
const _submitFileHashes = require('./lib/submitFiles')
const _getProofs = require('./lib/get')
const _verifyProofs = require('./lib/verify')
const _evaluateProofs = require('./lib/evaluate')

const { flattenBtcBranches, normalizeProofs, parseProofs, getCores: _getCores, getNodes: _getNodes } = utils

/**
 * retrieve raw btc tx objects for corresponding proofs
 * @param {Array} proofs - An Array of String, or Object proofs from getProofs(), to be evaluated. Proofs can be in any of the supported JSON-LD or Binary formats.
 * @returns {Object[]} - array of objects with relevant hash data
 */

function getProofTxs(proofs) {
  let normalizedProofs = normalizeProofs(proofs)
  let parsedProofs = parseProofs(normalizedProofs)
  let flatProofs = flattenBtcBranches(parsedProofs)
  return flatProofs
}

module.exports = {
  getCores: _getCores,
  getNodes: _getNodes,
  submitHashes: _submitHashes,
  submitFileHashes: _submitFileHashes,
  getProofs: _getProofs,
  verifyProofs: _verifyProofs,
  evaluateProofs: _evaluateProofs,
  getProofTxs: getProofTxs
}
