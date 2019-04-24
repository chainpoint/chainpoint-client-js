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
import sinon from 'sinon'
import { isEqual } from 'lodash'

import submitHashes from '../lib/submit'
import { network, proofs } from '../lib/utils'
import submitHashesResp from './data/submit-hashes'
import hashes from './data/hashes'
import nodes from './data/nodes'

describe('submitHashes', () => {
  let mockResponses
  beforeEach(async () => {
    let stub = sinon.stub(network, 'getNodes')
    stub.returns(nodes)
    mockResponses = nodes.map((uri, index) =>
      nock(uri)
        .persist()
        .post('/hashes')
        .reply(200, submitHashesResp[index])
    )
  })

  afterEach(() => {
    // cleanup all mocked responses
    nock.cleanAll()
    sinon.restore()
  })
  it('should reject invalid hashes arg', async () => {
    let emptyArray, notArray, notHex

    try {
      await submitHashes([])
    } catch (e) {
      emptyArray = true
    }
    expect(emptyArray, 'Should have thrown with an empty array').to.be.true

    try {
      await submitHashes('not an array')
    } catch (e) {
      notArray = true
    }
    expect(notArray, 'Should have thrown with a non-array arg').to.be.true

    try {
      await submitHashes(['not a hash'])
    } catch (e) {
      notHex = true
    }
    expect(notHex, 'Should have thrown with a non-array arg').to.be.true
  })

  it('should reject invalid uris arg', async () => {
    let bigArray, notArray, invalidUri

    try {
      await submitHashes(hashes, [1, 2, 3, 4, 5, 6])
    } catch (e) {
      bigArray = e.message
    }
    expect(bigArray).to.have.string('5 elements', 'Should have thrown with a uris array of more than 5 elements')

    try {
      await submitHashes(hashes, 'not an array')
    } catch (e) {
      notArray = true
    }
    expect(notArray, 'Should have thrown with a non-array uris arg').to.be.true

    try {
      await submitHashes(hashes, ['http://fail'])
    } catch (e) {
      invalidUri = e.message
    }
    expect(invalidUri).to.have.string('invalid URI', 'Should have thrown for an invalid node URI')
  })

  it('should get node uris from a core if none are passed', async () => {
    await submitHashes(hashes)
    expect(network.getNodes.called).to.be.true
  })
  it('should send POST request to nodes with hashes in the request body', async () => {
    // nock doesn't give us a good way to check the request bodies
    // so we need to add a check to each mocked request/response
    // by updating a reqBodies object that tracks if the req for each endpoint
    // has a body object with the hashes
    let reqBodies = {}
    nodes.forEach(uri => (reqBodies[uri] = false))
    mockResponses = mockResponses.map(mock =>
      mock.filteringRequestBody(body => {
        // remove the port at the end of the uri
        let uri = mock.basePath.slice(0, -3)
        body = JSON.parse(body)
        // check the body in the req for this uri has the hashes
        reqBodies[uri] = isEqual(body, { hashes })
      })
    )

    await submitHashes(hashes)

    mockResponses.forEach(resp => expect(resp.isDone()).to.be.true)
    nodes.forEach(uri => expect(reqBodies[uri]).to.be.true)
  })
  it('should return mapped proof handles after successful submission', async () => {
    sinon.spy(proofs, 'mapSubmitHashesRespToProofHandles')
    let testHandles = await submitHashes(hashes)

    expect(proofs.mapSubmitHashesRespToProofHandles.called, 'Did not map to proof handles').to.be.true

    // confirm all are valid proof handles
    testHandles.forEach(handle => expect(proofs.isValidProofHandle(handle)).to.be.true)
  })
})
