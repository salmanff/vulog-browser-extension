// overlay.js - part of vulog
// Compare iosApp vs ChromeExtension - verified 2022-07-05

/* global chrome, overlayUtils, vulogPageDataFromSwift, pasteAsText, COLOR_MAP, isIos, pureUrlify, VuPageData, highlightFromSelection, alert, showHighlights, newHlightIdentifier, HIGHLIGHT_CLASS */

const vulogOverlayGlobal = {
  purl: pureUrlify(window.location.href), // new 220705 - used to be parsedPage.props.purl, and defined below,
  self_mark: null,
  showthis: 'none',
  redirect_mark: null,
  messages: null,
  shown_highlight: null,
  shown_highlight_details: null,
  edit_mode: false,
  currentHColor: 'green'
}
// onsole.log('overlay running ', isIos())
if (!isIos()) {
  vulogOverlayGlobal.pageInfoFromPage = (new VuPageData({ ignoreNonStandard: true, ignoreCookies: true }).props)

  vulogOverlayGlobal.desktop_overlay = {
    is_open: false,
    close: function () {
      vulogOverlayGlobal.desktop_overlay.is_open = false
      if (document.getElementById('vulog_overlay_outer')) document.getElementById('vulog_overlay_outer').style.display = 'none'
    },
    timer: null,
    extend_timer: function () {
      clearTimeout(vulogOverlayGlobal.desktop_overlay.timer)
      // vulogOverlayGlobal.desktop_overlay.timer = setTimeout(this.desktop_overlay.close, 20000)
    },
    toggleMark: function (theStar, starWasChosen) {
      vulogOverlayGlobal.desktop_overlay.extend_timer()
      const thediv = document.getElementById('vulog_overlay_' + theStar + (starWasChosen ? '_ch' : '_nc'))
      if (thediv) {
        chrome.runtime.sendMessage({
          msg: 'mark_star',
          url: window.location.href,
          purl: vulogOverlayGlobal.purl,
          id: (vulogOverlayGlobal.self_mark ? vulogOverlayGlobal.self_mark._id : null),
          theStar: theStar,
          doAdd: !starWasChosen,
          publishChange: false,
          tabinfo: null
        }, function (response) {
          thediv.id = ('vulog_overlay_' + theStar + (starWasChosen ? '_nc' : '_ch'))
        })
      } else {
        // onsole.log("not div means it's not chosen")
      }
    },
    copy_highs: function () {
      vulogOverlayGlobal.desktop_overlay.extend_timer()
      if (!vulogOverlayGlobal.self_mark.vHighlights)vulogOverlayGlobal.self_mark.vHighlights = []
      // onsole.log(vulogOverlayGlobal)
      vulogOverlayGlobal.shown_highlight_details.forEach(ahigh => vulogOverlayGlobal.self_mark.vHighlights.push(ahigh))
      chrome.runtime.sendMessage({ purl: vulogOverlayGlobal.pageInfoFromPage.purl, highlights: vulogOverlayGlobal.shown_highlight_details, msg: 'copyHighlights' },
        function (resp) {
          if (resp.error) console.warn('Error sending info to background ', vulogOverlayGlobal.pageInfoFromPage) // new 220705 - used to be parsedPage instead of vulogOverlayGlobal.pageInfoFromPage
          else overlayUtils.setCookieAndReload('self')
        }
      )
    }
  }

  vulogOverlayGlobal.showVulogOverlay = function (errMsg) {
    vulogOverlayGlobal.desktop_overlay.extend_timer()
    vulogOverlayGlobal.desktop_overlay.is_open = true
    chrome.runtime.sendMessage({ msg: 'getMarkFromVulog', purl: vulogOverlayGlobal.pageInfoFromPage.purl, tabinfo: null }, function (response) {
      vulogOverlayGlobal.currentHColor = response.hcolor || 'green'
      if (response.mark) {
        vulogOverlayGlobal.self_mark = response.mark
        nowShowMarks(errMsg)
      } else if (!response.haveFreezr) {
        vulogOverlayGlobal.self_mark = { purl: vulogOverlayGlobal.pageInfoFromPage.purl }
        nowShowMarks(errMsg)
      } else {
        vulogOverlayGlobal.self_mark = { purl: vulogOverlayGlobal.pageInfoFromPage.purl }
        nowShowMarks(errMsg)
        chrome.runtime.sendMessage({ msg: 'getMarkOnlineInBg', purl: vulogOverlayGlobal.pageInfoFromPage.purl, tabinfo: null }, function (response) {})
        setTimeout(function () {
          chrome.runtime.sendMessage({ msg: 'getMarkFromVulog', purl: vulogOverlayGlobal.pageInfoFromPage.purl, tabinfo: null }, function (response) {
            if (response && response.mark) {
              vulogOverlayGlobal.self_mark = response.mark
              nowShowMarks(errMsg)
            }
          })
        }, 2000) // time for server to respond
      }
    })

    function nowShowMarks (errMsg) {
      const vulogToggleOverlay = function (e) {
        var parts = e.target.id.split('_')
        const theStar = parts[2]
        const starWasChosen = (parts[3] === 'ch')
        vulogOverlayGlobal.desktop_overlay.toggleMark(theStar, starWasChosen)
      }

      // Add overlay
      var overlay
      if (document.getElementById('vulog_overlay_outer')) {
        overlay = document.getElementById('vulog_overlay_outer')
        overlay.innerHTML = ''
      } else {
        overlay = overlayUtils.makeEl('div', 'vulog_overlay_outer', null, '')
      }
      overlay.style.display = 'block'

      if (errMsg) {
        var errDiv = overlayUtils.makeEl('div', 'vulog_overlay_errMsg', null, errMsg)
        overlay.appendChild(errDiv)
      }

      overlay.appendChild(overlayUtils.makeEl('div', null, null, 'vulog bookmarks'))

      var aspan = overlayUtils.makeEl('span', 'vulog_overlay_cross_ch')
      aspan.onclick = vulogOverlayGlobal.desktop_overlay.close
      overlay.appendChild(aspan)

      var stars = vulogOverlayGlobal.self_mark.vStars || []
      const MAIN_STARS = ['star', 'inbox', 'archive']
      var stardiv = document.createElement('div')
      stardiv.style['text-align'] = 'center'
      MAIN_STARS.forEach(aStar => {
        var adiv = overlayUtils.makeEl('div', ('vulog_overlay_' + aStar + (stars.includes(aStar) ? '_ch' : '_nc')), 'vulog_overlay_stars')
        adiv.onclick = vulogToggleOverlay
        stardiv.appendChild(adiv)
      })
      overlay.appendChild(stardiv)

      const vulogOverlayTextListener = function (evt) {
        vulogOverlayGlobal.desktop_overlay.extend_timer()
        // if (evt.keyCode === 13) evt.preventDefault() // return key
        vulogOverlaySaveNotesTags()
        // if ([13, 27].includes(evt.keyCode) || (evt.keyCode === 9 /* tab */ && evt.target.id === 'vulog_overlay_notes')) vulogOverlayGlobal.close() // return or escape key & tab if on notes
      }

      const vulogOverlaySaveNotesTags = function () {
        // todo 2022-10 - use highlughtcomments for this?
        vulogOverlayGlobal.desktop_overlay.extend_timer()
        var theNotes = document.getElementById('vulog_overlay_notes').textContent
        vulogOverlayGlobal.self_mark.vNote = theNotes
        chrome.runtime.sendMessage({
          msg: 'saveMainComment',
          purl: vulogOverlayGlobal.self_mark.purl,
          id: vulogOverlayGlobal.self_mark._id,
          notes: theNotes,
          tabinfo: null
        }, function (response) {
          if (!response || response.error) console.warn('err' + (response ? response.error : null))
          if (document.getElementById('vulog_overlay_savenotes')) document.getElementById('vulog_overlay_savenotes').className = 'vulog_overlay_grey'
        })
      }

      const selfHighlights = (vulogOverlayGlobal.self_mark && vulogOverlayGlobal.self_mark.vHighlights && vulogOverlayGlobal.self_mark.vHighlights.length > 0) ? vulogOverlayGlobal.self_mark.vHighlights : null
      const redirectHighlights = (vulogOverlayGlobal.redirect_mark && vulogOverlayGlobal.redirect_mark.vHighlights && vulogOverlayGlobal.redirect_mark.vHighlights.length > 0) ? vulogOverlayGlobal.redirect_mark.vHighlights : null
      const hasMessages = (vulogOverlayGlobal.messages && vulogOverlayGlobal.messages.length > 0) ? vulogOverlayGlobal.messages : null
      let messageHighlights = false
      if (hasMessages) {
        vulogOverlayGlobal.messages.forEach((messageHl, i) => {
          if (messageHl.record && messageHl.record.vHighlights && messageHl.record.vHighlights.length > 0) messageHighlights = true
        })
      }
      const hasHighlights = (selfHighlights || redirectHighlights || messageHighlights)
      const hasNotesOrHighs = hasHighlights || hasMessages

      if (vulogOverlayGlobal.showthis === 'self_mark' || vulogOverlayGlobal.showthis === 'none') { // || !hasHighlights
        // Add pallette
        const palletteOuter = overlayUtils.makeEl('div')
        palletteOuter.appendChild(overlayUtils.makeEl('div', '', 'vulog_overlay_titles', 'Highligher Pallette'))
        palletteOuter.appendChild(overlayUtils.makeEl('div', 'vulog_overlay_palletteArea', '', ''))
        overlay.appendChild(palletteOuter)
        setTimeout(vulogOverlayGlobal.addPalleteeArea, 5)

        // Add edit_mode
        overlay.appendChild(overlayUtils.makeEl('div', null, 'vulog_overlay_titles', 'Edit mode'))
        var editModeArea = overlayUtils.makeEl('div', 'vulog_overlay_editModeArea', null, null)
        editModeArea.style['margin-top'] = '-5px'
        overlay.appendChild(editModeArea)
        setTimeout(vulogOverlayGlobal.addEditModeButton, 5)
      }
      const notesDiv = overlayUtils.makeEl('div', 'vulog_overlay_notes', 'vulog_overlay_input')
      const messagenum = 0

      if (vulogOverlayGlobal.showthis === 'self_mark' || vulogOverlayGlobal.showthis === 'none') {
        overlay.appendChild(overlayUtils.makeEl('div', null, 'vulog_overlay_titles', 'Notes'))
        notesDiv.style['min-height'] = '36px'
        notesDiv.style.cursor = 'text'
        notesDiv.setAttribute('contenteditable', 'true')
        notesDiv.onpaste = function (evt) {
          pasteAsText(evt)
          vulogOverlaySaveNotesTags()
        }

        notesDiv.onkeydown = vulogOverlayTextListener
        if (vulogOverlayGlobal.self_mark.vulog_mark_tags && vulogOverlayGlobal.self_mark.vulog_mark_tags.length > 0) notesDiv.textContent += vulogOverlayGlobal.self_mark.vulog_mark_tags.join(' ')
        if (vulogOverlayGlobal.self_mark.vulog_mark_notes && vulogOverlayGlobal.self_mark.vulog_mark_notes.trim().length > 0) notesDiv.textContent += vulogOverlayGlobal.self_mark.vulog_mark_notes
        if (vulogOverlayGlobal.self_mark.vNote && vulogOverlayGlobal.self_mark.vNote.trim().length > 0) notesDiv.textContent += ' ' + vulogOverlayGlobal.self_mark.vNote
        overlay.appendChild(notesDiv)
      }

      var shownHighlight = null

      if (hasNotesOrHighs) {
        let highlightTitle = null
        if (vulogOverlayGlobal.showthis === 'self_mark') {
          shownHighlight = 'self'
          highlightTitle = 'Showing Your notes and highlights'
        } else if (vulogOverlayGlobal.showthis === 'none') {
          shownHighlight = 'self'
          highlightTitle = 'Enter any notes'
        } else if (vulogOverlayGlobal.showthis === 'redirect_mark') {
          shownHighlight = 'redirect'
          highlightTitle = 'Showing highlights from ' + vulogOverlayGlobal.redirect_mark._data_owner + ' @ ' + vulogOverlayGlobal.redirect_mark.host
        } else if (vulogOverlayGlobal.showthis.includes('messages')) {
          shownHighlight = 'messages'
          highlightTitle = 'Showing notes and highlights from ' + vulogOverlayGlobal.messages[messagenum].sender_id + ' @ ' + vulogOverlayGlobal.messages[messagenum].sender_host
        }

        // overlay.appendChild(overlayUtils.makeEl('div', null, null, highlightTitle))

        var theselect = overlayUtils.makeEl('div', null, 'normheight boldtext', highlightTitle)
        theselect.style['font-size'] = '10px'
        theselect.style['margin-top'] = '10px'

        if (shownHighlight !== 'self' && vulogOverlayGlobal.messages[messagenum].record.vNote) {
          notesDiv.innerText = vulogOverlayGlobal.messages[messagenum].record.vNote
          notesDiv.style.color = 'blue'
          overlay.appendChild(notesDiv)
        }

        // add buttons
        const hasAMessageHighlight = vulogOverlayGlobal.messages && vulogOverlayGlobal.messages[messagenum] && vulogOverlayGlobal.messages[messagenum].record && vulogOverlayGlobal.messages[messagenum].record.vHighlights && vulogOverlayGlobal.messages[messagenum].record.vHighlights.length > 0
        if (['redirect', 'messages'].indexOf(shownHighlight) >= 0 && hasAMessageHighlight) {
          // console.log todo add similar logic for redirectHighlights
          var addhighs = overlayUtils.makeEl('div', null, 'vulog_overlay_butt', 'Copy Highlights')
          addhighs.onclick = function () {
            vulogOverlayGlobal.desktop_overlay.copy_highs()
          }
          theselect.appendChild(addhighs)
        }
        var remhighs = overlayUtils.makeEl('div', null, 'vulog_overlay_butt', 'Hide Highlights')
        remhighs.onclick = function () { overlayUtils.setCookieAndReload('none') }
        theselect.appendChild(remhighs)

        if (shownHighlight !== 'self') {
          const showSelf = overlayUtils.makeEl('div', null, 'vulog_overlay_butt', 'show Your Own Notes and Highlights')
          showSelf.onclick = function () { overlayUtils.setCookieAndReload('self') }
          theselect.appendChild(showSelf)
        }

        if (redirectHighlights || messageHighlights || hasMessages) {
          const others = overlayUtils.makeEl('div', null, null, 'Shared Highlights - click to show')
          let othersCount = 0

          if (redirectHighlights && shownHighlight !== 'redirect') {
            const redirectViewButt = overlayUtils.makeEl('div', null, 'vulog_overlay_butt', (vulogOverlayGlobal.redirect_mark._data_owner + ' @ ' + vulogOverlayGlobal.redirect_mark.host))
            redirectViewButt.onclick = function () { overlayUtils.setCookieAndReload('redirect') }
            othersCount++
            others.appendChild(redirectViewButt)
          }

          if (messageHighlights || hasMessages) {
            vulogOverlayGlobal.messages.forEach((messageHl, i) => {
              if (shownHighlight !== 'messages' || messagenum !== i) {
                const msgViewButt = overlayUtils.makeEl('div', null, 'vulog_overlay_butt', (vulogOverlayGlobal.messages[i].sender_id + ' @ ' + vulogOverlayGlobal.messages[i].sender_host))
                const toOpen = 'messages_' + i
                msgViewButt.onclick = function () { overlayUtils.setCookieAndReload(toOpen) }
                othersCount++
                others.appendChild(msgViewButt)
              }
            })
          }

          if (othersCount) theselect.appendChild(others)
        }
        overlay.appendChild(theselect)
      }

      document.body.appendChild(overlay)
      if (!redirectHighlights && document.getElementById('vulog_overlay_notes')) document.getElementById('vulog_overlay_notes').focus()
    }
  }

  // fix this
  vulogOverlayGlobal.addPalleteeArea = function () {
    const palletteModeArea = document.getElementById('vulog_overlay_palletteArea')
    palletteModeArea.innerHTML = ''

    const colorTable = overlayUtils.makeEl('div', null, 'vulog_colorAreaDiv', '')
    for (const [key, value] of Object.entries(COLOR_MAP)) {
      var colorChoice = overlayUtils.makeEl('div', null, 'vulog_colorPalletteChoice', '')
      colorChoice.style['background-color'] = value
      colorChoice.style.border = '2px solid ' + (vulogOverlayGlobal.currentHColor === key ? 'darkgrey' : 'white')
      colorChoice.onclick = function () {
        vulogOverlayGlobal.setHColor(key, vulogOverlayGlobal.addPalleteeArea)
      }
      colorTable.appendChild(colorChoice)
    }

    palletteModeArea.appendChild(colorTable)
  }

  vulogOverlayGlobal.addEditModeButton = function () {
    const editModeArea = document.getElementById('vulog_overlay_editModeArea')
    if (editModeArea) {
      editModeArea.innerHTML = ''
      const modeButton = vulogOverlayGlobal.edit_mode
        ? overlayUtils.makeEl('div', null, 'vulog_overlay_butt', ' Back to Normal ')
        : overlayUtils.makeEl('div', null, 'vulog_overlay_butt', ' Turn On Edit Mode ')
      modeButton.style['background-color'] = 'white'
      modeButton.onclick = vulogOverlayGlobal.toggleEditMode
      editModeArea.appendChild(modeButton)
    }
  }

  vulogOverlayGlobal.toggleEditMode = function () {
    vulogOverlayGlobal.edit_mode = !vulogOverlayGlobal.edit_mode
    vulogOverlayGlobal.addEditModeButton()
    vulogOverlayGlobal.setCursorColor()
    chrome.runtime.sendMessage({ msg: 'set_edit_mode', set: (vulogOverlayGlobal.edit_mode), purl: vulogOverlayGlobal.pageInfoFromPage.purl }, function (response) {
      // onsole.log(response)
    })
  }
  vulogOverlayGlobal.setCursorColor = function () {
    // onsole.log(`url(${chrome.extension.getURL('images/cursor_'+'vulogOverlayGlobal.currentHColor'+'.png')}), auto`)
    const imageUrl = (`url(${chrome.runtime.getURL('images/cursor_' + vulogOverlayGlobal.currentHColor + '.png')}), auto`)
    document.body.style.cursor = vulogOverlayGlobal.edit_mode ? imageUrl : 'default'
    if (document.getElementById('vulog_overlay_notes')) document.getElementById('vulog_overlay_notes').style.cursor = vulogOverlayGlobal.edit_mode ? 'pointer' : 'cursor'
  }
  document.addEventListener('keydown', function (e) {
    if (!vulogOverlayGlobal.desktop_overlay.is_open && (e.ctrlKey || e.metaKey) && e.keyCode === 83) { // SHOW DIALOGUE
      e.preventDefault()
      vulogOverlayGlobal.showVulogOverlay()
    } else if ((e.ctrlKey || e.metaKey) && vulogOverlayGlobal.desktop_overlay.is_open && [65, 66, 73, 83].includes(e.keyCode)) {
      e.preventDefault()
      vulogOverlayGlobal.desktop_overlay.extend_timer()
      const theStar = ['bookmark', 'inbox', 'star', 'archive'][[66, 73, 83, 65].indexOf(e.keyCode)]
      vulogOverlayGlobal.desktop_overlay.toggleMark(theStar, false)
    } else if (vulogOverlayGlobal.desktop_overlay.is_open && e.keyCode === 27) {
      vulogOverlayGlobal.desktop_overlay.close()
    }
  })

  // highlighting in edit mode
  vulogOverlayGlobal.vulogMouseDown = { left: 0, top: 0 }
  document.addEventListener('mousedown', function (evt) {
    vulogOverlayGlobal.vulogMouseDown = { left: evt.pageX, top: evt.pageY }
  })
  document.addEventListener('mouseup', function (evt) {
    const pointsAreFarApart = function (p1, p2, dist) {
      // onsole.log({p1,p2},true, (Math.abs(p1.left-p2.left)>dist || Math.abs(p1.top-p2.top)>dist))
      if (!p1 || !p2) return false
      return (Math.abs(p1.left - p2.left) > dist || Math.abs(p1.top - p2.top) > dist)
    }
    const vulogMouseUp = { left: evt.pageX, top: evt.pageY }

    if (vulogOverlayGlobal.edit_mode && pointsAreFarApart(vulogOverlayGlobal.vulogMouseDown, vulogMouseUp, 10) && document.getSelection() && document.getSelection().toString().length > 0) {
      highlightSelection()
    } else {
      // console.log('NOT executing select')
    }
  })

  document.addEventListener('click', function (evt) { // actions from overlay
    // onsole.log('click')
    const hlightBox = document.getElementById('vulog_changeHighlight_outer')
    if (evt.target.className.includes('VULOG--highlighter--highlighted')) {
      vulogOverlayGlobal.drawHighlightChangeOptionsBox(evt)
    } else if (hlightBox && hlightBox.contains(evt.target)) {
      if (evt.target.className === 'ios_vulog_colorPalletteChoice') {
        vulogOverlayGlobal.changeHlightColor(evt)
      }
      // clicking inside the change highlight dialogue -  do nothing
    } else {
      if (hlightBox) hlightBox.style.display = 'none'
      if (vulogOverlayGlobal.edit_mode) {
        const hrefNode = evt.target.tagName === 'A' ? evt.target
          : (evt.target.parentElement && evt.target.parentElement.tagName && evt.target.parentElement.tagName === 'A') ? evt.target.parentElement : null
        if (hrefNode) {
          const theTarget = hrefNode.href
          const confirmDiv = overlayUtils.makeEl('div', null, 'vulogAddToInboxConfirm', null)
          confirmDiv.style.width = '150px'
          const addToInboxEl = overlayUtils.makeEl('div', null, 'vulog_overlay_butt', 'Add to Inbox')
          addToInboxEl.onclick = function (evt) {
            handleAddToInbox(theTarget, function(cb) {
              confirmDiv.innerHTML = 'Added to inbox'
              setTimeout(function () { if (confirmDiv) confirmDiv.remove() }, 3000)
            })
          }
          confirmDiv.appendChild(addToInboxEl)
          const gotoUrl = overlayUtils.makeEl('div', null, 'vulog_overlay_butt', 'Open Url')
          gotoUrl.onclick = function (evt) { window.location.href = theTarget }
          confirmDiv.appendChild(gotoUrl)
          confirmDiv.style.top = (evt.pageY - 30) + 'px'
          confirmDiv.style.left = (10 + evt.pageX) + 'px'
          document.body.appendChild(confirmDiv)
          document.addEventListener('keydown', function (evt) {
            if (evt.keyCode === 27 /* escape */) confirmDiv.remove()
          })
          evt.preventDefault()
          setTimeout(function () { if (confirmDiv) confirmDiv.remove() }, 5000)
        }
      }
    }
  })

  chrome.runtime.onMessage.addListener( // messages from background
    function (request, sender, sendResponse) {
      // console.log(sender.tab ? 'from a content script:' + sender.tab.url : 'from the extension')
      if (request.action === 'highlight_selection') {
        highlightSelection()
        sendResponse({ done: 'highlighted text' })
      } else if (request.action === 'toggle_edit_mode') {
        vulogOverlayGlobal.toggleEditMode()
        sendResponse()
      } else if (request.action === 'set_hcolor') {
        vulogOverlayGlobal.currentHColor = request.color
        vulogOverlayGlobal.setCursorColor()
        vulogOverlayGlobal.addPalleteeArea()
        sendResponse()
      } else {
        console.warn('unknown request from vulog background ', sender.tab, { request })
      }
    }
  )
} else if (window.self === window.top) { // && isIos ie main page
  vulogOverlayGlobal.isAppInjectedScript = !(chrome && chrome.runtime && chrome.runtime.onMessage) // otherwise it is the extension
  // SELECTION FOR HIGHLIGHTING ON IOS
  vulogOverlayGlobal.seeIfNeedToHighlightSelection = function (e) {
    // Called on touchstart to see if touch is at end of clicking on highlight button, and if so highlight the selection
    const selection = window.getSelection()
    const selectionString = selection.toString()

    if (e.target.className.includes('VULOG--highlighter--highlighted')) {
      vulogOverlayGlobal.hideHighlighterDivs()
      vulogOverlayGlobal.drawHighlightChangeOptionsBox(e)
    } else if (e.target.id === 'vulog_overlay_highlighter') {
      if (selectionString.length > 0) highlightSelection() // 2nd if stmt due to bug of clicking on highlights a 2nd time
      vulogOverlayGlobal.hideHighlighterDivs()
    } else if (e.target.className === 'ios_vulog_colorPalletteChoice') {
      const hColor = e.target.id.split('_')[2]
      const chooseNotChange = e.target.id.startsWith('vulogIos_colorChoice')
      vulogOverlayGlobal.setHColor(hColor)
      if (chooseNotChange) {
        if (selectionString.length > 0) highlightSelection()
        vulogOverlayGlobal.hideHighlighterDivs()
      } else {
        vulogOverlayGlobal.changeHlightColor(e)
      }
    }
  }
  vulogOverlayGlobal.showHideIosHighlightBoxUponSelection = function (e) {
    const selection = window.getSelection()

    let highLightBox
    let colorPallette

    if (e.target.className.includes('VULOG--highlighter--highlighted')) {
      // handled on touch start
    } else if (e.target.id.indexOf('vulog') !== 0 && selection.toString().length > 0) { // draw highlighter
      // e.target.id !== 'vulog_overlay_highlighter'
      const sRange = selection.getRangeAt(0)
      const sRect = sRange.getBoundingClientRect()
      // onsole.log({ sRect }, ' length ' + selection.toString().length)

      if (document.getElementById('vulog_highlighter_outer')) { // box had been shown previously
        highLightBox = document.getElementById('vulog_highlighter_outer')
        highLightBox.innerHTML = ''
      } else { // new box
        highLightBox = overlayUtils.makeEl('div', 'vulog_highlighter_outer', null, '')
      }

      highLightBox.style.display = 'block'
      highLightBox.style.top = (window.scrollY + sRect.top + sRect.height + 5) + 'px'
      const OUTERBOX_SIZE = 40
      highLightBox.style.left = Math.min(Math.max(0, window.scrollX + window.innerWidth - OUTERBOX_SIZE), Math.max(0, Math.round(window.scrollX + sRect.right - (sRect.width + OUTERBOX_SIZE) / 2))) + 'px'

      const highlightButt = overlayUtils.makeEl('img', 'vulog_overlay_highlighter')
      highlightButt.style.width = '40px'
      highLightBox.appendChild(highlightButt)

      document.body.appendChild(highLightBox)

      if (document.getElementById('vulogIos_colorChoosearea')) { // box had been shown previously
        colorPallette = document.getElementById('vulogIos_colorChoosearea')
      } else { // new box
        colorPallette = overlayUtils.makeEl('div', 'vulogIos_colorChoosearea', 'vulogIos_pallette_area', '')
        document.body.appendChild(colorPallette)
      }

      colorPallette.style.top = (window.scrollY + sRect.top + sRect.height + 75) + 'px'
      const OUTERBOX_SIZE_PALLETTE = 300
      colorPallette.style.left = Math.min(Math.max(0, window.scrollX + window.innerWidth - OUTERBOX_SIZE_PALLETTE), Math.max(0, Math.round(window.scrollX + sRect.right - (sRect.width + OUTERBOX_SIZE_PALLETTE) / 2))) + 'px'

      vulogOverlayGlobal.redrawIosPalleteAndPen()
    } else if (!e.target.id || e.target.id.indexOf('vulog') !== 0) { // document.getElementById('vulog_highlighter_outer') &&
      // hide box if need be
      vulogOverlayGlobal.hideHighlighterDivs()
    }
  }
  vulogOverlayGlobal.redrawIosPalleteAndPen = function () {
    if (document.getElementById('vulog_overlay_highlighter')) document.getElementById('vulog_overlay_highlighter').src = chrome.runtime.getURL('images/cursor_' + vulogOverlayGlobal.currentHColor + '.png')
    if (document.getElementById('vulogIos_colorChoosearea')) {
      const colorPallette = document.getElementById('vulogIos_colorChoosearea')
      colorPallette.style.display = 'block'
      colorPallette.innerHTML = ''
      colorPallette.appendChild(vulogOverlayGlobal.highlightChangeOptionsBoxColorTable(vulogOverlayGlobal.currentHColor, null, true))
    }
  }
  document.addEventListener('touchstart', vulogOverlayGlobal.seeIfNeedToHighlightSelection)
  document.addEventListener('touchend', vulogOverlayGlobal.showHideIosHighlightBoxUponSelection)
  // document.addEventListener('mousedown', vulogOverlayGlobal.seeIfNeedToHighlightSelection) // for testing ios on laptop chrome browser  only
  // document.addEventListener('mouseup', vulogOverlayGlobal.showHideIosHighlightBoxUponSelection) // for testing ios on laptop chrome browser  only

  const finishLoading = function () {
    vulogOverlayGlobal.pageInfoFromPage = (new VuPageData({ ignoreNonStandard: true, ignoreCookies: true }).props)
    if (!vulogOverlayGlobal.isAppInjectedScript) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'newPageInfo') {
          vulogOverlayGlobal.self_mark = request.mark
          // todo now With page data
          // vulogOverlayGlobal.gotPageInfoFromBackground = true
          // onsole.log('vulogOverlayGlobal.self_mark : ', vulogOverlayGlobal.self_mark)
          showHighlights('self_mark')
          sendResponse()
        } else if (request.action === 'highlightRecorded') {
          // onsole.log('highlightRecorded action ', { request, vulogOverlayGlobal })
          vulogOverlayGlobal.confirmHighlightRecorded(request.hlightIdentifier)
        }
      })
      vulogOverlayGlobal.confirmHighlightRecorded = function (hlightIdentifier) {
        if (vulogOverlayGlobal.pageHighlightPending.url === window.location.href && vulogOverlayGlobal.pageHighlightPending.hlightIdentifier === hlightIdentifier) {
          // highlightFromSelection(vulogOverlayGlobal.pageHighlightPending.selectionString, vulogOverlayGlobal.pageHighlightPending.container, vulogOverlayGlobal.pageHighlightPending.selection, color)
          vulogOverlayGlobal.pageHighlightPending = null
          // todo -> if error then remove highlight
        } else {
          console.warn('IOS identifier and or url mismatch ', vulogOverlayGlobal.pageHighlightPending.url, window.location.href, vulogOverlayGlobal.pageHighlightPending.hlightIdentifier, hlightIdentifier)
        }
      }
    } else { //  vulogOverlayGlobal.isAppInjectedScript
      const mark = vulogPageDataFromSwift || (vulogOverlayGlobal.pageInfoFromPage || {})
      vulogOverlayGlobal.self_mark = mark
      setTimeout(function () {
        // reload data with delay as sometimes it takes more time for data to show up
        vulogOverlayGlobal.pageInfoFromPage = (new VuPageData({ ignoreNonStandard: true, ignoreCookies: true }).props)
        // onsole.log('about to send message to app with refresded data', vulogOverlayGlobal.pageInfoFromPage)
        chrome.runtime.sendMessage({ msg: 'newPageInfoForIosApp', url: window.location.href, pageInfoFromPage: vulogOverlayGlobal.pageInfoFromPage },
          function (resp) {
            if (!resp || resp.error) console.warn('Handle Error sending info to background todo ', vulogOverlayGlobal.pageInfoFromPage, resp)
            // onsole.log('do nothing ...')
          }
        )
      }, 5000)
      setTimeout(function () { showHighlights('self_mark') }, 500)
    }
  }

  if (document.readyState === 'complete') {
    // setTimeout(function () {  }, 10000)
    finishLoading()
  } else {
    // setTimeout(function () { }, 10000)
    window.addEventListener('load', (event) => {
      finishLoading()
    })
  }
} else {
  // console.warn('non main page on ios -  message ')
}

