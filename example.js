'use strict'

const cp = require('./index')

const testHashes = [
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b',
  '9d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0b'
]

// submit to local node
let testNodes = [
  'http://127.0.0.1',
  'http://127.0.0.1',
  'http://127.0.0.1'
]

testNodes = []
testNodes = null

cp.submitHashes(testHashes, testNodes).then(data => {
  console.log(JSON.stringify(data, null, 2))
}).catch(function (err) {
  console.log(err)
})

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
  