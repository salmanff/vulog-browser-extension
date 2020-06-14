// pageData.js - part of vulog

/* exported VuPageData */

function VuPageData () {
  this.props = getAllPageTags()
}

const getAllPageTags = function (options = { ignore_unknowns: true }) {
  // initiates parsedTags and gets all meta data assuming there is a document in window
  let parsedTags = {
    url: window.location.href,
    isiframe: (window.self !== window.top),
    purl: pureUrlify(window.location.href),
    hasBody: haveBody(),
    referrer: document.referrer,
    vulog_timestamp: new Date().getTime()
  }
  try {
    parsedTags.vulog_cookies = getCookies()
  } catch (e) {
    console.warn('Error getting cookie from ' + window.location.href, e)
    parsedTags.vulog_hidden_cees = true
  }

  if (parsedTags.hasBody) {
    if (document.getElementsByTagName('title') && document.getElementsByTagName('title')[0]) parsedTags.title = document.getElementsByTagName('title')[0].innerText

    const allMetas = document.getElementsByTagName('meta')

    parsedTags = addMetaTotags(parsedTags, allMetas)

    parsedTags.vuLog_height = document.getElementsByTagName('BODY')[0].scrollHeight
  }
  const [vulog3pjs, vulog3pimg] = get3rdPartyLinks()
  parsedTags.vulog_3rdParties = { js: vulog3pjs, img: vulog3pimg }

  return parsedTags
}
const EQUIV_NAMES = {
  type: 'type', // 'article', 'website' keep 1
  'og:type': 'type',

  description: 'description',
  'twitter:description': 'description', // keep 1
  Description: 'description',
  'og:description': 'description',
  'sailthru.description': 'description',

  title: 'title', // keep 1
  'twitter:title': 'title',
  'sailthru.title': 'title',
  'og:title': 'title',

  author: 'author', // keep 1
  'og:article:author': 'author',
  'article:author': 'author',
  'vr:author': 'author',
  'sailthru.author': 'author',

  keywords: 'keywords', // add all
  news_keywords: 'keywords',
  'sailthru.tags': 'keywords',
  'og:article:tag': 'keywords',

  image: 'image',
  'twitter:image:src': 'image',
  'twitter:image': 'image',
  'og:image': 'image',
  'sailthru.image.full': 'image',

  'og:site_name': 'domain_app', // Any one of these (pref: application-name) and if not the domain
  'al:android:app_name': 'domain_app',
  'al:ios:app_name': 'domain_app',
  'application-name': 'domain_app',

  'article:published_time': 'published',
  'article:published': 'published',

  'article:modified': 'modified',
  'article:modified_time': 'modified'
}
const OTHER_NAMES = [ // These are recorded
  'sailthru.date', 'date',
  'twitter:app:country', 'og:locale', 'outbrain:sourcename',
  'generator', 'Generator', 'twitter:creator', 'article:publisher',
  'sailthru.verticals', 'tbi-vertical', 'article:collection',
  'ptime', 'DISPLAYDATE', 'pdate', 'utime',
  'article:section', 'article:top-level-section',
  'thumbnail_150', 'thumbnail_150_height', 'thumbnail_150_width', 'thumbnail', 'thumbnail_height', 'thumbnail_width'
]
const IGNORE_NAMES = [
  'viewport', 'referrer', 'theme-color', 'fb:app_id',
  'apple-itunes-app', 'apple-mobile-web-app-title',
  'al:ios:app_store_id', 'al:android:package', 'al:ios:url', 'al:android:url', 'al:web:url',
  'twitter:site', 'twitter:url', 'twitter:card',
  'fb:admins', 'fb:page_id',
  'twitter:domain', 'og:url', 'twitter:app:name:iphone', 'twitter:app:id:iphone', 'twitter:app:url:iphone',
  'twitter:app:name:ipad', 'twitter:app:id:ipad', 'twitter:app:url:ipad', 'twitter:app:name:googleplay',
  'twitter:app:url:googleplay', 'twitter:app:id:googleplay',
  'google-site-verification', 'p:domain_verify', 'og:image:width', 'og:image:height',
  'msapplication-window', 'msapplication-tooltip', 'msapplication-task',
  'MobileOptimized', 'HandheldFriendly', 'keywofb:pages', 'msapplication-TileColor', 'msapplication-TileImage',
  'msapplication-square70x70logo', 'msapplication-square150x150logo', 'msapplication-wide310x150logo', 'msapplication-square310x310logo',
  'p:domain_verify', 'msvalidate pocket-site-verifcation', 'parsely-page',
  'sailthru.image.thumb', 'linkedin:owner',
  'sourceApp', 'applicationName', 'al:iphone:url', 'al:iphone:app_store_id', 'al:iphone:app_name', 'al:ipad:url',
  'al:ipad:app_store_id', 'al:ipad:app_name', 'robots', 'hdl_p', 'genre', 'articleid', 'usageTerms', 'hdl',
  'article:section-taxonomy-id', 'article:section_url', 'dat', 'lp', 'msapplication-starturl', 'cre', 'slug', 'sectionfront_jsonp', 'tone', 'byl', 'PT', 'CG', 'SCG', 'PST', 'tom',
  'edt', 'twitter:image:alt', 'article:tag', 'des', 'nyt-collection:display-name', 'nyt-collection:identifier',
  'nyt-collection:url', 'nyt-collection:uri', 'nyt-collection:tone', 'nyt-collection:type', 'CN', 'CT', 'dfp-ad-unit-path', 'dfp-amazon-enabled'
]
const addMetaTotags = function (parsedTags, allMetas, options = { ignore_unknowns: true }) {
  // assumes title url purl ... have already been added to ParsedTags and adds other meta objects
  const EMPTY_STR = ['type', 'author', 'description', 'published', 'modified', 'domain_app']
  EMPTY_STR.forEach(tag => { parsedTags[tag] = '' })
  const EMPTY_ARRS = ['keywords', 'temp_unknown_tags', 'vulog_visit_details']
  EMPTY_ARRS.forEach(tag => { parsedTags[tag] = [] })
  parsedTags.other = {}

  // console 2020 todo review all tags
  parsedTags.vulog_kword2 = renderUrlToCleanedText(parsedTags.url)
  parsedTags.vulog_kword2 = addToListAsUniqueItems(parsedTags.vulog_kword2, renderUrlToCleanedText(parsedTags.referrer))

  // get all meta data
  let mName
  if (allMetas && allMetas.length > 0) {
    for (let i = 0; i < allMetas.length; i++) {
      const m = allMetas[i]
      mName = m.getAttribute('name')
      if (!mName) mName = m.getAttribute('property')
      if (mName && m.getAttribute('content')) {
        // onsole.log('got meta '+mName+': '+m.getAttribute('content'))
        if (EQUIV_NAMES[mName]) {
          if (mName.indexOf('vulog') === 0) {
            console.warn('some body is trying to play nasty tricks on vulog. ;)')
          } else if (['keywords'].indexOf(EQUIV_NAMES[mName]) > -1) { // Add all unique words
            parsedTags[EQUIV_NAMES[mName]] = addToListAsUniqueItems(parsedTags[EQUIV_NAMES[mName]], cleanTextForEasySearch(m.getAttribute('content')).split(' '))
          } else if (EQUIV_NAMES[mName] === 'domain_app') {
            parsedTags.domain_app = (mName === 'application-name' || !parsedTags.domain_app) ? m.getAttribute('content') : parsedTags.domain_app
          } else if (EQUIV_NAMES[mName] === mName) {
            parsedTags[mName] = m.getAttribute('content')
          } else if (!parsedTags[EQUIV_NAMES[mName]]) {
            parsedTags[EQUIV_NAMES[mName]] = m.getAttribute('content')
          }
          parsedTags.vulog_kword2 = addToListAsUniqueItems(parsedTags.vulog_kword2, cleanTextForEasySearch(m.getAttribute('content')).split(' '))
        } else if (IGNORE_NAMES.indexOf(mName) < 0 && !options.ignore_unknowns) {
          parsedTags.other[mName.split('.').join('_')] = m.getAttribute('content')
          if (OTHER_NAMES.indexOf(mName) < 0) parsedTags.temp_unknown_tags.push(mName)
        }
      }
    }
  }

  parsedTags.domain_app = parsedTags.domain_app ? (parsedTags.domain_app.toLowerCase()) : (domainAppFromUrl(parsedTags.url))
  EMPTY_STR.forEach(tag => { if (parsedTags[tag] === '') delete parsedTags[tag] })
  EMPTY_ARRS.forEach(tag => { if (parsedTags[tag].length === 0) delete parsedTags[tag] })

  if (!parsedTags.isiframe) { // ie is masterpage
    parsedTags.fj_modified_locally = new Date().getTime()
    parsedTags.vulog_sub_pages = []
  }
  return parsedTags
}

