/* Copyright 2017-2018 Tierion
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

'use strict'

import {
  isString as _isString,
  isEmpty as _isEmpty,
  isFunction as _isFunction,
  isInteger as _isInteger,
  map as _map,
  shuffle as _shuffle,
  filter as _filter,
  slice as _slice,
  first as _first,
  isObject as _isObject,
  has as _has,
  isArray as _isArray,
  forEach as _forEach,
  isBuffer as _isBuffer,
  reject as _reject,
  uniq as _uniq,
  every as _every,
  keys as _keys,
  flatten as _flatten,
  mapKeys as _mapKeys,
  camelCase as _camelCase,
  uniqWith as _uniqWith,
  isEqual as _isEqual,
  curry as _curry
} from 'lodash'
const Promise = require('bluebird')
const dns = require('dns')
const url = require('url')
const validator = require('validator')
const uuidValidate = require('uuid-validate')
const cpp = require('chainpoint-parse')
const request = require('request')
const rp = require('request-promise')
const crypto = require('crypto')
const fs = require('fs')
const uuidv1 = require('uuid/v1')

const NODE_PROXY_URI = 'https://node-proxy.chainpoint.org:443'

Promise.config({
  // Enables all warnings except forgotten return statements.
  warnings: {
    wForgottenReturn: false
  }
})

const DNS_CORE_DISCOVERY_ADDR = '_core.addr.chainpoint.org'

/**
 * Check if valid Core URI
 *
 * @param {string} coreURI - The Core URI to test for validity
 * @returns {bool} true if coreURI is a valid Core URI, otherwise false
 */
function _isValidCoreURI(coreURI) {
  if (_isEmpty(coreURI) || !_isString(coreURI)) return false

  try {
    return validator.isURL(coreURI, {
      protocols: ['https'],
      require_protocol: true,
      host_whitelist: [/^[a-z]\.chainpoint\.org$/]
    })
  } catch (error) {
    return false
  }
}

/**
 * Retrieve an Array of discovered Core URIs. Returns one Core URI by default.
 *
 * @param {Integer} num - Max number of Core URI's to return.
 * @param {function} callback - An optional callback function.
 * @returns {string} - Returns either a callback or a Promise with an Array of Core URI strings.
 */
function getCores(num, callback) {
  callback = callback || function() {}
  num = num || 1

  if (!_isInteger(num) || num < 1)
    throw new Error('num arg must be an Integer >= 1')

  return new Promise(function(resolve, reject) {
    if (dns && _isFunction(dns.resolveTxt)) {
      dns.resolveTxt(DNS_CORE_DISCOVERY_ADDR, (err, records) => {
        if (err) {
          reject(err)
          return callback(err)
        }

        if (_isEmpty(records)) {
          let err = new Error('no core addresses available')
          reject(err)
          return callback(err)
        }

        let cores = _map(records, coreIP => {
          return 'https://' + coreIP
        })

        // randomize the order
        let shuffledCores = _shuffle(cores)
        // only return cores with valid addresses (should be all)
        let filteredCores = _filter(shuffledCores, function(c) {
          return _isValidCoreURI(c)
        })
        // only return num cores
        let slicedCores = _slice(filteredCores, 0, num)

        resolve(slicedCores)
        return callback(null, slicedCores)
      })
    } else {
      // `dns` module is not available in the browser
      // fallback to simple random selection of Cores
      let cores = [
        'https://a.chainpoint.org',
        'https://b.chainpoint.org',
        'https://c.chainpoint.org'
      ]
      let slicedCores = _slice(_shuffle(cores), 0, num)
      resolve(slicedCores)
      return callback(null, slicedCores)
    }
  })
}

/**
 * Check if valid Node URI
 *
 * @param {string} nodeURI - The value to check
 * @returns {bool} true if value is a valid Node URI, otherwise false
 */
function _isValidNodeURI(nodeURI) {
  if (!_isString(nodeURI)) return false

  try {
    let isValidURI = validator.isURL(nodeURI, {
      protocols: ['http', 'https'],
      require_protocol: true,
      host_blacklist: ['0.0.0.0']
    })

    let parsedURI = url.parse(nodeURI).hostname

    // Valid URI w/ IPv4 address?
    return isValidURI && validator.isIP(parsedURI, 4)
  } catch (error) {
    return false
  }
}

