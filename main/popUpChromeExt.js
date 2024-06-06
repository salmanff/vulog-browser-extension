/*
    popUpChromeExt.js
    com.salmanff.vulog - chrome app for browser view history and book marking
    version 0.0.3 - mid 2023

*/

/* global chrome */ // from system
/* global dg */ // from dgelements.js
/* global freezrMeta  */ // from freezr_app_init
/* global freezr, freezerRestricted */ // from freezr_core.js
/* global history */ // from  history.js
/* global trackers */ // from trackers.js
/* global lister */ // from lister.js
/* global removeSpacesEtc */ // from utils.js

/* exported getItemsSharedBy */ 

let warningTimeOut
let cookieRemovalHasBeenCalled = false
var tabinfo = {}
const vState = {}

freezrMeta.initialize('com.salmanff.vulog')
// initialize freezr related
freezr.app.isWebBased = false

// Startup and main view
const UPDATE_INTERVAL = 3000
chrome.tabs.query({ active: true, currentWindow: true }, function (tabArray) {
  var purl
  if (tabArray && tabArray.length > 0 && tabArray[0].url) {
    purl = pureUrlifyCopy(tabArray[0].url)
    tabinfo = {
      url: tabArray[0].url,
      purl: purl,
      title: tabArray[0].title,
      tabid: tabArray[0].id
    }
  } else {
    showWarning('Error trying to get tab information on the web page (2)')
  }
  setTimeout(getvulogInfotoDrawCurrentTabForPopUp, 5)
})
const pureUrlifyCopy = function (aUrl) { // copied from utils as sometimes utils doesnt seem to load in time
  if (!aUrl) return null
  if (aUrl.indexOf('#') > 0) aUrl = aUrl.slice(0, aUrl.indexOf('#'))
  if (aUrl.slice(-1) === '/') { aUrl = aUrl.slice(0, -1) }
  return aUrl.trim()
}
const getvulogInfotoDrawCurrentTabForPopUp = async function () {
  const purl = tabinfo.purl
  // v3-manifest 
  vulogInfo = await chrome.runtime.sendMessage({ msg: 'getVulogState', purl: purl, tabinfo: tabinfo })
  // v2-manifest chrome.runtime.sendMessage({ msg: 'getVulogState', purl: purl, tabinfo: tabinfo }, function (vulogInfo) {
    if (!vulogInfo || !vulogInfo.success) {
      console.warn({ vulogInfo })
      showWarning ('Error getting page info. Please close this and try again')
      return 
    }
    if (vulogInfo.currentLog && vulogInfo.vState) { 
      updateStateBasedOnVulogInfo(vulogInfo)
      drawCurrentLogDetails(vulogInfo.currentMark, vulogInfo.currentLog)
    } else {
      // onsole.log('1st vulogInfo ', { vulogInfo})
      dg.el('thisPage_details', { clear: true }).appendChild(dg.div({ className: 'vulog_title  vulog_title_emph' }, purl))
      dg.el('thisPage_details').appendChild(dg.div({ style: { 'margin-left': '23px', 'padding-top': '20px' } }, 'No meta-data available for this page.'))
      setTimeout(async () => {
        chrome.runtime.sendMessage({ msg: 'getVulogState', purl: purl, tabinfo: tabinfo }, function (vulogInfo2) {
          // onsole.log('note nb - tried getting getpagedata again after currentLog was unfound - giving it time to refresh ', { vulogInfo })
          if (vulogInfo2 && vulogInfo2.success && vulogInfo2.currentLog && vulogInfo2.vState) {
            updateStateBasedOnVulogInfo(vulogInfo2)
            drawCurrentLogDetails(vulogInfo2.currentMark, vulogInfo2.currentLog)
          } else {
            console.warn('err getting vuloginfo', { vulogInfo2})
            showWarning('Sorry but theere was an error connecting to the back end. If you have just installed hiper.cards, you may want to restart your browser. thanks!')
          }
        })
      }, 250);
    }
  // })
}
const updateStateBasedOnVulogInfo = function (vulogInfo) {
  // onsole.log('updateStateBasedOnVulogInfo ', { vulogInfo })

  const { currentMark, currentLog } = vulogInfo
  const backEndVstate = vulogInfo.vState
  // purl,  contacts, edit_mode, cookieRemovalHasBeenCalled

  vState.friends = backEndVstate.contacts //  vState.freezrMeta?.perms?.friends?.granted ? await freepr.feps.postquery({ app_table: 'dev.ceps.contacts', permission_name: 'friends' }) : []
  vState.feedcodes = backEndVstate.feedcodes.map(obj => ({ ...obj, type: 'privateFeed' }))
  vState.groups = backEndVstate.groups.map(obj => ({ ...obj, type: 'group' }))

  freezrMeta.set(backEndVstate.freezrMeta)
  vState.freezrMeta = freezrMeta
  vState.offlineCredentialsExpired = !Boolean(freezrMeta.appToken)
  vState.isLoggedIn = Boolean(freezrMeta.appToken)

  vState.defaultHashTag = backEndVstate.defaultHashTag

  if (backEndVstate.syncErr) showWarning('There was an error syncing. ', vulogInfo.details.syncErr)
  if (backEndVstate.syncErr) vState.syncErr = backEndVstate.syncErr
  if (backEndVstate.deleted_unbackedupdata) {
    showWarning('Some of your logged items were deleted! Please do find a Personal Data Store to be able to keep mroe data, as the web browser doesnt have any more space.', 10000)
  }
  if (backEndVstate?.marks_data_size && backEndVstate.marks_data_size > 1500000 && (!freezrMeta || !freezrMeta.appToken)) {
    showWarning('You have a large ' + backEndVstate.marks_data_size + ' amount of marks (notes and highlights) - you really need to get a personal data store or risk losing these.', 10000)
  }
  if (backEndVstate.fatalErrors) showWarning('Serious Error Encountered: "' + backEndVstate.fatalErrors + '".   You may want to restart your browser')

  if (!freezrMeta.appToken) dg.el('openpopupintab_messages').style.display = 'none'
}
vState.environmentSpecificSendMessage = async function (params) {
  // params : { chosenFriends, text, hLight, markCopy }
  params.msg = 'sendMessage'
  return await chrome.runtime.sendMessage(params)
}
vState.environmentSpecificSyncAndGetMessage =  async function (purl) {
  function apiOn(purl) {
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

const markOnBackEnd = async function (mark, options, theStar, starWasChosen) {
  // options - logToConvert

  function apiOn(mark, options, theStar, starWasChosen) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({
        msg: 'mark_star',
        purl: mark.purl,
        id: mark._id,
        theStar,
        doAdd:!starWasChosen,
        props: mark,
        publishChange: false
      }, async function (retInfo) {
        resolve(retInfo)
      })
    });
  }
  async function runApi() {
    return await apiOn(mark, options, theStar, starWasChosen); 
  }
  const retInfo = await runApi()
  if (theStar === 'trash' && retInfo.success) {
    const star = document.querySelector('.vulog_overlay_star_ch')
    if (star) star.className = 'vulog_overlay_star_nc'
    const inbox = document.querySelector('.vulog_overlay_inbox_ch')
    if (inbox) inbox.className = 'vulog_overlay_inbox_nc'
    const trashspital = document.querySelector('.vulog_overlay_spiral')
    if (trashspital) trashspital.style.display = 'none'
    
    document.querySelector('.vulog_overlay_input.vulog_notes').innerText = ''
    document.getElementById('highlights_area').innerText = ''

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'refresh' }, function (resp2) {
      })
    })

  } else if (retInfo.success) {

  } else {
    showWarning('Could not change bookmark. Sorry. Please try again, after refreshing the page.')
  }
  return retInfo
}
const drawCurrentLogDetails = function(currentMark, currentLog) {
  // onsole.log('drawCurrentLogDetails', { currentMark, currentLog, vState })

  const purl = currentMark?.purl || currentLog?.purl

  const domainApp = currentMark?.domainApp || currentLog?.domainApp || ''
  const title = currentMark?.title || currentLog?.title || ''
  dg.el('thisPage_title').innerText = title + ' ' + (domainApp ? '' : ' - file') // (domainApp ? (domainApp + ': ') : '' ) + 

  const notesAndStars = dg.el('thisPage_stars_and_notes')
  if (currentMark) {
    const trash =  dg.div() 
    notesAndStars.style['grid-template-columns'] = '50px 1fr 100px'
    trash.style.margin = '0'
    const inner = overlayUtils.drawstar('trash', currentMark, { log: currentLog, markOnBackEnd})
    inner.style.padding = '8px'
    inner.style.margin = '5px 10px 0px 0px'
    inner.style.border = '1px solid lightgrey'
    trash.appendChild(inner)
    notesAndStars.appendChild(trash)
  }
  const notesBox = overlayUtils.drawMainNotesBox(currentMark, {  purl, type: 'purlNote', defaultHashTag: vState.defaultHashTag, markOnBackEnd, log: currentLog })
  notesBox.style['max-height'] = '100px'
  notesBox.style['min-height'] = '37px'
  notesAndStars.appendChild(dg.div(notesBox))
  const stars = overlayUtils.drawstars(currentMark, { log: currentLog, markOnBackEnd })
  stars.style.padding = '5px'
  stars.style.margin = '5px 0px'
  stars.style.height = '35px'
  stars.style.border = '1px solid lightgrey'
  notesAndStars.appendChild(dg.div(stars))

  addSharingOnCurrent(currentMark, currentLog)

  // notesDiv.style.width = '360px'
  // notesDiv.style['margin-left'] = '20px'
  // dg.el('thisPage_note').appendChild(notesDiv)
  // starsOuter.appendChild(overlayUtils.drawstars(currentMark, { purl, defaultHashTag: vState?.defaultHashTag, notesDivForHashtag: notesDiv, log: currentLog, markOnBackEnd: backEndComms.markStar}))
  // drawPallette()
  
  dg.el('pallette').appendChild(drawPallette(vState.hcolor, vState.edit_mode))
  const hlArea = dg.el('highlights_area', { show: true, clear: true })
  if (currentMark?.vHighlights && currentMark.vHighlights.length > 0) {
    currentMark.vHighlights.forEach(hlight => hlArea.appendChild(overlayUtils.drawHighlight(currentMark.purl,  hlight, { isOwn: true, include_delete: true, show_display_errs: true, mark: currentMark })))
  } else {
    hlArea.appendChild(dg.div('To highlight text from the page, right click on the page and choose highlight. Use the color pallette above to change your highlight color.'))
  }
  dg.el('thisPage_details').appendChild(dg.div(
    dg.div({ className: 'vulog_title_subtle', style: { } }, 'Page Info'),
    history.drawDetailHeader(currentLog),
    history.drawDetailsDiv(currentLog),
    // trackers.header(vState, { isCurrent: true, cookieRemovalHasBeenCalled: vState.cookieRemovalHasBeenCalled }),
    // trackers.details(vState, { isCurrent: true }),
    // dg.div({ id: 'sharing_on_current' })
  ))

  // addSettingsOnCurrent(vState)
}

