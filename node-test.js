const chp = require('./dist/bundle')
// const dns = require('dns')

async function runIt() {
  console.log('====================================')
  console.log('runit()')
  console.log('====================================')
  // A few sample SHA-256 proofs to anchor
  let hashes = [
    '1d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a',
    '2d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a',
    '3d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a'
  ]

  // Submit each hash to three randomly selected Nodes
  let proofHandles = await chp.submitHashes(hashes)
  console.log('Submitted Proof Objects: Expand objects below to inspect.')
  console.log(proofHandles)

  // Wait for Calendar proofs to be available
  console.log('Sleeping 16 seconds to wait for proofs to generate...')
  await new Promise(resolve => setTimeout(resolve, 16000))

  // Retrieve a Calendar proof for each hash that was submitted
  let proofs = await chp.getProofs(proofHandles)
  console.log('Proof Objects: Expand objects below to inspect.')
  console.log(proofs)

  // Verify every anchor in every Calendar proof
  let verifiedProofs = await chp.verifyProofs(proofs)
  console.log('Verified Proof Objects: Expand objects below to inspect.')
  console.log(verifiedProofs)
}

runIt()