// Utility functions
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
const pureUrlify = function (aUrl) {
  if (!aUrl) return null
  if (aUrl.indexOf('#') > 0) aUrl = aUrl.slice(0, aUrl.indexOf('#'))
  if (aUrl.slice(-1) === '/') { aUrl = aUrl.slice(0, -1) }
  return aUrl.trim()
}

const corePurl = function (aUrl) {
  aUrl = pureUrlify(aUrl)
  return aUrl.split('?')[0]
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
const renderUrlToCleanedText = function (aUrl) {
  return addToListAsUniqueItems([], cleanTextForEasySearch(aUrl),
    function (x) { return ((x + '').length === 1) ? '' : x })
  // words in title url query (not www) author description url
}
const haveBody = function () {
  return Boolean(document.getElementsByTagName('BODY') && document.getElementsByTagName('BODY')[0] && document.getElementsByTagName('BODY')[0].scrollHeight)
}
const getCookies = function () {
  var cookies = []
  const carr = document.cookie.split('; ')
  carr.forEach(oneC => { if (oneC) cookies.push(oneC.split('=')[0]) })
  // old: let splits = oneC.split('='); cookies[splits[0].replace(/\./g, '_')] = splits[1]
  return cookies
}
const get3rdPartyLinks = function () {
  var vulog3pjs = []
  var vulog3pimg = []
  var links = document.all
  for (var i = 0; i < links.length; i++) {
    if (links[i].src && startsWith(links[i].src, 'http') && toplevel(links[i].src) !== toplevel(window.location.href)) {
      const isJs = (endsWith(corePurl(links[i].src), 'js'))
      if (isJs) { vulog3pjs.push(links[i].src) } else { vulog3pimg.push(links[i].src) }
    }
  }
  return [vulog3pjs, vulog3pimg]
}

const startsWith = function (longWord, portion) {
  return (typeof longWord === 'string' && longWord.indexOf(portion) === 0)
}
const removeStart = function (longWord, portion) {
  if (startsWith(longWord, portion)) { return (longWord.slice(portion.length)) } else { return longWord }
}
const endsWith = function (longWord, portion) {
  return (longWord.indexOf(portion) === (longWord.length - portion.length))
}
const hostFromUrl = function (url) {
  url = removeStart(url, 'https://')
  url = removeStart(url, 'http://')
  url = url.substring(0, url.indexOf('/'))
  return url
}
const toplevel = function (url) {
  url = hostFromUrl(url)
  const parts = url.split('.')
  return parts[parts.length - 2] + '.' + parts[parts.length - 1]
}
