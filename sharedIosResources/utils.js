// Utility functions
// changed 2022-04
// Compare iosApp vs ChromeExtension - verified 2022-07-05
/* global chrome,freezrMeta */ // from system
/* global COLOR_MAP, HIGHLIGHT_CLASS */ // from overlay_constants
/* global getMarkFromVstateList, getAllMessagesAndUpdateStateteFor */ // from overlay
/* global expandSection, collapseSection, smallSpinner */ // from drawUtils
/* global vState  */ // from view

const MCSS = {
  LIGHT_GREY: 'rgb(151, 156, 160)',
  DARK_GREY: 'darkgrey',
  RED: 'indianred',
  PURPLE: '#680368',
  GREEN: '#057d47',
  YGREENBG: '#79ac12'
}

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
const convertListerParamsToDbQuery = function (queryParams, q) {
  if (queryParams?.starFilters && queryParams?.starFilters.length > 0) {
    q.$and = []
    if (queryParams?.starFilters.indexOf('vHighlights') > -1) {
      q.$and.push({ vHighlights: { $not: { $size: 0 } } })
      q.$and.push({ vHighlights: { $exists: true } })
    }
    if (queryParams?.starFilters.indexOf('vNote') > -1) {
      q.$and.push({ vNote: { $ne: '' } })
      q.$and.push({ vNote: { $exists: true } })
    }
    if (queryParams?.starFilters.indexOf('inbox') > -1) q.$and.push({ vStars: 'inbox' })
    if (queryParams?.starFilters.indexOf('star') > -1) q.$and.push({ vStars: 'star' })
  }
  if (queryParams?.words) {
    if (!q.$and) q.$and = []
    const words = queryParams?.words.split(' ')
    const safeRegex = function (word) {
      if (!word || typeof word !== 'string') return ''
      const specials = ['\\', '^', '$', '.', '|', '?', '*', '+', '(', ')', '[', ']', '{', '}']
      specials.forEach(sp => { word = word.split(sp).join('') })
      return word.toLowerCase()
    }
    words.forEach(word => {
      // https://stackoverflow.com/questions/10610131/checking-if-a-field-contains-a-string
      if (word && word.length > 1 && word.indexOf('!') !== 0) q.$and.push({ vSearchString: { $regex: safeRegex(word) } }) // ({ vSearchString: word.toLowerCase().trim() })
      // https://stackoverflow.com/questions/406230/regular-expression-to-match-a-line-that-doesnt-contain-a-word
      if (word && word.length > 1 && word.indexOf('!') === 0) q.$and.push({ vSearchString: { $regex: '^((?!' + safeRegex(word.slice(1)) + ').)*$' } })
    })
  }
  // DO DATES
  if (q.$and && q.$and.length === 1) {
    // .. remove and
  }

  return q
}

const assignSenderIdAndHostFromFreezrMeta = (item) => {
  if (!item.sender_id) {
    item.sender_id = freezrMeta?.userId
    item.sender_host = freezrMeta?.serverAddress
  }
  return item
}
const assignDateTextFromCreatedDate = (item) => {
  item.dateText = overlayUtils.dateOrTime(item.vCreated)
  return item
}

const LOG_FIELDS_USED_IN_MARKS = ['url', 'purl', 'description', 'domainApp', 'title', 'author', 'image', 'keywords', 'type', 'vulog_favIconUrl', 'vulog_max_scroll', 'vSearchString', 'vCreated', 'referrer']
const convertLogToMark = function (logtomark, options) {
  if (!logtomark) return null
  const newmark = { vulog_mark_tags: [], vHighlights: [], vNote: '', vStars: [] }
  // todo vulog_max_scroll to be replaced by last scroll etc
  LOG_FIELDS_USED_IN_MARKS.forEach((item) => {
    if (logtomark[item]) {
      newmark[item] = JSON.parse(JSON.stringify(logtomark[item]))
    }
  })
  // if (!logtomark.url && logtomark.linkUrl) newmark.url = logtomark.linkUrl
  // if (!logtomark.referrer && logtomark.referrerUrl) newmark.referrer = logtomark.referrerUrl
  if (!newmark.purl) newmark.purl = pureUrlify(newmark.url)
  if (!newmark.domainApp) newmark.domainApp = domainAppFromUrl(newmark.purl)

  newmark.vSource = options?.source || 'chrome_browser'
  newmark.vNote = options?.defaultHashTag ? ('#' + options.defaultHashTag) : null
  newmark.vStars = []
  newmark.vHighlights = []
  newmark.vComments = []

  newmark.vCreated = new Date().getTime()

  if (!newmark.url) newmark.url = newmark.purl

  if (!newmark.url) throw Error('trying to convert log to mark with nopurl ', logtomark)
  return newmark
}

const convertMarkToSharable = function (mark, options) {
  // options: excludeHlights, excludeHlightComments
  if (!mark) return null
  const newmark = { vHighlights: [], vNote: '', vStars: [] }
  const ToTransfer = ['url', 'purl', 'description', 'domainApp', 'title', 'author', 'image', 'keywords', 'vulog_favIconUrl']
  ToTransfer.forEach((item) => {
    if (mark[item]) {
      newmark[item] = JSON.parse(JSON.stringify(mark[item]))
    }
  })

  if (!options?.excludeHlights) {
    mark.vHighlights.forEach((hl) => {
      hl = assignSenderIdAndHostFromFreezrMeta(JSON.parse(JSON.stringify(hl)))

      if (options?.excludeHlightComments || !hl.vComments || hl.vComments?.length === 0) {
        hl.vComments = []
      } else { //(hl.vComments?.length > 0) 
        const vComments = JSON.parse(JSON.stringify(hl.vComments))
        hl.vComments = []
        vComments.forEach((vComment) => {
          highlight.vComments = JSON.parse(JSON.stringify(highlight.vComments))
            .filter(isOwnComment)
            .map(assignSenderIdAndHostFromFreezrMeta)
            .map(assignDateTextFromCreatedDate)
          // vComment.dateText = overlayUtils.dateOrTime(vComment.vCreated)
          // if (isOwnComment(vComment)) {
          //   if (!vComment.sender_id) {
          //     vComment.sender_id = freezrMeta?.userId
          //     vComment.sender_host = freezrMeta?.serverAddress
          //   }
          //   hl.vComments.push(vComment)
          // }
        })
      }
      newmark.vHighlights.push(hl)
    })
  }
  if (!newmark.purl) newmark.purl = pureUrlify(newmark.url)
  if (!newmark.url) newmark.url = newmark.purl
  if (!newmark.domainApp) newmark.domainApp = domainAppFromUrl(newmark.purl)

  newmark.vCreated = new Date().getTime()

  if (!newmark.url) throw Error('trying to mark to msg with nopurl ', newmark)
  return newmark
}
const convertDownloadedMessageToRecord = function (downloadedMessage) {
  // therse are the original format messages as kept on ceps.dev...
  if (!downloadedMessage || !downloadedMessage.record) return null
  downloadedMessage.record._id = 'tempId' + downloadedMessage._id
  downloadedMessage.record.vCreated = downloadedMessage._date_created

  if (!downloadedMessage.record.vComments) downloadedMessage.record.vComments = [] // should not happen
  if (downloadedMessage.record.vNote) { // legacy- to remove
    const vComment = vCommentFromOldVNoteMessage(downloadedMessage)
    downloadedMessage.record.vComments.push(vComment)
  }
  downloadedMessage.record.vHighlights = addMissingSendersToHLights(downloadedMessage.record.vHighlights, downloadedMessage)
  if (downloadedMessage.record.vComments.length === 1 && downloadedMessage.record.vComments[0].text === '' && downloadedMessage.record.vHighlights.length > 0) {
    downloadedMessage.record.vComments[0].hLightsCopy = JSON.parse(JSON.stringify(downloadedMessage.record.vHighlights))
  } else if (downloadedMessage.record.vComments.length === 0 && downloadedMessage.record.vHighlights.length > 0) {
    downloadedMessage.record.vComments.push({
      sender_id: downloadedMessage.sender_id,
      sender_host: downloadedMessage.sender_host,
      hLightsCopy: JSON.parse(JSON.stringify(downloadedMessage.record.vHighlights))
    })
  }

  downloadedMessage.record.vCreated = downloadedMessage.vCreated || downloadedMessage._date_modified
  downloadedMessage.record.vLatestMsg = downloadedMessage.vCreated || downloadedMessage._date_modified

  return downloadedMessage.record // convertMessageToRecord(downloadedMessage.record)
}
// const convertMessageToRecord = function (record) {
//   if (!record.vComments) record.vComments = []

