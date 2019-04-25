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
import nock from 'nock'
import { forEach, isEmpty } from 'lodash'

import proofHandles from './data/proof-handles'
import proofsResponse from './data/proofs-response'
import { getProofs, evaluateProofs } from '../index'

describe('getProofs', () => {
  let nodes
  before(() => {
    nodes = {}
    forEach(proofHandles, handle => {
      if (isEmpty(nodes[handle.uri])) {
        nodes[handle.uri] = []
      }
      nodes[handle.uri].push(handle.hashIdNode)
    })
  })

  it('should only accept an array of valid proof handles', async () => {
    let emptyArray, notArray, tooManyHandles, invalidHandle, badURIs, badUUID

    try {
      await getProofs([])
    } catch (e) {
      emptyArray = true
    }
    expect(emptyArray, 'Should have thrown with an empty array').to.be.true

    try {
      await getProofs('not an array')
    } catch (e) {
      notArray = true
    }
    expect(notArray, 'Should have thrown with a non-array arg').to.be.true

    try {
      let largeDataSet = [...proofHandles]
      while (largeDataSet.length < 251) {
        largeDataSet.push(...proofHandles)
      }
      await getProofs(largeDataSet)
    } catch (e) {
      if (e.message.indexOf('<= 250') > -1) tooManyHandles = true
    }
    expect(tooManyHandles, 'Should have thrown with a data set larger than 250 items').to.be.true

    try {
      await getProofs([{ ...proofHandles[0], uri: undefined }])
    } catch (e) {
      badURIs = true
    }
    expect(badURIs, 'Should have thrown with an invalid uri').to.be.true

    try {
      await getProofs([{ foo: 'bar' }])
    } catch (e) {
      invalidHandle = true
    }
    expect(invalidHandle, 'Should have thrown with an invalid handle').to.be.true

    try {
      await getProofs([{ ...proofHandles[0], hashIdNode: '123456' }])
    } catch (e) {
      badUUID = true
    }
    expect(badUUID, 'Should have thrown with an invalid hashIdNode').to.be.true
  })

  describe('network responses', () => {
    let mockedReponses

    beforeEach(() => {
      // mocked response should be from test data
      mockedReponses = Object.keys(nodes).map((uri, index) =>
        nock(uri)
          .get('/proofs')
          .reply(200, proofsResponse[index])
      )
    })

    it('should make one get request to each node uri', async () => {
      await getProofs(proofHandles)
      mockedReponses.forEach(resp => expect(resp.isDone()).to.be.true)
    })

    it('should return flattened proofs from nodes that can be normalized', async () => {
      let flattenedResponse = await getProofs(proofHandles)
      let evaluatedProofs = evaluateProofs(flattenedResponse)

      expect(evaluatedProofs).to.exist
    })
  })
})
