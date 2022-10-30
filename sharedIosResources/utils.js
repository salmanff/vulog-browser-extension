// Utility functions
// changed 2022-04
// Compare iosApp vs ChromeExtension - verified 2022-07-05

const pureUrlify = function (aUrl) {
  if (!aUrl) return null
  if (aUrl.indexOf('#') > 0) aUrl = aUrl.slice(0, aUrl.indexOf('#'))
  if (aUrl.slice(-1) === '/') { aUrl = aUrl.slice(0, -1) }
  return aUrl.trim()
}

const domainAppFromUrl = function (url) {
  if (!url) return url
  let temp = url.split('://')
  if (temp.length > 1) temp.shift()
  temp = temp[0].split('/')[0]
  temp = temp.split('.')
  while (temp.length > 2) { temp.shift() }
  temp = temp.join('.')
  return temp
}

const addToListAsUniqueItems = function (aList, items, transform) {
  // takes two lists..  integrates items into aList without duplicates
  // if items are strins or numbers, they are treated as a one item list
  if (!aList) aList = []
  if (!items) return aList
  if (typeof items === 'string' || !isNaN(items)) items = [items]
  if (!Array.isArray(items)) { throw new Error('items need to be a list') }
  if (transform) items = items.map(transform)
  items.forEach(function (anItem) { if (anItem && anItem !== ' ' && aList.indexOf(anItem) < 0 && anItem.length > 0) aList.push(anItem) })
  return aList
}
const removeFromlist = function (aList, item, transform) {
  // removes item from a list and returns it
  if (!aList) aList = []
  if (!item) return aList
  if (typeof item !== 'string' && isNaN(item)) throw new Error('need to pass string or number in removeFromlist')
  if (transform) item = transform(item)
  const idx = aList.indexOf(item)
  if (idx > -1) aList.splice(idx, 1)
  return aList
}
const cleanTextForEasySearch = function (aText) {
  // onsole.log('cleaning '+aText)
  const seps = ['.', '/', '+', ':', '@', '#', '-', '_', '|', '?', ', ', '…', '&', '=']
  if (Array.isArray(aText)) aText = aText.join(' ')
  aText = aText.replace(/é/g, 'e').replace(/è/g, 'e').replace(/ö/g, 'o').replace(/à/g, 'a').replace(/ä/g, 'a').replace(/%/g, 'à')
  aText = decodeURIComponent(aText + '')
  aText = aText.replace(/à/g, '%')
  seps.forEach(function (aSep) { aText = aText.split(aSep).join(' ') })
  return aText.toLowerCase()
}
const hostFromUrl = function (url) {
  url = removeStart(url, 'https://')
  url = removeStart(url, 'http://')
  url = url.substring(0, url.indexOf('/'))
  return url
}
const startsWith = function (longWord, portion) {
  return (typeof longWord === 'string' && longWord.indexOf(portion) === 0)
}
const endsWith = function (longWord, portion) {
  return (longWord.indexOf(portion) === (longWord.length - portion.length))
}
const removeStart = function (longWord, portion) {
  if (startsWith(longWord, portion)) { return (longWord.slice(portion.length)) } else { return longWord }
}

// https://stackoverflow.com/questions/9038625/detect-if-device-is-ios
const isIos = function () {
//  console.warn("TEMP -> SIMULATING IOS")
//  return true
  return [
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator',
    'iPad',
    'iPhone',
    'iPod'
  ].includes(navigator.platform) ||
  // iPad on iOS 13 detection
  (navigator.userAgent.includes('Mac') && 'ontouchend' in document)
}

const COLOR_MAP = {
  green: 'yellowgreen',
  yellow: 'yellow',
  blue: 'lightskyblue',
  pink: 'lightpink',
  grey: 'lightgrey',
  orange: 'lightsalmon'
  // 'u' : 'underline'
}
const mapColor = function (hcolor) {
  return COLOR_MAP[hcolor] || hcolor
}

const isiframe = function () {
  return (window.self !== window.top)
}
const idOf = function (mark) {
  if (!mark) return null
  if (mark._id) return mark._id
  if (mark.fj_local_temp_unique_id) return mark.fj_local_temp_unique_id
  return null
}
const newHlightIdentifier = function() {
  return new Date().getTime() + '-' + Math.round(Math.random() * 1000, 0)
}
const pasteAsText = function (evt) {
  // for more details and improvements: stackoverflow.com/questions/12027137/javascript-trick-for-paste-as-plain-text-in-execcommand
  evt.preventDefault()
  var text = evt.clipboardData.getData('text/plain"')
  document.execCommand('insertHTML', false, text)
}
const utilsDummy = false // for eslint exports

// General Functions
const overlayUtils = {
  makeEl: function (type, id, classNameOrStyle, text) {
    const el = document.createElement(type)
    if (id) el.id = id
    if (typeof classNameOrStyle === 'string') {
      if (classNameOrStyle) el.className = classNameOrStyle
    } else if (classNameOrStyle !== null && typeof classNameOrStyle === 'object') {
      for (const [key, value] of Object.entries(classNameOrStyle)) {
        el.style[key] = value
      }
    }
    if (text) el.innerText = text
    return el
  },
  smartDate: function (dateNum) {
    const date = new Date(dateNum)
    const today = new Date()
    if (today.toDateString() === date.toDateString()) {
      return date.toTimeString().split(' ')[0].split(':')[0] + ':' + date.toTimeString().split(' ')[0].split(':')[1]
    } else {
      return date.toDateString()
    }
  },
  setCookieAndReload: function (type) {
    // nb not used on safari yet
    document.cookie = 'vulog_show=' + type + '; expires= ' + (new Date(new Date().getTime() + 15000)).toUTCString()
    window.location.reload()
  },
  mainColorOf: function (endColor) {
    let hColor
    for (const [key, value] of Object.entries(COLOR_MAP)) {
      if (value === endColor) hColor = key
    }
    return hColor
  }
}


if (utilsDummy) { // exported vars
  isIos()
  endsWith()
  domainAppFromUrl()
  addToListAsUniqueItems()
  cleanTextForEasySearch()
  hostFromUrl()
  mapColor()
  isiframe()
  idOf(1)
  newHlightIdentifier()
  pasteAsText()
  // console.log(isAppInjectedScript)
}
