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
import nock from 'nock'

import { verifyProofs } from '../index'
import { network } from '../lib/utils'
import * as evaluate from '../lib/evaluate'
import proofs from './data/proofs'
import uris from './data/nodes'

describe('verifyProofs', () => {
  // verify just one proof to make calls faster
  let proof = proofs.slice(0, 1)
  let evaluatedProof = evaluate.evaluateProofs(proof)[0]
  let uri = uris[0]

  beforeEach(() => {
    nock.cleanAll()
  })

  it('should evaluate proofs', async () => {
    sinon.spy(evaluate, 'evaluateProofs')
    await verifyProofs(proof)
    expect(evaluate.evaluateProofs.called).to.be.true
  })

  it('should take a single node uri and reject invalid uris args', async () => {
    let notString, invalidUri

    try {
      await verifyProofs(proof, { foo: 'bar' })
    } catch (e) {
      notString = true
    }

    expect(notString, 'Should have thrown error when passed a non-string as uri arg').to.be.true

    try {
      await verifyProofs(proof, 'foo://bar')
    } catch (e) {
      invalidUri = true
    }

    expect(invalidUri, 'Should have thrown error when passed invalid uri').to.be.true

    sinon.stub(network, 'getNodes').callsFake(() => uris)

    await verifyProofs(proof)

    expect(network.getNodes.called).to.be.true
  })

  it('should verify all proofs against a single node at path /calendar/[ANCHOR_ID]/hash', async () => {
    nock(uri)
      .get(`/calendar/${evaluatedProof['anchor_id']}/hash`)
      .reply(200, [evaluatedProof['expected_value']])

    await verifyProofs(proof, uri)
    expect(nock.isDone()).to.be.true
  })

  it('should throw if no hashes found/returned', async () => {
    nock(uri)
      .get(`/calendar/${evaluatedProof['anchor_id']}/hash`)
      .reply(200)

    let noHashFound
    try {
      await verifyProofs(proof, uri)
    } catch (e) {
      if (e.message.match('No hashes')) noHashFound = true
    }

    expect(noHashFound, 'should have thrown when no hashes found').to.be.true
  })

  it('should return proofs with properties indicated if and when the hash was verified', async () => {
    nock(uri)
      .get(`/calendar/${evaluatedProof['anchor_id']}/hash`)
      .reply(200, [evaluatedProof['expected_value']])

    let verified = await verifyProofs(proof, uri)
    let now = new Date()
    expect(verified[0].verified).to.be.true
    expect(verified[0].verifiedAt).exist

    expect(new Date(verified[0].verifiedAt)).to.be.at.most(now)
  })
})
