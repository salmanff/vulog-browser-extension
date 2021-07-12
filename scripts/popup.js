/*
    vuLog_popup.js
    com.salmanff.vulog - chrome app for browser view history and book marking
    version 0.0.2 - march 2020

*/

/* global chrome */ // from system
/* global dg */ // from dgelements.js
/* global freezrMeta  */ // from freezr_app_init
/* global freezr, freezerRestricted */ // from freezr_core.js
/* global history */ // from  history.js
/* global trackers */ // from trackers.js
/* global sharing */ // from sharing.js
/* global lister */ // from lister.js
/* global removeSpacesEtc */ // from utils.js

/* exported offlineCredentialsExpired, getItemsSharedBy */ // getItemsSharedBy to be used in future

let recordingPaused
let warningTimeOut
let cookieRemovalHasBeenCalled = false
let offlineCredentialsExpired = false
var currentLog
var tabinfo = {}
var currentHColor = 'green'
var marks = { current: null }
var editMode = false

if (navigator.platform.toUpperCase().indexOf('MAC') >= 0) dg.el('topBar').style.height = '30px'

freezrMeta.initialize('com.salmanff.vulog')

const isPopUp = (window.location.pathname !== '/static/viewintab.html')
var thisTab = null

var opentab = function (tabName, options = {}) {
  thisTab = tabName
  var alltabs = isPopUp ? ['current', 'history', 'inbox', 'messages', 'feed', 'more'] : ['history', 'bookmarks', 'messages', 'sentMsgs', 'feed', 'more']
  alltabs.forEach(function (aTab) {
    if (document.getElementById(aTab + '_tab'))document.getElementById(aTab + '_tab').style = 'display:' + (aTab === tabName ? 'block' : 'none')
    if (document.getElementById('click_gototab_' + aTab)) document.getElementById('click_gototab_' + aTab).className = 'top_menu_item tm_' + (aTab === tabName ? 'opened' : 'closed')
  })

  if (tabName === 'history') {
    if (dg.el('vulog_history_records').innerHTML === '') {
      history.clearSearch()
    }
  } else if (tabName === 'inbox') {
    if (dg.el('vulog_inbox_records').innerHTML === '') searchInTab()
  } else if (tabName === 'bookmarks') {
    searchInTab(options)
  } else if (tabName === 'testCommand') {
    const toShare = {
      type: 'share-records',
      recipient_host: 'http://localhost:3000',
      recipient_id: 'user2',
      sharing_permission: 'link_share',
      contact_permission: 'friends',
      table_id: 'com.salmanff.vulog.marks',
      record_id: 'ioKuIXC2IQ30twE8',
      app_id: 'com.salmanff.vulog',
      sender_id: 'salmanlocal',
      sender_host: 'http://localhost:3000'
    }
    freezerRestricted.connect.ask('/ceps/message/initiate', toShare, function (ret) {
      showWarning(JSON.stringify(ret))
    })
    /*
    freezerRestricted.connect.read('/ceps/message/get', null, function (err, ret) {
      showWarning(JSON.stringify(ret))
      console.log({err, ret})
    })
    */
  } else if (tabName === 'messages' || tabName === 'messages_tab') { // popup or tabview
    searchInTab()
  } else if (tabName === 'sentMsgs') { // popup or tabview
    searchInTab()
  } else if (tabName === 'more') {
    showPauseGraphics()
    const isLoggedIn = (freezrMeta && freezrMeta.appToken)
    if (!isLoggedIn || !isPopUp) dg.hideEl('moreLoggedInSection')
  } else if (tabName === 'current') {
  } else if (tabName === 'feed') {
  }
}

