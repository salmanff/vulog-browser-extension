// overlay.js - part of vulog
// Compare iosApp vs ChromeExtension - verified 2022-07-05

// setCookieAndReload -> change to backend side keeping track
// getmark =>
// remove shown_highlight => replace with showThis
// create error box
// manage msg: marksDisplayErrs and hlightDisplayErr
// showThis can be none (dont show any highlights), ownMark, redirectmark or messageMark

/* global showWarning, chrome, overlayUtils, vulogPageDataFromSwift, pasteAsText, COLOR_MAP, isIos, pureUrlify, VuPageData, highlightFromSelection, alert, showHighlights, HIGHLIGHT_CLASS, freepr, freezr */

const vState = {
  purl: pureUrlify(window.location.href), // new 220705 - used to be parsedPage.props.purl, and defined below,
  ownMark: null,
  showThis: 'notInitialised',
  redirectmark: null,
  messageMark: null,
  edit_mode: false,
  currentHColor: 'green',
  markOnBackEnd: async function (mark, options, theStar, starWasChosen) {
    function apiOn(mark, options, theStar, starWasChosen) {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({
          msg: 'mark_star',
          purl: mark.purl,
          id: mark._id,
          theStar,
          doAdd: !starWasChosen,
          props: mark,
          publishChange: false
        }, async function (retInfo) {
          resolve(retInfo)
        })
      })
    }
    async function runApi () {
      return await apiOn(mark, options, theStar, starWasChosen); 
    }
    const retInfo = await runApi()
    if (retInfo.success) {
      // update state here should grab all ecent marks from backend and update all
    } else {
      showWarning('Could not change bookmark. Sorry. Please try again, after refreshing the page.')
    }
    return retInfo
  }
}
if (!isIos()) {
  vState.pageInfoFromPage = (new VuPageData({ ignoreNonStandard: true, ignoreCookies: true }).props)
  if (window.self === window.top) {
    // onsole.log({ vState })
    vState.desktop_overlay = {
      is_open: false,
      close: function () {
        vState.desktop_overlay.is_open = false
        if (document.getElementById('vulog_overlay_outer')) document.getElementById('vulog_overlay_outer').style.display = 'none'
      },
      copy_highs: function () {
        if (!vState.ownMark.vHighlights) vState.ownMark.vHighlights = []
        // onsole.log(vState)
        vState.shown_highlight_details.forEach(ahigh => vState.ownMark.vHighlights.push(ahigh))
        chrome.runtime.sendMessage({ purl: vState.pageInfoFromPage.purl, highlights: vState.shown_highlight_details, msg: 'copyHighlights' },
          function (resp) {
            if (resp.error) {
              console.warn('Error sending info to background ', vState.pageInfoFromPage) // new 220705 - used to be parsedPage instead of vState.pageInfoFromPage
            } else {
              window.location.reload()
            }
          }
        )
      },
      saveWithInterValer: async function () {
        const now = new Date().getTime()
        const desktopOverlay = vState.desktop_overlay
        if (!desktopOverlay.saver.firstTimeSinceSave) desktopOverlay.saver.firstTimeSinceSave = now
        clearTimeout(desktopOverlay.saver.intervaler)
        if (now - desktopOverlay.saver.firstTimeSinceSave > desktopOverlay.saver.THRESHOLD_FOR_FORCED_SAVE) {
          desktopOverlay.saver.intervaler = null // - needed??
          return await desktopOverlay.saver.saveItems()
        } else {
          clearTimeout(desktopOverlay.saver.intervaler)
          desktopOverlay.saver.intervaler = setTimeout(desktopOverlay.saver.saveItems, vState.saver.INTERVALS)
          return { success: true, note: 'set time out to save' }
        }
      },
      saver: {
        intervaler: null,
        saveList: { vNotes: {}, hLights: { }},
        firstTimeSinceSave: null,
        THRESHOLD_FOR_FORCED_SAVE: 3000, // 3 seconds before forceSave
        INTERVALS: 1000, // 1 seconds
        saveItems: async function () {
          const desktopOverlay = vState.desktop_overlay
          desktopOverlay.saver.firstTimeSinceSave = null
          const errors = []
          for (const [_id, vNote] of Object.entries(desktopOverlay.saver.saveList.vNotes)) {
            const markPartsCopy = { _id, vNote }
            const result = await freepr.feps.update(markPartsCopy, { app_table: 'com.salmanff.vulog.marks', replaceAllFields: false })
            if (!result || result.error) errors.push(result)
          }
          for (const [_id, vHighlights] of Object.entries(desktopOverlay.saver.saveList.hLights)) {
            const markPartsCopy = { _id, vHighlights }
            const result = await freepr.feps.update(markPartsCopy, { app_table: 'com.salmanff.vulog.marks', replaceAllFields: false })
            if (!result || result.error) errors.push(result)
          }
          if (errors.length === 0) {
            return { success: true }
          }
          if (errors.length > 0) console.warn('There was an error uploading data to the server. Create overlay error box')
          return { success: false, errors: { } }
        }
      },
    }

    vState.showVulogOverlay = function (options) {
      // options fromKeyboard
      
      let overlay
      if (document.getElementById('vulog_overlay_outer')) {
        overlay = document.getElementById('vulog_overlay_outer')
        overlay.innerHTML = ''
      } else {
        overlay = overlayUtils.makeEl('div', 'vulog_overlay_outer', 'cardOuter', '') // cardOuter included so messageMark can remove previousInterface
      }
      overlay.style.display = 'block'
      // if (errMsg) {
      //   var errDiv = overlayUtils.makeEl('div', 'vulog_overlay_errMsg', null, errMsg)
      //   overlay.appendChild(errDiv)
      // }

      overlay.appendChild(overlayUtils.makeEl('div', null, null, 'vulog'))

      const aspan = overlayUtils.makeEl('span', 'vulog_overlay_cross_ch')
      aspan.onclick = vState.desktop_overlay.close
      overlay.appendChild(aspan)

      const stardiv = document.createElement('div')
      stardiv.style['text-align'] = 'center'
      stardiv.style.margin = '0'
      stardiv.appendChild(overlayUtils.drawstars((vState.ownMark || parsedPage.props), { markOnBackEnd: vState.markOnBackEnd }))

      overlay.appendChild(stardiv)
      const notesBox = overlayUtils.drawMainNotesBox(vState.ownMark, { log: vState.pageInfoFromPage, defaultHashTag: vState.defaultHashTag })
      overlay.appendChild(notesBox)
      if (options?.fromKeyboard) setTimeout(() => { notesBox.focus() }, 10)

      if (vState.showThis === 'ownMark') {
        // Add pallette
        const palletteOuter = overlayUtils.makeEl('div')
        palletteOuter.style['padding-top'] = '10px'
        palletteOuter.style.margin = '0'
        palletteOuter.appendChild(overlayUtils.areaTitle('hlightPaellette', { color: 'yellowgreen', title: 'Highlight Pallette' }))
        const palletteArea = overlayUtils.makeEl('div', 'vulog_overlay_palletteArea', { display: 'inline-block', margin: 0, 'padding-left': '27px' }, '')
        palletteArea.appendChild(overlayUtils.drawColorTable(vState.currentHColor))
        palletteOuter.appendChild(palletteArea)
        overlay.appendChild(palletteOuter)
        setTimeout(vState.addPalleteeArea, 5)

        // Add edit_mode
        const editOuter = overlayUtils.areaTitle('Power mode', { color: 'yellowgreen'})
        editOuter.style['padding-top'] = '10px'
        overlay.appendChild(editOuter)
        const editModeArea = overlayUtils.makeEl('div', 'vulog_overlay_editModeArea', { 'margin-top': '-5px', 'font-size': '18px' }, null)
        overlay.appendChild(editModeArea)
        setTimeout(vState.addEditModeButton, 5)
      }

      const hasSelfHighlights = (vState.ownMark?.vHighlights && vState.ownMark.vHighlights.length > 0)
      const hasRedirectHighlights = (vState.redirectmark?.vHighlights && vState.redirectmark.vHighlights.length > 0)
      const hasMessageHighlights = (vState.messageMark?.vHighlights && vState.messageMark.vHighlights.length > 0)
      let hasHighlights = false
      let theHighlights
      let highlightTitle = null
      let logToConvert = null
      let markOnMarks

      if (vState.showThis === 'ownMark') {
        highlightTitle = 'Your highlights!!!'
        hasHighlights = hasSelfHighlights
        theHighlights = vState.ownMark?.vHighlights
        markOnMarks = vState.ownMark
      } else if (vState.showThis === 'none') {
        highlightTitle = 'Highhlights hidden'
        hasHighlights = false
      } else if (vState.showThis === 'redirectmark') {
        highlightTitle = hasRedirectHighlights ? 'Shared Highlights' : ''
        hasHighlights = hasRedirectHighlights
        theHighlights = vState.redirectmark?.vHighlights
        logToConvert = vState.redirectmark
        if (logToConvert && logToConvert.vComments && logToConvert.vComments.length > 0) {
          overlay.appendChild(overlayUtils.areaTitle("Shared Link", { color: 'purple'}))
          logToConvert.vComments.forEach(comment => { // currently should only be one
            comment.sender_host = logToConvert.host
            comment.sender_id = logToConvert._data_owner
            const commDiv = overlayUtils.oneComment(logToConvert.purl, comment, { isReceived: true, noReply: true })
            overlay.appendChild(commDiv)
          });
        }
      } else if (vState.showThis === 'messageMark') {
        highlightTitle = 'Highlights in Messages'
        hasHighlights = hasMessageHighlights
        theHighlights = vState.messageMark?.vHighlights
        logToConvert = vState.messageMark
      }

      if (hasHighlights) {
        const hlightsDiv = overlayUtils.makeEl('div', null, null)
        hlightsDiv.appendChild(overlayUtils.areaTitle(highlightTitle, { color: 'yellowgreen'}))
        theHighlights.forEach(hlight => {
          const isOwn = (vState.showThis === 'ownMark') // || (vState.ownMark?.vHighlights && vState.ownMark?.vHighlights.find(m => m.id === hlight.id)))
          const showErr = vState.displayErrs && vState.displayErrs.find(m => m.id === hlight.id)
          const hlightDiv = overlayUtils.drawHighlight(vState.purl, hlight,
            { isOwn, showErr, showTwoLines: !showErr, logToConvert, markOnMarks, markOnBackEnd: vState.markOnBackEnd, overLayClick: showErr ? null : function() { vState.scrollToHighLight(hlight.id) } }
          )
          hlightsDiv.appendChild(hlightDiv)
        })
        overlay.appendChild(hlightsDiv)
      }

      const theselect = overlayUtils.areaTitle('hlightPaellette', { color: 'yellowgreen', title: 'Switch Views' })
      // add buttons
      if (vState.showThis === 'ownMark') {
        if (hasSelfHighlights) {
          const hideHighs = overlayUtils.makeEl('div', null, 'vulog_overlay_butt', 'Hide Highlights')
          hideHighs.onclick = function () {
            chrome.runtime.sendMessage({ msg: 'showThisFromOverlay', showThis: 'none', purl: vState.pageInfoFromPage.purl }, function (response) {
              if (!response || response.error) {
                console.warn('handle error ', response)
              } else {
                // onsole.log(response)// reload
                window.location.reload()
              }
            })
          }
          theselect.appendChild(hideHighs)
        }
        if (hasMessageHighlights) {
          const showMsgHighs = overlayUtils.makeEl('div', null, 'vulog_overlay_butt', 'Show Messages Highlights')
          showMsgHighs.onclick = function () { 
            chrome.runtime.sendMessage({ msg: 'showThisFromOverlay', showThis: 'messageMark', purl: vState.pageInfoFromPage.purl }, function (response) {
              if (!response || response.error) {
                console.warn('handle error ', response)
              } else {
                // onsole.log(response)// reload
                window.location.reload()
              }
            })
          }
          theselect.appendChild(showMsgHighs)
        }
      } else if (vState.showThis === 'none') {
        const refresh = overlayUtils.makeEl('div', null, 'vulog_overlay_butt', 'Refresh to show Highlights')
        refresh.onclick = function () { window.location.reload() }
        theselect.appendChild(refresh)
      } else { // messageMark or redriectmark
        const showSelf = overlayUtils.makeEl('div', null, 'vulog_overlay_butt', 'Refresh')
        showSelf.onclick = function () { window.location.reload() }
        theselect.appendChild(showSelf)

        const addhighs = overlayUtils.makeEl('div', null, 'vulog_overlay_butt', 'Copy Highlights')
        addhighs.onclick = function () {
          vState.desktop_overlay.copy_highs()
        }
        theselect.appendChild(document.createElement('br'))
        if (vState.showThis === 'redirectmark' && hasRedirectHighlights) {
          theselect.appendChild(addhighs)
        } else if (vState.showThis === 'messageMark' && hasMessageHighlights) {
          theselect.appendChild(addhighs)
        } 
      }
      if (hasMessageHighlights || hasSelfHighlights) overlay.appendChild(theselect)

      if (vState.messageMark) {
        const messageVcomments = overlayUtils.vMessageCommentDetails(vState.pageInfoFromPage.purl, vState.messageMark.vComments)
        messageVcomments.style.display = 'block'
        overlay.appendChild(messageVcomments)
      }
      document.body.appendChild(overlay)
      
      vState.desktop_overlay.is_open = true
    }

    // fix this
    vState.addPalleteeArea = function () {
      const palletteModeArea = document.getElementById('vulog_overlay_palletteArea')
      palletteModeArea.innerHTML = ''

      const colorTable = overlayUtils.makeEl('div', null, 'vulog_colorAreaDiv', '')
      for (const [key, value] of Object.entries(COLOR_MAP)) {
        var colorChoice = overlayUtils.makeEl('div', null, 'vulog_colorPalletteChoice', '')
        colorChoice.style['background-color'] = value
        colorChoice.style.border = '2px solid ' + (vState.currentHColor === key ? 'darkgrey' : 'white')
        colorChoice.onclick = function () {
          vState.setHColor(key, vState.addPalleteeArea)
        }
        colorTable.appendChild(colorChoice)
      }

      palletteModeArea.appendChild(colorTable)
    }

    vState.addEditModeButton = function () {
      const editModeArea = document.getElementById('vulog_overlay_editModeArea')
      if (editModeArea) {
        editModeArea.innerHTML = ''
        const modeButton = vState.edit_mode
          ? overlayUtils.makeEl('div', null, 'vulog_overlay_butt', ' Back to Normal ')
          : overlayUtils.makeEl('div', null, 'vulog_overlay_butt', ' Turn On Power Mode ')
        modeButton.style['background-color'] = 'white'
        modeButton.onclick = vState.toggleEditMode
        editModeArea.appendChild(modeButton)
      }
    }

    vState.toggleEditMode = function () {
      vState.edit_mode = !vState.edit_mode
      vState.addEditModeButton()
      vState.setCursorColor()
      chrome.runtime.sendMessage({ msg: 'set_edit_mode', set: (vState.edit_mode), purl: vState.pageInfoFromPage.purl }, function (response) {
        // onsole.log(response)
      })
    }
    vState.setCursorColor = function () {
      // onsole.log(`url(${chrome.extension.getURL('images/cursor_'+'vState.currentHColor'+'.png')}), auto`)
      const imageUrl = (`url(${chrome.runtime.getURL('images/cursor_' + vState.currentHColor + '.png')}), auto`)
      document.body.style.cursor = vState.edit_mode ? imageUrl : 'default'
      if (document.getElementById('vulog_overlay_notes')) document.getElementById('vulog_overlay_notes').style.cursor = vState.edit_mode ? 'pointer' : 'cursor'
    }
    document.addEventListener('keydown', async function (e) {
      // onsole.log(`Key Pressed: ${e.key}\nCTRL key pressed: ${e.ctrlKey} and meta ${e.metaKey}\n`)
      if (!vState.desktop_overlay.is_open && (e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { // SHOW DIALOGUE
        e.preventDefault()
        vState.showVulogOverlay({ fromKeyboard: true })
      // } else if ((e.ctrlKey || e.metaKey) && vState.desktop_overlay.is_open && [65, 66, 73, 83].includes(e.keyCode)) {
      //   e.preventDefault()
      //   vState.desktop_overlay.extend_timer()
      //   const theStar = ['bookmark', 'inbox', 'star', 'archive'][[66, 73, 83, 65].indexOf(e.keyCode)]
      //   await vState.desktop_overlay.toggleMark(theStar, false)
      } else if (vState.desktop_overlay.is_open && e.key === 'Escape') {
        vState.desktop_overlay.close()
      }
    })

    // highlighting in edit mode
    vState.vulogMouseDown = { left: 0, top: 0 }
    document.addEventListener('mousedown', function (evt) {
      vState.vulogMouseDown = { left: evt.pageX, top: evt.pageY }
    })
    document.addEventListener('mouseup', function (evt) {      
      const pointsAreFarApart = function (p1, p2, dist) {
        // onsole.log({p1,p2},true, (Math.abs(p1.left-p2.left)>dist || Math.abs(p1.top-p2.top)>dist))
        if (!p1 || !p2) return false
        return (Math.abs(p1.left - p2.left) > dist || Math.abs(p1.top - p2.top) > dist)
      }
      const vulogMouseUp = { left: evt.pageX, top: evt.pageY }
      if (vState.edit_mode && pointsAreFarApart(vState.vulogMouseDown, vulogMouseUp, 10) && document.getSelection() && document.getSelection().toString().length > 0) {
        if ( (document.getElementById('vulog_overlay_outer') && document.getElementById('vulog_overlay_outer').contains(evt.target))
          || (document.getElementById('vulogAddToInboxConfirm') && document.getElementById('vulogAddToInboxConfirm').contains(evt.target))) {
          // onsole.log('do nothing')
        } else {
          highlightSelection()
        }
      } else {
        // onsole.log('NOT executing select')
      }
    })

    window.onscroll = function (e) {
      if (document.getElementById('vulogAddToInboxConfirm')) document.getElementById('vulogAddToInboxConfirm').style.display = 'none'
    }

    document.addEventListener('click', function (evt) { // actions from overlay
      // onsole.log('click ', getParentWithId(evt.target, 'vulog_overlay_outer'))
      const hrefNode = getParentWithTag(evt.target, 'A') 
      if (hrefNode && vState.edit_mode) {
        evt.preventDefault()
        evt.stopPropagation()
      }
      
      const hlightBox = document.getElementById('vulogIos_changeHighlight_outer')  
      if (evt.target?.className && (typeof evt.target.className === 'string') && evt.target.className.indexOf(HIGHLIGHT_CLASS) > -1) {
        vState.drawHighlightChangeOptionsBox(evt)
        vState.desktop_overlay.close()
      } else if (getParentWithId(evt.target, 'vulog_overlay_outer')) {
        // do nothing extra
      } else if (hlightBox && hlightBox.contains(evt.target)) {
        if (evt.target.className === 'ios_vulog_colorPalletteChoice') {
          vState.changeHlightColor(evt)
        }
        // clicking inside the change highlight dialogue -  do nothing
      } else {
        if (hlightBox) hlightBox.style.display = 'none'
        if (document.getElementById('vulogAddToInboxConfirm') && !document.getElementById('vulogAddToInboxConfirm').contains(evt.target)) document.getElementById('vulogAddToInboxConfirm').style.display = 'none'
       
        if (vState.edit_mode) {
          const hrefNode = getParentWithTag(evt.target, 'A') // evt.target.tagName === 'A' ? evt.target
          if (hrefNode) {
            evt.preventDefault()
            evt.stopPropagation()
            // send msg to bg to see if url exists and get defaulthashtag
            // show stars and notes
            const theUrl = hrefNode.href
            chrome.runtime.sendMessage({msg: 'getMarkFromVulog', purl: theUrl }, function (response) {

              let confirmDiv
              if (document.getElementById('vulogAddToInboxConfirm')) {
                confirmDiv = document.getElementById('vulogAddToInboxConfirm')
                confirmDiv.innerHTML = ''
              } else {
                confirmDiv = document.getElementById('vulogAddToInboxConfirm') || overlayUtils.makeEl('div', 'vulogAddToInboxConfirm', null, null)
                document.body.appendChild(confirmDiv)  
              }
              confirmDiv.style.display = 'none'

              const handleAddToInbox = function (textDiv, theUrl, addToInbox, cb) {
                chrome.runtime.sendMessage({
                  msg: 'addStarFromOverlay',
                  linkUrl: theUrl,
                  referrerUrl: window.location.href,
                  note: textDiv.innerText,
                  theStar: (addToInbox ? 'inbox' : null),
                  props: { url: theUrl }
                }, function (response) {
                  cb(null)
                })
              }

              if (response.mark) {
                const existingMark  = overlayUtils.makeEl('div', null, 'vulog_overlay_titles')
                existingMark.style.padding = '5px'
                existingMark.style.width = '100%'
                existingMark.style.color = 'yellowgreen'
                existingMark.style['text-align'] = 'left'
                existingMark.innerHTML = 'Existing bookmark.' 
                if (response.mark.vHighlights && response.mark.vHighlights.length > 0) {
                  existingMark.innerHTML += ' ' + response.mark.vHighlights.length + ' highlight' + (response.mark.vHighlights.length > 1 ? 's.' : '.')
                }
                confirmDiv.appendChild(existingMark)
              }
              if (!response.mark || response.mark.vStars.indexOf('inbox') < 0) {
                const addToInboxEl = overlayUtils.makeEl('div', null, 'vulog_overlay_butt', 'Add to Inbox')
                addToInboxEl.onclick = async function (evt) {                
                  handleAddToInbox(evt.target.nextSibling, theUrl, true, function(cb) {
                    confirmDiv.innerHTML = 'Added to inbox'
                    setTimeout(function () { if (confirmDiv) confirmDiv.remove() }, 3000)
                  })
                }
                confirmDiv.appendChild(addToInboxEl)
              }
              const notesBox = overlayUtils.makeEl('div', null, 'vulog_overlay_input')
              notesBox.style.margin = '5px'
              if (response.mark) {
                if (response.mark.vNote) notesBox.innerText = response.mark.vNote
              } else if (response.defaultHashTag) {
                notesBox.innerText = '#' + response.defaultHashTag + ' '
              }
              notesBox.setAttribute('placeholder', 'Note for link')
              notesBox.setAttribute('contenteditable', 'true')
              notesBox.onkeydown =  function (evt) {
                if (evt.key === 'Enter'){
                  handleAddToInbox(evt.target, theUrl, false, function(cb) {
                    confirmDiv.innerHTML = 'Note added.'
                    setTimeout(function () { if (confirmDiv) confirmDiv.remove() }, 3000)
                  })
                }
              }
              confirmDiv.appendChild(notesBox)

              const gotoUrl = overlayUtils.makeEl('a', null, 'vulog_overlay_butt', 'Open Url')
              gotoUrl.setAttribute('href', theUrl)
              // gotoUrl.onclick = function (evt) { window.location.href = theUrl }
              confirmDiv.appendChild(gotoUrl)
              confirmDiv.style.top = (evt.pageY - 30) + 'px'
              confirmDiv.style.left = (10 + evt.pageX) + 'px'
              confirmDiv.style.display = 'block'
              
              document.addEventListener('keydown', function (evt) {
                if (evt.key === 'Escape') confirmDiv.remove()
              })
            })
            // setTimeout(function () { if (confirmDiv) confirmDiv.remove() }, 5000)
          }
        }
      }
    })

    chrome.runtime.onMessage.addListener( // messageMark from background
      function (request, sender, sendResponse) {
        if (request.msg === 'markUpdated') {
          if (request.updatedMark?.purl === vState.pageInfoFromPage.purl) {
            vState.ownMark = request.updatedMark
            // todo - edge case: highlights could ahve changed too, so need to check if they have changed
            // also need to update for new messages
            if (vState.desktop_overlay.is_open) vState.showVulogOverlay()
          } else {
            console.warn('markUpdated sent to page but purl is different??? snbh')
          }
        }
        // 2023 - 06 -> not used?
        // if (request.action === 'highlight_selection') {
        //   highlightSelection()
        //   sendResponse({ done: 'highlighted text' })
        // } else if (request.action === 'toggle_edit_mode') {
        //   vState.toggleEditMode()
        //   sendResponse()
        // } else if (request.action === 'set_hcolor') {
        //   vState.currentHColor = request.color
        //   vState.setCursorColor()
        //   vState.addPalleteeArea()
        //   sendResponse()

        // 2023 - 06 -> not working
        // } else if (request.action === 'getUrlInfo') {
        //  onsole.log('got request for info from backgrouns - send ing ', vState.pageInfoFromPage )
        //   sendResponse({ pageInfoFromPage: vState.pageInfoFromPage })
        
        // } else {
        //   console.warn('unknown request from vulog background ', sender.tab, { request })
        // }
      }
    )

    // When on freezr set up page, allow for automated sign in
    if (window.location.pathname === '/account/app/settings/com.salmanff.vulog') {
      chrome.runtime.sendMessage({ msg: 'getFreezrInfo' }, function (response) {
        if (response && response.success) {
          // onsole.log('have extenstion installed on app set up page',window.location.href   )
              // For freezr server settings page
          const waitForELAndExecute = function (elId, options, callFwd) {
            if (!options) options = {}
            if (!options.maxTime) options.maxTime = 3000
            if (!options.interval) options.interval = 250
            if (!options.timePassed) options.timePassed = 0
            setTimeout(function () {
              if (document.getElementById(elId)) {
                callFwd({ success: true })
              } else if (options.timePassed > options.maxTime) {
                callFwd({ success: false })
              } else {
                options.timePassed += options.interval
                waitForELAndExecute (elId, options, callFwd)
              }
            }, options.interval)
          }

          const tryLoggingIn = function (loginUrl, freezrMeta, callFwd) {
            const parts = loginUrl.split('?')
            const params = parts.length > 1 ? new URLSearchParams(loginUrl.split('?')[1]) : null
            if (parts.length > 1 &&
                (!freezrMeta.serverAddress ||
                  (params.get('user') === freezrMeta.userId &&
                  loginUrl.indexOf(freezrMeta.serverAddress) === 0)
                )) {
              freezr.utils.applogin(loginUrl, 'com.salmanff.vulog', function (err, jsonResp) {
                if (err || jsonResp.error || !jsonResp.appToken) {
                  callFwd({ success: false, message: 'unsuccessful attempt'})
                } else {
                  const newFreezrMeta = {
                    userId: jsonResp.userId,
                    appToken: jsonResp.appToken,
                    serverAddress: jsonResp.serverAddress,
                    serverVersion: jsonResp.serverVersion
                  }
                  chrome.runtime.sendMessage({ msg: 'loggedin', freezrMeta: newFreezrMeta }, function (response) {
                    if (response && response.success) {
                      callFwd({ success: true })
                    } else {
                      callFwd({ success: false })
                    }
                  })
                }
              })
            } else {
              console.warn('error  - inconsitent with login info')
              callFwd({ success: false, message: 'invalid url - inconsitent with login info'})
            }
          }

          waitForELAndExecute('freezrChromeExtInstallLink', {}, function(loadResp) {
            if (!loadResp.success) {
              console.warn('elements did not load in time for freezrChromeExtInstallLink')
            } else {
              document.getElementById('freezrChromeExtInstallLink').style.display = 'none'
              if (response.freezrInfo?.serverAddress === window.location.origin) {
                document.getElementById('freezrChromeExtensionCredsReplace').style.display = 'block'
              } else if (!response.freezrInfo?.serverAddress) {
                document.getElementById('freezrChromeExtensionCredsReplace').style.display = 'block'
                document.getElementById('freezrChromeExtensionCredsReplace').firstChild.nextSibling.innerHTML = 'Log in'
              } // else - the below becomes hidden and thus irrelevant
              const redoOnclicks = function() {
                waitForELAndExecute('freezrNewLoginUrl', {}, function(loadResp) {
                  if (!loadResp.success) {
                    console.warn('elements did not load in time for freezrChromeExtInstallLink')
                  } else { 
                    tryLoggingIn(document.getElementById('freezrNewLoginUrl')?.innerText, response.freezrInfo, function (resp) {
                      if (resp.success) document.getElementById('freezrChromeExtensionCredsReplace').firstChild.nextSibling.innerHTML = 'Credentials registered successfully!'
                      if (!resp.success) document.getElementById('freezrAppSettingsMessages').innerHTML = 'Error updating credentials! Please copy the url into your app'
                      document.getElementById('freezrChromeExtensionCredsReplace').firstChild.nextSibling.onclick = null
                      document.getElementById('freezrChromeExtensionCredsReplace').firstChild.firstChild.onclick = null
                    })
                  }
                })
              }
              document.getElementById('freezrChromeExtensionCredsReplace').firstChild.nextSibling.onclick = redoOnclicks
              document.getElementById('freezrChromeExtensionCredsReplace').firstChild.firstChild.onclick = redoOnclicks
            }
          })
        }
      })
    }
    if (document.getElementById('vulog_show_if_extension_is_installed')) {
      document.getElementById('vulog_show_if_extension_is_installed').style.display = 'block'
      if (document.getElementById('vulog_show_if_NOT_installed')) document.getElementById('vulog_show_if_NOT_installed').style.display = 'none'
      // should check if there are highlughts.. if so enable a redirect - perhaps use attributes?
    }
    const toshowDivs = document.querySelectorAll('.vulog_show_if_extension_is_installed') 
    toshowDivs.forEach(showDiv => { showDiv.style.display = 'block' })
  }
} else if (window.self === window.top) { // && isIos ie main page
  vState.isAppInjectedScript = !(chrome && chrome.runtime && chrome.runtime.onMessage) // otherwise it is the extension
  // SELECTION FOR HIGHLIGHTING ON IOS
  vState.seeIfNeedToHighlightSelection = function (e) {
    // Called on touchstart to see if touch is at end of clicking on highlight button, and if so highlight the selection
    const selection = window.getSelection()
    const selectionString = selection.toString()

    if (e.target.className.includes(HIGHLIGHT_CLASS)) {
      vState.hideHighlighterDivs()
      vState.drawHighlightChangeOptionsBox(e)
    } else if (e.target.id === 'vulog_overlay_highlighter') {
      if (selectionString.length > 0) highlightSelection() // 2nd if stmt due to bug of clicking on highlights a 2nd time
      vState.hideHighlighterDivs()
    } else if (e.target.className === 'ios_vulog_colorPalletteChoice') {
      const hColor = e.target.id.split('_')[2]
      const chooseNotChange = e.target.id.startsWith('vulogIos_colorChoice')
      vState.setHColor(hColor)
      if (chooseNotChange) {
        if (selectionString.length > 0) highlightSelection()
        vState.hideHighlighterDivs()
      } else {
        const hlightId = e.target.id.split('_')[3]
        onsole.log('will change color for hlightId ', hlightId)
        chrome.runtime.sendMessage({ msg: 'changeHlightColor', hColor, hlightId, url: window.location.href }, function (response) {
          // onsole.log('changeHlightColor sent to background - ', { response, hlightId })
          const hLightDiv = document.getElementById('vulog_hlight_' + hlightId)
          if (hLightDiv) hLightDiv.style.backgroundColor = COLOR_MAP[hColor]
          if (!hLightDiv) console.warn('couldnt find vulog_hlight_' + hlightId)
          const colorChanger = document.getElementById('vulogIos_pallette_area_for_change')
          colorChanger.innerHTML = ''
          colorChanger.appendChild(vState.highlightChangeOptionsBoxColorTable(hColor, hlightId, false))
          // todo later => change the ownMark mark as well? needed for note? or send the whole ownMark back
        })
      }
    } else if (selection) {
      if (document.getElementById('vulogIos_highlighter_outer')) document.getElementById('vulogIos_highlighter_outer').style.display = 'none'
      if (document.getElementById('vulogIos_colorChoosearea')) document.getElementById('vulogIos_colorChoosearea').style.display = 'none'
    }
  }
  vState.showHideIosHighlightBoxUponSelection = function (e) {
    const selection = window.getSelection()
    // onsole.log('got a click ? ' + e.target.id, 'selectionString.length ', selection.toString().length, ' id ', e.target.id, { vState })

    let highLightBox
    let colorPallette

    if (e.target.className.includes(HIGHLIGHT_CLASS)) {
      // handled on touch start
    } else if (e.target.id.indexOf('vulog') !== 0 && selection.toString().length > 0) { // draw highlighter
      // e.target.id !== 'vulog_overlay_highlighter'
      const sRange = selection.getRangeAt(0)
      const sRect = sRange.getBoundingClientRect()
      // onsole.log({ sRect }, ' length ' + selection.toString().length)

      if (document.getElementById('vulogIos_highlighter_outer')) { // box had been shown previously
        highLightBox = document.getElementById('vulogIos_highlighter_outer')
        highLightBox.innerHTML = ''
      } else { // new box
        highLightBox = overlayUtils.makeEl('div', 'vulogIos_highlighter_outer', null, '')
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

      vState.redrawIosPalleteAndPen()
    } else if (!e.target.id || e.target.id.indexOf('vulog') !== 0) { // document.getElementById('vulogIos_highlighter_outer') &&
      // hide box if need be
      vState.hideHighlighterDivs()
    }
  }
  vState.redrawIosPalleteAndPen = function () {
    if (document.getElementById('vulog_overlay_highlighter')) document.getElementById('vulog_overlay_highlighter').src = chrome.runtime.getURL('images/cursor_' + vState.currentHColor + '.png')
    if (document.getElementById('vulogIos_colorChoosearea')) {
      const colorPallette = document.getElementById('vulogIos_colorChoosearea')
      colorPallette.style.display = 'block'
      colorPallette.innerHTML = ''
      colorPallette.appendChild(vState.highlightChangeOptionsBoxColorTable(vState.currentHColor, null, true))
    }
  }
  document.addEventListener('touchstart', vState.seeIfNeedToHighlightSelection)
  document.addEventListener('touchend', vState.showHideIosHighlightBoxUponSelection)
  // document.addEventListener('mousedown', vState.seeIfNeedToHighlightSelection) // for testing ios on laptop chrome browser  only
  // document.addEventListener('mouseup', vState.showHideIosHighlightBoxUponSelection) // for testing ios on laptop chrome browser  only

  const finishLoading = function () {
    vState.pageInfoFromPage = (new VuPageData({ ignoreNonStandard: true, ignoreCookies: true }).props)
    if (!vState.isAppInjectedScript) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'newPageInfo') {
          vState.ownMark = request.mark
          // todo now With page data
          // vState.gotPageInfoFromBackground = true
          showHighlights()
          sendResponse()
        } else if (request.action === 'highlightRecorded') {
          // const color = request.color || 'yellowgreen'
          vState.confirmHighlightRecorded(request.hlightIdentifier)
        }
      })
      vState.confirmHighlightRecorded = function (hlightIdentifier) {
        if (vState.pageHighlightPending.url === window.location.href && vState.pageHighlightPending.hlightIdentifier === hlightIdentifier) {
          // highlightFromSelection(vState.pageHighlightPending.selectionString, vState.pageHighlightPending.container, vState.pageHighlightPending.selection, color)
          vState.pageHighlightPending = null
          // todo -> if error then remove highlight
        } else {
          console.warn('IOS identifier and or url mismatch ', vState.pageHighlightPending.url, window.location.href, vState.pageHighlightPending.hlightIdentifier, hlightIdentifier)
        }
      }
    } else { //  vState.isAppInjectedScript
      const mark = vulogPageDataFromSwift || (vState.pageInfoFromPage || {})
      vState.ownMark = mark
      setTimeout(function () {
        // reload data with delay as sometimes it takes more time for data to show up
        vState.pageInfoFromPage = (new VuPageData({ ignoreNonStandard: true, ignoreCookies: true }).props)
        // onsole.log('about to send message to app with refresded data', vState.pageInfoFromPage)
        chrome.runtime.sendMessage({ msg: 'newPageInfoForIosApp', url: window.location.href, pageInfoFromPage: vState.pageInfoFromPage },
          function (resp) {
            if (!resp || resp.error) console.warn('Handle Error sending info to background todo ', vState.pageInfoFromPage, resp)
            // onsole.log('do nothing ...')
          }
        )
      }, 5000)
      setTimeout(function () { showHighlights() }, 500)
    }
  }

  if (document.readyState === 'complete') {
    finishLoading()
  } else {
    window.addEventListener('load', (event) => {
      finishLoading()
    })
  }
} else {
  // console.warn('non main page on ios -  message ')
}

