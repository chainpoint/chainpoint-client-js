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

import * as submit from './submit'
import { getFileHashes, validateUrisArg } from './utils/helpers'

/**
 * Submit hash(es) of selected file(s) to one or more Nodes, returning an Array of proof handle objects, one for each submitted hash and Node combination.
 * @param {Array<String>} paths - An Array of paths of the files to be hashed.
 * @param {Array<String>} uris - An Array of String URI's. Each hash will be submitted to each Node URI provided. If none provided three will be chosen at random using service discovery.
 * @return {Array<{path: String, uri: String, hash: String, hashIdNode: String, groupId: String}>} An Array of Objects, each a handle that contains all info needed to retrieve a proof.
 */
async function submitFileHashes(paths, uris) {
  uris = uris || []
  const hashObjs = await getFileHashes(paths)
  const hashes = hashObjs.map(hashObj => hashObj.hash)
  // Validate all Node URIs provided
  validateUrisArg(uris)

  const proofHandles = await submit.submitHashes(hashes, uris)
  return proofHandles.map(proofHandle => {
    proofHandle.path = hashObjs.find(hashObj => hashObj.hash === proofHandle.hash).path
    return proofHandle
  })
}

export default submitFileHashes