const backEndComms = {
  markStar: async function (mark, options, theStar, starWasChosen) {
    // options - logToConvert

    function apiOn(mark, options, theStar, starWasChosen) {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({
          msg: 'mark_star',
          purl: mark.purl,
          id: mark._id,
          theStar,
          doAdd:!starWasChosen,
          props: mark,
          publishChange: false
        }, async function (retInfo) {
          resolve(retInfo)
        })
      });
    }
    async function runApi() {
      return await apiOn(mark, options, theStar, starWasChosen); 
    }
    const retInfo = await runApi()
    if (retInfo.success) {
      if (theStar === 'trash') { showWarning('need to remove local vars and redraw?')}
      // update state here should grab all ecent marks from backend and update all
      if (retInfo.error) showWarning('Bookmark was changed but there was an error updating this page. Try refreshing. Sorry.')
    } else {
      showWarning('Could not change bookmark. Sorry. Please try again, after refreshing the page.')
    }
    return retInfo
  },
}

// getItemsSharedBy to be used in future
const getItemsSharedBy = function (user, host, accessToken, callback) {
  console.log('for future use .... ??')
  const data = {
    data_owner_host: host,
    data_owner_user: user,
    table_id: 'com.salmanff.vulog.marks',
    permission: 'link_share',
    app_id: 'com.salmanff.vulog'
  }
  if (!accessToken) {
    freezr.perms.validateDataOwner(data, function (ret) {
      if (!ret || ret.error || !ret['access-token']) {
        callback(new Error(ret ? ((ret.error || 'error') + ' ' + (ret.code || '')) : 'Error getting access token. Please try later'))
      } else {
        // onsole.log('got validation ret ', ret)
        const accessToken = ret['access-token']
        console.log('nb - todo should send accesstoken back to background so it can be recorded')
        getItemsSharedBy(user, host, accessToken, callback)
      }
    })
  } else {
    freezr.ceps.getquery({ host: host, appToken: accessToken, app_table: 'com.salmanff.vulog.marks' }, function (err, ret) {
      if (err || !ret || ret.error) {
        callback(err || ret.error || 'Error getting access token. Please try later')
      } else {
        callback(null, accessToken, ret)
      }
    })
  }
}