//   // todo should sort vComments and remove non comments
//   return record
// }
const vCommentFromOldVNoteMessage = function (messageItem) {
  const vComment = {
    recipient_host: messageItem.recipient_host,
    recipient_id: messageItem.recipient_id,
    sender_host: messageItem.sender_host,
    sender_id: messageItem.sender_id,
    text: messageItem.record.vNote,
    vCreated: messageItem._date_modified
  }
  return vComment
}
const mergeMessageRecords = function (masterRecord, MessageToMerge) {
  // if (!masterRecord.vComments) masterRecord.vComments = [] // should not happen
  if (!MessageToMerge?.record) {
    console.error('getting message with no record')
    return masterRecord
  }

  if (!MessageToMerge.record.vComments) MessageToMerge.record.vComments = []
  if (MessageToMerge.record.vHighlights && MessageToMerge.record.vHighlights.length > 0) {
    MessageToMerge.record.vHighlights = addMissingSendersToHLights(MessageToMerge.record.vHighlights, MessageToMerge)
    if (MessageToMerge.record.vComments.length === 1 && MessageToMerge.record.vComments[0].text === '' && MessageToMerge.record.vHighlights.length > 0) {
      MessageToMerge.record.vComments[0].hLightsCopy = JSON.parse(JSON.stringify(MessageToMerge.record.vHighlights))
    } else if (MessageToMerge.record.vComments.length === 0 && MessageToMerge.record.vHighlights.length > 0) {
      MessageToMerge.record.vComments.push({
        sender_id: MessageToMerge.sender_id,
        sender_host: MessageToMerge.sender_host,
        hLightsCopy: JSON.parse(JSON.stringify(MessageToMerge.record.vHighlights)),
        vCreated: MessageToMerge.vCreated
      })
    }
    MessageToMerge.record.vHighlights.forEach(hLight => {
      if (hLight.vComments && hLight.vComments.length > 0) {
        hLight.vComments.forEach(hLightComment => {
          const modifiedComm = JSON.parse(JSON.stringify(hLightComment))
          modifiedComm.hLightCopy = hLight
          MessageToMerge.record.vComments.push(modifiedComm)
        })
      }
    })
  }
  if (MessageToMerge.record.vNote) { // old legacy - remove
    const vComment = vCommentFromOldVNoteMessage(MessageToMerge)
    MessageToMerge.record.vComments.push(vComment)
  }
  if (!masterRecord.vComments) masterRecord.vComments = []
  masterRecord.vComments = [...masterRecord.vComments, ...MessageToMerge.record.vComments]

  const now = new Date().getTime()
  masterRecord.vCreated = Math.min(masterRecord.vCreated || now, masterRecord.vCreated || now, MessageToMerge._date_modified || now)
  masterRecord.vLatestMsg = Math.max(masterRecord.vLatestMsg || 0, masterRecord.vCreate || 0, MessageToMerge._date_modified || 0)

  // masterRecord.vHighlights = [...masterRecord.vHighlights, ...MessageToMerge.record.vHighlights]
  masterRecord.vHighlights = mergeHighlightsRemovingDuplicates(masterRecord.vHighlights, MessageToMerge.record.vHighlights)

  // todo merge unique highlights and unique vComments
  // if (MessageToMerge.record.vComments) {
  //   MessageToMerge.record.vComments.forEach(vComment => {
  //     if (masterRecord.vComments.indexOf(vComment) < 0) masterRecord.vComments.push(vComment)
  //   })
  // }
  return masterRecord
}
const mergeHighlightsRemovingDuplicates = function (list1, list2) {
  if (!list1) return list2
  if (!list2) return list1
  const fullMerge = [...list1, ...list2]
  const jLights = {}
  fullMerge.forEach(hLight => {
    if (!jLights[hLight.id]) {
      jLights[hLight.id] = hLight
    } else {
      jLights[hLight.id].vComments = mergeHlightComments(jLights[hLight.id].vComments, hLight.vComments)
    }
  })

  const cleanedList = []
  for (const [id, val] of Object.entries(jLights)) {
    cleanedList.push(val)
  }
  return cleanedList.sort(sortBycreatedDate) // .reverse()
}
const mergeHlightComments = function (list1, list2) {
  if (!list1 || list1.length === 0) return list2 || []
  if (!list2 || list2.length === 0) return list1 || []
  list2.forEach(vCom2 => {
    const existing = list1.find(com1 => (com1.text === vCom2.text && com1.vCreated === vCom2.vCreated))
    if (!existing) list1.push(vCom2)
  })
  return list1.sort(sortBycreatedDate) // .reverse()
}
const addMissingSendersToHLights = function (vHighlights, messageItem) {
  if (!vHighlights || vHighlights.length === 0) return []

  vHighlights.forEach(vHighlight => {
    // if (!vHighlight.vCreated || vHighlight.vComments.length === 0) vHighlight.vComments = [{ vCreated: messageItem._date_modified }]
    if (!vHighlight.sender_host) vHighlight.sender_host = messageItem.sender_host
    if (!vHighlight.sender_id) vHighlight.sender_id = messageItem.sender_id
    if (!vHighlight.vComments) vHighlight.vComments = []
  })
  return vHighlights
}
const isOwnComment = function (vComment) {
  return ((vComment?.sender_id && vComment?.sender_id === freezrMeta?.userId && vComment?.sender_host && vComment?.sender_host === freezrMeta?.serverAddress) ||
    (!vComment?.sender_id && !vComment?.sender_host && !vComment?.recipient_id && !vComment?.recipient_host))
  // temp for debug
}

const markMsgHlightsAsMarked = function (markHlights, msgHlights) {
  if (!msgHlights || msgHlights.length === 0) return []

  msgHlights = JSON.parse(JSON.stringify(msgHlights))
  if (!markHlights || markHlights.length === 0) return msgHlights

  msgHlights.forEach(msgHlight => {
    if (!msgHlight.vComments) console.warn('Should not get any hlights with no vcomments ', msgHlight)
    if (!msgHlight.vComments) msgHlight.vComments = []
    const existingIdx = markHlights.findIndex((markHLight) => markHLight.id === msgHlight.id)
    if (existingIdx >= 0) msgHlight._isMarked = true
  })

  return msgHlights
}
const resetVulogKeyWords = function (logOrMark) { // for vSearchString
  let words = []
  // if val is object need to get into it... eg highlights
  const ADD_FIELDS = ['url', 'title', 'description', 'vNote', 'author', 'referrer', 'redirectOrigin']
  ADD_FIELDS.forEach(field => {
    words = addToListAsUniqueItems(words, logOrMark[field])
  })

  if (logOrMark.vComments && logOrMark.vComments.length > 0) {
    logOrMark.vComments.forEach(aComment => {
      words = addToListAsUniqueItems(words, aComment.text)
      words = addToListAsUniqueItems(words, aComment.creator)
      words = addToListAsUniqueItems(words, aComment.recipient_id)
      words = addToListAsUniqueItems(words, aComment.sender_id)
      // todo - add host??
    })
  }

  if (logOrMark.vHighlights && logOrMark.vHighlights.length > 0) {
    logOrMark.vHighlights.forEach(aHigh => {
      words = addToListAsUniqueItems(words, aHigh.string)
      words = addToListAsUniqueItems(words, aHigh.vNote)

      if (aHigh.vComments && aHigh.vComments.length > 0) {
        aHigh.vComments.forEach(aComment => {
          words = addToListAsUniqueItems(words, aComment.text)
          words = addToListAsUniqueItems(words, aComment.creator)
          words = addToListAsUniqueItems(words, aComment.recipient_id)
          words = addToListAsUniqueItems(words, aComment.sender_id)
          // todo - add host??
        })
      }
    })
  }
  return ' ' + cleanTextForEasySearch(words.join(' ')) + ' ' // adding spaces so in future full words can also be found by seaerch for " word "
}
const addToListAsUniqueItems = function (aList, items, transform) {
  // takes two lists..  integrates items into aList without duplicates
  // if items are strins or numbers, they are treated as a one item list
  if (!aList) aList = []
  if (!items) return aList
  if (!isNaN(items)) items = items + ''
  if (typeof items === 'string' || !isNaN(items)) items = items.split(' ')
  if (!Array.isArray(items)) { throw new Error('items need to be a list') }
  if (transform) items = items.map(transform)
  items.forEach(function (anItem) { if (anItem && anItem !== ' ' && aList.indexOf(anItem) < 0 && anItem.length > 0) aList.push(anItem) })
  return aList
}
const cleanTextForEasySearch = function (aText) {
  // onsole.log('cleaning '+aText)
  if (Array.isArray(aText)) aText = aText.join(' ')

  try {
    aText = decodeURIComponent(aText + '')
  } catch (e) {
    console.warn('could not decode uri ', { e, aText }) // nb need to remove whtespace and line breaks...
  }
  aText = aText.replace(/é/g, 'e').replace(/è/g, 'e').replace(/ö/g, 'o').replace(/à/g, 'a').replace(/ä/g, 'a')
  // .replace(/%/g, 'à')
  // aText = aText.replace(/à/g, '%')

  const seps = ['\n', '\\', '.', '/', '“', '”', "'", '’', '+', ':', ';', '-', '_', '|', '?', ',', '…', '&', '=', '(', ')', '{', '}', '[', ']']
  seps.forEach(function (aSep) { aText = aText.split(aSep).join(' ') })
  const parts = aText.split(' ')

  aText = ' '
  parts.forEach(part => { if (part.length > 1) aText += (part + ' ') })
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
  const platform = navigator?.userAgent || navigator?.platform || 'unknown'
  return (/iPhone|iPod|iPad/.test(platform)) ||
    // iPad on iOS 13 detection
    (navigator.userAgent.includes('Mac') && 'ontouchend' in document)
}

const mapColor = function (hcolor) {
  return COLOR_MAP[hcolor] || hcolor
}

