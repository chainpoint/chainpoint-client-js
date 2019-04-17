import url from 'url'
import uuidValidate from 'uuid-validate'
import { isURL, isIP } from 'validator'
import { isEmpty, isString, has, isObject } from 'lodash'

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

    let parsedURI = url.parse(nodeURI).hostname

    // Valid URI w/ IPv4 address?
    return isValidURI && isIP(parsedURI, 4)
  } catch (error) {
    return false
  }
}

/**
 * Checks if value is a hexadecimal string
 *
 * @param {string} value - The value to check
 * @returns {bool} true if value is a hexadecimal string, otherwise false
 */
export function isHex(value) {
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
export function isValidProofHandle(handle) {
  if (!isEmpty(handle) && isObject(handle) && has(handle, 'uri') && has(handle, 'hashIdNode')) {
    return true
  }
}

/**
 * Checks if a UUID is a valid v1 UUID.
 *
 * @param {string} uuid - The uuid to check
 * @returns {bool} true if uuid is valid, otherwise false
 */
export function isValidUUID(uuid) {
  if (uuidValidate(uuid, 1)) {
    return true
  }
}

/**
 * Check if client is being used over an https connection
 * @returns {bool} true if served over https
 */
export function isSecureOrigin() {
  return typeof window === 'object' && window.location.protocol === 'https:'
}

export function promiseMap(arr, fn) {
  return Promise.all(
    arr.map(currVal => {
      let obj = JSON.parse(JSON.stringify(currVal))
      let method = obj.method
      let uri = obj.uri
      let body = obj.body

      delete obj.method
      delete obj.uri
      delete obj.body

      switch (method) {
        case 'GET':
          return fn(uri, obj).then(res => {
            let res1 = res.clone()

            return res.json().catch(() => res1.text())
          })
        case 'POST':
          return fn(uri, {
            method,
            ...obj,
            body: JSON.stringify(body)
          }).then(res => {
            let res1 = res.clone()

            return res.json().catch(() => res1.text())
          })
      }
    })
  )
}