/**
 * Check if client is being used over an https connection
 * @returns {bool} true if served over https
 */
function _isSecureOrigin() {
  return typeof window === 'object' && window.location.protocol === 'https:'
}

/**
 * Retrieve an Array of discovered Node URIs. Returns three Node URIs by default.
 * Can only return up to the number of Nodes that Core provides.
 *
 * @param {Integer} num - Max number of Node URIs to return.
 * @param {function} callback - An optional callback function.
 * @returns {Array<String>} - Returns either a callback or a Promise with an Array of Node URI strings
 */
function getNodes(num, callback) {
  callback = callback || function() {}
  num = num || 3

  if (!_isInteger(num) || num < 1)
    throw new Error('num arg must be an Integer >= 1')

  return new Promise(function(resolve, reject) {
    getCores(1)
      .then(coreURI => {
        let getNodeURI = _first(coreURI) + '/nodes/random'
        request(
          {
            uri: getNodeURI,
            json: true,
            timeout: 10000
          },
          (err, response, body) => {
            if (err) {
              reject(err)
              return callback(err)
            }

            // extract public_uri from each node object
            let nodes = _map(body, 'public_uri')
            // randomize the order
            let shuffledNodes = _shuffle(nodes)
            // only return nodes with valid addresses (should be all)
            let filteredNodes = _filter(shuffledNodes, function(n) {
              return _isValidNodeURI(n)
            })
            // only return maxNodes nodes
            let slicedNodes = _slice(filteredNodes, 0, num)
            // We should never return an empty array of nodes
            if (!slicedNodes.length)
              throw new Error(
                'There seems to be an issue retrieving a list of available nodes. Please try again.'
              )

            resolve(slicedNodes)
            return callback(null, slicedNodes)
          }
        )
      })
      .catch(err => {
        reject(err)
        return callback(err)
      })
  })
}

/**
 * Checks if value is a hexadecimal string
 *
 * @param {string} value - The value to check
 * @returns {bool} true if value is a hexadecimal string, otherwise false
 */
function _isHex(value) {
  var hexRegex = /^[0-9a-f]{2,}$/i
  var isHex = hexRegex.test(value) && !(value.length % 2)
  return isHex
}

/**
 * Checks if a proof handle Object has valid params.
 *
 * @param {Object} handle - The proof handle to check
 * @returns {bool} true if handle is valid Object with expected params, otherwise false
 */
function _isValidProofHandle(handle) {
  if (
    !_isEmpty(handle) &&
    _isObject(handle) &&
    _has(handle, 'uri') &&
    _has(handle, 'hashIdNode')
  ) {
    return true
  }
}

/**
 * Checks if a UUID is a valid v1 UUID.
 *
 * @param {string} uuid - The uuid to check
 * @returns {bool} true if uuid is valid, otherwise false
 */
function _isValidUUID(uuid) {
  if (uuidValidate(uuid, 1)) {
    return true
  }
}

/**
 * Map the JSON API response from submitting a hash to a Node to a
 * more accessible form that can also be used as the input arg to
 * getProofs function.
 *
 * @param {Array} respArray - An Array of responses, one for each Node submitted to
 * @returns {Array<{uri: String, hash: String, hashIdNode: String}>} An Array of proofHandles
 */
function _mapSubmitHashesRespToProofHandles(respArray) {
  if (!_isArray(respArray) && !respArray.length)
    throw new Error('_mapSubmitHashesRespToProofHandles arg must be an Array')

  let proofHandles = []
  let groupIdList = []
  if (respArray[0] && respArray[0].hashes) {
    _forEach(respArray[0].hashes, () => {
      groupIdList.push(uuidv1())
    })
  }

  _forEach(respArray, resp => {
    _forEach(resp.hashes, (hash, idx) => {
      let handle = {}

      handle.uri = resp.meta.submitted_to
      handle.hash = hash.hash
      handle.hashIdNode = hash.hash_id_node
      handle.groupId = groupIdList[idx]
      proofHandles.push(handle)
    })
  })

  return proofHandles
}