const newHlightIdentifier = function () {
  return new Date().getTime() + '-' + Math.round(Math.random() * 1000, 0)
}
const pasteAsText = function (evt) {
  // https://javascript.plainenglish.io/how-to-copy-paste-text-into-clipboard-using-javascript-1bb5f96325e8#:~:text=clipboard%20to%20get%20access%20to,Clipboard%20to%20avoid%20Promise%20rejections.
  evt.preventDefault()
  navigator.clipboard
    .readText()
    .then(
      cliptext => {
        const position = getCursorPosition(evt.target)
        evt.target.innerText = evt.target.innerText.slice(0, position) + cliptext + evt.target.innerText.slice(position)
        moveCursorToEnd(evt.target)
      },
      err => console.warn('pasteAsText:', { err })
    )
}
const moveCursorToEnd = (contentEle) => { // if pos is left out, it moves to end
  // https://phuoc.ng/collection/html-dom/move-the-cursor-to-the-end-of-a-content-editable-element/s
  const range = document.createRange()
  const selection = window.getSelection()
  range.setStart(contentEle, (contentEle.childNodes.length)) // contentEle?.childNodes?.length || 
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}
const getCursorPosition = (contentEle) => {
  // https://phuoc.ng/collection/html-dom/get-or-set-the-cursor-position-in-a-content-editable-element/
  const selection = window.getSelection()
  const range = selection.getRangeAt(0)
  const clonedRange = range.cloneRange()
  clonedRange.selectNodeContents(contentEle)
  clonedRange.setEnd(range.endContainer, range.endOffset)

  const cursorPosition = clonedRange.toString().length
  return cursorPosition
}

