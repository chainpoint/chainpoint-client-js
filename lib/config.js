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

import Config from 'bcfg'

let config = null

function getConfig(options = {}) {
  // create a new config module for chainpoint
  // this will set the prefix to `~/.chainpoint`
  // and also parse env vars that are prefixed with `CHAINPOINT_`
  config = new Config('chainpoint')
  config.inject(options)
  config.load({
    // Parse URL hash
    hash: true,
    // Parse querystring
    query: true,
    // Parse environment
    env: true,
    // Parse args
    argv: true
  })

  // Will parse [PREFIX]/chainpoint.conf (throws on FS error).
  // PREFIX defaults to `~/.chainpoint`
  // can change the prefix by passing in a `prefix` option
  config.open('chainpoint.conf')
  return config
}

export default getConfig
