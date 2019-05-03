import { expect } from 'chai'
import nock from 'nock'

import { network } from '../lib/utils'
import nodes from './data/nodes'

describe('network utilities', () => {
  describe('isValidNodeURI', () => {
    it('should only pass valid node URIs', () => {
      let validURIs = ['http://123.45.64.2', 'https://123.54.32.11']
      let invalidURIs = [
        123, // should only accept strings
        '0.0.0.0', // blacklisted
        'chainpoint.org', // must be IP address
        '123.45.66.3', // must have protocol
        'ftp://123.45.66.3' // only accept http or https protocol
      ]
      validURIs.forEach(uri => expect(network.isValidNodeURI(uri), `expected ${uri} to be validated`).to.be.true)
      invalidURIs.forEach(uri => expect(network.isValidNodeURI(uri), `expected ${uri} to be validated`).to.be.false)
    })
  })

  describe('isValidCoreURI', () => {
    it('should only pass valid core URIs', () => {
      let validURIs = ['https://a.chainpoint.org']
      let invalidURIs = [
        'http://satoshi.chainpoint.org', // only https is valid
        'https://satoshi.chainpoint.org', // only single letter subdomains are valid
        123, // should only accept strings
        '', // returns false on empty
        'a.chainpoint.org' // must have protocol
      ]
      validURIs.forEach(uri => expect(network.isValidCoreURI(uri), `expected ${uri} to be validated`).to.be.true)
      invalidURIs.forEach(uri => expect(network.isValidCoreURI(uri), `expected ${uri} to be validated`).to.be.false)
    })
  })

  describe('getCores', () => {
    it('should return valid core URIs corresponding to the number requested', async () => {
      let count = 2
      let cores = await network.getCores(count)
      expect(cores).to.have.lengthOf.at.most(count)
      cores.forEach(core => expect(network.isValidCoreURI(core), `Invalid core URI returned: ${core}`).to.be.true)
    })
  })

  describe('getNodes', function() {
    this.timeout(8000)
    it('should return valid node URIs corresponding to the number requested', async () => {
      let count = 2
      let nodes = await network.getNodes(count)
      // because testing network is unstable, needs to be `at.most` because
      // some nodes will sometimes fail
      expect(nodes).to.have.lengthOf.at.most(count)
      nodes.forEach(node => expect(network.isValidNodeURI(node), `Invalid node URI returned: ${node}`).to.be.true)
    })
  })

  describe('testNodeEndpoints', () => {
    afterEach(() => {
      nock.cleanAll()
    })

    it('should skip invalid node URIs and only return valid Nodes that respond to requests', async () => {
      nodes.forEach(node => {
        nock(node)
          .get('/')
          .delay(100)
          .reply(200)
      })
      let badNodes = ['fail.com', 'http://0.0.0.3']
      let failed = []
      let tested = await network.testNodeEndpoints([...nodes, ...badNodes], failed)
      // clear failed endpoints from result
      tested = tested.filter(node => node)

      // should not have more than the known working nodes in result
      expect(failed).to.eql(badNodes)
      expect(tested).to.have.lengthOf(nodes.length)
    })

    it("should reject endpoints that don't respond after specified timeout", async () => {
      let timeoutDelay = 100
      nodes.forEach(node => {
        nock(node)
          .get('/')
          .delay(timeoutDelay)
          .reply(200)
      })

      let failed = []
      let tested = await network.testNodeEndpoints(nodes, failed, timeoutDelay - 50)
      tested = tested.filter(node => node)
      expect(tested).to.have.lengthOf(0)
      expect(failed).to.have.lengthOf(nodes.length)
    })
  })
})
