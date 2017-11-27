'use strict'

const _ = require('lodash')

const cp = require('./index')

// let testHashes = [
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b'
// ]

// let testHashes = [
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
//   '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0c'
// ]

let testHashes = [
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a'
]

// submit to local node
// let testNodes = [
//   'http://127.0.0.1',
//   'http://127.0.0.1',
//   'http://127.0.0.1'
// ]

// let testNodes = [
//   'http://35.188.224.112',
//   'http://35.186.176.183',
//   'http://35.188.230.126'
// ]

let testNodes = null

async function runIt () {
  // Submit hashes
  let proofHandles = await cp.submitHashes(testHashes, testNodes)
  // console.log(JSON.stringify(proofHandles, null, 2))

  // Sleep 15 seconds to allow time for Calendar proofs to be generated
  await new Promise(resolve => setTimeout(resolve, 15000))

  // Retrieve proofs for each of the Hash ID's returned
  let proofObjects = await cp.getProofs(proofHandles)
  // console.log(JSON.stringify(proofObjects, null, 2))

  // FIXME : Extract an Array of proofs from the proofObjects
  let proofs = _.map(proofObjects, 'proof')

  let verifiedProofs = await cp.verifyProofs(proofs)
  console.log(JSON.stringify(verifiedProofs, null, 2))
}

runIt()

// cp.submitHashes(testHashes, testNodes).then(data => {
//   console.log(JSON.stringify(data, null, 2))
// }).catch(function (err) {
//   console.log(err)
// })

// cp.submitHashes(testHashes, testNodes, function (err, data) {
//   if (err) { throw err }
//   console.log(JSON.stringify(data, null, 2))
// })

// cp.getCore().then(core => {
//   console.log('Promise Core')
//   console.log(core.toString())
// }).catch(err => {
//   console.log(err)
// })

// cp.getCore(function (err, data) {
//   console.log('Callback Core')

//   if (err) {
//     throw err
//   }

//   console.log(data.toString())
// })

// cp.getNodes().then(node => {
//     console.log('Promise Node')
//     console.log(node.toString())
//   }).catch(err => {
//     console.log(err)
//   })

// cp.getNodes(function (err, data) {
// console.log('Callback Node')

// if (err) {
//     throw err
// }

// console.log(data.toString())
// })

// let proofHandles = [{uri: 'http://35.188.224.112', hashIDNode: 'a7750482-cb22-11e7-8a79-01cf788c7bd2'}]

// cp.getProofs(proofHandles).then(data => {
//   console.log(JSON.stringify(data, null, 2))
// }).catch(function (err) {
//   console.log(err)
// })

// cp.getProofs(proofHandles, function (err, data) {
//   if (err) { throw err }
//   console.log(JSON.stringify(data, null, 2))
// })
