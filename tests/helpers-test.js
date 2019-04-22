import { helpers } from '../lib/utils'
import { expect } from 'chai'
import fs from 'bfile'
import crypto from 'crypto'
import path from 'path'

describe('helpers utilities', () => {
  let testPath
  before(async () => {
    testPath = '/tmp/test_hashes'
    await fs.mkdirp(testPath)
  })

  after(async () => {
    await fs.remove(testPath)
  })
  describe('isHex', () => {
    it('should test for valid hexadecimal strings', () => {
      const buf = new Buffer.from([149, 236, 195, 128, 175, 233, 17, 228, 155, 108, 117, 27, 102, 221, 84, 30], 'hex')
      const hex = buf.toString('hex')
      expect(helpers.isHex(hex)).to.be.true
      expect(helpers.isHex('foo bar')).to.be.false
    })
  })

  describe('isValidUUID', () => {
    it('should validate v1 UUIDs', () => {
      let v1 = '23d57c30-afe7-11e4-ab7d-12e3f512a338'
      let v4 = '09bb1d8c-4965-4788-94f7-31b151eaba4e'

      expect(helpers.isValidUUID(v1)).to.be.true
      expect(helpers.isValidUUID(v4)).to.be.false
    })
  })

  describe('isSecureOrigin', () => {
    it('should only validate https locations', () => {
      global.window = {
        location: {
          protocol: 'https:'
        }
      }
      expect(helpers.isSecureOrigin()).to.be.true
      global.window.location.protocol = 'http:'
      expect(helpers.isSecureOrigin()).to.be.false
    })
  })

  describe('sha256FileByPath', () => {
    it('should create a sha256 hash of the contents of a file', async () => {
      let text = 'I am some test content'
      let hash = crypto
        .createHash('sha256')
        .update(text, 'utf8')
        .digest()
      let filePath = path.resolve(testPath, 'sha256FileByPath')
      await fs.writeFile(filePath, text)
      let file = await helpers.sha256FileByPath(filePath)

      // testing that the hash that is returned from the contents of the file
      // are the same as the hash we made of the content before adding to file
      expect(file.hash.toString('hex')).to.equal(hash.toString('hex'))
    })
  })

  describe('fetchEndpoints', () => {
    it('should return all responses from designated endpoints', () => {
      throw new Error('Test not implemented!')
    })
    it('should should only run for GET and POST requests', () => {
      throw new Error('Test not implemented!')
    })
  })

  describe('validateHashesArg', () => {
    it('should reject invalid arguments', () => {
      let { validateHashesArg } = helpers
      let testFns = []
      let nonArray = () => validateHashesArg('not an array!')
      let emptyArray = () => validateHashesArg([])
      let bigArray = () => validateHashesArg(Array(251))
      let withValidator = () => validateHashesArg([1], item => item > 5)

      testFns.push(nonArray, emptyArray, bigArray, withValidator)
      testFns.forEach(test =>
        expect(test, `invoking ${test.name} should have thrown but passed the validation`).to.throw()
      )
    })
  })

  describe('validateUrisArg', () => {
    it('should reject invalid uri args', () => {
      let { validateUrisArg } = helpers
      let testFns = []
      let nonArray = () => validateUrisArg('not an array!')
      let bigArray = () => validateUrisArg(Array(6))
      testFns.push(nonArray, bigArray)
      testFns.forEach(test =>
        expect(test, `invoking ${test.name} should have thrown but passed the validation`).to.throw()
      )
    })
  })

  describe('getFileHashes', () => {
    let content1, content2, file1, file2
    before(async () => {
      content1 = 'I am some test content that will be added to the first file'
      content2 = 'I am some test content that will be added to the second file'
      file1 = path.resolve(testPath, 'file1')
      file2 = path.resolve(testPath, 'file2')
      await fs.writeFile(file1, content1)
      await fs.writeFile(file2, content2)
    })

    after(async () => {
      await fs.remove(file1)
      await fs.remove(file2)
    })
    it('should throw if paths arg is invalid', async () => {
      let { getFileHashes } = helpers
      let filePath = path.resolve(testPath, 'foobar.txt')
      let firstError = false
      let secondError = false

      try {
        await getFileHashes('foobar.txt')
      } catch (e) {
        if (e) firstError = true
      }

      try {
        await getFileHashes([filePath])
      } catch (e) {
        if (e) secondError = true
      }
      expect(firstError).to.be.true
      expect(secondError).to.be.true
    })
    it('should get hashes from the contents of multiple files', async () => {
      let hashObjs = await helpers.getFileHashes([file1, file2])
      let hash1 = crypto
        .createHash('sha256')
        .update(content1, 'utf8')
        .digest()
      let hash2 = crypto
        .createHash('sha256')
        .update(content2, 'utf8')
        .digest()

      expect(hash1.toString('hex')).to.equal(hashObjs[0].hash.toString('hex'))
      expect(hash2.toString('hex')).to.equal(hashObjs[1].hash.toString('hex'))
    })
  })
})