// Change Highlight Box and functions
vState.drawHighlightChangeOptionsBox = function (e) {
  if (vState.showThis === 'ownMark') {
    const hlightId = e.target.id.split('_')[2]
    const currentHColor = overlayUtils.mainColorOf(e.target.style.backgroundColor)
    const thehighLight = vState.getHLightFrom(hlightId)

    let changeHighlightBox
    if (document.getElementById('vulogIos_changeHighlight_outer')) { // box had been shown previously
      changeHighlightBox = document.getElementById('vulogIos_changeHighlight_outer')
      changeHighlightBox.innerHTML = ''
    } else { // new box
      changeHighlightBox = overlayUtils.makeEl('div', 'vulogIos_changeHighlight_outer', null, '')
    }
    changeHighlightBox.style.display = 'block'

    // onsole.log('window.scrollY' + window.scrollY + '   e.touches: ', e.touches, '   e.event.targetTouches ', e.targetTouches)
    changeHighlightBox.style.top = (window.scrollY + (e.clientY || ((e.touches && e.touches[0]) ? e.touches[0].clientY : null) || 0)) + 'px'
    const OUTERBOX_SIZE = 200
    changeHighlightBox.style.left = (window.scrollX + window.innerWidth - e.clientX < OUTERBOX_SIZE
      ? Math.max(0, Math.round(window.scrollX + window.innerWidth - OUTERBOX_SIZE))
      : Math.max(0, Math.round(window.scrollX + e.clientX - OUTERBOX_SIZE / 2))) + 'px'

    if (thehighLight) {
      if (thehighLight.vComments && thehighLight.vComments.length > 0) {
        changeHighlightBox.appendChild(overlayUtils.drawCommentsSection(vState.pageInfoFromPage.purl, thehighLight))
      }

      // this hsould go into drawHlightCommentsBox
      // .. then dp vState.hideHighlighterDivs()
      const notesDiv = overlayUtils.makeEl('div', 'vulog_hlight_notes', 'vulog_overlay_input')
      notesDiv.setAttribute('contenteditable', 'true')
      notesDiv.setAttribute('placeholder', 'Add a comment')
      notesDiv.onpaste = function (evt) {
        pasteAsText(evt)
      }
      notesDiv.onkeydown = function () {
        document.getElementById('vulog_hlight_saveNote').className = 'vulog_dialogue_butts bluecol'
      }
      if (thehighLight.vNote && thehighLight.vNote !== '') notesDiv.innerText = thehighLight.vNote
      changeHighlightBox.appendChild(notesDiv)

      const saveDiv = overlayUtils.makeEl('div', 'vulog_hlight_saveNote', 'vulog_dialogue_butts')
      saveDiv.innerText = 'Save Comment'
      saveDiv.onclick = function () {
        const vCreated = new Date().getTime()
        const text = notesDiv.innerText.trim()
        const theComment = { text, vCreated }
        if (!thehighLight.vComments) thehighLight.vComments = []
        thehighLight.vComments.push(theComment)
        if (document.getElementById('vulog_hlight_' + thehighLight.id)) document.getElementById('vulog_hlight_' + thehighLight.id).className = HIGHLIGHT_CLASS + ' hlightComment'
        if (!document.getElementById('vulog_hlight_' + thehighLight.id)) console.warn('could not get element with id ', document.getElementById(thehighLight.id))
        chrome.runtime.sendMessage({ msg: 'addHLightComment', hlightId, text, vCreated, url: window.location.href }, function (response) {
          vState.hideHighlighterDivs()
        })
      }
      changeHighlightBox.appendChild(saveDiv)

      const colorChanger = overlayUtils.makeEl('div', 'vulogIos_pallette_area_for_change', '')

      colorChanger.appendChild(vState.highlightChangeOptionsBoxColorTable(currentHColor, hlightId, false))
      changeHighlightBox.appendChild(colorChanger)

      const removeButt = overlayUtils.makeEl('div', 'vulog_hlightdeleteNote_' + hlightId, 'vulog_dialogue_butts redcol')
      removeButt.innerText = 'Remove Highlight'
      // const trash = document.createElement('img')
      // trash.src = chrome.runtime.getURL('images/trash_red.png')
      // trash.className = 'vulog_inner_butt_img'
      // trash.style.width = '20px'
      removeButt.onclick = function () {
        chrome.runtime.sendMessage({ msg: 'removeHighlight', hlightId, url: window.location.href }, function (response) {
          window.location.reload()
          // vState.hideHighlighterDivs()
          // const hLightDiv = document.getElementById('vulog_hlight_' + hlightId)
          // hLightDiv.style.backgroundColor = ''
          // hLightDiv.className = ''
          // hLightDiv.id = ''
        })
      }
      changeHighlightBox.appendChild(removeButt)
    } else {
      const errorText = overlayUtils.makeEl('div', '', 'redcol')
      errorText.innerText = 'Error: Could not retrieve highlight. sorry!'
    }

    document.body.appendChild(changeHighlightBox)
  } else {
    console.warn('todo - handle highlights from others.')
  }
}
vState.changeHlightColor = function (e) {
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
    colorChanger.appendChild(vState.highlightChangeOptionsBoxColorTable(hColor, hlightId, false))
    // todo later => change the ownMark mark as well? needed for note? or send the whole ownMark back
  })
}
vState.hideHighlighterDivs = function () {
  if (document.getElementById('vulogIos_changeHighlight_outer')) document.getElementById('vulogIos_changeHighlight_outer').style.display = 'none'
  // ios only:
  if (document.getElementById('vulogIos_highlighter_outer')) document.getElementById('vulogIos_highlighter_outer').style.display = 'none'
  if (document.getElementById('vulogIos_colorChoosearea')) document.getElementById('vulogIos_colorChoosearea').style.display = 'none'
}
vState.getHLightFrom = function (hlightId) {
  const theMark = vState[vState.showThis]
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
vState.highlightChangeOptionsBoxColorTable = function (currentColor = 'yellowgreen', hlightId, chooseNotChange = true) {
  const colorTable = overlayUtils.makeEl('div', '', '', '')
  for (const [key, value] of Object.entries(COLOR_MAP)) {
    if (currentColor !== key || !chooseNotChange) {
      var colorChoice = overlayUtils.makeEl('div', 'vulogIos_color' + (chooseNotChange ? 'Choice' : 'Change') + '_' + key + (chooseNotChange ? '' : ('_' + hlightId)), 'ios_vulog_colorPalletteChoice', '')
      colorChoice.style['background-color'] = value
      colorChoice.style.border = chooseNotChange
        ? '1px solid white'
        : ('3px solid ' + ((currentColor === key || currentColor ===  value)? 'grey' : 'white'))
      colorTable.appendChild(colorChoice)
    }
  }
  return colorTable
}
vState.setHColor = function (hColor, cb) {
  // vState.currentHColor = hcolor
  vState.currentHColor = hColor
  chrome.runtime.sendMessage({ msg: 'setHColor', hColor, url: window.location.href }, function (response) {
    // non ios
    if (vState.addPalleteeArea) vState.addPalleteeArea()
    if (vState.setCursorColor) vState.setCursorColor()
    if (cb) cb(response)
  })
}
vState.environmentSpecificSendMessage = async function (params) {
  // params : { chosenFriends, text, hLight, markCopy }
  params.msg = 'sendMessage'
  return await chrome.runtime.sendMessage(params)
}

// go to highlight
vState.scrollToHighLight = function (hlightId) {
  const theHLight = document.getElementById('vulog_hlight_' + hlightId)
  if (theHLight) {
    theHLight.scrollIntoView()
  } else {
    console.warn('hlight not found so cant scroll to it')
  }
}

// 
const getMarkFromVstateList = function (purl, options) {
  // options: excludeComments, excludeHLights, excludeHandC
  const oneItem = vState.ownMark || convertLogToMark(vState.pageInfoFromPage)

  if (options?.excludeHlights || options?.excludeHandC) oneItem.vHighlights = []
  if (options?.excludeComments || options?.excludeHandC) oneItem.vComments = []

  return oneItem
}
const environmentSpecificSyncAndGetMessage = async function (purl) {
  function apiOn (purl) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ msg: 'syncMessagesAndGetLatestFor', purl }, async function (retInfo) {
        resolve(retInfo)
      })
    })
  }
  async function runApi() {
    return await apiOn(purl)
  }
  return await runApi()
}
const getAllMessagesAndUpdateStateteFor = async function (purl) {
  const retInfo = await environmentSpecificSyncAndGetMessage(purl)
  if (!retInfo) return { }
  if (retInfo.error) return { error: retInfo.error }

  const mergedItems = retInfo.mergedMessages
  if (!mergedItems || mergedItems.length === 0) return { itemJson: {} }
  let itemJson = null

  mergedItems.forEach(item => {
    if (!item.record) {
      console.warn('no recrod to merge for ', item)
    } else if (!itemJson) {
      itemJson = convertDownloadedMessageToRecord(item)
    } else {
      itemJson = mergeMessageRecords(itemJson, item)
    }
  })

  vState.messageMark = itemJson

  return { itemJson }
  // find purl in messages and update it
}

