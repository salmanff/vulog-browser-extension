// highlight.js
// Compare iosApp vs ChromeExtension  - verified against iosApp 2022-07-05 and  2022-10??

// Highligher FUNCTIONS from github.com/jeromepl/highlighter
// Pick a combination of characters that should (almost) never occur

/* global Node, vState, showVulogOverlay, mapColor */

/* exported highlightFromSelection, setHighlightsToColor */

var DELIMITERS = {
  start: '~|:;',
  end: ';:~|'
}

function getReplacements (color, id, hasComment) {
  return {
    start: '<span id="vulog_hlight_' + id + '" class="' + HIGHLIGHT_CLASS + (hasComment ? ' hlightComment' : '') + '" style="background-color: ' + color + ';">',
    end: '</span>'
  }
}

var anchor = null
var focus = null
var anchorOffset = 0
var focusOffset = 0
var selectionString = ''
var selectionLength = 0

var startFound = false
var charsHighlighted = 0

function resetVars () {
  anchor = null
  focus = null
  anchorOffset = 0
  focusOffset = 0
  selectionString = ''
  selectionLength = 0
  startFound = false
  charsHighlighted = 0
}

const highlightFromSelection = function (highlightObj, selection, container) {
  // onsole.log('will highlight now string 0')
  const selString = highlightObj.string
  // onsole.log('will highlight now string 1')
  const color = mapColor(highlightObj.color)
  // onsole.log('will highlight now string 2')
  const id = highlightObj.id
  // onsole.log('will highlight now string 3')
  const hasComment = (highlightObj.vComments && highlightObj.vComments.length > 0)
  // onsole.log('will highlight now string ', selString, ' with color ', color)

  // if (vState.showThis === 'ownMark' || vState.showThis === 'redirectmark') {
    // todo - why should 'self' be in above - self_mark shoudl suffice - todo clean logic
    resetVars()

    selectionString = selString
    selectionLength = selectionString.length

    anchor = selection.anchorNode
    anchorOffset = selection.anchorOffset
    focus = selection.focusNode
    focusOffset = selection.focusOffset

    /**
    * STEPS:
    * 1 - Use the offset of the anchor/focus to find the start of the selected text in the anchor/focus element
    *     - Use the first of the anchor of the focus elements to appear
    * 2 - From there, go through the elements and find all Text Nodes until the selected text is all found.
    *     - Wrap all the text nodes (or parts of them) in special characters
    * 3 - Replace the special characters by span tags with a yellow background color in the container html
    * 4 - Deselect text
    */

    // Step 1 + 2:
    recursiveWrapper(container)
    // color = color || 'yellowgreen'
    var replacements = getReplacements(color, id, hasComment)

    // Step 3:
    // Either highlight, or un-highlight the selection

    // Need to take the parent in order to be able to open and close the container's root element (a <span> in the un-highlight case)
    // Also needed for the negative lookahead of the highlight case

    var parent = container.parentNode
    var content = parent.innerHTML

    var startRe, endRe, sanitizeRe

    // sf removed alreadyHighlighted comncept as vulog has manual remove
    startRe = new RegExp(escapeRegex(DELIMITERS.start), 'g')
    endRe = new RegExp(escapeRegex(DELIMITERS.end), 'g')
    content = content.replace(startRe, replacements.start).replace(endRe, replacements.end)

    // Make sure to not highlight the same thing twice, as it breaks the un-highlighting
    sanitizeRe = new RegExp(escapeRegex(replacements.start + replacements.start) + '(.*?)' + escapeRegex(replacements.end + replacements.end), 'g')
    parent.innerHTML = content.replace(sanitizeRe, replacements.start + '$1' + replacements.end)

    // Step 4:
    if (selection.removeAllRanges) selection.removeAllRanges()

    return true // No errors. 'undefined' is returned by default if any error occurs during this method's execution, like if 'content.replace' fails by 'content' being 'undefined'
  // } else {
  //   vState.showVulogOverlay()
  //   return false
  // }
}

function recursiveWrapper (container) {
  [].forEach.call(container.childNodes, function (element) {
    if (element.nodeType === Node.TEXT_NODE) {
      var startIndex = 0

      // Step 1:
      // The first element to appear could be the anchor OR the focus node,
      // since you can highlight from left to right or right to left
      if (!startFound) {
        if (anchor.isEqualNode(element)) {
          startFound = true
          startIndex = anchorOffset
        }
        if (focus.isEqualNode(element)) {
          if (startFound) { // If the anchor and the focus elements are the same, use the smallest index
            startIndex = Math.min(anchorOffset, focusOffset)
          } else {
            startFound = true
            startIndex = focusOffset
          }
        }
      }

      // Step 2:
      if (startFound && charsHighlighted < selectionLength) {
        var nodeValueLength = element.nodeValue.length
        var newText = ''

        // Go over all characters to see if they match the selection.
        // This is done because the selection text and node text contents differ.
        for (var i = 0; i < nodeValueLength; i++) {
          if (i === startIndex) newText += DELIMITERS.start
          if (charsHighlighted === selectionLength) {
            newText += DELIMITERS.end
            newText += element.nodeValue.substr(i)
            break
          }

          newText += element.nodeValue[i]

          if (i >= startIndex && charsHighlighted < selectionLength) {
            // Skip whitespaces as they often cause trouble (differences between selection and actual text)
            while (charsHighlighted < selectionLength && selectionString[charsHighlighted].match(/\s/)) charsHighlighted++

            if (selectionString[charsHighlighted] === element.nodeValue[i]) charsHighlighted++
          }

          if (i === nodeValueLength - 1) newText += DELIMITERS.end
        }

        element.nodeValue = newText
      }
    } else recursiveWrapper(element)
  })
}

const setHighlightsToColor = function (colorOrInherit) {
  console.error('snbh - this is no longer being used. or is it?')
  Array.from(document.getElementsByClassName(HIGHLIGHT_CLASS)).forEach((ahigh) => {
    ahigh.style['background-color'] = colorOrInherit || 'inherit'
  })
}

/** UTILS **/

// Escape Regex special characters
function escapeRegex (text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
}