/**
 * Parse an Array of proofs, each of which can be in any supported format.
 *
 * @param {Array} proofs - An Array of proofs in any supported form
 * @returns {Array} An Array of parsed proofs
 */
function _parseProofs(proofs) {
  if (!_isArray(proofs)) throw new Error('proofs arg must be an Array')
  if (_isEmpty(proofs)) throw new Error('proofs arg must be a non-empty Array')

  let parsedProofs = []

  _forEach(proofs, proof => {
    if (_isObject(proof)) {
      // OBJECT
      parsedProofs.push(cpp.parse(proof))
    } else if (validator.isJSON(proof)) {
      // JSON-LD
      parsedProofs.push(cpp.parse(JSON.parse(proof)))
    } else if (validator.isBase64(proof) || _isBuffer(proof) || _isHex(proof)) {
      // BINARY
      parsedProofs.push(cpp.parse(proof))
    } else {
      throw new Error('unknown proof format')
    }
  })

  return parsedProofs
}

/**
 * Flatten an Array of parsed proofs where each proof anchor is
 * represented as an Object with all relevant proof data.
 *
 * @param {Array} parsedProofs - An Array of previously parsed proofs
 * @returns {Array} An Array of flattened proof objects
 */
function _flattenProofs(parsedProofs) {
  if (!_isArray(parsedProofs))
    throw new Error('parsedProofs arg must be an Array')
  if (_isEmpty(parsedProofs))
    throw new Error('parsedProofs arg must be a non-empty Array')

  let flatProofAnchors = []

  _forEach(parsedProofs, parsedProof => {
    let proofAnchors = _flattenProofBranches(parsedProof.branches)
    _forEach(proofAnchors, proofAnchor => {
      let flatProofAnchor = {}
      flatProofAnchor.hash = parsedProof.hash
      flatProofAnchor.hash_id_node = parsedProof.hash_id_node
      flatProofAnchor.hash_id_core = parsedProof.hash_id_core
      flatProofAnchor.hash_submitted_node_at =
        parsedProof.hash_submitted_node_at
      flatProofAnchor.hash_submitted_core_at =
        parsedProof.hash_submitted_core_at
      flatProofAnchor.branch = proofAnchor.branch
      flatProofAnchor.uri = proofAnchor.uri
      flatProofAnchor.type = proofAnchor.type
      flatProofAnchor.anchor_id = proofAnchor.anchor_id
      flatProofAnchor.expected_value = proofAnchor.expected_value
      flatProofAnchors.push(flatProofAnchor)
    })
  })

  return flatProofAnchors
}

/**
 * Flatten an Array of proof branches where each proof anchor in
 * each branch is represented as an Object with all relevant data for that anchor.
 *
 * @param {Array} proofBranchArray - An Array of branches for a given level in a proof
 * @returns {Array} An Array of flattened proof anchor objects for each branch
 */
function _flattenProofBranches(proofBranchArray) {
  let flatProofAnchors = []

  _forEach(proofBranchArray, proofBranch => {
    let anchors = proofBranch.anchors
    _forEach(anchors, anchor => {
      let flatAnchor = {}
      flatAnchor.branch = proofBranch.label || undefined
      flatAnchor.uri = anchor.uris[0]
      flatAnchor.type = anchor.type
      flatAnchor.anchor_id = anchor.anchor_id
      flatAnchor.expected_value = anchor.expected_value
      flatProofAnchors.push(flatAnchor)
    })
    if (proofBranch.branches) {
      flatProofAnchors = flatProofAnchors.concat(
        _flattenProofBranches(proofBranch.branches)
      )
    }
  })
  return flatProofAnchors
}

/**
 * Submit hash(es) to one or more Nodes, returning an Array of proof handle objects, one for each submitted hash and Node combination.
 * @param {Array<String>} hashes - An Array of String Hashes in Hexadecimal form.
 * @param {Array<String>} uris - An Array of String URI's. Each hash will be submitted to each Node URI provided. If none provided three will be chosen at random using service discovery.
 * @return {Array<{uri: String, hash: String, hashIdNode: String, groupId: String}>} An Array of Objects, each a handle that contains all info needed to retrieve a proof.
 */