/*
------ overlay utils -------
*/
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
      return 'today ' + date.toTimeString().split(' ')[0].split(':')[0] + ':' + date.toTimeString().split(' ')[0].split(':')[1]
    } else {
      return date.toDateString()
    }
  },
  mainColorOf: function (endColor) {
    let hColor
    for (const [key, value] of Object.entries(COLOR_MAP)) {
      if (value === endColor) hColor = key
    }
    return hColor
  },
  hasMarks: function (mark) {
    if (mark.vStars && mark.vStars.length > 0) return true
    if (mark.vHighlights && mark.vHighlights.length > 0) return true
    if (mark.vNote && mark.vNote !== '') return true
    return false
  },

  drawstars: function (mark, options = {}) {
    // options: defaultHashtag, notesDivForHashtag, logToConvert
    // showBookmark: bool, drawTrash: bool, trashFloatHide bool, markOnBackEnd: function
    // if (!mark && !options?.logToConvert) console.warn('cannot draw stars without mark or log: ', { mark, options })
    const purl = mark?.purl || options?.purl || options?.log?.purl
    if (!mark & !options?.log) console.warn('no mark or log in drawstars ', { options })
    if (!mark) mark = convertLogToMark(options?.log || { purl })
    const stardiv = document.createElement('div')
    const MAIN_STARS = ['bookmark', 'star', 'inbox', 'trash']
    const addDefaultHashTag = (options?.defaultHashTag && options.notesDivForHashtag && options.notesDivForHashtag.textContent === '')
      ? ('#' + options?.defaultHashTag)
      : ''
    options.addDefaultHashTag = addDefaultHashTag
    // if (!options.markOnBackEnd) options.markOnBackEnd = markOnBackEndForExtenstion

    MAIN_STARS.forEach(aStar => {
      if (aStar === 'trash' && !options.drawTrash) {
        // doNothing
      } else {
        stardiv.appendChild(overlayUtils.drawstar(aStar, mark, options))
        // var adiv = this.makeEl('div', null, 'vulog_overlay_stars')
        // adiv.innerContent = ' '
        // let chosenEnding = ''
        // switch (aStar) {
        //   case 'trash':
        //     chosenEnding = ''
        //     break
        //   case 'inbox':
        //   case 'star':
        //     chosenEnding = mark?.vStars && mark.vStars.includes(aStar) ? '_ch' : '_nc'
        //     break
        //   case 'bookmark':
        //     chosenEnding = isMarked ? '_ch' : '_nc'
        //     break
        //   default:
        //     chosenEnding = '?'
        //     break
        // }
        // adiv.className = 'vulog_overlay_' + aStar + chosenEnding
        // if (aStar === 'trash' && options.trashFloatHide) {
        //   adiv.style.display = 'none'
        //   adiv.style.float = 'left'
        // }
        // adiv.onclick = async function (e) {
        //   const thediv = e.target
        //   const parts = e.target.className.split('_')
        //   const theStar = parts[2]
        //   const starWasChosen = (parts.length > 3 && parts[3] === 'ch')
        //   thediv.className = 'vulog_overlay_spiral'
        //   try {
        //     const response = await options.markOnBackEnd(mark, options, theStar, starWasChosen, addDefaultHashTag)
        //     if (response && response.success && theStar === 'trash') {
        //       // remove item - this is handled at the markOnBackEnd level
        //     } else if (response && response.success) {
        //       thediv.className = ('vulog_overlay_' + theStar + (starWasChosen ? '_nc' : '_ch'))
        //       if (addDefaultHashTag) options.notesDivForHashtag.textContent = addDefaultHashTag
        //     } else {
        //       console.error('could not connect to toggle mark - handle error')
        //     }
        //   } catch (error) {
        //     console.error('could not connect to toggle mark - handle error', { error })
        //   }
        // }
        // if (aStar === 'bookmark' && !options.showBookmark) adiv.style.display = 'none'
        // stardiv.appendChild(adiv)
      }
    })
    return stardiv
  },
  drawstar: function (aStar, mark, options = {}) {
    // options: defaultHashtag, notesDivForHashtag, logToConvert
    // showBookmark: bool, drawTrash: bool, trashFloatHide bool, markOnBackEnd: function
    // if (!mark && !options?.logToConvert) console.warn('cannot draw stars without mark or log: ', { mark, options })
    const isMarked = Boolean(mark?._id)
    const purl = mark?.purl || options?.purl || options?.log?.purl
    if (!mark & !options?.log) console.warn('no mark or log in drawstars ', { options })
    if (!mark) mark = convertLogToMark(options?.log || { purl }) 
    const addDefaultHashTag = (options?.defaultHashTag && options.notesDivForHashtag && options.notesDivForHashtag.textContent === '')
      ? ('#' + options?.defaultHashTag)
      : ''
    options.addDefaultHashTag = addDefaultHashTag
    // if (!options.markOnBackEnd) options.markOnBackEnd = markOnBackEndForExtenstion

    const adiv = this.makeEl('div', null, 'vulog_overlay_stars')
    adiv.innerContent = ' '
    let chosenEnding = ''
    switch (aStar) {
      case 'trash':
        chosenEnding = ''
        break
      case 'inbox':
      case 'star':
        chosenEnding = mark?.vStars && mark.vStars.includes(aStar) ? '_ch' : '_nc'
        break
      case 'bookmark':
        chosenEnding = isMarked ? '_ch' : '_nc'
        break
      default:
        chosenEnding = '?'
        break
    }
    adiv.className = 'vulog_overlay_' + aStar + chosenEnding
    if (aStar === 'trash' && options.trashFloatHide) {
      adiv.style.display = 'none'
      adiv.style.float = 'left'
    }
    adiv.onclick = async function (e) {
      const thediv = e.target
      const parts = e.target.className.split('_')
      const theStar = parts[2]
      const starWasChosen = (parts.length > 3 && parts[3] === 'ch')
      thediv.className = 'vulog_overlay_spiral'

      try {
        const response = await options.markOnBackEnd(mark, options, theStar, starWasChosen, addDefaultHashTag)
        if (response && response.success && theStar === 'trash') {
          // remove item - this is handled at the markOnBackEnd level
        } else if (response && response.success) {
          thediv.className = ('vulog_overlay_' + theStar + (starWasChosen ? '_nc' : '_ch'))
          if (addDefaultHashTag) options.notesDivForHashtag.textContent = addDefaultHashTag
        } else {
          console.error('could not connect to toggle mark - handle error')
        }
      } catch (error) {
        console.error('could not connect to toggle mark - handle error', { error })
      }
    }
    if (aStar === 'bookmark' && !options.showBookmark) adiv.style.display = 'none'
    return adiv
  },
  drawSmallStars: function (mark) {
    const stardiv = document.createElement('div')
    const ALL_STARS = ['bookmark', 'star', 'inbox', 'vNote', 'vHighlights']
    ALL_STARS.forEach(aStar => {
      const adiv = this.makeEl('div', null, null)
      adiv.innerContent = ' '
      let chosen = false
      switch (aStar) {
        case 'bookmark':
          chosen = Boolean(mark)
          break
        case 'vNote':
          chosen = mark && mark.vNote
          break
        case 'vHighlights':
          chosen = (mark && mark.vHighlights && mark.vHighlights.length > 0)
          break
        default:
          chosen = mark?.vStars && mark.vStars.includes(aStar)
          break
      }
      adiv.className = ('vulog_overlay_' + aStar + (chosen ? '_ch' : '_nc'))
      adiv.style['margin-left'] = '-5px'
      adiv.style['margin-right'] = '-5px'
      adiv.style.scale = 0.5
      stardiv.appendChild(adiv)
    })
    stardiv.style.display = 'inline-block'
    stardiv.style['margin-top'] = '-5px'
    return stardiv
  },
  editableBox: function (opts = {}, onkeyup) {
    //  opts: placeHolderText id
    // used for notes and comments
    const textBox = overlayUtils.makeEl('div', opts?.id, 'vulog_overlay_input vulog_notes')
    textBox.setAttribute('contenteditable', 'true')
    if (opts.placeHolderText) textBox.setAttribute('placeholder', opts.placeHolderText)
    textBox.style.margin = '5px'
    textBox.onpaste = function (evt) {
      pasteAsText(evt)
    }
    textBox.onkeyup = onkeyup
    return textBox
  },
  drawMainNotesBox: function (mark, options) {
    if (!options) options = {} // mainNoteSaver, log (if being converted to mark), defaultHashTag
    options.isLogOnly = Boolean(!mark && options.log)
    if (!mark && options.log) mark = convertLogToMark(options.log)
    if (!mark.purl) {
      console.warn('No purl sent in ', options.log, { mark, options })
      mark.purl = pureUrlify(mark.url)
    }
    // todo and check -> does this work with converting log to mark
    if (!options.mainNoteSaver) {
      options.mainNoteSaver = async function (mark) {
        const purl = mark.purl
        const id = mark?._id // Should be different if it is a log ?
        const msg = 'saveMainComment'
        const response = await chrome.runtime.sendMessage({ msg, purl, notes: mark.vNote, props: mark, id })
        return response
      }
    }

    const placeHolderText = options?.defaultHashTag ? ('Add notes - default hashtag : ' + options.defaultHashTag) : 'Add notes related to this page'
    const notesDiv = this.editableBox({ placeHolderText }, async function (evt) {
      const notes = evt.target.textContent
      mark.vNote = notes
      const response = await options.mainNoteSaver(mark, options)
      if (!response || response.error) {
        let errBox = evt.target.nextSibling
        if (!errBox) {
          errBox = overlayUtils.makeEl('div', null, 'noteErrBox')
          evt.target.parentElement.appendChild(errBox)
        }
        errBox.innerText = 'Error saving ... (sorry)'
        console.warn((response ? response.error : 'error saving note'))
      }
    })
    notesDiv.onclick = function (evt) {
      if (evt.target.textContent === '' && options.defaultHashTag) {
        evt.target.textContent = '#' + options.defaultHashTag + ' '
        moveCursorToEnd(evt.target)
      }
    }
    notesDiv.onpaste = function (evt) {
      pasteAsText(evt)
    }
    if (mark?.vNote) notesDiv.textContent = mark.vNote

    return notesDiv
  },

  // highlights and comments
  drawHighlight: function (purl, hLight, options = {}) {
    // options: include_delete include_delete: true, show_display_errs: false, overLayClick, showErr, showTwoLines: false, hLightCommentSaver, hLightDeleter
    // innerHighs.appendChild(overlayUtils.drawHighlight(purl, hlight, { include_delete: true, hLightCommentSaver: options.hLightCommentSaver, hLightDeleter: options.hLightDeleter, markOnBackEnd: options.markOnBackEnd, markOnMarks: options.markOnMarks, logToConvert: options.logToConvert  }))

    const theColor = ((hLight.color && COLOR_MAP[hLight.color]) ? COLOR_MAP[hLight.color] : 'yellowgreen')
    if (!options) options = {}
    // if (!options.markOnBackEnd) options.markOnBackEnd = markOnBackEndForExtenstion

    const deleteButtOuter = overlayUtils.makeEl('div', null, { width: '100%', 'text-align': 'left', padding: '10px' })
    const deleteButt = overlayUtils.makeEl('div', null, 'quote_delete', 'Remove Highlight')
    if (!options.hLightDeleter) {
      options.hLightDeleter = async function (hLight, mark, options) {
        const response = await chrome.runtime.sendMessage({ msg: 'removeHighlight', url: mark.purl, hlightId: hLight.id, mark })
        if (!response || !response.success) {
          // do nothing
        } else if (options?.showTwoLines) { // ie from overlay
          console.error('todo - need to refresh page and show ')
        } else if (chrome?.tabs?.query) { // for extension overlay only
          chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'refresh' }, function (resp2) {
              if (response?.error && options?.button) options.button.innerText = 'Internal error - please close and re-open'
            })
          })
        }
        return response
      }
    }
    // deleteButt.setAttribute('hlightId', hlight.id)
    deleteButt.onclick = async function (e) {
      if (e.target.className.includes('quote_delete_confirm')) {
        // const hlightId = this.getAttribute('hlightId')
        const response = await options.hLightDeleter(hLight, options?.mark, { button: e.target.parentElement.parentElement })

        e.target.parentElement.parentElement.style.color = 'red'
        e.target.parentElement.parentElement.style['text-align'] = 'center'

        if (!response || !response.success) {
          e.target.parentElement.parentElement.innerHTML = 'Error'
          console.warn('Error trying to delete highlight (' + response.error + ')')
        } else {
          e.target.parentElement.parentElement.innerHTML = 'REMOVED'
        }
      } else {
        setTimeout(() => {
          e.target.className = 'quote_delete quote_delete_confirm'
          e.target.innerText = 'Press again to cofnirm deleting highlight'
        }, 250)
      }
    }
    deleteButtOuter.appendChild(deleteButt)

    const quoteSection = function (text, theColor) {
      const outer = overlayUtils.makeEl('div', null, { display: 'grid', color: theColor, 'grid-template-columns': '5px 1fr 5px', 'margin-right': '5px' })
      outer.appendChild(overlayUtils.makeEl('div', null, 'quote_left'))
      const quoteInner = overlayUtils.makeEl('div', null, 'quote_inner', text)
      if (options?.showTwoLines) {
        quoteInner.style.cursor = 'pointer'
        quoteInner.style.overflow = 'hidden'
        quoteInner.style['max-height'] = '32px'
        quoteInner.style['text-overflow'] = 'ellipsis'
        quoteInner.style['margin-bottom'] = '5px'
      }
      if (options.overLayClick) quoteInner.onclick = options.overLayClick // vState.scrollToHighLight(hlight.id)
      outer.appendChild(quoteInner)
      outer.appendChild(overlayUtils.makeEl('div', null, 'quote_right'))
      return outer
    }

    const retDiv = overlayUtils.makeEl('div', null, { 'border-color': theColor })
    retDiv.className = 'quote_outer'

    // retDiv.append(displayErrDiv)
    if (options?.showErr) {
      retDiv.appendChild(overlayUtils.makeEl('div', null, { color: 'red', 'background-color': 'yellow', border: '1px solid red', 'border-radius': '3px', padding: '3px', margin: '5px' }, 'Sorry! Error showing highlight!'))
    }
    retDiv.append(quoteSection(hLight.string, theColor))

    const commentsOuter = overlayUtils.makeEl('div', null, { padding: '3px' })
    commentsOuter.append(overlayUtils.drawCommentsSection(purl, hLight, options))
    retDiv.append(commentsOuter)

    if (!options?.noThreeDots) {
      const threeDots = overlayUtils.makeEl('div', null, { width: '100%', 'text-align': 'right', color: 'blue', 'font-size': '24px', 'margin-top': '-10px', 'margin-bottom': '5px' })
      const threeDotsInner = overlayUtils.makeEl('span', null, { 'margin-right': '10px', height: '20px', size: '40px', cursor: 'pointer', 'font-weight': 'bold' }, '...')
      threeDotsInner.onclick = function (e) {
        e.target.parentElement.nextSibling.style.display = 'block'
        e.target.parentElement.nextSibling?.firstChild?.firstChild?.focus()
        e.target.parentElement.style.display = 'none'
      }
      threeDots.append(threeDotsInner)
      retDiv.append(threeDots)
    }

    const notesBoxOuter = overlayUtils.makeEl('div', null, { display: 'none' })

    // options.noteSaver = options.hLightCommentSaver
    options.purl = purl
    // if (!options.hLightCommentSaver) console.error('drawHighligh - No hLightCommentSaver for ', { purl, hLight, options })

    notesBoxOuter.append(overlayUtils.drawHlightCommentsBox(purl, hLight, options))
    retDiv.append(notesBoxOuter)

    const highlightOuter = options?.existingDiv || overlayUtils.makeEl('div', null, 'highlightOuter')
    if (hLight.sender_id) {
      if (options?.type === 'msgHighLights') highlightOuter.setAttribute('personId', overlayUtils.fullPersonString(hLight.sender_id, hLight.sender_host))
      if (hLight._isMarked) {
        const markedDiv = overlayUtils.makeEl('div', null, { scale: '0.4', float: 'right', 'margin-top': '5px', 'margin-bottom': '-10px', 'margin-right': '-5px' })
        markedDiv.className = 'vulog_overlay_bookmark_ch'
        highlightOuter.appendChild(markedDiv)
      }
      const personDiv = hLight.sender_id ? overlayUtils.personOneLiner(hLight.sender_id, hLight.sender_host, true) : document.createElement('div')
      highlightOuter.appendChild(personDiv)
    }

    highlightOuter.appendChild(retDiv)

    return highlightOuter
  },
  drawHlightCommentsBox: function (purl, hLight, options) {
    // if (!options.hLightCommentSaver) console.error('drawHlightCommentsBox - No hLightCommentSaver for ', { purl, hLight, options })

    // options has to haev purl & mark and from non overlay, needs noteSaver
    // markOnBackEnd: options.markOnBackEnd, markOnMarks: options.markOnMarks, logToConvert: options.logToConvert

    const outer = overlayUtils.makeEl('div', null, null)

    if (!hLight._isMarked && !options.isOwn) { // _isMarked is from msgs and isown is from markOnMarks / overlay
      const addToMarks = overlayUtils.makeEl('div', null, 'vulog_dialogue_butts bluecol')
      addToMarks.innerText = 'Bookmark highlight'
      addToMarks.onclick = async function (e) {
        const eltoMark = e.target.parentElement.parentElement
        const resultMessage = overlayUtils.makeEl('div', null, { color: 'red', margin: '5px' })
        try {
          if (!options.markOnMarks && !options.logToConvert) throw new Error('need to be able to covert a log if none exist')
          if (!options.markOnMarks) {
            if (!options.markOnBackEnd) throw new Error('need to define options.markOnBackEnd')
            const markOnMarksResult = await options.markOnBackEnd(convertLogToMark(options.logToConvert), options, 'bookmark', false, '') // (mark, options, theStar, starWasChosen, addDefaultHashTag)
            if (!markOnMarksResult || !markOnMarksResult.success) throw new Error('error creating mark - no id ', { markOnMarksResult })
            options.markOnMarks = convertLogToMark(options.logToConvert)
          }
          if (!options.markOnMarks.vHighlights) options.markOnMarks.vHighlights = []
          options.markOnMarks.vHighlights.push(hLight)
          if (options.logToConvert && hLight.vComments && hLight.vComments.length > 0) {
            hLight.vComments.forEach(comment => {
              if (!comment.userId) {
                if (options.logToConvert._data_owner) comment.sender_id = options.logToConvert._data_owner 
                if (options.logToConvert.host) comment.sender_host = options.logToConvert.host
              }
            })
          }
          const hLightAddRet = await chrome.runtime.sendMessage({ url: options.purl, highlight: hLight, msg: 'newHighlight', props: options.markOnMarks })
          if (!hLightAddRet || !hLightAddRet.success) {
            throw new Error('unable to send message')
          } else {
            resultMessage.innerText = 'Bookmark added.'
            e.target.style.display = 'none'
            options.existingDiv = getParentWithClass(e.target, 'highlightOuter')
            hLight._isMarked = true
            //resultMessage.onclick = () => { overlayUtils.drawHighlight(purl, hLight, options) }
          }
          eltoMark.insertBefore(resultMessage, eltoMark.firstChild);
        } catch (err) {
          console.error('caught error in adding hlight to marks ', { err, options })
          addToMarks.after(overlayUtils.makeEl('div', null, { color: 'red', margin: '10px' }, 'Error bookmarking highlight - sorry'))
        }
        // need to mark if mark doesnt exist and also add it to the new note below... and also add the hlight to the mark
        // need to need to so hlightonbackend like markonbackend
      }
      outer.appendChild(addToMarks)
    } else {
      const notesDiv = overlayUtils.makeEl('div', null, 'vulog_overlay_input vulog_hlight_notes')
      notesDiv.setAttribute('contenteditable', 'true')
      notesDiv.setAttribute('placeholder', 'Add a comment')
      notesDiv.style.margin = '3px'
      notesDiv.onpaste = function (evt) {
        pasteAsText(evt)
      }
      notesDiv.onkeydown = function (e) {
        e.target.nextSibling.className = 'vulog_dialogue_butts bluecol'
      }
      // if (hLight.vNote && hLight.vNote !== '') notesDiv.innerText = hLight.vNote ;  hLight.vNote = null // transitional
      outer.appendChild(notesDiv)

      if (!options.hLightCommentSaver) {
        console.error('No hLightCommentSaver for ', { purl, hLight, options })
        options.hLightCommentSaver = async function (hLight, text, options) { // purl, noteSaver
          // need to create mark if not exists
          if (!hLight || !text || (!options.purl && !options.mark)) return { error: true, msg: 'need hlight text to process' }
          const vCreated = new Date().getTime()
          const theComment = { text, vCreated }
          if (!hLight.vComments) hLight.vComments = []
          hLight.vComments.push(theComment)
          if (document.getElementById('vulog_hlight_' + hLight.id)) document.getElementById('vulog_hlight_' + hLight.id).className = HIGHLIGHT_CLASS + ' hlightComment'
          return await chrome.runtime.sendMessage({ msg: 'addHLightComment', hlightId: hLight.id, text, vCreated, url: options.purl })
        }
      }

      const saveDiv = overlayUtils.makeEl('div', null, 'vulog_dialogue_butts')
      saveDiv.innerText = 'Save Comment'
      saveDiv.onclick = async function (evt) {
        const resp = await options.hLightCommentSaver(hLight, evt.target.previousSibling.innerText, { purl: options.purl, mark: options.markOnMarks }) // , mark: options.mark
        if (!resp || resp.error) {
          let errBox = evt.target.nextSibling
          if (!errBox) {
            errBox = overlayUtils.makeEl('div', null, 'noteErrBox')
            evt.target.parentElement.appendChild(errBox)
          }
          errBox.innerText = 'Error saving ... ' + (resp?.msg || 'sorry!')
          console.warn((resp ? resp.error : 'error saving note'))
        } else {
          const notesDiv = evt.target.previousSibling
          notesDiv.innerText = ''
          notesDiv.parentElement.parentElement.style.display = 'none'
          notesDiv.nextSibling.className = 'vulog_dialogue_butts'
          notesDiv.parentElement.parentElement.previousSibling.style.display = 'block'
          notesDiv.parentElement.parentElement.previousSibling.previousSibling.innerHTML = ''
          notesDiv.parentElement.parentElement.previousSibling.previousSibling.appendChild(overlayUtils.drawCommentsSection(purl, hLight))
        }
      }
      outer.appendChild(saveDiv)
    }

    return outer
  },
  drawCommentsSection: function (purl, thehighLight, options  = {}) { // hlighId
    // onsole.log('drawCommentsSection', { purl, thehighLight })
    const emptyDiv = overlayUtils.makeEl('span', null, { style: { displauy: 'none' } })

    if (thehighLight.vComments && thehighLight.vComments.length > 0) {
      const retDiv = overlayUtils.makeEl('div', null, { style: { 'background-color': 'white', padding: '5px' } })
      thehighLight.vComments.forEach((comment, i) => {
        options.hLight = thehighLight
        options.isReceived = !isOwnComment(comment)
        retDiv.appendChild(overlayUtils.oneComment(purl, comment, options ))
      })
      return retDiv
    } else {
      return emptyDiv
    }
  },

  // commenting - NB these need vState to function
  oneComment: function (purl, vComment, options) {
    // onsole.log('oneComment', { purl, vComment, options })

    const oneComment = overlayUtils.makeEl('div', null, { 'margin-left': ((options?.isReceived || options?.noreply) ? '0px' : '20px') })

    if (!vComment) return oneComment.appendChild(overlayUtils.makeEl('div', null, null, 'Error: No message details'))

    if (options?.isReceived || options?.addPerson) {
      oneComment.setAttribute('personid', overlayUtils.fullSenderName(vComment))
      oneComment.appendChild(overlayUtils.personOneLiner(vComment.sender_id, vComment.sender_host, options.isReceived, options))

      if (!options.noreply) {
        const replyButt = overlayUtils.makeEl('div', null, {
          float: 'right',
          opacity: '100%',
          zoom: '60%',
          margin: '5px',
          cursor: 'pointer'
        }, '')
        replyButt.className = 'vulog_overlay_reply'
        replyButt.onclick = function (e) {
          replyButt.style.display = 'none'
          // remove previous ones - currently only sending one comment at a time
          const cardParent = getParentWithClass(e.target, 'cardOuter')
          const previousInterface = cardParent.querySelector('.messageSendingInterface_inlineReply')
          if (previousInterface) { // note: assumed all others have been deleted
            collapseSection(previousInterface)
            previousInterface.parentElement.firstChild.nextSibling.style.display = 'block' // repluyButt
            previousInterface.innerHTML = ''
            previousInterface.className = 'oldMessageInterface' // todo should really delete this
          }

          overlayUtils.setUpMessagePurlWip(purl, options.hLight)
          vState.messages.wip[purl].text = ''
          vState.messages.wip[purl].chosenFriends = [overlayUtils.tempFriendObjFrom(vComment.sender_id, vComment.sender_host)]
          const messageSendingInterface = overlayUtils.drawMessageSendingInterface(purl, 'inlineReply', options.hLight)
          messageSendingInterface.style.height = '0px'
          e.target.parentElement.appendChild(messageSendingInterface)
          setTimeout(() => { expandSection(messageSendingInterface, { display: 'grid', height: 'auto' }) })
          setTimeout(() => {
            const messageBox = messageSendingInterface.firstChild
            messageBox.focus()
            // https://codepen.io/sinfullycoded/details/oNLBJpm nb can be used to mvoe cursor to end of selction - not needed on replies
            // window.getSelection().selectAllChildren(messageBox)
            // window.getSelection().collapseToEnd()
          }, 100)
          // need to get all reply butts and make them diplay??
        }
        oneComment.appendChild(replyButt)
      }
    } else {
      oneComment.setAttribute('personid', overlayUtils.fullRecipientName(vComment))
      oneComment.appendChild(overlayUtils.personOneLiner(vComment.recipient_id, vComment.recipient_host, options.isReceived))
    }
    const textBox = overlayUtils.makeEl('div', null, {
      color: (options.isReceived ? MCSS.PURPLE : 'white'),
      'background-color': (options.isReceived ? 'lightgray' : MCSS.PURPLE),
      border: '1px solid grey',
      padding: (vComment.text ? '3px' : '0px 3px'),
      'border-radius': '3px',
      'margin-right': ((options.isReceived && !options?.noreply) ? '40px' : '0px'),
    }, vComment.text || ((vComment.hLightsCopy && vComment.hLightsCopy.length > 0 &&  vComment.hLightsCopy[0].vComments && vComment.hLightsCopy[0].vComments.length > 0 && vComment.hLightsCopy[0].vComments[0].text) ?  vComment.hLightsCopy[0].vComments[0].text : null) || ' ')
    //  vComment.hLightsCopy[0].string should be function grabbing first comment in highlight
    if (vComment.text == ' ') textBox.border = '1px solid purple'
    if (options?.maxHeight) {
      textBox.style['max-height'] = options.maxHeight
      textBox.style.overflow = 'hidden'
    }
    if (options?.oneLiner) {
      textBox.style['text-overflow'] = 'ellipsis'
      textBox.style.overflow = 'hidden'
      textBox.style['white-space'] = 'nowrap'
    }
    oneComment.appendChild(textBox)

    const bottomLine = overlayUtils.makeEl('div', null, {
      'padding-right': '5px',
      'margin-bottom': '10px',
      'margin-right': ((options.isReceived && !options?.noreply) ? '40px' : '0px'),
      'font-size': 'smaller',
      color: 'darkgray'
    })

    const dateOrTime = function (vCreated) {
      // today: https://stackoverflow.com/questions/8215556/how-to-check-if-input-date-is-equal-to-todays-date
      if (new Date().setHours(0, 0, 0, 0) === new Date(vCreated).setHours(0, 0, 0, 0)) return new Date(vCreated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      return new Date(vCreated).toLocaleDateString()
    }

    bottomLine.appendChild(overlayUtils.makeEl('div', null, { float: 'right' }, dateOrTime(vComment.vCreated)))
    const bottomLineText = overlayUtils.makeEl('div', null, { overflow: 'hidden', height: '12px', 'text-overflow': 'ellipsis', 'margon-right': '5px' })
    if (vComment.hLightCopy) {
      bottomLineText.style.color = mapColor(vComment.hLightCopy.color)
      // bottomLine.appendChild(d g div({ style: { color: mapColor(vComment.hLightCopy.color), overflow: 'hidden', height: '12px', 'text-overflow': 'ellipsis', 'margon-right': '5px' }}, '“' + vComment.hLightCopy.string + '”'))
      bottomLineText.innerText = '“' + vComment.hLightCopy.string + '”'
    } else if (vComment.hLightsCopy && vComment.hLightsCopy.length === 1) {
      bottomLineText.style.color = mapColor(vComment.hLightsCopy[0].color)
      bottomLineText.innerText = vComment.hLightsCopy[0].string ? ('“' + vComment.hLightsCopy[0].string + '”') : ('1 Highlight')
    } else if (vComment.hLightsCopy) {
      bottomLineText.style.color = 'green'
      bottomLineText.innerText = (vComment.hLightsCopy.length + ' highlights')
    } else {
      // bottomLine.appendChild(d g div({ style: { 'min-width': '10px', height: '12px' } }, ' '))
    }
    bottomLine.appendChild(bottomLineText)
    oneComment.appendChild(bottomLine)
    return oneComment
  },
  // messaging -> // todo - why use wip?
  drawMessageSendingInterface: function (purl, from, hLight) {
    overlayUtils.setUpMessagePurlWip(purl, hLight)
    const wip = vState.messages.wip[purl]
    const outer = overlayUtils.makeEl('div', null, { display: 'grid', 'grid-template-columns': '1fr 40px' })
    outer.className = 'messageSendingInterface_' + from
    const messageBox = overlayUtils.editableBox({
      placeHolderText: ((from === 'mainInterface') ? 'Enter a message before sending' : ' Enter reply')
    }, async function (e) {
      wip.text = e.target.innerText
      if (e.key === 'Enter') {
        e.preventDefault()
        await sendMessageAndRedraw(purl, outer, from)
      }
    })
    messageBox.onpaste = convertPasteToText
    messageBox.className = 'messageBox vulog_overlay_input'
    messageBox.style.border = '1px solid lightgrey'
    messageBox.style['max-height'] = 'none'
    if (wip.text) messageBox.innerText = wip.text

    const clickSendMessage = async function (e) {
      e.target.style.display = 'none'
      e.target.after(smallSpinner())
      // const messageBox = e.target.parentElement.querySelector('messageBox')
      messageBox.setAttribute('contenteditable', false)
      messageBox.style['background-color'] = '#80008080'
      sendMessageAndRedraw(purl, outer, from)
    }

    // messageBox.style.margin = '0px 5px'
    if (from === 'mainInterface') {
      outer.appendChild(messageBox)
      const sendOuter = overlayUtils.makeEl('div', null, { 'text-align': 'center'})
      const SendInner = overlayUtils.makeEl('div', null, { zoom: '80%', cursor: 'pointer', margin: '5px' })
      SendInner.className = 'vulog_overlay_send'
      SendInner.onclick = clickSendMessage
      sendOuter.appendChild(SendInner)
      outer.appendChild(sendOuter)
    } else { // from === 'inlineReply'
      const sendButt = overlayUtils.makeEl('div', null, { zoom: '60%', cursor: 'pointer', margin: '-10px 15px 0px 10px' })
      sendButt.className = 'vulog_overlay_send'
      sendButt.onclick = clickSendMessage

      messageBox.style.margin = '-10px 0px 0px 0px'
      messageBox.style['font-size'] = 'smaller'
      outer.style['margin-bottom'] = '40px'
      outer.appendChild(messageBox)
      outer.appendChild(sendButt)
    }

    const sendMessageAndRedraw = async function (purl, outer, from) {
      const wip = vState.messages.wip[purl]
      const chosenFriends = wip.chosenFriends
      const text = wip.text
      const hLight = wip.hLight
      const markCopy = convertMarkToSharable((vState.marks.lookups[purl] || getMarkFromVstateList(purl, { excludeHandC: true })), { excludeHlights: (from === 'inlineReply') })
      markCopy._id = null

      const { successFullSends, erroredSends } = await vState.environmentSpecificSendMessage({ chosenFriends, text, hLight, markCopy })
      // await sendMessage({ chosenFriends, text, hLight, markCopy })

      if (erroredSends && erroredSends.length === 0) {
        delete vState.messages.wip[purl]
      } else if (erroredSends && erroredSends.length > 0) {
        vState.messages.wip[purl].chosenFriends = erroredSends
      }

      const cardParent = getParentWithClass(outer, 'cardOuter') || document.getElementById('tabInner') // tabInner for popup
      const messageSharingArea = cardParent.querySelector('.sharingArea_messages')
      if (messageSharingArea) messageSharingArea.setAttribute('vStateChanged', 'true')

      const result = overlayUtils.makeEl('div', null, { padding: '10px', color: 'red' })
      if (erroredSends.length === 0) {
        result.innerText = 'Your message was sent successfully!'
      } else if (successFullSends.length === 0) {
        result.innerText = 'There was a problem sending your message. Please try again.'
      } else {
        result.appendChild(overlayUtils.makeEl('div', null, {}, ('Your message was sent successfully to:')))
        successFullSends.forEach(friend => result.appendChild(overlayUtils.makeEl('div', null, {}, (friend.nickname + '(' + friend.username + '@' + friend.serverurl + ')'))))
        result.appendChild(document.createElement('br'))
        result.appendChild(overlayUtils.makeEl('div', null, {}, 'There were errors sending your message to:'))
        erroredSends.forEach(friend => result.appendChild(overlayUtils.makeEl('div', null, {}, (friend.nickname + '(' + friend.username + '@' + friend.serverurl + ')'))))
      }
      if (from === 'mainInterface') {
        messageSharingArea.innerHTML = ''
        messageSharingArea.appendChild(result)
        messageSharingArea.style.height = 'auto'
      } else { // from === 'inlineReply'
        outer.innerHTML = ''
        outer.appendChild(result)
      }

      const updateStatus = await getAllMessagesAndUpdateStateteFor(purl)
      if (updateStatus && updateStatus.error) {
        outer.appendChild(overlayUtils.makeEl('div', null, {}, ('.. but there was an error confirming the update. Please refresh this page')))
      } else if (updateStatus) {
        const itemJson = updateStatus.itemJson
        setTimeout(() => {
          const vMessageCommentDetailsDiv = cardParent.querySelector('.vMessageCommentDetails')
          if (vMessageCommentDetailsDiv) overlayUtils.vMessageCommentDetails(purl, itemJson.vComments, vMessageCommentDetailsDiv)
          const vMessageCommentSummaryDiv = cardParent.querySelector('.vMessageCommentSummary')
          if (vMessageCommentSummaryDiv) overlayUtils.vMessageCommentSummary(purl, itemJson.vComments, vMessageCommentSummaryDiv)
        }, 5000)
      }
      // redraw messages areaboth forsmallcard and large card
      // add text box to
    }
    return outer
  },
  setUpMessagePurlWip: function (purl, hLight) {
    if (!vState.messages) vState.messages = {}
    if (!vState.messages.wip) vState.messages.wip = { }
    if (!vState.messages.wip[purl]) overlayUtils.resetmessageWipFor(purl)
    vState.messages.wip[purl].hLight = hLight
  },
  resetmessageWipFor: function (purl, hLight) {
    // for overlay:
    if (!vState.marks) vState.marks = {}
    if (!vState.marks.lookups) vState.marks.lookups = {}

    // for overlay and others..
    const text = (!hLight && vState.marks.lookups[purl] && vState.marks.lookups[purl].vNote) ? vState.marks.lookups[purl].vNote : ''
    vState.messages.wip[purl] = {
      chosenFriends: [],
      text
    }
  },
  // drawing messages
  vMessageCommentSummary: function (purl, vComments, existingDiv) {
    const outer = existingDiv || overlayUtils.makeEl('div', null, { 'margin-top': '10px', 'border-top': '1px lightgrey solid', 'padding-top': '10px' })
    outer.className = 'vMessageCommentSummary'
    outer.innerHTML = ''
    const { lastSentComment, lastReceivedComment, numSentComments, numReceivedComments, numComments } = overlayUtils.commentData(vComments)
    if (numComments === 0) return outer


    if (numReceivedComments > 0) {
      outer.appendChild(overlayUtils.makeEl('div', null, { }, (numReceivedComments > 1 ? ('Last of ' + numReceivedComments + ' messages received:') : 'Received: ')))
      const inner = overlayUtils.oneComment(purl, lastReceivedComment, { isReceived: true, oneLiner: true })
      outer.appendChild(inner)
    }

    if (numSentComments > 0) {
      outer.appendChild(overlayUtils.makeEl('div', null, { }, (numSentComments > 1 ? ('Latest of ' + numSentComments + ' messages sent:') : 'Sent: ')))
      outer.appendChild(overlayUtils.oneComment(purl, lastSentComment, { isReceived: false, oneLiner: true }))
    }

    return outer
  },
  vMessageCommentDetails: function (purl, vComments, existingDiv) {
    const outer = existingDiv || overlayUtils.makeEl('div', null, { display: 'none' })
    outer.className = 'vMessageCommentDetails'
    outer.innerHTML = ''
    if (!vComments || vComments.length === 0) return outer

    outer.appendChild(overlayUtils.areaTitle('Messages'))

    const { numComments } = overlayUtils.commentData(vComments)

    if (numComments > 0) {
      let listOfPersons = []
      const personHasMessagedBefore = function (vComment) { // only show emoty messages if the person has not messages previously
        return listOfPersons.indexOf(overlayUtils.fullPersonString(vComment.sender_id, vComment.sender_host)) > -1
      }
      vComments.sort(sortBycreatedDate).reverse()
      vComments.forEach(vComment => {
        if (vComment.text || vComment.hLightCopy || vComment.hLightsCopy || !personHasMessagedBefore(vComment)) {
          outer.appendChild(overlayUtils.oneComment(purl, vComment, {
            isReceived: !isOwnComment(vComment)
          }))
        }
        if (isOwnComment(vComment)) listOfPersons = addToListAsUniqueItems(listOfPersons, overlayUtils.fullPersonString(vComment.recipient_id, vComment.recipient_host))
        if (!isOwnComment(vComment)) listOfPersons = addToListAsUniqueItems(listOfPersons, overlayUtils.fullPersonString(vComment.sender_id, vComment.sender_host))
      })

      // friendScroller

      if (listOfPersons.length > 1) {
        const personFilter = overlayUtils.personFilterScroller(purl, listOfPersons)
        // outer.appendChild(personFilter)
        outer.firstChild.after(personFilter)
      }
    }

    return outer
  },
  commentData: function (vComments) {
    const data = {
      lastSentComment: null,
      lastReceivedComment: null,
      numSentComments: 0,
      numReceivedComments: 0,
      numComments: 0,
      people: []
    }
    if (vComments && vComments.length > 0) {
      vComments.forEach(vComment => {
        data.numComments++
        if (isOwnComment(vComment)) {
          data.numSentComments++
          if (!data.lastSentComment) data.lastSentComment = vComment
          data.people = addToListAsUniqueItems(data.people, overlayUtils.fullPersonString(vComment.sender_id, vComment.sender_host))
        } else {
          data.numReceivedComments++
          if (!data.lastReceivedComment) data.lastReceivedComment = vComment
          data.people = addToListAsUniqueItems(data.people, overlayUtils.fullPersonString(vComment.recipient_id, vComment.recipient_host))
        }
      })
    }
    return data
  },

  // persons and pictures
  personOneLiner: function (personId, personHost, received, options) {
    const oneLiner = overlayUtils.makeEl('div', null, { overflow: 'hidden', 'white-space': 'nowrap', color: MCSS.PURPLE, 'padding-left': '4px' })
    if (personId) {
      const floater = overlayUtils.makeEl('span', null, { float: (received ? '' : 'right') })
      floater.appendChild(overlayUtils.personPict(personId, personHost))
      oneLiner.appendChild(floater)
      const texter = overlayUtils.makeEl('span', null, { 'font-weight': 'bold', 'margin-top': '10px', display: 'inline-block' }, (options?.nofrom ? '' : (received ? 'From ' : 'To ')) + personId)
      if (personHost) texter.appendChild(overlayUtils.makeEl('span', null, null, (' @ ' + domainAppFromUrl(personHost))))
      oneLiner.appendChild(texter)
    }
    return oneLiner
  },
  personPict: function (personId, personHost, options) {
    // options width
    if (personId && typeof personId === 'object') {
      personHost = personId.serverurl
      personId = personId.username
    }
    // onsole.log('person pict for ', { personHost, personId, options })
    const width = options?.width || '25px'
    const imgDiv = overlayUtils.makeEl('img', null, { 'border-radius': '50%', width, height: width, 'margin-right': '2px', 'margin-bottom': '-5px' }, '')
    imgDiv.src = (overlayUtils.personPictUrl(personId, personHost))
    imgDiv.onerror = options?.onerror || function (e) {
      e.target.style.display = 'none'
      if (options?.addSpace) e.target.after(overlayUtils.makeEl('div', null, { display: 'inline-block', 'margin-left': width, height: width }))
    }
    return imgDiv
  },
  personPictUrl: function (personId, personHost) {
    return (personHost || '') + '/publicfiles/@' + personId + '/info.freezr.account/profilePict.jpg'
  },
  fullPersonString: function (personId, personHost) {
    return personId + (personHost ? ('@' + personHost) : '')
  },
  tempFriendObjFrom: function (personId, personHost, allFriends) {
    // to do - could fetch this from vtsate.friends if friend exists
    if (!personHost && personId.indexOf('@') > 0) {
      personHost = personId.split('@')[1]
      personId = personId.split('@')[0]
    }
    // if freiend exists in allFriends return it
    if (allFriends && allFriends.length > 0) {
      allFriends.forEach(realFriend => {
        if (realFriend.username === personId && realFriend.serverurl === personHost) return realFriend
      })
    }
    // other wise return what you have
    return {
      username: personId,
      nickname: personId,
      serverurl: personHost,
      searchname: personId + (personHost ? ('@' + personHost.replace(/\./g, '_')) : '')
    }
  },
  fullSenderName: function (hLightOrComment) {
    if (!hLightOrComment || !hLightOrComment.sender_id) return null
    return hLightOrComment.sender_id + (hLightOrComment.sender_host ? ('@' + hLightOrComment.sender_host) : '')
  },
  fullRecipientName: function (hLightOrComment) {
    if (!hLightOrComment || !hLightOrComment.recipient_id) return null
    return hLightOrComment.recipient_id + (hLightOrComment.recipient_host ? ('@' + hLightOrComment.recipient_host) : '')
  },
  personPictOrInitial: function (friend, options) {
    const WIDTH = options?.width || '40px'
    const pict = overlayUtils.personPict(friend.username, friend.serverurl, {
      width: WIDTH,
      onerror: function (e) {
        const circle = overlayUtils.makeEl('div', null, { 'border-radius': '50%', width: WIDTH, height: WIDTH, border: '1px solid lightgrey', 'background-color': 'white', 'text-align': 'center', 'margin-left': '4px', 'margin-bottom': '-1px' })
        circle.appendChild(overlayUtils.makeEl('span', null, { overflow: 'hidden', 'font-size': '34px', 'vertical-align': 'middle', color: 'lightgrey', 'font-weight': 'bold' }, ((friend.nickname || friend.username || 'no friend or username').slice(0, 1).toUpperCase())))
        const pictOuter = pict.parentElement
        pictOuter.innerHTML = ''
        pictOuter.appendChild(circle)
        if (options?.failBorder) circle.style.border = options.failBorder
      }
    })
    const outer = overlayUtils.makeEl('span')
    outer.appendChild(pict)
    return outer
  },

  personFilterScroller: function (purl, personList, options) {
    // options existingDiv existingFriends
    const emptyOuter = overlayUtils.makeEl('div', null, {
      height: '50px',
      width: '100%',
      'overflow-y': 'hidden',
      'overflow-x': 'scroll',
      background: 'lightgrey',
      'white-space': 'nowrap'
    })
    emptyOuter.className = 'personFilterScroller'
    const outer = options?.existingDiv || emptyOuter

    let counter = 1
    personList.forEach(fullPerson => {
      const friendPict = overlayUtils.drawComplexFriend((overlayUtils.tempFriendObjFrom(fullPerson, null, options?.existingFriends)), purl, { failBorder: '2px solid purple' })
      friendPict.style.scale = 0.7
      // friendPict.firstChild.firstChild.onerror = (e) => { setTimeout(() => { e.target.style.border = '2px solid purple' }, 20); } // when not adding this
      friendPict.style.margin = '-8px -10px 0px 0px'
      const toggleSeeing = function (e) {
        const outer = getParentWithClass(e.target, 'friend')
        const wasSeen = (outer.getAttribute('shown') === 'true')
        outer.firstChild.firstChild.style.border = (wasSeen ? '2px solid lightgrey' : '2px solid purple')
        if (outer.firstChild.firstChild.firstChild) outer.firstChild.firstChild.firstChild.style.color = (wasSeen ? 'grey' : 'purple')
        outer.firstChild.nextSibling.style.color = (wasSeen ? 'black' : 'purple')
        outer.style.opacity = (wasSeen ? '0.5' : '1')
        outer.setAttribute('shown', (wasSeen ? 'false' : 'true'))
        const cardDiv = getParentWithClass(outer, 'cardOuter')
        if (cardDiv) {
          const personDivs = cardDiv.querySelectorAll('[personid="' + fullPerson + '"]')
          const expandInitOption = e.initExpandSection ? { height: 'auto' } : null
          personDivs.forEach(aDiv => { if (wasSeen) { collapseSection(aDiv) } else { expandSection(aDiv, expandInitOption) } })
        } else {
          console.warn('could not fund carddiv for ', { outer, fullPerson })
        }
      }
      setTimeout(() => {
        toggleSeeing({ target: friendPict, initExpandSection: true })
      }, 5 + counter++)
      friendPict.onclick = toggleSeeing
      outer.appendChild(friendPict)
    })
    return outer
  },
  redrawFriendScrollerFor: function (purl, existingDiv) {
    const wip = vState.messages.wip[purl]
    const emptyOuter = overlayUtils.makeEl('div', null, {
      height: '65px',
      width: '100%',
      'overflow-y': 'hidden',
      'overflow-x': 'scroll',
      background: 'lightgrey',
      // display: 'grid',
      // 'grid-auto-flow': 'column',
      // 'grid-template-columns': 'repeat(' + vState.friends.length + ', 70px)',
      // margin: '0 auto',
      'white-space': 'nowrap'
    })
    emptyOuter.className = 'friendScroller'
    const outer = existingDiv || emptyOuter
    outer.innerHTML = ''

    vState.friends.forEach(f => {
      if (f.username) {
        const friendPict = overlayUtils.drawComplexFriend(f, purl)
        const existing = wip.chosenFriends.find((f2) => f2.searchname === f.searchname)
        if (existing) friendPict.style.background = 'purple'
        outer.appendChild(friendPict)
      } else if (f._date_created > 1709362100000) { // old bug
        console.warn('empty friend found')
      }
    })
    return outer
  },
  drawComplexFriend: function (friend, purl, options) {
    const outer = overlayUtils.makeEl('div', null, {
      display: 'inline-block',
      margin: '2px',
      padding: '2px',
      'text-align': 'center',
      border: '1px solid lightgrey',
      'border-radius': '8px',
      cursor: 'pointer',
      width: '50px',
      height: '54px'
    })
    outer.className = 'friend'
    const friendPictOrInitial = overlayUtils.personPictOrInitial(friend, options)
    const friendName = overlayUtils.makeEl('div', null, {
      'font-weight': 'bold',
      overflow: 'hidden',
      padding: '2px',
      width: '48px',
      'white-space': 'nowrap',
      'text-overflow': 'ellipsis',
      'max-height': '14px'
    }, friend.nickname)
    outer.appendChild(friendPictOrInitial)
    outer.appendChild(friendName)

    outer.onclick = function () {
      const wip = vState.messages.wip[purl]
      const existing = wip.chosenFriends.findIndex((f) => f.searchname === friend.searchname)
      if (existing > -1) {
        wip.chosenFriends.splice(existing, 1)
      } else {
        wip.chosenFriends.push(friend)
      }
      const friendScroller = getParentWithClass(outer, 'friendScroller')
      overlayUtils.redrawFriendScrollerFor(purl, friendScroller)

      const messageSendingArea = friendScroller.nextSibling
      overlayUtils.redrawSendMessagePaneFor(purl, messageSendingArea)
    }
    return outer
  },
  redrawSendMessagePaneFor: function (purl, existingDiv) {
    const outer = existingDiv || overlayUtils.makeEl('div', null, 'messageSendingArea')
    outer.innerHTML = ''
    outer.style.height = 'auto'
    const wip = vState.messages.wip[purl]
    if (wip.chosenFriends.length === 0) {
      outer.appendChild(overlayUtils.makeEl('div', null, { padding: '5px' }, 'Select a friend to send messages.'))
    } else {
      const recipients = overlayUtils.makeEl('div', null, { padding: '5px', color: 'purple' }, 'Send message to: ')
      wip.chosenFriends.forEach(friend => {
        const friendOuter = overlayUtils.makeEl('div', null, { 'padding-left': '5px' })
        friendOuter.appendChild(overlayUtils.personPict(friend, null, { addSpace: true, width: '15px' }))

        const textOuter = overlayUtils.makeEl('span', null, { height: '12px' })
        if (friend.nickname) textOuter.appendChild(overlayUtils.makeEl('span', null, { 'font-weight': 'bold' }), friend.nickname + ': ')
        textOuter.appendChild(overlayUtils.makeEl('span', null, null, (' (' + overlayUtils.fullPersonString(friend.username, friend.serverurl) + ')')))
        friendOuter.appendChild(textOuter)
        recipients.appendChild(friendOuter)
      })
      outer.appendChild(recipients)

      outer.appendChild(overlayUtils.drawMessageSendingInterface(purl, 'mainInterface'))
    }
    return outer
  },

  // other...
  areaTitle: function (type, options) {
    const types = {
      Sharing: { color: 'purple' },
      Messages: { color: 'purple' },
      Highlights: { color: '#057d47'}
    }
    const h3 = document.createElement(options?.tag || 'div') // g3 clashes with tailwind that can reduce foint size 
    h3.className = type + 'Title'
    h3.innerText = options?.title || type
    h3.style['border-top'] = '1px solid lightgrey'
    h3.style['padding-top'] = '20px'
    h3.style['font-size'] = 'medium'
    h3.style['font-weight'] = 'bold'
    h3.style.color = (type && types[type]) ? types[type].color : (options?.color || 'black')
    if (options?.display) h3.style.display = options.display
    return h3
  },
  drawColorTable: function (chosenColor) {
    const hLightChosenColor = function (box, chosenHColor) {
      for (const colorChoice of box.children) {
        colorChoice.style.border = '2px solid ' + (((colorChoice.style['background-color'] === COLOR_MAP[chosenHColor])) ? 'darkgrey' : 'white')
      }
    }

    const colorTable = overlayUtils.makeEl('div', null, 'vulog_colorAreaDiv', '')
    for (const [hColor, value] of Object.entries(COLOR_MAP)) {
      const colorChoice = overlayUtils.makeEl('div', null, 'vulog_colorPalletteChoice', '')
      colorChoice.style['background-color'] = value
      colorChoice.onclick = async function (e) {
        const result = await chrome.runtime.sendMessage({ msg: 'setHColor', hColor })
        if (result && !result.error) hLightChosenColor(e.target.parentElement, hColor)
      }
      colorTable.appendChild(colorChoice)
    }
    hLightChosenColor(colorTable, chosenColor)
    return colorTable
  }
}