var drawPallette = function (currentHColor, editMode) {
  if (!currentHColor) currentHColor = 'green'

  const outer = overlayUtils.makeEl('div', '', { display: 'block', 'margin-left': '10px' }) // 'margin-top': '-10px'
  
  const palletteTitle = overlayUtils.makeEl('div', '', {
    display: 'inline-block',
    width: '35px',
    'font-size': '8px',
    color: 'yellowgreen',
    margin: '0 5px'
  }, 'Highlight Pallette')
  palletteTitle.style.display = 'inline-block'
  outer.appendChild(palletteTitle)

  const palletteArea = overlayUtils.makeEl('div', 'vulog_overlay_palletteArea', { 
    display: 'inline-block',
    border: '1px solid lightgrey',
    'border-radius': '3px',
    padding: '2px 0px 7px 2px',
    'margin-right': '10px'
  }, '')
  const colortable = overlayUtils.drawColorTable(currentHColor)
  colortable.style.border = '0px'
  palletteArea.appendChild(colortable)
  outer.appendChild(palletteArea) // new

  // Add edit_mode
  const editModeInener = overlayUtils.makeEl('div', 'powerModeButtPopUp', {
    'font-size': '14px',
    width: '150px',
    display: 'inline-block',
    color: 'blue',
    'vertical-align': 'top',
    padding: '5px',
    cursor: 'pointer',
    'text-align': 'center',
    border: '1px solid lightgray',
    'border-radius': '5px',
    'margin-top': '-2px'
  }, 'Use Power mode')

  editModeInener.onclick = async function () {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const resp0 = await chrome.scripting.executeScript({
      target : {tabId : tab.id},
      files : [ 'main/toggle_edit_mode.js' ],
    })
    // chrome.tabs.executeScript({ file: 'main/toggle_edit_mode.js' })
    // v3-manifest 
    const resp = await chrome.runtime.sendMessage({ msg: 'set_edit_mode', set: !editMode, purl: tabinfo.purl })
    // v2-manifest chrome.runtime.sendMessage({ msg: 'set_edit_mode', set: !editMode, purl: tabinfo.purl }, function (resp) {
      if (resp && !resp.error) {
          editMode = !editMode
          setEditModetext(editMode)
      }
    // })
  }
  const setEditModetext = function(isPowerMode) {
    theEl = document.getElementById('powerModeButtPopUp')
    if (theEl) theEl.textContent =  isPowerMode ? 'Turn off Power Mode' : 'Use Power Mode '
  }
  setTimeout(() => {
    setEditModetext(editMode)    
  }, 5);

  outer.appendChild(editModeInener)

    // setTimeout(vState.addEditModeButton, 5)

    return outer
}
const addSharingOnCurrent = function (currentMark, currentLog) {
  if (!vState.isLoggedIn) {
    const loggedOutDiv = dg.el( 'thisPage_Sharing_loggedOut', { clear: true })
    loggedOutDiv.appendChild(dg.div({ className: 'vulog_title_subtle' }, 'Personal Data Server'))
    loggedOutDiv.appendChild(dg.div({ 'font-size': '9px', }, dg.span('To be be able to share your bookmarks across devices or with friends, you need a CEPS-compatible personal server. Go to '), dg.a({ href: '/main/settings.html', target: '_blank' }, 'the settings page'), dg.span(' To sign up for a temporary / limited personal server, visit ', dg.a( { href: 'https://freezr.info', target: '_blank'}, 'freezr.info.'))))
  } else {
    const itemdiv = dg.el( 'thisPage_Sharing_loggedIn', { clear: true, show: true })
    const purl = currentMark?.purl || currentLog?.purl

    itemdiv.appendChild(dg.div({ className: 'vulog_title_subtle' }, 'Sharing'))
    
    const skeleton = lister.sharingDetailsSkeleton(purl, { hideSummary: true, minHeight: '0px' })
    itemdiv.appendChild(skeleton)
    itemdiv.appendChild(overlayUtils.vMessageCommentDetails(purl, []))
    const hLightOptions = {
      type: 'msgHighLights',
      purl: purl,
      markOnBackEnd,
      markOnMarks: currentMark,
      logToConvert: null,
      hLightCommentSaver: vState.hLightCommentSaver,
      hLightDeleter: vState.hLightDeleter,
      hLightCommentSaver: vState.hLightCommentSaver
    }
    if (!hLightOptions.hLightCommentSaver) console.error('No hLightOptions hLightCommentSaver msgHighLightoptions in drawmakr')
    itemdiv.appendChild(lister.newDrawHighlights(purl, [], hLightOptions)) //
    
    // set up for lister -> emulating extensions for sharing marks
    if (!vState.sharedmarks){
      vState.sharedmarks = { lookups: { }, unfilteredItems: [] }
      vState.sharedmarks.lookups[purl] = []
      vState.marks = { lookups: { }, unfilteredItems: [] }
      vState.messages = { unfilteredItems: [] }
    }
    if (currentMark) {
      vState.marks.lookups[purl] = currentMark
      vState.marks.unfilteredItems.push(currentMark)
    }
    if (!currentMark) vState.history = { unfilteredItems: [ currentLog ]}
    vState.queryParams = { list: currentMark ? 'marks' : 'history' }

    setTimeout(async function () { 
      try {
        await refreshSharedMarksinVstateFor(purl)
        lister.redrawSharingDetails(skeleton)
      } catch (e) {
        console.warn('err in refreshSharedMarksinVstateFor ', {e})
        lister.postErrInSharingDetails(itemdiv.firstChild.nextSibling)
      }
    }, 2)
    
    skeleton.style.display = 'block'
  }
}
const clearPopUpDivsAndResetVulogData = function() {
  freezrMeta.reset()
  vulogInfo.details.freezrMeta = freezrMeta
  marks.offlineCredentialsExpired = false
  const divs = ['thisPage_domainApp', 'thisPage_title', 'thisPage_stars', 'shareOptions', 'thisPage_note', 'highlights_area', 'thisPage_Sharing', 'thisPage_details']
  divs.forEach(div => { div.innerhTML = '' })
}

