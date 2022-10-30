// Highligher FUNCTIONS from github.com/jeromepl/highlighter

/* global parsedPage, chrome, highlightFromSelection, newHlightIdentifier, vulogOverlayGlobal */

'use strict'

var HIGHLIGHT_CLASS = 'VULOG--highlighter--highlighted'

var selection = window.getSelection()
var selectionString = selection.toString()

if (selectionString) {
  // If there is text selected
  var container = selection.getRangeAt(0).commonAncestorContainer

  // Sometimes the element will only be text. Get the parent in that case
  // TODO: Is this really necessary?
  while (!container.innerHTML) {
    container = container.parentNode
  }

  // onsole.log("Vu-highlights storing...: ",selection," from ",window.location.pathname)
  const theHighlight = {
    vCreated: new Date().getTime(),
    string: selection.toString(),
    container: getQuery(container),
    anchorNode: getQuery(selection.anchorNode, 'anchorNode'), // start of selection
    anchorOffset: selection.anchorOffset,
    focusNode: getQuery(selection.focusNode, 'focusnode'), // end of selection
    focusOffset: selection.focusOffset,
    id: newHlightIdentifier()
  }
  chrome.runtime.sendMessage({ purl: parsedPage.props.purl, highlight: theHighlight, msg: 'newHighlight' },
    function (resp) {
      if (!resp || resp.error) console.warn('Error sending info to background ', parsedPage, resp)

      theHighlight.color = resp.color || 'yellowgreen' // todo: Get from preferences
      highlightFromSelection(theHighlight, selection, container)
      vulogOverlayGlobal.self_mark.vHighlights.push(theHighlight)
    }
  )
}

// From an DOM element, get a query to that DOM element
function getQuery (element, eltype) {
  if (element.id) return [{ id: element.id }]
  if (element.localName === 'html') return [{ type: 'html' }]

  var parent = element.parentNode
  var parentSelector = getQuery(parent)

  const type = element.localName || 'text'
  // ..
  let realindex = -1
  let offset = 0
  while (parent.childNodes[++realindex] && parent.childNodes[realindex] !== element) {
    if (eltype && parent.childNodes[realindex].className === HIGHLIGHT_CLASS) {
      offset += (parent.childNodes[realindex].previousSibling ? 2 : 1) // 1 for the span and 1 for the next text element
    }
  }
  const index = (parent.childNodes[realindex] === element) ? (realindex - offset) : -1
  // if (index<0) console.warn("DID NOT find the getQuery")
  // let index = Array.prototype.indexOf.call(parent.childNodes, element);
  parentSelector.push({ type, index })
  return parentSelector
}