const removeChildren = function (parent) {
  while (parent.firstChild) {
    parent.firstChild.remove()
  }
}
const getParentWithClass = function (theDiv, className) {
  if (!theDiv) return null
  while ((theDiv && (!theDiv.className || !theDiv.className.includes(className)) && theDiv.tagName !== 'BODY')) {
    theDiv = theDiv.parentElement
  }
  if (theDiv && theDiv.tagName !== 'BODY') return theDiv
  return null
}
const appTableFromList = function (list) {
  switch (list) {
    case 'marks':
      return 'com.salmanff.vulog.marks'
    case 'sentMsgs':
      return 'dev.ceps.messages.sent'
    // case 'messages':
    //   return 'dev.ceps.messages.got'
    case 'gotMsgs':
      return 'dev.ceps.messages.got'
    case 'history':
      return 'com.salmanff.vulog.logs'
    default:
      return 'com.salmanff.vulog.marks'
  }
}
// Sorting
function sortBycreatedDate (obj1, obj2) {
  //
  return getCreatedDate(obj1) - getCreatedDate(obj2)
}
function getCreatedDate (obj) {
  // onsole.log("getMaxLastModDate obj is "+JSON.stringify(obj));
  if (!obj) {
    return 0
  } else if (obj.vCreated) {
    return obj.vCreated
  // below should never take place, except in legacy as all should have a vCreated  
  } else if (obj._date_created) {
    return obj._date_created
  } else if (obj.fj_modified_locally) {
    return obj.fj_modified_locally
  } else {
    return 0 // error
  }
}
function sortByPublishedDate (obj1, obj2) {
  //
  return getPublishedDate(obj1) - getPublishedDate(obj2)
}
function getPublishedDate (obj) {
  // onsole.log("getMaxLastModDate obj is "+JSON.stringify(obj));
  if (!obj) {
    return 0
  } else if (obj._date_published) {
    return obj._date_published
  // below should never take place, except in legacy as all should have a vCreated  
  } else if (obj._date_modified) {
    return obj._date_modified
  } else {
    return 0 // error
  }
}
// const dateCreatedSorter = function (obj1, obj2) {
//   if (!obj1 || ! obj2) {
//     console.warn('trying to sort on an empty object ', { obj1, obj2 })
//     return 0
//   }
//   const date1 = obj1.vCreated || obj1._date_created
//   const date2 = obj2.vCreated || obj2._date_created
//   if (date1 < date2) return 1
//   return -1
// }
const dateLatestMessageSorter = function (obj1, obj2) {
  const date1 = obj1.vLatestMsg || obj1._date_modified
  const date2 = obj2.vLatestMsg || obj2._date_modified
  if (date1 < date2) return 1
  return -1
}