// clicks
document.addEventListener('click', function (e) {
  let clickable = e.target.id ? e.target : e.target.parentElement
  var elSects = clickable.id.split('_')
  if (elSects[0] === 'openpopupintab') { doClick(elSects) }
  if (e.target.id === 'closeWarnings') document.getElementById('closeWarnings').onclick  = function() { showWarning() }
}, false)
var doClick = function (args) {
  let ending = ''
  if (args[1] === 'settings') {
    chrome.tabs.create({ url: '/main/settings.html' })
  } else {
    switch (args[1]) {
      case 'tabhistory' :
        ending = 'view=tabhistory'
        break
      case 'history' :
        ending = 'view=history'
        break
      case 'marks' :
        ending = 'view=marks'
        break
      case 'messages' :
        ending = 'view=messages'
        break
      default:
        ending = 'view=marks'
    }
    chrome.tabs.create({ url: '/main/view.html?' + ending })
  }
}

var showWarning = function (msg, timing) {
  console.warn('WARNING : ' + JSON.stringify(msg))
  // null msg clears the message
  if (warningTimeOut) clearTimeout(warningTimeOut)
  if (!msg) {
    dg.el('warning_outer').style.display = 'none'
    dg.el('warnings', { clear: true })
  } else {
    const newWarning = dg.div(
      { style: { border: '1px solid grey', 'border-radius': '3px', padding: '3px', margin: '3px' } })
    newWarning.innerHTML = msg
    dg.el('warnings').appendChild(newWarning)
    dg.el('warning_outer').style.display = 'block'
    if (timing) {
      setTimeout(function () {
        newWarning.remove()
        if (dg.el('warnings').innerText === '') dg.el('warning_outer').style.display = 'none'
      }, timing)
    }
  }
}