function submitHashes(hashes, uris, callback) {
  uris = uris || []
  callback = callback || function() {}
  let nodesPromise

  // Validate callback is a function
  if (!_isFunction(callback)) throw new Error('callback arg must be a function')

  // Validate all hashes provided
  if (!_isArray(hashes)) throw new Error('hashes arg must be an Array')
  if (_isEmpty(hashes)) throw new Error('hashes arg must be a non-empty Array')
  if (hashes.length > 250)
    throw new Error('hashes arg must be an Array with <= 250 elements')
  let rejects = _reject(hashes, function(h) {
    return _isHex(h)
  })
  if (!_isEmpty(rejects))
    throw new Error(
      `hashes arg contains invalid hashes : ${rejects.join(', ')}`
    )

  // Validate all Node URIs provided
  if (!_isArray(uris))
    throw new Error('uris arg must be an Array of String URIs')
  if (uris.length > 5)
    throw new Error('uris arg must be an Array with <= 5 elements')

  if (_isEmpty(uris)) {
    // get a list of nodes via service discovery
    nodesPromise = getNodes(3)
  } else {
    // eliminate duplicate URIs
    uris = _uniq(uris)

    // non-empty, check that *all* are valid or throw
    let badURIs = _reject(uris, function(h) {
      return _isValidNodeURI(h)
    })
    if (!_isEmpty(badURIs))
      throw new Error(`uris arg contains invalid URIs : ${badURIs.join(', ')}`)
    // all provided URIs were valid
    nodesPromise = Promise.resolve(uris)
  }

  return new Promise(function(resolve, reject) {
    // Resolve an Array of Nodes from service discovery or the arg provided
    nodesPromise
      .then(nodes => {
        // Setup an options Object for each Node we'll submit hashes to.
        // Each Node will then be sent the full Array of hashes.
        let nodesWithPostOpts = _map(nodes, node => {
          let uri = _isSecureOrigin() ? NODE_PROXY_URI : node
          let headers = Object.assign(
            {
              'content-type': 'application/json'
            },
            _isSecureOrigin()
              ? {
                  'X-Node-Uri': node
                }
              : {}
          )

          let postOptions = {
            method: 'POST',
            uri: uri + '/hashes',
            body: {
              hashes: hashes
            },
            headers,
            timeout: 10000,
            json: true
          }
          return postOptions
        })

        // All requests succeed in parallel or all fail.
        Promise.map(nodesWithPostOpts, rp, {
          concurrency: 25
        }).then(
          parsedBody => {
            // Nodes cannot be guaranteed to know what IP address they are reachable
            // at, so we need to amend each result with the Node URI it was submitted
            // to so that proofs may later be retrieved from the appropriate Node(s).
            // This mapping relies on that fact that Promise.map returns results in the
            // same order that options were passed to it so the results can be mapped to
            // the Nodes submitted to.
            _forEach(nodes, (uri, index) => {
              parsedBody[index].meta.submitted_to = uri
            })

            // Map the API response to a form easily consumable by getProofs
            let proofHandles = _mapSubmitHashesRespToProofHandles(parsedBody)

            resolve(proofHandles)
            return callback(null, proofHandles)
          },
          function(err) {
            reject(err)
            return callback(err)
          }
        )
      })
      .catch(err => {
        console.error(err.message)
        throw err
      })
  })
}

/**
 * Submit hash(es) of selected file(s) to one or more Nodes, returning an Array of proof handle objects, one for each submitted hash and Node combination.
 * @param {Array<String>} paths - An Array of paths of the files to be hashed.
 * @param {Array<String>} uris - An Array of String URI's. Each hash will be submitted to each Node URI provided. If none provided three will be chosen at random using service discovery.
 * @return {Array<{path: String, uri: String, hash: String, hashIdNode: String, groupId: String}>} An Array of Objects, each a handle that contains all info needed to retrieve a proof.
 */