function sortByModifedDate (obj1, obj2) {
  //
  return getModifiedDate(obj1) - getModifiedDate(obj2)
}
function getModifiedDate (obj) {
  // onsole.log("getMaxLastModDate obj is "+JSON.stringify(obj));
  if (!obj) {
    return 0
  } else if (obj._date_modified) {
    return obj._date_modified
  } else if (obj.fj_modified_locally) {
    return obj.fj_modified_locally
  } else {
    return 0 // error
  }
}
const convertPasteToText = function (evt) {
  evt.preventDefault()
  const text = evt.clipboardData.getData('text/plain')
  evt.target.innerText += text
}

const utilsDummy = false // for eslint exports
if (utilsDummy) { // exported vars
  isIos()
  appTableFromList()
  endsWith()
  domainAppFromUrl()
  addToListAsUniqueItems()
  cleanTextForEasySearch()
  hostFromUrl()
  pasteAsText()
  dateLatestMessageSorter()
  sortBycreatedDate()
  newHlightIdentifier()
  markMsgHlightsAsMarked()
  removeChildren()
  sortByModifedDate()
  resetVulogKeyWords()
  convertMarkToSharable()
  convertDownloadedMessageToRecord()
  mergeMessageRecords()
  convertListerParamsToDbQuery()
}
