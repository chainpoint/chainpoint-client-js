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

import fs from 'bfile'
import path from 'path'
import crypto from 'crypto'
import { expect } from 'chai'
import sinon from 'sinon'

import * as submit from '../lib/submit'
import submitFileHashes from '../lib/submitFiles'
import { helpers } from '../lib/utils'
import nodes from './data/nodes'

describe('submitFileHashes', () => {
  let testPath, file1, file2, content1, content2, hash1, hash2, spy, hashes, paths
  before(async () => {
    testPath = '/tmp/chainpoint_test'
    file1 = path.resolve(testPath, 'file1.txt')
    file2 = path.resolve(testPath, 'file2.txt')
    paths = [file1, file2]
    content1 = 'i am content in file1'
    content2 = 'i am content in file2'
    await fs.mkdirp(testPath)
    fs.writeFileSync(file1, content1)
    fs.writeFileSync(file2, content2)
    hash1 = crypto
      .createHash('sha256')
      .update(content1, 'utf8')
      .digest()
      .toString('hex')
    hash2 = crypto
      .createHash('sha256')
      .update(content2, 'utf8')
      .digest()
      .toString('hex')
    hashes = [hash1, hash2]
  })

  after(async () => {
    await fs.remove(testPath)
  })

  beforeEach(() => {
    spy = sinon.spy(submit, 'submitHashes')
  })

  afterEach(() => {
    sinon.restore()
  })

  it('should run submitHashes', async () => {
    await submitFileHashes([file1, file2], nodes)
    expect(submit.submitHashes.called).to.be.true
  })

  it('should get hashes of contents of files at given paths', async () => {
    sinon.spy(helpers, 'getFileHashes')

    await submitFileHashes(paths, nodes)
    expect(spy.withArgs(hashes, nodes).called).to.be.true
    expect(helpers.getFileHashes.withArgs(paths).called).to.be.true
  })
  it('should return proofHandles with path property matching the path of the submitted hash', async () => {
    let proofHandles = await submitFileHashes(paths, nodes)

    proofHandles.forEach(handle => {
      expect(handle).to.have.property('path')
      expect(handle.path).to.be.oneOf(paths)
    })
  })
})