function submitFileHashes(paths, uris, callback) {
  callback = callback || function() {}
  uris = uris || []

  // Validate callback is a function
  if (!_isFunction(callback)) throw new Error('callback arg must be a function')

  // Validate all paths provided
  if (!_isArray(paths)) throw new Error('paths arg must be an Array')
  if (_isEmpty(paths)) throw new Error('paths arg must be a non-empty Array')
  if (paths.length > 250)
    throw new Error('paths arg must be an Array with <= 250 elements')
  let rejects = _reject(
    paths,
    path => fs.existsSync(path) && fs.lstatSync(path).isFile()
  )
  if (!_isEmpty(rejects))
    throw new Error(`paths arg contains invalid paths : ${rejects.join(', ')}`)

  // Validate all Node URIs provided
  if (!_isArray(uris))
    throw new Error('uris arg must be an Array of String URIs')
  if (uris.length > 5)
    throw new Error('uris arg must be an Array with <= 5 elements')

  return new Promise(async function(resolve, reject) {
    let hashObjs = []
    try {
      hashObjs = await Promise.all(paths.map(path => sha256FileByPath(path)))
    } catch (err) {
      reject(err)
      return callback(err)
    }

    // filter out any EACCES errors
    hashObjs = hashObjs.filter(hashObj => {
      if (hashObj.error === 'EACCES')
        console.error(
          `Insufficient permission to read file '${hashObj.path}', skipping`
        )
      return hashObj.error !== 'EACCES'
    })
    if (hashObjs.length === 0) {
      resolve([])
      return callback(null, [])
    }

    submitHashes(hashObjs.map(hashObj => hashObj.hash), uris).then(
      proofHandles => {
        proofHandles = proofHandles.map(proofHandle => {
          proofHandle.path = hashObjs.find(
            hashObj => hashObj.hash === proofHandle.hash
          ).path
          return proofHandle
        })
        resolve(proofHandles)
        return callback(null, proofHandles)
      },
      function(err) {
        reject(err)
        return callback(err)
      }
    )
  }).catch(err => {
    console.error(err.message)
    throw err
  })
}

function sha256FileByPath(path) {
  return new Promise((resolve, reject) => {
    let sha256 = crypto.createHash('sha256')
    let readStream = fs.createReadStream(path)
    readStream.on('data', data => sha256.update(data))
    readStream.on('end', () => {
      let hash = sha256.digest('hex')
      resolve({
        path,
        hash
      })
    })
    readStream.on('error', err => {
      if (err.code === 'EACCES') {
        resolve({
          path: path,
          hash: null,
          error: 'EACCES'
        })
      }
      reject(err)
    })
  })
}

/**
 * Retrieve a collection of proofs for one or more hash IDs from the appropriate Node(s)
 * The output of `submitProofs()` can be passed directly as the `proofHandles` arg to
 * this function.
 *
 * @param {Array<{uri: String, hashIdNode: String}>} proofHandles - An Array of Objects, each Object containing all info needed to retrieve a proof from a specific Node.
 * @param {function} callback - An optional callback function.
 * @return {Array<{uri: String, hashIdNode: String, proof: String}>} - An Array of Objects, each returning the URI the proof was returned from and the Proof in Base64 encoded binary form.
 */