const getItemsSharedBy = function (user, host, accessToken, callback) {
  console.log('for future use....')
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
        // console.log('should send accesstoken back to background so it can be recorded')
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

const UPDATE_INTERVAL = 3000

if (isPopUp) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabArray) {
    var purl
    if (tabArray && tabArray.length > 0 && tabArray[0].url) {
      purl = corePath(tabArray[0].url)
      tabinfo = {
        url: tabArray[0].url,
        purl: purl,
        title: tabArray[0].title,
        tabid: tabArray[0].id
      }
    } else {
      showWarning('Error trying to get information on the web page (2)')
    }
    opentab('current')
    if (!purl) {
      dg.el('userMarks_area').style.display = 'none'
      dg.el('thispage_title', { clear: true }).appendChild(dg.div('Could not get page info - no url available'))
    } else {
      drawCurrentTabForPopUp()
    }
  })
} else if (!isPopUp) {
  document.addEventListener('DOMContentLoaded', (evt) => {
    let theTab = lister.loadUrlParams(dg.el('idSearchMarksBox'))
    chrome.runtime.sendMessage({ msg: 'getFreezrmeta' }, function (response) {
      // onsole.log('getFreezrmeta', response)
      if (response && response.success) {
        freezrMeta.set(response.freezrMeta)
      } else {
        showWarning('Internal communication error. You may need to restart your browser.')
      }
      if (!freezrMeta || !freezrMeta.appToken) {
        dg.el('click_gototab_messages').style.display = 'none'
        dg.el('click_gototab_sentMsgs').style.display = 'none'
        theTab = 'bookmarks'
      }
      opentab(theTab, { fromPopState: false })
      window.onpopstate = function (evt, ignore) {
        const theTab = lister.loadUrlParams(dg.el('idSearchMarksBox'))
        opentab(theTab, { fromPopState: true })
      }
    })
  })
  setInterval(lister.markUpdater.checkBackgroundForChanges, UPDATE_INTERVAL)
}

const drawCurrentTabForPopUp = function () {
  const purl = tabinfo.purl
  setTimeout(function () {
    chrome.runtime.sendMessage({ msg: 'getPageData', purl: purl, tabinfo: tabinfo }, function (response) {
      // onsole.log('getPageData', response.details)
      if (response && response.success) {
        currentLog = response.details.currentLog
        marks.current = response.details.current_mark
        marks.contacts = response.details.contacts
        freezrMeta.set(response.details.freezrMeta)
        cookieRemovalHasBeenCalled = response.details.cookieRemovalHasBeenCalled
        setofflineCredentialsto(response.details.offlineCredentialsExpired)
        recordingPaused = response.details.pause_vulog
        currentHColor = response.hcolor
        // onsole.log('current.mark:',marks.current )

        editMode = response.details.edit_mode

        // if (!freezrMeta.appToken) dg.showEl('notloggedinmsg')
        if (response.details.syncErr) showWarning('There was an error syncing. ', response.details.syncErr)
        if (response.details.syncErr) console.log('need to handle sync err messaging better')
        if (response.details.deleted_unbackedupdata) {
          showWarning('Some of your logged items were deleted! Please do find a Personal Data Store to be able to keep mroe data, as the web browser doesnt have any more space.', 10000)
        }
        if (response.details.marks_data_size && response.details.marks_data_size > 1500000 && (!freezrMeta || !freezrMeta.appToken)) {
          showWarning('You have a large amount of marks (notes and highlights) - you really need to get a personal data store or risk losing these.', 10000)
        }
        if (response.fatalErrors) showWarning('Serious Error Encountered: "' + response.fatalErrors + '".   You may want to restart your browser')
        if (dg.el('thisPage_details')) {
          if (currentLog) {
            dg.el('thisPage_details').appendChild(dg.div(
              dg.div({ style: { 'font-size': '14px', 'font-weight': 'bold', 'padding-top': '10px' } },
                (currentLog.title ? currentLog.title +
                  ((currentLog.domain_app ? (currentLog.title.toLowerCase().includes(currentLog.domain_app.toLowerCase().split('.')[0]) ? '' : (' - ' + currentLog.domain_app))
                    : '- file')
                  )
                  : currentLog.url.split('/').join('/ '))),
              dg.div({ id: 'currentStars' }),
              dg.div(
                { style: { 'margin-top': '15px', padding: '0px 0px 0px 10px', 'margin-left': '-9px' } },
                dg.span({ className: 'fa fa-bookmark littlestars unchosen-star markmiddle' }),
                dg.span({ id: 'addRemoveStars' }),
                dg.div({ id: 'expandMarks' })
              ),
              dg.div({ className: 'vulog_title_subtle' }, dg.span({ className: 'fa fa-info-circle littlestars unchosen-star' }), 'General Info'),
              history.drawDetailHeader(currentLog),
              history.drawDetailsDiv(currentLog),
              trackers.header(currentLog, { isCurrent: true, cookieRemovalHasBeenCalled }),
              trackers.details(currentLog, { isCurrent: true }),

              dg.div({ id: 'sharing_on_current' })
            ))
            addSharingOnCurrent()
            addEmptyCurrentStars()
          } else {
            dg.el('thisPage_details', { clear: true }).appendChild(dg.div({ className: 'vulog_title  vulog_title_emph' }, purl))
            dg.el('thisPage_details').appendChild(dg.div({ style: { 'margin-left': '23px', 'padding-top': '20px' } }, 'No meta-data available for this page.'))
          }
        }
        drawPallette()
        if (!freezrMeta || !freezrMeta.appToken) dg.el('click_gototab_messages').style.display = 'none'
        if (marks.current) {
          showCurrentUserMark()
        } else if (freezrMeta.serverAddress) {
          freezr.ceps.getquery({ collection: 'marks', q: { purl } },
            function (error, returndata) {
              if (error) {
                marks.commsError = true
                if (offlineCredentialsExpired) {
                  showWarning('Your credentials are expired. Please re-enter an authorization url to re-connect to yoru server.')
                } else {
                  showWarning('Could not connect to your data store to retrieve online marks. Your marks can be synced later.')
                }
              } else if (!returndata || returndata.length === 0) {
                marks.current = {}
              } else {
                marks.current = returndata[0]
                showCurrentUserMark()
                chrome.runtime.sendMessage({ msg: 'newOnlineMarks', marks: returndata }, function (response) {
                  // onsole.log('updated online mark ',response)
                })
              }
            }
          )
        } else {
          marks.current = { purl: currentLog.purl }
        }
      } else {
        opentab('current')
        if (dg.el('userMarks_area')) dg.el('userMarks_area').style.display = 'none'
        if (dg.el('thispage_title')) dg.el('thispage_title', { clear: true }).appendChild(dg.div('Internal Error. Please refresh the page to try again'))
      }
    })
  }, 100)
}

