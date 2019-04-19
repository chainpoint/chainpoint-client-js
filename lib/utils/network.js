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

/*
 * helper functions related to interacting with chainpoint network objects
 * such as nodes and cores
 */

import { resolveTxt } from 'dns'
import { parse } from 'url'
import { promisify } from 'util'
import { isInteger, isFunction, isEmpty, slice, map, shuffle, filter, first, isString } from 'lodash'
import { isURL, isIP } from 'validator'
import fetch from 'node-fetch'

import { DNS_CORE_DISCOVERY_ADDR } from '../constants'

/**
 * Check if valid Core URI
 *
 * @param {string} coreURI - The Core URI to test for validity
 * @returns {bool} true if coreURI is a valid Core URI, otherwise false
 */
export function isValidCoreURI(coreURI) {
  if (isEmpty(coreURI) || !isString(coreURI)) return false

  try {
    return isURL(coreURI, {
      protocols: ['https'],
      require_protocol: true,
      host_whitelist: [/^[a-z]\.chainpoint\.org$/]
    })
  } catch (error) {
    return false
  }
}

/**
 * Check if valid Node URI
 *
 * @param {string} nodeURI - The value to check
 * @returns {bool} true if value is a valid Node URI, otherwise false
 */
export function isValidNodeURI(nodeURI) {
  if (!isString(nodeURI)) return false

  try {
    let isValidURI = isURL(nodeURI, {
      protocols: ['http', 'https'],
      require_protocol: true,
      host_blacklist: ['0.0.0.0']
    })

    let parsedURI = parse(nodeURI).hostname

    // Valid URI w/ IPv4 address?
    return isValidURI && isIP(parsedURI, 4)
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
export async function getCores(num) {
  num = num || 1

  if (!isInteger(num) || num < 1) throw new Error('num arg must be an Integer >= 1')

  if (resolveTxt && isFunction(resolveTxt)) {
    let resolveTxtAsync = promisify(resolveTxt)
    let records = await resolveTxtAsync(DNS_CORE_DISCOVERY_ADDR)

    if (isEmpty(records)) throw new Error('no core addresses available')

    let cores = map(records, coreIP => {
      return 'https://' + coreIP
    })

    // randomize the order
    let shuffledCores = shuffle(cores)
    // only return cores with valid addresses (should be all)
    let filteredCores = filter(shuffledCores, function(c) {
      return isValidCoreURI(c)
    })
    // only return num cores
    return slice(filteredCores, 0, num)
  } else {
    // `dns` module is not available in the browser
    // fallback to simple random selection of Cores
    let cores = ['https://a.chainpoint.org', 'https://b.chainpoint.org', 'https://c.chainpoint.org']
    return slice(shuffle(cores), 0, num)
  }
}

/**
 * Retrieve an Array of discovered Node URIs. Returns three Node URIs by default.
 * Can only return up to the number of Nodes that Core provides.
 *
 * @param {Integer} num - Max number of Node URIs to return.
 * @param {function} callback - An optional callback function.
 * @returns {Array<String>} - Returns either a callback or a Promise with an Array of Node URI strings
 */
export async function getNodes(num) {
  num = num || 3

  if (!isInteger(num) || num < 1) throw new Error('num arg must be an Integer >= 1')

  let coreURI = await getCores(1)
  let getNodeURI = first(coreURI) + '/nodes/random'
  let response = await fetch(getNodeURI)
  response = await response.json()

  let nodes = map(response, 'public_uri')
  // randomize the order
  let shuffledNodes = shuffle(nodes)
  // only return nodes with valid addresses (should be all)
  let filteredNodes = filter(shuffledNodes, function(n) {
    return isValidNodeURI(n)
  })
  // only return maxNodes nodes
  let slicedNodes = slice(filteredNodes, 0, num)
  // We should never return an empty array of nodes
  if (!slicedNodes.length)
    throw new Error('There seems to be an issue retrieving a list of available nodes. Please try again.')

  return slicedNodes
}