const highlightSelection = function () {
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
    const hlightIdentifier = newHlightIdentifier()
    const theHighlight = {
      vCreated: new Date().getTime(),
      string: selection.toString(),
      container: getQuery(container),
      anchorNode: getQuery(selection.anchorNode, 'anchorNode'), // start of selection
      anchorOffset: selection.anchorOffset,
      focusNode: getQuery(selection.focusNode, 'focusnode'), // end of selection
      focusOffset: selection.focusOffset,
      id: hlightIdentifier
    }
    // var color = 'yellowgreen' // todo: Get from preferences or from resp below
    // highlightFromSelection(selectionString, container, selection, color)

    if (isIos()) {
      if (!vulogOverlayGlobal.isAppInjectedScript || vulogIsOriginalUrl === true) {
        theHighlight.color = vulogOverlayGlobal.currentHColor || 'green'
        highlightFromSelection(theHighlight, selection, container)
      }
      vulogOverlayGlobal.pageInfoFromPage = (new VuPageData({ ignoreNonStandard: true, ignoreCookies: true }).props)
      vulogOverlayGlobal.pageHighlightPending = { selectionString, container, selection, hlightIdentifier, url: window.location.href }
      chrome.runtime.sendMessage({ msg: 'newHighlight', url: window.location.href, hlightIdentifier: hlightIdentifier, pageInfoFromPage: vulogOverlayGlobal.pageInfoFromPage, highlight: theHighlight },
        function (resp) {
          if (!resp || resp.error) console.warn('Error sending info to background ', vulogOverlayGlobal.pageInfoFromPage, resp)
          if (vulogOverlayGlobal.isAppInjectedScript && vulogIsOriginalUrl === false) {
            setTimeout(function () {
              history.back()
            }, 500)
          } else {
            vulogOverlayGlobal.self_mark.vHighlights.push(theHighlight)
          }
        }
      )
      setTimeout(function () {
        if (vulogOverlayGlobal.pageHighlightPending && vulogOverlayGlobal.pageHighlightPending.hlightIdentifier !== hlightIdentifier) {
          console.warn('Something went wrong and the highlight was not recorded - need to refresh', { vulogOverlayGlobal, hlightIdentifier })
          alert('Something went wrong and the highlight was not recorded - need to refresh')
        }
      }, 1000)
    } else { // non ios has data in background so dealt with differently
      chrome.runtime.sendMessage({ url: window.location.href, highlight: theHighlight, msg: 'newHighlight' },
        function (resp) {
          if (!resp || resp.error) console.warn('Error sending info to background ', vulogOverlayGlobal.pageInfoFromPage, resp)
          theHighlight.color = resp.color
          highlightFromSelection(theHighlight, selection, container)
          vulogOverlayGlobal.self_mark.vHighlights.push(theHighlight)
          // highlightFromSelection(selectionString, container, selection, color, hlightIdentifier)
        }
      )
    }
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
}

const handleAddToInbox = function (theTarget, cb) {
  chrome.runtime.sendMessage({
    msg: 'addStarFromOverlay',
    linkUrl: theTarget,
    referrer: window.location.href,
    theStar: 'inbox'
  }, function (response) {
    cb(null)
  })
}
