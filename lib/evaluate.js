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
import { normalizeProofs, parseProofs, flattenProofs } from './utils/proofs'
/**
 * Evaluates the expected anchor values for a collection of proofs
 *
 * @param {Array} proofs - An Array of String, or Object proofs from getProofs(), to be evaluated. Proofs can be in any of the supported JSON-LD or Binary formats.
 */
function evaluateProofs(proofs) {
  let normalizedProofs = normalizeProofs(proofs)
  let parsedProofs = parseProofs(normalizedProofs)
  let flatProofs = flattenProofs(parsedProofs)

  return flatProofs
}

export default evaluateProofs