function getProofs(proofHandles, callback) {
  callback = callback || function() {}

  // Validate callback is a function
  if (!_isFunction(callback)) throw new Error('callback arg must be a function')

  // Validate all proofHandles provided
  if (!_isArray(proofHandles))
    throw new Error('proofHandles arg must be an Array')
  if (_isEmpty(proofHandles))
    throw new Error('proofHandles arg must be a non-empty Array')
  if (
    !_every(proofHandles, h => {
      return _isValidProofHandle(h)
    })
  )
    throw new Error('proofHandles Array contains invalid Objects')
  if (proofHandles.length > 250)
    throw new Error('proofHandles arg must be an Array with <= 250 elements')

  // Validate that *all* URI's provided are valid or throw
  let badHandleURIs = _reject(proofHandles, function(u) {
    return _isValidNodeURI(u.uri)
  })
  if (!_isEmpty(badHandleURIs))
    throw new Error(
      `some proof handles contain invalid URI values : ${_map(
        badHandleURIs,
        h => {
          return h.uri
        }
      ).join(', ')}`
    )

  // Validate that *all* hashIdNode's provided are valid or throw
  let badHandleUUIDs = _reject(proofHandles, function(u) {
    return _isValidUUID(u.hashIdNode)
  })
  if (!_isEmpty(badHandleUUIDs))
    throw new Error(
      `some proof handles contain invalid hashIdNode UUID values : ${_map(
        badHandleUUIDs,
        h => {
          return h.hashIdNode
        }
      ).join(', ')}`
    )

  return new Promise(function(resolve, reject) {
    try {
      // Collect together all proof UUIDs destined for a single Node
      // so they can be submitted to the Node in a single request.
      let uuidsByNode = {}
      _forEach(proofHandles, handle => {
        if (_isEmpty(uuidsByNode[handle.uri])) {
          uuidsByNode[handle.uri] = []
        }
        uuidsByNode[handle.uri].push(handle.hashIdNode)
      })

      // For each Node construct a set of GET options including
      // the `hashids` header with a list of all hash ID's to retrieve
      // proofs for from that Node.
      let nodesWithGetOpts = _map(_keys(uuidsByNode), node => {
        let headers = Object.assign(
          {
            'content-type': 'application/json'
          },
          {
            hashids: uuidsByNode[node].join(',')
          },
          _isSecureOrigin()
            ? {
                'X-Node-Uri': node
              }
            : {}
        )
        let getOptions = {
          method: 'GET',
          uri: (_isSecureOrigin() ? NODE_PROXY_URI : node) + '/proofs',
          body: {},
          headers,
          timeout: 10000,
          json: true
        }
        return getOptions
      })

      // Perform parallel GET requests to all Nodes with proofs
      Promise.map(nodesWithGetOpts, rp, {
        concurrency: 25
      }).then(
        function(parsedBody) {
          // Promise.map returns an Array entry for each host it submits to.
          let flatParsedBody = _flatten(parsedBody)

          let proofsResponse = []

          try {
            _forEach(flatParsedBody, proofResp => {
              // Set to empty Array if unset of null
              proofResp.anchors_complete = proofResp.anchors_complete || []
              // Camel case object keys
              let proofRespCamel = _mapKeys(proofResp, (v, k) => _camelCase(k))
              proofsResponse.push(proofRespCamel)
            })
          } catch (err) {
            reject(err)
            return callback(err)
          }

          resolve(proofsResponse)
          return callback(null, proofsResponse)
        },
        function(err) {
          reject(err)
          return callback(err)
        }
      )
    } catch (err) {
      reject(err)
      return callback(err)
    }
  })
}

/**
 * Verify a collection of proofs using an optionally provided Node URI
 *
 * @param {Array} proofs - An Array of String, or Object proofs from getProofs(), to be verified. Proofs can be in any of the supported JSON-LD or Binary formats.
 * @param {String} uri - [Optional] The Node URI to submit proof(s) to for verification. If not provided a Node will be selected at random. All proofs will be verified by a single Node.
 * @param {function} callback - An optional callback function.
 * @return {Array<Object>} - An Array of Objects, one for each proof submitted, with vefification info.
 */
