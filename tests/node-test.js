const chp = require('../dist/bundle')
const fs = require('fs')

describe('node', function() {
  this.timeout(30000)
  let hashes

  before(() => {
    hashes = [
      '1d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a',
      '2d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a',
      '3d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a'
    ]
  })

  it('should run', async () => {
    // Submit each hash to three randomly selected Nodes
    let proofHandlesHashes = await chp.submitHashes(hashes)
    console.log('Submitted Proof Objects: Expand objects below to inspect.')
    console.log(proofHandlesHashes)

    // And test the submitFileHashes method
    let paths = fs
      .readdirSync('./')
      .map(file => `./${file}`)
      .filter(file => fs.lstatSync(file).isFile())

    // Submit each hash to three randomly selected Nodes
    let proofHandlesFiles = await chp.submitFileHashes(paths)
    console.log('Submitted Proof Objects: Expand objects below to inspect.')
    console.log(proofHandlesFiles)

    // Wait for Calendar proofs to be available
    console.log('Sleeping 16 seconds to wait for proofs to generate...')
    await new Promise(resolve => setTimeout(resolve, 16000))

    // Retrieve a Calendar proof for each hash that was submitted
    let proofs = await chp.getProofs([...proofHandlesHashes, ...proofHandlesFiles])
    console.log('Proof Objects: Expand objects below to inspect.')
    console.log(proofs)

    // Verify every anchor in every Calendar proof
    let verifiedProofs = await chp.verifyProofs(proofs)
    console.log('Verified Proof Objects: Expand objects below to inspect.')
    console.log(verifiedProofs)
  })
})
