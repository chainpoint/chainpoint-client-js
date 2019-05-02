const chp = require('../dist/bundle')
const fs = require('fs')
const { expect } = require('chai')

describe('E2E tests', function() {
  // need a very long timeout now because the
  // time from hash submission to proof creation can be up to two minutes
  this.timeout(250000)
  let hashes, proofHandlesHashes, proofHandlesFiles, proofs, nodes

  before(async () => {
    hashes = [
      '1d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a',
      '2d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a',
      '3d2a9e92b561440e8d27a21eed114f7018105db00262af7d7087f7dea9986b0a'
    ]

    // B/c v2 development is still unstable, sometimes we will be unable to
    // find a node. This should resolve after one or two tries
    // otherwise the describe's timeout will eventually end
    while (!nodes) {
      nodes = await chp.getNodes(2)
    }
  })

  it('should submit each hash to known good nodes', async () => {
    // Submit each hash to three randomly selected Nodes
    proofHandlesHashes = await chp.submitHashes(hashes, nodes)
    let paths = fs
      .readdirSync('./')
      .map(file => `./${file}`)
      .filter(file => fs.lstatSync(file).isFile())

    // Submit each hashes to same nodes
    proofHandlesFiles = await chp.submitFileHashes(paths, nodes)
    expect(proofHandlesFiles).to.exist
  })

  it('should retrieve a calendar proof for each hash that was submitted', async () => {
    // Wait for Calendar proofs to be available. This can take a couple of minutes
    await new Promise(resolve => setTimeout(resolve, 150000))
    proofs = await chp.getProofs([...proofHandlesHashes, ...proofHandlesFiles])
    expect(proofs).to.exist
  })

  it('should verify every anchor in every calendar proof', async () => {
    const verifiedProofs = await chp.verifyProofs(proofs, nodes[0])
    expect(verifiedProofs).to.exist
  })
})
