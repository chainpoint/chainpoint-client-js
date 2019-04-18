import fs from 'fs'
import crypto from 'crypto'
import uuidValidate from 'uuid-validate'
import { isEmpty, has, isObject, isArray, reject } from 'lodash'

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

export function sha256FileByPath(path) {
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

/**
 * Get SHA256 hash(es) of selected file(s) and prepare for submitting to a node
 * @param {Array<String>} paths - An Array of paths of the files to be hashed.
 * @param {Array<String>} uris - An Array of String URI's. Each hash will be submitted to each Node URI provided. If none provided three will be chosen at random using service discovery.
 * @return {Array<{path: String, hash: String} An Array of Objects, each a handle that contains all info needed to retrieve a proof.
 */
export async function getFileHashes(paths, uris) {
  uris = uris || []

  // Validate all paths provided
  if (!isArray(paths)) throw new Error('paths arg must be an Array')
  if (isEmpty(paths)) throw new Error('paths arg must be a non-empty Array')
  if (paths.length > 250) throw new Error('paths arg must be an Array with <= 250 elements')
  let rejects = reject(paths, path => fs.existsSync(path) && fs.lstatSync(path).isFile())
  if (!isEmpty(rejects)) throw new Error(`paths arg contains invalid paths : ${rejects.join(', ')}`)

  // Validate all Node URIs provided
  if (!isArray(uris)) throw new Error('uris arg must be an Array of String URIs')
  if (uris.length > 5) throw new Error('uris arg must be an Array with <= 5 elements')

  let hashObjs = []
  hashObjs = await Promise.all(paths.map(path => sha256FileByPath(path)))

  // filter out any EACCES errors
  hashObjs = hashObjs.filter(hashObj => {
    if (hashObj.error === 'EACCES') console.error(`Insufficient permission to read file '${hashObj.path}', skipping`)
    return hashObj.error !== 'EACCES'
  })
  console.log('hashObjs:', hashObjs)
  return hashObjs
}
