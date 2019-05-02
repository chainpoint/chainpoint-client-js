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
import getConfig from '../lib/config'
import { expect } from 'chai'
import Config from 'bcfg'
import fs from 'bfile'

describe('config', () => {
  let foo, prefix, config
  beforeEach(async () => {
    foo = 'bar'
    prefix = '/tmp/chainpoint_tests'
    fs.mkdirSync(prefix)
  })

  afterEach(async () => {
    await fs.remove(prefix)
    config = null
  })

  it('should return a bcfg object', () => {
    config = getConfig()
    expect(config).to.be.an.instanceof(Config)
  })

  it('should load env vars', () => {
    process.env.CHAINPOINT_FOO = foo
    config = getConfig()
    expect(config.str('foo')).to.equal(foo)
    delete process.env.CHAINPOINT_FOO
  })

  it('should load options that are passed to it', () => {
    config = getConfig({ foo })
    expect(config.str('foo')).to.equal(foo)
  })

  it('should load argv', () => {
    process.argv.push(`--foo=${foo}`)
    config = getConfig()
    expect(config.str('foo')).to.equal(foo)
    // remove variable from argv
    process.argv.pop()
  })

  it('should load configs from a config file', async () => {
    fs.writeFileSync(prefix + '/chainpoint.conf', 'foo: bar')
    config = getConfig({ prefix })
    expect(config.str('foo')).to.equal(foo)
  })
})
