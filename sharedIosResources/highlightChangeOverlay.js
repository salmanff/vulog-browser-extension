
// highlightChangeOverlay.js
// Change Highlight Bpx and functions

/* global chrome */
/* from overlay.js */
/* global vulogOverlayGlobal, overlayUtils, HIGHLIGHT_CLASS */
/* from utils */
/* global isIos, pasteAsText, COLOR_MAP */

vulogOverlayGlobal.drawHighlightChangeOptionsBox = function (e) {
  // onsole.log('drawHighlightChangeOptionsBox')
  if (vulogOverlayGlobal.shown_highlight === 'self_mark') {
    const hlightId = e.target.id.split('_')[2]
    const currentHColor = overlayUtils.mainColorOf(e.target.style.backgroundColor)
    const thehighLight = vulogOverlayGlobal.getHLightFrom(hlightId)

    if (thehighLight) {
      let changeHighlightBox
      if (document.getElementById('vulog_changeHighlight_outer')) { // box had been shown previously
        changeHighlightBox = document.getElementById('vulog_changeHighlight_outer')
        changeHighlightBox.innerHTML = ''
      } else { // new box
        changeHighlightBox = overlayUtils.makeEl('div', 'vulog_changeHighlight_outer', null, '')
      }
      changeHighlightBox.style.display = 'block'

      // onsole.log('window.scrollY' + window.scrollY + '   e.clientx and y ', e.clientX, ' - ', e.clientY)
      // onsole.log('window.scrollY result ' + ((window.scrollY + (e.clientY || ((e.touches && e.touches[0]) ? e.touches[0].clientY : null) || 0))))
      if (isIos()) {
        changeHighlightBox.style.top = (window.scrollY + (e.clientY || ((e.touches && e.touches[0]) ? e.touches[0].clientY : null) || 0)) + 'px'
        const OUTERBOX_SIZE = 200
        changeHighlightBox.style.left = (window.scrollX + window.innerWidth - e.clientX < OUTERBOX_SIZE
          ? Math.max(0, Math.round(window.scrollX + window.innerWidth - OUTERBOX_SIZE))
          : Math.max(0, Math.round(window.scrollX + e.clientX - OUTERBOX_SIZE / 2))) + 'px'
      } else {
        changeHighlightBox.style.top = (e.pageY - 30) + 'px'
        changeHighlightBox.style.left = (10 + e.pageX) + 'px'
      }

      changeHighlightBox.appendChild(vulogOverlayGlobal.drawCommentsSection(thehighLight, window.location.href, { hlightId }))

      const colorChanger = overlayUtils.makeEl('div', 'vulogIos_pallette_area_for_change', '')

      colorChanger.appendChild(vulogOverlayGlobal.highlightChangeOptionsBoxColorTable(currentHColor, hlightId, false))
      changeHighlightBox.appendChild(colorChanger)

      const removeButt = overlayUtils.makeEl('div', 'vulog_hlightdeleteNote_' + hlightId, 'vulog_dialogue_butts redcol')
      removeButt.innerText = 'Remove Highlight'
      // const trash = document.createElement('img')
      // trash.src = chrome.runtime.getURL('images/trash_red.png')
      // trash.className = 'vulog_inner_butt_img'
      // trash.style.width = '20px'
      removeButt.onclick = function () {
        // onsole.log('removeHighlight remove hlight of id ' + hlightId)
        chrome.runtime.sendMessage({ msg: 'removeHighlight', hlightId, url: window.location.href }, function (response) {
          window.location.reload()
          // vulogOverlayGlobal.hideHighlighterDivs()
          // const hLightDiv = document.getElementById('vulog_hlight_' + hlightId)
          // hLightDiv.style.backgroundColor = ''
          // hLightDiv.className = ''
          // hLightDiv.id = ''
        })
      }
      changeHighlightBox.appendChild(removeButt)

      document.body.appendChild(changeHighlightBox)
    } else {
      const errorText = overlayUtils.makeEl('div', '', 'redcol')
      errorText.innerText = 'Error: Could not retrieve highlight. sorry!'
      console.warn('Error: Could not retrieve highlight. sorry!')
    }
  } else {
    console.warn('todo - handle highlights from others.')
  }
}
vulogOverlayGlobal.hideHighlighterDivs = function () {
  if (document.getElementById('vulog_changeHighlight_outer')) document.getElementById('vulog_changeHighlight_outer').style.display = 'none'
  // ios only:
  if (document.getElementById('vulog_highlighter_outer')) document.getElementById('vulog_highlighter_outer').style.display = 'none'
  if (document.getElementById('vulogIos_colorChoosearea')) document.getElementById('vulogIos_colorChoosearea').style.display = 'none'
}
vulogOverlayGlobal.getHLightFrom = function (hlightId) {
  const theMark = vulogOverlayGlobal[vulogOverlayGlobal.shown_highlight]
  // onsole.log(' getHLightFrom ', { hlightId, theMark, vulogOverlayGlobal })
  if (theMark && theMark.vHighlights && theMark.vHighlights.length > 0) {
    let theHLight = null
    theMark.vHighlights.forEach((hlight, i) => {
      if (hlight.id === hlightId) theHLight = theMark.vHighlights[i]
    })
    return theHLight
  } else {
    console.warn('snbh - no highlight found to mark')
    return null
  }
}
vulogOverlayGlobal.highlightChangeOptionsBoxColorTable = function (currentColor = 'yellowgreen', hlightId, chooseNotChange = true) {
  // onsole.log(' highlightChangeOptionsBoxColorTable current volor is ', currentColor)
  const colorTable = overlayUtils.makeEl('div', '', '', '')
  for (const [key, value] of Object.entries(COLOR_MAP)) {
    if (currentColor !== key || !chooseNotChange) {
      var colorChoice = overlayUtils.makeEl('div', 'vulogIos_color' + (chooseNotChange ? 'Choice' : 'Change') + '_' + key + (chooseNotChange ? '' : ('_' + hlightId)), 'ios_vulog_colorPalletteChoice', '')
      colorChoice.style['background-color'] = value
      colorChoice.style.border = chooseNotChange
        ? '1px solid white'
        : ('3px solid ' + (currentColor === key ? 'grey' : 'white'))
      colorTable.appendChild(colorChoice)
    }
  }
  return colorTable
}
vulogOverlayGlobal.setHColor = function (hColor, cb) {
  // onsole.log(' vulogOverlayGlobal.setHColor - from ', vulogOverlayGlobal.currentHColor, ' to ', hColor)
  vulogOverlayGlobal.currentHColor = hColor
  chrome.runtime.sendMessage({ msg: 'setHColor', hColor, url: window.location.href }, function (response) {
    // non ios
    if (vulogOverlayGlobal.addPalleteeArea) vulogOverlayGlobal.addPalleteeArea()
    if (vulogOverlayGlobal.setCursorColor) vulogOverlayGlobal.setCursorColor()
    if (cb) cb(response)
  })
}
vulogOverlayGlobal.changeHlightColor = function (e) {
  const hColor = e.target.id.split('_')[2]
  const hlightId = e.target.id.split('_')[3]
  // onsole.log('will change color for hlightId ', hlightId)
  chrome.runtime.sendMessage({ msg: 'changeHlightColor', hColor, hlightId, url: window.location.href }, function (response) {
    if (response.error) console.warn('got error trying to change color')
    const hLightDiv = document.getElementById('vulog_hlight_' + hlightId)
    if (!response.error && hLightDiv) hLightDiv.style.backgroundColor = COLOR_MAP[hColor]
    if (!hLightDiv) console.warn('couldnt find vulog_hlight_' + hlightId)
    const colorChanger = document.getElementById('vulogIos_pallette_area_for_change')
    colorChanger.innerHTML = ''
    colorChanger.appendChild(vulogOverlayGlobal.highlightChangeOptionsBoxColorTable(hColor, hlightId, false))
    // todo later => change the self mark as well? needed for note? or send the whole self_mark back
  })
}
vulogOverlayGlobal.drawCommentsSection = function (theObject, purl, options = {}) { // hlighId or markId
  const retDiv = overlayUtils.makeEl('div', null, { style: { 'background-color': 'white', 'margin-right': '10px' } })
  var objId = theObject.id /* for highlights */ || theObject._id /* for synced items */ || theObject.fj_local_temp_unique_id
  // onsole.log('drawCommentsSection ', { options, objId, theObject })
  if (theObject.vComments && theObject.vComments.length > 0) {
    retDiv.appendChild(overlayUtils.makeEl('div', null, { 'font-size': '12px', 'text-align': 'left', 'font-weight': 'bold', 'text-decoration': 'underline' }, 'Annotations:'))
    theObject.vComments.forEach((comment, i) => {
      if (comment.text && comment.text !== '') {
        const creator = overlayUtils.makeEl('span', null, { 'font-size': '14px', 'font-weight': 'bold' }, (comment.creator ? (comment.creator + ', ') : ''))
        const smartDate = overlayUtils.makeEl('span', null, { 'font-size': '14px', 'font-style': 'italic' }, (overlayUtils.smartDate(comment.vCreated) + ': '))
        const text = overlayUtils.makeEl('span', null, { 'font-size': '14px' }, comment.text)
        const outer = overlayUtils.makeEl('div', null, { 'font-size': '14px', 'text-align': 'left' })
        outer.appendChild(creator)
        outer.appendChild(smartDate)
        outer.appendChild(text)
        retDiv.appendChild(outer)
      }
    })
  }

  const notesDiv = overlayUtils.makeEl('div', null, 'vulog_overlay_input vulog_notes')
  notesDiv.setAttribute('contenteditable', 'true')
  notesDiv.setAttribute('placeholder', 'Add Annotation')
  notesDiv.onpaste = function (evt) {
    pasteAsText(evt)
  }
  notesDiv.onkeyup = function (evt) {
    document.getElementById('vulog_hlight_saveNote' + objId).style.display = 'block' // .className = 'vulog_dialogue_butts bluecol'
    setTimeout(function () {
      const theNote = evt.target.textContent
      theObject.vNote = theNote
      chrome.runtime.sendMessage({
        msg: (options.hlightId ? 'saveHlightComment' : 'saveMainComment'),
        url: purl,
        id: objId,
        notes: theNote
      }, function (response) {
        if (!response || response.error) {
          console.warn((response ? response.error : 'error saving note'))
        }
        // lister.markUpdater.updated()
      })
    }, 0)
  }
  if (theObject.vNote) notesDiv.innerText = theObject.vNote
  retDiv.appendChild(notesDiv)

  const saveDiv = overlayUtils.makeEl('div', 'vulog_hlight_saveNote' + objId, 'vulog_dialogue_butts bluecol')
  saveDiv.style.display = theObject.vNote ? 'block' : 'none'
  saveDiv.innerText = 'Post Annotation'
  saveDiv.onclick = function (e) {
    const vCreated = new Date().getTime()
    const text = notesDiv.innerText
    const theComment = { text, vCreated }
    if (!theObject.vComments) theObject.vComments = []
    theObject.vComments.push(theComment)
    theObject.vNote = ''
    if (options.hlightId) { // dealing with a highlight
      if (document.getElementById('vulog_hlight_' + objId)) document.getElementById('vulog_hlight_' + objId).className = HIGHLIGHT_CLASS + ' hlightComment'
      // if (!document.getElementById('vulog_hlight_' + thehighLight.id)) console.log('could not get element with id ', document.getElementById(thehighLight.id))
      chrome.runtime.sendMessage({ msg: 'addHLightComment', hlightId: objId, text, vCreated, url: purl }, function (response) {
        const parent = e.target.parentElement
        parent.innerHTML = ''
        parent.appendChild(vulogOverlayGlobal.drawCommentsSection(theObject, purl, options))
        vulogOverlayGlobal.hideHighlighterDivs() // for overlay
      })
    } else if (options.markId) {
      chrome.runtime.sendMessage({
        msg: 'postMainComment',
        url: purl,
        id: options.markId,
        theComment: theComment,
        tabinfo: null
      }, function (response) {
        if (!response || response.error) {
          console.warn('err' + (response ? response.error : null))
        } else {
          // onsole.log('here why not work')
          const parent = e.target.parentElement
          parent.innerHTML = ''
          parent.appendChild(vulogOverlayGlobal.drawCommentsSection(theObject, purl, options))
        }
      })
    } else {
      console.warn('SNBH - need to have comments for mark or for hlight')
    }
  }
  retDiv.appendChild(saveDiv)
  return retDiv
}
