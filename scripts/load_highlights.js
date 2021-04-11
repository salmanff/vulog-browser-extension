// Highligher FUNCTIONS from github.com/jeromepl/highlighter

/* global parsedPage, chrome, vulogOverlayGlobal, showVulogOverlay, highlightFromSelection, HIGHLIGHT_CLASS */

const initiateHighlights = function () {
  if (!parsedPage.props.isiframe) {
    chrome.runtime.sendMessage({ purl: parsedPage.props.purl, msg: 'getMarkFromVulog' }, function (response) {
      // onsole.log(response)
      let showthis = null
      if (!response || response.error) {
        console.warn(response ? response.error : 'No response from vulog extension - internal error?')
      } else {
        if (response.mark) {
          vulogOverlayGlobal.self_mark = response.mark
          showthis = 'self_mark'
        }
        if (response.redirectedmark) {
          vulogOverlayGlobal.redirect_mark = response.redirectedmark
          showthis = 'redirect_mark'
        }
      }
      const displayErrs = showHighlights(showthis)
      if (displayErrs.length > 0) {
        if (showthis === 'self_mark') {
          chrome.runtime.sendMessage({ purl: parsedPage.props.purl, msg: 'marksDisplayErrs', display_errs: displayErrs }, function (response) {
            // onsole.log(response)
          })
        } else {
          console.warn(displayErrs)
        }
      }
      if (response.redirectedmark) showVulogOverlay()
    })
  }
}
const showHighlights = function (showthis) {
  var displayErrs = []
  // let color = 'yellowgreen'
  if (showthis) {
    //if (showthis === 'redirect_mark') color = 'yellow'
    if (vulogOverlayGlobal[showthis].vulog_highlights && vulogOverlayGlobal[showthis].vulog_highlights.length > 0) {
      const highlights = JSON.parse(JSON.stringify(vulogOverlayGlobal[showthis].vulog_highlights))
      highlights.forEach((aHighlight, idx) => {
        if (!loadHighlights(aHighlight)) displayErrs.push({ err: true, idx: idx })
        else if (aHighlight.display_err) displayErrs.push({ err: false, idx: idx })
      })
      vulogOverlayGlobal.shown_highlight = showthis
    }
  }
  return displayErrs
}

function loadHighlights (highlightVal) {
  //console.log('loadHighlights',highlightVal)
  var selection = {
    anchorNode: elementFromQuery(highlightVal.anchorNode, 'anchor', highlightVal.string),
    anchorOffset: highlightVal.anchorOffset,
    focusNode: elementFromQuery(highlightVal.focusNode, 'focus', highlightVal.string),
    focusOffset: highlightVal.focusOffset
  }

  // onsole.log(selection)

  var selectionString = highlightVal.string
  var container = elementFromQuery(highlightVal.container)

  if (!selection.anchorNode || !selection.focusNode || !container) {
    console.warn('NO Anchor or focusNode...', selection)
    return false
  } else {
    const success = highlightFromSelection(selectionString, container, selection, highlightVal.color) // returns true on success or false on err
    if (!success) console.warn('could not load highlight ', selection)
    return success
  }
}
function elementFromQuery (storedQuery, eltype, thestring) {
  //console.log('elementFromQuery',{thestring})
  let lastNode
  var aquery = storedQuery[0]
  if (!storedQuery || storedQuery.length === 0) console.warn('NO Query sent')
  if (!storedQuery || storedQuery.length === 0) {
    return null
  } else if (aquery.id) {
    lastNode = document.getElementById(aquery.id)
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

    // put while statement to traverse
    if (!lastNode || !((lastNode.localName === undefined && storedQuery[0].type === 'text') ||
        lastNode.localName === storedQuery[0].type)) console.warn('Got typemismatch on ', {lastNode, storedQuery, eltype, thestring})//lastNode, storedQuery[0])
    storedQuery.shift()
  }

  if (!lastNode) console.warn('No First node found for ' + eltype + ' ' + thestring, storedQuery)

  return lastNode
}

if (
  document.readyState === 'complete' ||
  (document.readyState !== 'loading' && !document.documentElement.doScroll)
) {
  initiateHighlights()
} else {
  document.addEventListener('DOMContentLoaded', initiateHighlights)
}
