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
import { expect } from 'chai'

import { evaluateProofs } from '../index'
import { normalizeProofs, flattenProofs, parseProofs } from '../lib/utils/proofs'
import proofs from './data/proofs'

describe('evaluateProofs', () => {
  it('should return normalized, parsed, and flattened proofs', () => {
    let normalized = normalizeProofs(proofs)
    let parsed = parseProofs(normalized)
    let flattened = flattenProofs(parsed)

    let test = evaluateProofs(proofs)

    flattened.forEach((proof, index) => expect(proof).to.deep.equal(test[index]))
  })
})
