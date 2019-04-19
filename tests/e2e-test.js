const chp = require('../dist/bundle')
const fs = require('fs')
const { expect } = require('chai')

describe('E2E tests', function() {
  this.timeout(30000)
  let hashes, proofHandlesHashes, proofHandlesFiles, proofs

  before(() => {
    hashes = [
      '1d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a',
      '2d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a',
      '3d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a'
    ]
  })

  it('should submit each hash to three randomly selected nodes', async () => {
    // Submit each hash to three randomly selected Nodes
    proofHandlesHashes = await chp.submitHashes(hashes)
    let paths = fs
      .readdirSync('./')
      .map(file => `./${file}`)
      .filter(file => fs.lstatSync(file).isFile())

    // Submit each hash to three randomly selected Nodes
    proofHandlesFiles = await chp.submitFileHashes(paths)
    expect(proofHandlesFiles).to.exist
  })

  it('should retrieve a calendar proof for each hash that was submitted', async () => {
    // Wait for Calendar proofs to be available
    await new Promise(resolve => setTimeout(resolve, 16000))
    proofs = await chp.getProofs([...proofHandlesHashes, ...proofHandlesFiles])
    expect(proofs).to.exist
  })

  it('should verify every anchor in every calendar proof', async () => {
    const verifiedProofs = await chp.verifyProofs(proofs)
    expect(verifiedProofs).to.exist
  })
})