// clicks
document.addEventListener('click', function (e) {
  if (dg.el('shareOptions') && e.target.id.indexOf('shareOptions') !== 0) dg.el('shareOptions').style.display = 'none'
  var elSects = e.target.id.split('_')
  if (elSects[0] === 'click') { doClick(elSects) }
}, false)
var doClick = function (args) {
  switch (args[1]) {
    case 'pause':
      if (recordingPaused) {
        pauseVulog(false)
      } else {
        pauseVulog(true)
      }
      break
    case 'gototab':
      opentab(args[2], { source: 'clicktab' })
      break
    case 'removeLocalData':
      removeLocalData()
      break
    case 'removeHistoryOnly':
      removeHistoryOnly()
      break
    case 'trySyncing':
      trySyncing()
      break
    case 'filterStar':
      lister.toggleFilterStar(args[2])
      break
    case 'saveNotesTags':
      saveNotesTags()
      break
    case 'closeWarnings':
      showWarning()
      break
    case 'openpopupintab':
    {
      let ending = ''
      switch (args[2]) {
        case 'msgSent':
          ending = 'vulogTab=msgSent'
          break
        case 'msgRec' :
          ending = 'vulogTab=messages'
          break
        case 'inbox':
          ending = 'vulogTab=bookmarks&stars=inbox&notstars=archive'
          break
        default:
          ending = '?vulogTab=bookmarks'
      }
      chrome.tabs.create({ url: '/static/viewintab.html?' + ending })
      break
    }
    case 'logout':
      freezr.utils.logout(logoutCallback)
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
    default:
      console.warn('undefined click ')
  }
}
// keypress events
document.getElementById('idSearchHistoryBox').onkeypress = function (evt) {
  if (evt.keyCode === 13 || evt.keyCode === 32) {
    if (evt.keyCode === 13) evt.preventDefault()
    // history.doSearch()
  }
}
if (document.getElementById('idNotesBox')) {
  document.getElementById('idNotesBox').onkeydown = function (evt) {
    setTimeout(function () {
      // if (evt.keyCode === 13) evt.preventDefault()
      saveNotesTags()
    }, 0)
  }
}

const convertPasteToText = function (evt) {
  evt.preventDefault()
  var text = evt.clipboardData.getData('text/plain')
  document.execCommand('insertHTML', false, text)
  // setTimeout(function () { evt.target.innerText}, 5)
}

if (document.getElementById('idNotesBox')) document.getElementById('idNotesBox').onpaste = convertPasteToText

