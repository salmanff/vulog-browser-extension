// Highligher FUNCTIONS from github.com/jeromepl/highlighter

/* global parsedPage, chrome, vulogOverlayGlobal, vulogutils,  showVulogOverlay, highlightFromSelection, HIGHLIGHT_CLASS */

const initiateHighlights = function () {
  if (!parsedPage.props.isiframe) {
    const overlayOuter = vulogutils.makeEl('div', 'vulog_overlay_outer', null, '')
    overlayOuter.style.display = 'none'
    document.body.appendChild(overlayOuter)

    chrome.runtime.sendMessage({ purl: parsedPage.props.purl, msg: 'getMarkFromVulog' }, function (response) {
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
        if (response.messages && response.messages.length > 0) {
          vulogOverlayGlobal.messages = response.messages
          showthis = showthis || 'messages_0'
        }
        // https://www.w3resource.com/javascript-exercises/fundamental/javascript-fundamental-exercise-171.php
        const parseCookie = str =>
          str
            .split(';')
            .map(v => v.split('='))
            .reduce((acc, v) => {
              if (v && v[0] && v[1]) acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim())
              return acc
            }, {})
        const cookies = parseCookie(document.cookie)
        if (cookies.vulog_show) {
          showthis = cookies.vulog_show
          if (!showthis || showthis === 'none') {
            showthis = 'none'
            vulogOverlayGlobal.shown_highlight = 'none'
          }
          if (showthis === 'self') showthis = 'self_mark'
          if (showthis === 'redirect' && vulogOverlayGlobal.redirect_mark) showthis = 'redirect_mark'
        }
      }
      if (!showthis) showthis = 'none'
      if (showthis) document.cookie = 'vulog_show=' + showthis + '; expires= ' + (new Date(new Date().getTime() + 1000)).toUTCString()
      const displayErrs = showHighlights(showthis)
      var errCount = 0
      for (const anErr in displayErrs) { if (anErr && anErr.err) errCount++ }
      vulogOverlayGlobal.showthis = showthis
      if (errCount > 0) {
        if (showthis === 'self_mark') {
          chrome.runtime.sendMessage({ purl: parsedPage.props.purl, msg: 'marksDisplayErrs', display_errs: displayErrs }, function (response) {
            // onsole.log(response)
          })
        }
        showVulogOverlay('Some errors occured in displaying highlights. ' + errCount + (errCount === 1 ? ' highlight was not shown.' : ' highlights were not shown.'))
      } else if (response.redirectedmark || (response.messages && response.messages.length > 0)) {
        showVulogOverlay()
      }
    })
  }
}
const showHighlights = function (showthis) {
  var displayErrs = []
  // let color = 'yellowgreen'
  let toshow = null
  if (showthis && showthis !== 'none') {
    if (showthis.split('_')[0] === 'messages') {
      toshow = vulogOverlayGlobal.messages[parseInt(showthis.split('_')[1])]
      toshow = toshow && toshow.record ? toshow.record : null
    } else {
      toshow = vulogOverlayGlobal[showthis]
    }
    // if (showthis === 'redirect_mark') color = 'yellow'
    if (toshow && toshow.vulog_highlights && toshow.vulog_highlights.length > 0) {
      const highlights = JSON.parse(JSON.stringify(toshow.vulog_highlights))
      highlights.forEach((aHighlight, idx) => {
        if (!loadHighlights(aHighlight)) displayErrs.push({ err: true, idx: idx })
        else if (aHighlight.display_err) displayErrs.push({ err: false, idx: idx })
      })
      vulogOverlayGlobal.shown_highlight = showthis
      vulogOverlayGlobal.shown_highlight_details = toshow.vulog_highlights
    }
  } else {
    vulogOverlayGlobal.shown_highlight = 'self_mark'
  }
  return displayErrs
}

function loadHighlights (highlightVal) {
  // console.log('loadHighlights',highlightVal)
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
  // console.log('elementFromQuery',{thestring})
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
