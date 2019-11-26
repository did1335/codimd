/* eslint-env browser */

// Modified from https://github.com/sparksuite/codemirror-spell-checker

import Typo from 'typo-js'
import { serverurl } from '../config'

const dictionaryDownloadUrls = {
  en_US: {
    aff: `${serverurl}/vendor/codemirror-spell-checker/en_US.aff`,
    dic: `${serverurl}/vendor/codemirror-spell-checker/en_US.dic`
  },
  de: {
    aff: 'https://rawcdn.githack.com/wooorm/dictionaries/143091715eebbbdfa0e8936e117f9182514eebe6/dictionaries/de/index.aff',
    dic: 'https://rawcdn.githack.com/wooorm/dictionaries/143091715eebbbdfa0e8936e117f9182514eebe6/dictionaries/de/index.dic'
  },
  de_AT: {
    aff: 'https://rawcdn.githack.com/wooorm/dictionaries/143091715eebbbdfa0e8936e117f9182514eebe6/dictionaries/de-AT/index.aff',
    dic: 'https://rawcdn.githack.com/wooorm/dictionaries/143091715eebbbdfa0e8936e117f9182514eebe6/dictionaries/de-AT/index.dic'
  },
  de_CH: {
    aff: 'https://rawcdn.githack.com/wooorm/dictionaries/143091715eebbbdfa0e8936e117f9182514eebe6/dictionaries/de-CH/index.aff',
    dic: 'https://rawcdn.githack.com/wooorm/dictionaries/143091715eebbbdfa0e8936e117f9182514eebe6/dictionaries/de-CH/index.dic'
  }
}

export const supportLanguages = Object.keys(dictionaryDownloadUrls)

function request (url) {
  return new Promise(resolve => {
    const req = new XMLHttpRequest()
    req.open('GET', url, true)
    req.onload = () => {
      if (req.readyState === 4 && req.status === 200) {
        resolve(req.responseText)
      }
    }
    req.send(null)
  })
}

async function runSeriesP (iterables, fn) {
  const results = []
  for (const iterable of iterables) {
    results.push(await fn(iterable))
  }
  return results
}

function mapSeriesP (iterables, fn) {
  return new Promise(resolve => {
    resolve(runSeriesP(iterables, fn))
  })
}

function createTypo (lang, affData, dicData) {
  return new Typo(lang, affData, dicData, { platform: 'any' })
}

const typoMap = new Map()

async function findOrCreateTypoInstance (lang) {
  // find existing typo instance
  let typo = typoMap.get(lang)
  if (typo) {
    return typo
  }

  const [affData, dicData] = await mapSeriesP([
    dictionaryDownloadUrls[lang].aff,
    dictionaryDownloadUrls[lang].dic
  ], request)

  typo = createTypo(lang, affData, dicData)
  typoMap.set(lang, typo)

  return typo
}

class CodeMirrorSpellChecker {
  /**
   * @param {CodeMirror} cm
   * @param {string} lang
   */
  constructor (cm, lang = 'en_US') {
    // Verify
    if (typeof cm !== 'function' || typeof cm.defineMode !== 'function') {
      console.log(
        'CodeMirror Spell Checker: You must provide an instance of CodeMirror via the option `codeMirrorInstance`'
      )
      return
    }

    this.typo = undefined
    this.defineSpellCheckerMode(cm, lang)
  }

  setDictLang (lang) {
    findOrCreateTypoInstance(lang).then(typo => { this.typo = typo })
  }

  defineSpellCheckerMode (cm, lang) {
    cm.defineMode('spell-checker', config => {
      // Load AFF/DIC data async
      this.setDictLang(lang)

      // Define what separates a word
      const regexWord = '!"#$%&()*+,-./:;<=>?@[\\]^_`{|}~ '

      // Create the overlay and such
      const overlay = {
        token: (stream) => {
          let ch = stream.peek()
          let word = ''

          if (regexWord.includes(ch)) {
            stream.next()
            return null
          }

          while ((ch = stream.peek()) != null && !regexWord.includes(ch)) {
            word += ch
            stream.next()
          }

          if (this.typo && !this.typo.check(word)) {
            return 'spell-error' // CSS class: cm-spell-error
          }

          return null
        }
      }

      const mode = cm.getMode(config, config.backdrop || 'text/plain')

      return cm.overlayMode(mode, overlay, true)
    })
  }
}

export default CodeMirrorSpellChecker