if (document.getElementById('idSearchMarksBox')) {
  document.getElementById('idSearchMarksBox').onkeypress = function (evt) {
    if (evt.keyCode === 13 || evt.keyCode === 32) {
      if (evt.keyCode === 13) evt.preventDefault()
      searchInTab()
    }
  }
  document.getElementById('idSearchMarksBox').onpaste = convertPasteToText
}

// main messaging with background
var pauseVulog = function (doPause) {
  document.getElementById('click_pause_0').className = ''
  document.getElementById('click_pause_1').innerHTML = '. . . .'
  chrome.runtime.sendMessage({ msg: (doPause ? 'pause' : 'unpause'), tabinfo: tabinfo }, function (response) {
    if (response.success) {
      recordingPaused = doPause
      showPauseGraphics()
    } else {
      showWarning('Error trying to pause.')
    }
  })
}
var removeLocalData = function () {
  chrome.runtime.sendMessage({ msg: 'removeLocalData', tabinfo: tabinfo }, function (response) {
    if (response.success) {
      // console.log('to do - need to refresh both pages')
      lister.doSearch()
      showWarning('Local data removed.')
    } else {
      showWarning('Error trying to remove local data.')
    }
  })
}
var removeHistoryOnly = function () {
  chrome.runtime.sendMessage({ msg: 'removeHistoryOnly', tabinfo: tabinfo }, function (response) {
    if (response.success) {
      // history.doSearch()
      showWarning('History removed.')
    } else {
      showWarning('Error trying to remove local data.')
    }
  })
}
var trySyncing = function () {
  chrome.runtime.sendMessage({ msg: 'trySyncing' }, function (response) {
    if (response && response.success) {
      showWarning('Syncing started')
    } else if (response.error) {
      showWarning(response.error)
    } else {
      console.warn(response)
      showWarning('Could not sync right now. ')
    }
  })
}

// Bookmarks
const switchView = function (grouptype) {
  lister[thisTab].groupBy = grouptype
  lister.showSearch(0, thisTab)
}

const searchInTab = function (options) {
  if (thisTab !== 'inbox') {
    const searchBox = dg.el('idSearchMarksBox')
    if (searchBox) lister[thisTab].searchParams.words = removeSpacesEtc(searchBox.innerText).split(' ')
  }

  lister[thisTab].pages = []

  const fromPopState = (options && options.fromPopState) ? options.fromPopState : false
  lister.doSearch(0, thisTab, fromPopState)
}

const addSharingOnCurrent = function () {
  dg.el('sharing_on_current', { clear: true })
  dg.el('sharing_on_current').appendChild(dg.div({ className: 'vulog_title_subtle' }, dg.span({ className: 'fa fa-users littlestars unchosen-star' }), sharing.title(currentLog)))
  dg.el('sharing_on_current').appendChild(sharing.header(currentLog, { isCurrent: true }))
  dg.el('sharing_on_current').appendChild(sharing.details(currentLog, { isCurrent: true }))
}
const addEmptyCurrentStars = function () {
  dg.el('currentStars').style['margin-bottom'] = '-10px'
  lister.drawStarsDiv('currentStars', [])
  dg.el('addRemoveStars', { clear: true }).appendChild(lister.addBookmarkChoices({ purl: currentLog.purl }))
}

var showCurrentUserMark = function () {
  lister.updateStarsDiv(marks.current)
  if (!marks.current.vulog_mark_notes) marks.current.vulog_mark_notes = ''
  if (marks.current.vulog_mark_tags) marks.current.vulog_mark_notes = marks.current.vulog_mark_tags.join(' ') + '\n\n' + marks.current.vulog_mark_notes
  if (marks.current.vulog_mark_notes) document.getElementById('idNotesBox').textContent = marks.current.vulog_mark_notes
  if (marks.current.vulog_highlights && marks.current.vulog_highlights.length > 0) {
    const hlArea = dg.el('highlights_area', { show: true, clear: true })
    marks.current.vulog_highlights.forEach((item, i) => hlArea.appendChild(lister.drawHighlight(item, { include_delete: true, show_display_errs: true })))
  }
}

var saveNotesTags = function () {
  var theNotes = document.getElementById('idNotesBox').textContent
  if (!marks.current) marks.current = {}
  marks.current.vulog_mark_notes = theNotes
  chrome.runtime.sendMessage({
    msg: 'save_notes',
    purl: marks.current.purl || currentLog.purl,
    id: marks.current._id,
    notes: theNotes,
    tabinfo: tabinfo
  }, function (response) {
    if (!response || response.error) showWarning((response ? response.error : null))
  })
}