function verifyProofs(proofs, uri, callback) {
  callback = callback || function() {}

  let evaluatedProofs = evaluateProofs(proofs)

  // Validate and return an Array with a single Node URI
  // if provided or get an Array of Nodes via service discovery.
  // In both cases return a Promise.
  let nodesPromise
  if (_isEmpty(uri)) {
    nodesPromise = getNodes(1)
  } else {
    if (!_isString(uri)) throw new Error('uri arg must be a String')
    if (!_isValidNodeURI(uri))
      throw new Error(`uri arg contains invalid Node URI : ${uri}`)
    nodesPromise = Promise.resolve([uri])
  }

  return new Promise(function(resolve, reject) {
    try {
      nodesPromise
        .then(nodes => {
          return _first(nodes)
        })
        .then(node => {
          // Assign all flat proofs to the same Node URI for verification
          let singleNodeFlatProofs = _map(evaluatedProofs, proof => {
            let oldProofURI = url.parse(proof.uri)
            proof.uri = node + oldProofURI.path
            return proof
          })

          let uniqSingleNodeFlatProofs = _uniqWith(
            singleNodeFlatProofs,
            _isEqual
          )

          return uniqSingleNodeFlatProofs
        })
        .then(flatProofs => {
          let anchorURIs = []
          _forEach(flatProofs, proof => {
            anchorURIs.push(proof.uri)
          })

          let uniqAnchorURIs = _uniq(anchorURIs)

          let nodesWithGetOpts = _map(uniqAnchorURIs, anchorURI => {
            let headers = Object.assign(
              {
                'content-type': 'application/json'
              },
              _isSecureOrigin()
                ? {
                    'X-Node-Uri':
                      url.parse(anchorURI).protocol +
                      '//' +
                      url.parse(anchorURI).host
                  }
                : {}
            )

            let uri = _isSecureOrigin()
              ? NODE_PROXY_URI + url.parse(anchorURI).path
              : anchorURI

            return {
              method: 'GET',
              uri,
              body: {},
              headers,
              timeout: 10000,
              json: true
            }
          })

          return [flatProofs, nodesWithGetOpts]
        })
        .then(([flatProofs, nodesWithGetOpts]) => {
          // Perform parallel GET requests to all Nodes with proofs
          let hashesByNodeURI = Promise.map(nodesWithGetOpts, rp, {
            concurrency: 25
          })
            .then(parsedBody => {
              // Promise.map returns an Array entry for each host it submits to.
              let flatParsedBody = _flatten(parsedBody)

              let r = {}

              _forEach(nodesWithGetOpts, (getOpt, index) => {
                r[getOpt.uri] = flatParsedBody[index]
              })

              return r
            })
            .catch(err => {
              reject(err)
              return callback(err)
            })

          return [flatProofs, hashesByNodeURI]
        })
        .then(([flatProofs, hashesByNodeURI]) => {
          // Fulfill the Promise for all of the request results.
          hashesByNodeURI
            .then(hashesFound => {
              if (_isEmpty(hashesFound))
                return Promise.reject(new Error('No hashes were found.'))
              let results = []

              _forEach(flatProofs, flatProof => {
                if (flatProof.expected_value === hashesFound[flatProof.uri]) {
                  // IT'S GOOD!
                  flatProof.verified = true
                  flatProof.verified_at =
                    new Date().toISOString().slice(0, 19) + 'Z'
                } else {
                  // IT'S NO GOOD :-(
                  flatProof.verified = false
                  flatProof.verified_at = null
                }

                // Camel case object keys
                let flatProofCamel = _mapKeys(flatProof, (v, k) =>
                  _camelCase(k)
                )

                results.push(flatProofCamel)
              })

              resolve(results)
              return callback(null, results)
            })
            .catch(err => {
              console.error(err.message)
              reject(err)
              return callback(err)
            })
        })
        .catch(err => {
          console.error(err.message)
          reject(err)
          return callback(err)
        })
    } catch (err) {
      reject(err)
      return callback(err)
    }
  })
}

/**
 * Evaluates the expected anchor values for a collection of proofs
 *
 * @param {Array} proofs - An Array of String, or Object proofs from getProofs(), to be evaluated. Proofs can be in any of the supported JSON-LD or Binary formats.
 */
function evaluateProofs(proofs) {
  // Validate proofs arg
  if (!_isArray(proofs)) throw new Error('proofs arg must be an Array')
  if (_isEmpty(proofs)) throw new Error('proofs arg must be a non-empty Array')

  // If any entry in the proofs Array is an Object, process
  // it assuming the same form as the output of getProofs().
  let normalizedProofs = _map(proofs, proof => {
    if (_isObject(proof) && _has(proof, 'proof') && _isString(proof.proof)) {
      // Probably result of `submitProofs()` call. Extract proof String
      return proof.proof
    } else if (
      _isObject(proof) &&
      _has(proof, 'type') &&
      proof.type === 'Chainpoint'
    ) {
      // Probably a JS Object Proof
      return proof
    } else if (
      _isString(proof) &&
      (validator.isJSON(proof) || validator.isBase64(proof))
    ) {
      // Probably a JSON String or Base64 encoded binary proof
      return proof
    } else {
      throw new Error(
        'proofs arg Array has elements that are not Objects or Strings'
      )
    }
  })

  let parsedProofs = _parseProofs(normalizedProofs)
  let flatProofs = _flattenProofs(parsedProofs)

  return flatProofs
}

module.exports = {
  getCores: getCores,
  getNodes: getNodes,
  submitHashes: submitHashes,
  submitFileHashes: submitFileHashes,
  getProofs: getProofs,
  verifyProofs: verifyProofs,
  evaluateProofs: evaluateProofs
}
