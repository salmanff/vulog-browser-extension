// load_highlights.js
// Compare iosApp vs ChromeExtension  - verified against iosApp 2022-07-05

// Highligher FUNCTIONS from github.com/jeromepl/highlighter

/* global chrome, vState, overlayUtils,  showVulogOverlay, highlightFromSelection, mapColor, HIGHLIGHT_CLASS */
let freezrMeta = null // used to pass onto overlay => utils to see if isOwnComment

const initiateHighlights = function () {
  if (!vState.pageInfoFromPage.isiframe) {
    const overlayOuter = overlayUtils.makeEl('div', 'vulog_overlay_outer', 'cardOuter', '')
    overlayOuter.style.display = 'none'
    document.body.appendChild(overlayOuter)

    chrome.runtime.sendMessage({ purl: vState.pageInfoFromPage.purl, msg: 'getMarkFromVulog' }, function (response) {
      if (!response || response.error) {
        console.warn(response || 'No response from vulog extension - internal error?')
      } else {
        freezrMeta = response.freezrMeta
        if (response.mark) vState.ownMark = response.mark
        if (response.redirectmark) vState.redirectmark = response.redirectmark
        if (response.defaultHashTag) vState.defaultHashTag = response.defaultHashTag
        if (response.messages && response.messages.length > 0) {
          let itemJson = null
          response.messages.forEach(item => {
            if (!item.record) {
              console.warn('no recrod to merge for ', item)
            } else if (!itemJson) {
              itemJson = convertDownloadedMessageToRecord(item)
            } else {
              itemJson = mergeMessageRecords(itemJson, item)
            }
          })
          vState.messageMark = itemJson
        } else {
          vState.messageMark = null
        }
        vState.showThis = (response.showThisInoverlay?.show && hasHighlights(vState[response.showThisInoverlay?.show])) ? response.showThisInoverlay.show : 'ownMark'
        if (response.showThisInoverlay?.show && ['ownMark', 'messageMark', 'redirectmark'].indexOf(response.showThisInoverlay?.show) < 0) {
          console.warn('showThis has to be one of ownMark, messageMark or redirectmark')
        }

        vState.displayErrs = showHighlights()
        if (vState.displayErrs && vState.displayErrs.length > 0) {
          chrome.runtime.sendMessage({ purl: vState.pageInfoFromPage.purl, msg: 'marksDisplayErrs', display_errs: vState.displayErrs }, function (response) {
            // onsole.log(response)
            vState.showVulogOverlay()
          })
          // vState.showVulogOverlay('Some errors occured in displaying highlights. ' + errCount + (errCount === 1 ? ' highlight was not shown.' : ' highlights were not shown.'))
        } else if (vState.ownMark || vState.redirectmark || vState.messageMark) {
          vState.showVulogOverlay()
        } else {
          console.warn('vState NOT showing ovelay  ', { haveMark: Boolean(vState.ownMark), haveMessages: Boolean(vState.messageMark), haveRedirect: Boolean(vState.redirectmark) })
        }
      }
    })
  }
}
const hasHighlights = function (mark) {
  return (mark?.vHighlights && mark.vHighlights.length > 0)
}
const showHighlights = function () {
  if (!vState.showThis) console.warn('No showThis ? SNBH')
  const showThis = vState.showThis || 'ownMark'
  const displayErrs = []
  // let color = 'yellowgreen'
  const toshow = vState[showThis]

  // if (showThis === 'redirect_mark') color = 'yellow'
  if (hasHighlights(toshow)) {
    // const highlights =  JSON.parse(JSON.stringify(toshow.vHighlights))
    toshow.vHighlights.forEach((aHighlight, idx) => {
      const highlightCopy = JSON.parse(JSON.stringify(aHighlight))
      if (!loadHighlights(highlightCopy)) {
        console.warn('Error showing highlight: ', { highlightCopy })
        chrome.runtime.sendMessage({ msg: 'hlightDisplayErr', hlightId: aHighlight.id, url: window.location.href }, function (response) {
        })
        displayErrs.push({ err: true, idx: idx, id: aHighlight.id }) // old versiona s of ovt 24 2022
      }
      // else if (aHighlight.display_err) displayErrs.push({ err: false, idx: idx, id: aHighlight.id })
    })
  } else {
    console.warn('No highligths to show')
  }

  return displayErrs
}