var showPauseGraphics = function () {
  document.getElementById('click_pause_0').className = 'fa topBut_Mobile fa-' + (recordingPaused ? 'play' : 'stop')
  document.getElementById('click_pause_1').innerHTML = (recordingPaused ? 'Press to log ALL your browsing history' : 'Press to STOP logging &nbsp; ')
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

const COLOR_MAP = {
  green: 'yellowgreen',
  yellow: 'yellow',
  blue: 'lightskyblue',
  pink: 'lightpink',
  grey: 'lightgrey',
  orange: 'lightsalmon'
  // 'u' : 'underline'
}
var drawPallette = function () {
  const colorTable = dg.div({ style: { border: '1px solid lightgrey', 'background-color': 'white', 'border-radius': '1px', width: '66px', 'margin-bottom': '3px' } })
  for (var [key, value] of Object.entries(COLOR_MAP)) {
    colorTable.appendChild(dg.div({
      style: {
        'background-color': value,
        width: '18px',
        height: '18px',
        cursor: 'pointer',
        display: 'inline-block',
        margin: '0px',
        border: ('2px solid ' + (currentHColor === key ? 'darkgrey' : 'white'))
      },
      onclick: function () {
        setHColor(key, drawPallette)
      }
    }, (key === 'u' ? 'U' : '')
    ))
  }

  const setEditModeText = function () {
    dg.el('popUpSetEditModeButt').innerText = editMode ? 'Turn OFF \n Edit Mode' : 'Turn ON \n Edit Mode'
    dg.el('popUpSetEditModeButt').style.color = editMode ? 'indianred' : 'darkgrey'
  }

  dg.el('pallette', { clear: true }).appendChild(dg.div(
    dg.span('Highlight Pallette'),
    colorTable,
    dg.div({
      className: 'cepsbutton',
      style: { width: '61px', padding: '2px', margin: '2px 0px 2px 0px' },
      id: 'popUpSetEditModeButt',
      onclick: function () {
        chrome.tabs.executeScript({ file: 'scripts/toggle_edit_mode.js' })
        chrome.runtime.sendMessage({ msg: 'set_edit_mode', set: (!editMode), purl: tabinfo.purl, tabinfo }, function (response) {
          if (response.success) {
            editMode = !editMode
            setEditModeText()
          } else {
            editMode = false
            showWarning('Error setting edit mode')
          }
        })
      }
    }, 'Edit Mode')
  ))
  setEditModeText()
}
var setHColor = function (hcolor, cb) {
  chrome.runtime.sendMessage({ msg: 'setHColor', hcolor, tabinfo }, function (response) {
    currentHColor = hcolor
    cb(response)
  })
}

// other
const setofflineCredentialsto = function (value) {
  offlineCredentialsExpired = value
}

// Generic functions
var corePath = function (aUrl) {
  if (aUrl.indexOf('#') > 0) aUrl = aUrl.slice(0, aUrl.indexOf('#'))
  // if (aUrl.indexOf('http://')== 0){ aUrl=aUrl.slice(7)} else if (aUrl.indexOf('https://')== 0) {aUrl=aUrl.slice(8)}
  if (aUrl.slice(-1) === '/') { aUrl = aUrl.slice(0, -1) }
  return aUrl.trim()
}

// initialize freezr related
freezr.app.isWebBased = false
const logoutCallback = function (resp) {
  if (resp && resp.error) {
    showWarning('There was an error logging you out.')
  }
  marks.current = null
  freezrMeta.reset()
  if (dg.el('vulog_inbox_records')) dg.el('vulog_inbox_records').innerHTML = ''
  if (dg.el('cepsloginAuthUrl')) dg.el('cepsloginAuthUrl').textContent = ''
  opentab('current')
  addSharingOnCurrent()
  chrome.runtime.sendMessage({ msg: 'logged_out' }, function (response) {
    if (!response || !response.success) {
      showWarning('Error trying to save logout information')
    } else {
      freezrMeta.reset()
      offlineCredentialsExpired = false
      dg.el('thisPage_details').innerHTML = ''
      dg.el('idNotesBox').innerHTML = ''
      drawCurrentTabForPopUp()
      showWarning("You have been logged out, and your unsynced history has been kept locally. Go to 'Settings' to remove your data.")
    }
  })
}