// General Functions

const highlightSelection = function () {
  const selection = window.getSelection()
  const selectionString = selection.toString()

  if (selectionString) {
    // If there is text selected
    let container = selection.getRangeAt(0).commonAncestorContainer

    // Sometimes the element will only be text. Get the parent in that case
    // TODO: Is this really necessary?
    while (!container.innerHTML) {
      container = container.parentNode
    }

    // onsole.log("Vu-highlights storing...: ",selection," from ",window.location.pathname)
    const hlightIdentifier = new Date().getTime() + '-' + Math.round(Math.random() * 1000, 0) 
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
      if (!vState.isAppInjectedScript || vulogIsOriginalUrl === true) {
        theHighlight.color = vState.currentHColor || 'green'
        highlightFromSelection(theHighlight, selection, container)
      }
      vState.pageInfoFromPage = (new VuPageData({ ignoreNonStandard: true, ignoreCookies: true }).props)
      vState.pageHighlightPending = { selectionString, container, selection, hlightIdentifier, url: window.location.href }
      chrome.runtime.sendMessage({ msg: 'newHighlight', url: window.location.href, hlightIdentifier: hlightIdentifier, pageInfoFromPage: vState.pageInfoFromPage, highlight: theHighlight },
        function (resp) {
          if (!resp || resp.error) console.warn('Error sending info to background ', vState.pageInfoFromPage, resp)
          if (vState.isAppInjectedScript && vulogIsOriginalUrl === false) {
            setTimeout(function () {
              history.back()
            }, 500)
          } else {
            vState.ownMark.vHighlights.push(theHighlight)
          }
        }
      )
      setTimeout(function () {
        if (vState.pageHighlightPending && vState.pageHighlightPending.hlightIdentifier !== hlightIdentifier) {
          console.warn('Something went wrong and the highlight was not recorded - need to refresh', { vState, hlightIdentifier })
          alert('Something went wrong and the highlight was not recorded - need to refresh')
        }
      }, 1000)
    } else { // non ios has data in background so dealt with differently
      chrome.runtime.sendMessage({ url: window.location.href, highlight: theHighlight, msg: 'newHighlight', props: vState.pageInfoFromPage },
        function (resp) {
          if (!resp || resp.error) console.warn('Error sending info to background ', vState.pageInfoFromPage, resp)
          theHighlight.color = resp.color
          highlightFromSelection(theHighlight, selection, container)
          // vState.ownMark.vHighlights.push(theHighlight) - why removed? 2023-04
          // highlightFromSelection(selectionString, container, selection, color, hlightIdentifier)
        }
      )
    }
  }

  // From an DOM element, get a query to that DOM element
  function getQuery (element, eltype) {
    if (element.id) return [{ id: element.id }]
    if (element.localName === 'html') return [{ type: 'html' }]

    const parent = element.parentNode
    const parentSelector = getQuery(parent)

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

const getParentWithId = function(theDiv, id) {
  if (!theDiv) return null
  while (theDiv && theDiv.id !== id && theDiv.tagName !== 'BODY') {
    theDiv = theDiv.parentElement
  }
  if (theDiv && theDiv.id === id) return theDiv
  return null
}
const getParentWithTag = function(theDiv, name) {
  if (!theDiv) return null
  while (theDiv && theDiv.tagName !== name && theDiv.tagName !== 'BODY') {
    theDiv = theDiv.parentElement
  }
  if (theDiv && theDiv.tagName === name) return theDiv
  return null
}