// OLD NOT USED OR USED IN LISTER
/* clicks 
    case 'filterStar':
      lister.toggleFilterStar(args[2])
      break
    case 'saveNotesTags':
      saveNotesTags()
      break
    case 'search':
      searchInTab()
      break
    case 'switchGroupByview':
      var theEl = dg.el('click_switchGroupByview')
      if (theEl.getAttribute('data-placeholder') === 'date') {
        theEl.setAttribute('data-placeholder', 'referrer')
        theEl.innerText = 'Group by date' // referrer
        switchView('referrer')
      } else {
        theEl.setAttribute('data-placeholder', 'date')
        theEl.innerText = 'Group by referrer' // referrer
        switchView('date')
      }
      break
*/
// Bookmarks
const switchView = function (grouptype) {
  lister[thisTab].groupBy = grouptype
  lister.showSearch(0, thisTab)
}
const searchInTab = function (options) {
  if (thisTab !== 'inbox') {
    const searchBox = dg.el('idSearchMarksBox')
    if (searchBox && searchBox.innerText.trim()) lister[thisTab].searchParams.words = removeSpacesEtc(searchBox.innerText).split(' ')
  }

  lister[thisTab].pages = []

  const fromPopState = (options && options.fromPopState) ? options.fromPopState : false
  lister.doSearch(0, thisTab, fromPopState)
}
// const convertPasteToText = function (evt) {
//   evt.preventDefault()
//   var text = evt.clipboardData.getData('text/plain')
//   document.execCommand('insertHTML', false, text)
//   // setTimeout(function () { evt.target.innerText}, 5)
// }
// if (document.getElementById('idNotesBox')) document.getElementById('idNotesBox').onpaste = convertPasteToText

if (document.getElementById('idSearchMarksBox')) {
  document.getElementById('idSearchMarksBox').onkeypress = function (evt) {
    if (evt.keyCode === 13 || evt.keyCode === 32) {
      if (evt.keyCode === 13) evt.preventDefault()
      searchInTab()
    }
  }
  document.getElementById('idSearchMarksBox').onpaste = convertPasteToText
}
// const addEmptyCurrentStars = function () {
//   dg.el('currentStars').style['margin-bottom'] = '-10px'
//   lister.drawStarsDiv('currentStars', [])
//   dg.el('addRemoveStars', { clear: true }).appendChild(lister.addBookmarkChoices({ purl: currentLog.purl }))
// }
