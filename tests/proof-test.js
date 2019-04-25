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
import sinon from 'sinon'

import submitHashes from './data/submit-hashes.json'
import proofs from './data/proofs.json'
import chp from 'chainpoint-binary'

import {
  isValidProofHandle,
  mapSubmitHashesRespToProofHandles,
  parseProofs,
  flattenProofBranches,
  flattenProofs,
  // flattenBtcBranches,
  normalizeProofs
} from '../lib/utils/proofs'
import { testArrayArg } from './helpers'

describe('proof utilities', () => {
  describe('isValidProofHandle', () => {
    it('should correctly validate proof handles', () => {
      let mockHandle = {}
      expect(isValidProofHandle(mockHandle), 'should not accept empty objects').to.be.false
      expect(isValidProofHandle('I am not an object!'), 'Should only accept objects').to.be.false
      mockHandle.uri = 'http://35.212.136.230'
      expect(isValidProofHandle(mockHandle), 'should fail without hashIdNode property').to.be.false
      delete mockHandle.uri
      mockHandle.hashIdNode = '4bd142c0-655d-11e9-8108-01842c6b2502'
      expect(isValidProofHandle(mockHandle), 'should fail without uri property').to.be.false
      mockHandle.uri = 'http://35.212.136.230'
      expect(isValidProofHandle(mockHandle), 'should pass with uri and hashIdNode properties').to.be.true
    })
  })

  describe('mapSubmitHashesRespToProofHandles', () => {
    it('should only accept non-empty array as argument', () => {
      testArrayArg(mapSubmitHashesRespToProofHandles)
    })
    it('should return handles with expected json formatting', () => {
      let proofHandles = mapSubmitHashesRespToProofHandles(submitHashes)
      proofHandles.forEach(handle => {
        expect(handle).to.have.property('uri')
        expect(handle).to.have.property('hash')
        expect(handle).to.have.property('hash')
        expect(handle).to.have.property('hashIdNode')
        expect(handle).to.have.property('groupId')
      })
    })
  })

  describe('parseProofs', () => {
    it('should only accept non-empty array as argument', () => {
      testArrayArg(parseProofs)
    })

    it('should reject proofs of unknown format', () => {
      expect(() => parseProofs(['hello world!']), 'unserialized strings should not be accepted').to.throw()
    })

    it('should parse an array of valid proofs', () => {
      let { proof } = proofs[0]
      proof = chp.binaryToObjectSync(proof)
      let proofBuff = chp.objectToBinarySync(proof)
      let proofHex = proofBuff.toString('hex')
      let proofBase64 = chp.objectToBase64Sync(proof)
      let proofJSON = JSON.stringify(proof)

      let proofsArr = [proof, proofBuff, proofHex, proofBase64, proofJSON]

      expect(() => parseProofs(proofsArr)).not.to.throw()
    })
  })

  describe('normalizeProofs', () => {
    beforeEach(() => {
      sinon.spy(console, 'error')
    })
    afterEach(() => {
      console.error.restore()
    })
    it('should skip incorrectly passed args and log errors', () => {
      testArrayArg(normalizeProofs)
      // empty array, null proof, or non-chainpoint type proofs should all fail gracefully
      let normalized = normalizeProofs([{}, { hashIdNode: 'i-am-an-id', proof: null }, { type: 'foobar' }])
      expect(normalized, 'Array of normalized invalid proofs should have been empty').to.have.length(0)
      expect(console.error.calledThrice, 'Did not log errors for each incorrect proof object').to.be.true
    })

    it('should normalize parsed proof objects', () => {
      let parsedProofs = proofs.map(proof => chp.binaryToObjectSync(proof.proof))
      // test with already parsed proof objects with type `Chainpoint`
      let normalized = normalizeProofs(parsedProofs)
      expect(normalized[0]).to.equal(parsedProofs[0])
    })

    it('should normalize a raw proof binary or submit hashes response', () => {
      let testProofs = [...proofs]
      // raw proof string in Base64
      testProofs[0] = testProofs[0].proof
      let normalized = normalizeProofs(testProofs)

      expect(normalized[0]).to.equal(testProofs[0])
    })
  })

  describe('flattenProofBranches', () => {
    it('should only accept non-empty array as argument', () => {
      testArrayArg(flattenProofBranches)
    })

    it('should return an array of objects with all relevant data for each branch anchor submitted', () => {
      let parsedProofs = parseProofs(proofs.map(proof => chp.binaryToObjectSync(proof.proof)))
      let proofBranchArray = parsedProofs.map(proof => proof.branches[0])
      let flattenedBranches = flattenProofBranches(proofBranchArray)
      expect(flattenedBranches).to.have.lengthOf.at.least(parsedProofs.length)

      flattenedBranches.forEach(branch => {
        // also checking that the property is a string to verify it is defined
        expect(branch)
          .to.have.property('branch')
          .that.is.a('string')
        expect(branch)
          .to.have.property('uri')
          .that.is.a('string')
        expect(branch)
          .to.have.property('type')
          .that.is.a('string')
        expect(branch)
          .to.have.property('anchor_id')
          .that.is.a('string')
        expect(branch)
          .to.have.property('expected_value')
          .that.is.a('string')
        expect(branch).to.not.have.property('branches')
      })
    })
  })

  describe('flattenProofs', () => {
    it('should return an array of flattened proof anchor objects for each branch', () => {
      let parsedProofs = parseProofs(proofs.map(proof => chp.binaryToObjectSync(proof.proof)))
      let flattenedProofs = flattenProofs(parsedProofs)
      expect(flattenedProofs).to.have.lengthOf.at.least(parsedProofs.length)

      flattenedProofs.forEach(branch => {
        // also checking that the property is a string to verify it is defined
        expect(branch)
          .to.have.property('hash')
          .that.is.a('string')
        expect(branch)
          .to.have.property('hash_id_node')
          .that.is.a('string')
        expect(branch)
          .to.have.property('hash_id_core')
          .that.is.a('string')
        expect(branch)
          .to.have.property('hash_submitted_node_at')
          .that.is.a('string')
        expect(branch)
          .to.have.property('hash_submitted_core_at')
          .that.is.a('string')
        expect(branch)
          .to.have.property('branch')
          .that.is.a('string')
        expect(branch)
          .to.have.property('uri')
          .that.is.a('string')
        expect(branch)
          .to.have.property('type')
          .that.is.a('string')
        expect(branch)
          .to.have.property('anchor_id')
          .that.is.a('string')
        expect(branch)
          .to.have.property('expected_value')
          .that.is.a('string')
        expect(branch).to.not.have.property('branches')
      })
    })
  })

  describe('flattenBtcBranches', () => {
    it('should return an array of objects with hash_id_node and raw btc tx')
  })
})