function loadHighlights (highlightObj) {
  // onsole.log('loadHighlights', highlightObj)
  var selection = {
    anchorNode: elementFromQuery(highlightObj.anchorNode, 'anchor', highlightObj.string),
    anchorOffset: highlightObj.anchorOffset,
    focusNode: elementFromQuery(highlightObj.focusNode, 'focus', highlightObj.string),
    focusOffset: highlightObj.focusOffset
  }

  // onsole.log(selection)

  var container = elementFromQuery(highlightObj.container)

  if (!selection.anchorNode || !selection.focusNode || !container) {
    console.warn('NO Anchor or focusNode...', selection)
    return false
  } else {
    // const success = highlightFromSelection(selectionString, container, selection, mapColor(highlightObj.color), highlightObj.id) // returns true on success or false on err
    const success = highlightFromSelection(highlightObj, selection, container) // returns true on success or false on err

    if (!success) {
      console.warn('could not load highlight ', selection)
    } else {
      // onsole.log('success in highlighting')
    }
    return success
  }
}
function elementFromQuery (storedQuery, eltype, thestring) {
  // onsole.log('elementFromQuery',{thestring})
  let lastNode
  var aquery = storedQuery[0]
  if (!storedQuery || storedQuery.length === 0) console.warn('NO Query sent')
  if (!storedQuery || storedQuery.length === 0) {
    return null
  } else if (aquery.id) {
    lastNode = document.getElementById(aquery.id)
  } else if (aquery.nodeId) { // 2022 added for ios
    lastNode = document.getElementById(aquery.nodeId) // due to ios conversion
  } else if (aquery.type === 'html') {
    lastNode = document.getElementsByTagName('html')[0]
  }

  if (!lastNode) console.warn('1 No First node found for ', storedQuery, thestring)

  storedQuery.shift()
  while (lastNode && storedQuery.length > 0) {
    let currentChild = -1
    let targetChild = storedQuery[0].index
    while (currentChild < targetChild) {
      currentChild++
      if (storedQuery.length === 1) {
        if (lastNode.childNodes[currentChild] && lastNode.childNodes[currentChild].className === HIGHLIGHT_CLASS) {
          targetChild += 1
        } else if (lastNode.childNodes[currentChild] && lastNode.childNodes[currentChild].nextSibling && lastNode.childNodes[currentChild].nextSibling.className === HIGHLIGHT_CLASS) {
          targetChild += 2
          currentChild++
        }
      }
    }
    lastNode = lastNode.childNodes[currentChild]

    // fix? put while statement to traverse
    if (!lastNode || !((lastNode.localName === undefined && storedQuery[0].type === 'text') ||
        lastNode.localName === storedQuery[0].type)) {
      console.warn('Got typemismatch on ', { lastNode, storedQuery, eltype, thestring })
    }
    storedQuery.shift()
  }

  if (!lastNode) console.warn('No First node found for ' + eltype + ' ' + thestring, storedQuery)

  return lastNode
}

if (
  document.readyState === 'complete' ||
  (document.readyState !== 'loading' && !document.documentElement.doScroll)
) {
  // 2023-04 - reduce times - if notintiating highlights recheck to see if reduced too much - from 10s & 5s respectively
  setTimeout(function () {
    // onsole.log('going to initiate highlights')
    initiateHighlights()
  }, 1000) // previousl 2
} else {
    setTimeout(function () {
      document.addEventListener('DOMContentLoaded', initiateHighlights)
  }, 3000) // previousl 4
}
