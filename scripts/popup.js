/*
    vuLog_popup.js
    com.salmanff.vulog - chrome app for browser view history and book marking
    version 0.0.2 - march 2020

*/

/* global chrome */ // from system
/* global dg */ // from dgelements.js
/* global freezrMeta  */ // from freezr_app_init
/* global freezr */ // from freezr_core.js
/* global marks */ // from  marks.js
/* global history */ // from  history.js
/* global showTrackers */ // from trackers.js

const tabOpenTime = new Date().getTime()

let recordingPaused
let warningTimeOut
let gotBullHornPublicWarning = false
var currentLog
var tabinfo

if (navigator.platform.toUpperCase().indexOf('MAC') >= 0) dg.el('topBar').style.height = '30px'

freezrMeta.initialize('com.salmanff.vulog')

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
  if (marks.viewMode === 'markInTab') {
    opentab('marks')
  } if (!purl) {
    opentab('action')
    dg.el('userMarks_area').style.display = 'none'
    dg.el('thispage_title', { clear: true }).appendChild(dg.div('Could not get page info - no url available'))
  } else {
    setTimeout(function () {
      chrome.runtime.sendMessage({ msg: 'getPageData', purl: purl, tabinfo: tabinfo }, function (response) {
        // onsole.log('getPageData',response)
        if (response && response.success) {
          currentLog = response.details.currentLog
          marks.current = response.details.current_mark
          freezrMeta.set(response.details.freezrMeta)
          gotBullHornPublicWarning = response.details.gotBullHornPublicWarning
          recordingPaused = response.details.pause_vulog

          if (!freezrMeta.appToken) dg.showEl('notloggedinmsg')
          if (response.details.syncErr) showWarning('There was an error syncing. ', response.details.syncErr)
          if (response.details.deleted_unbackedupdata) {
            showWarning('Some of your logged items were deleted! Please do find a Personal Data Store to be able to keep mroe data, as the web browser doesnt have any more space.', 10000)
          }
          if (response.details.marks_data_size && response.details.marks_data_size > 1500000) {
            showWarning('You have a large amount of marks (notes and highlights) - you really need to get a personal data store or risk losing these.', 10000)
          }
          if (currentLog) {
            dg.el('thisPage_details').appendChild(dg.div({ style: { 'margin-left': '15px' } },
              dg.div({ style: { 'font-size': '14px', 'font-weight': 'bold', 'margin-left': '60px', 'margin-bottom': '5px' } },
                (currentLog.title ? ((currentLog.domain_app ? currentLog.domain_app : 'file') + ' - ' + currentLog.title) : currentLog.url)),
              history.drawDetailHeader(currentLog),
              history.drawDetailsDiv(currentLog)
            ))
          } else {
            dg.el('thisPage_details', { clear: true }).appendChild(dg.div({ className: 'vulog_title  vulog_title_emph' }, purl))
            dg.el('thisPage_details').appendChild(dg.div({ style: { 'margin-left': '75px', 'padding-top': '20px' } }, 'No meta-data available for this page.'))
          }
          opentab('action')
          if (marks.current) {
            showCurrentUserMark()
          } else if (freezrMeta.serverAddress) {
            freezr.ceps.getquery({ collection: 'marks', q: { purl } },
              function (error, returndata) {
                if (error) {
                  showWarning('Could not connect to your data store to retrieve online marks. Your marks can be synced later.')
                } else if (!returndata || returndata.length === 0) {
                  marks.current = {}
                } else {
                  marks.current = returndata[0]
                  showCurrentUserMark()
                  chrome.runtime.sendMessage({ msg: 'newOnlineMarks', marks: returndata }, function (response) {
                    // onsole.log('updated online mark ',response)
                  })
                }
                opentab('action')
              }
            )
          } else {
            marks.current = {}
          }
        } else {
          opentab('action')
          dg.el('userMarks_area').style.display = 'none'
          dg.el('thispage_title', { clear: true }).appendChild(dg.div('Internal Error. Please refresh the page to try again'))
        }
      })
    }, 100)
  }
})
var opentab = function (tabName, options = {}) {
  if (marks.viewMode === 'popup') {
    var alltabs = ['action', 'trackers', 'history', 'marks', 'more']
    alltabs.forEach(function (aTab) {
      document.getElementById(aTab + '_tab').style = 'display:' + (aTab === tabName ? 'block' : 'none')
      document.getElementById('click_gototab_' + aTab).className = 'top_menu_item tm_' + (aTab === tabName ? 'opened' : 'closed')
    })
  } else { // viewMode=='markInTab'
    tabName = 'marks'
  }
  if (tabName === 'history') {
    if (dg.el('vulog_history_records').innerHTML === '') {
      history.clearSearch()
    }
  } else if (tabName === 'marks') {
    if (dg.el('vulog_marks_records').innerHTML === '') {
      marks.clearSearch()
    }
  } else if (tabName === 'more') {
    showPauseGraphics()
  } else if (tabName === 'action') {
  } else if (tabName === 'trackers') {
    if (options && options.source === 'clicktab' && (!currentLog || tabOpenTime - currentLog.vulog_timestamp < 2000)) {
      dg.el('tracker_main', { clear: true }).appendChild(dg.div({ style: { 'margin-left': '250px', 'margin-top': '100px' } }, dg.img({ src: '../freezr/static/ajaxloaderBig.gif' })))
      setTimeout(function () {
        chrome.runtime.sendMessage({ msg: 'getPageData', purl: tabinfo.purl, tabinfo: tabinfo }, function (response) {
          if (response && response.success) {
            currentLog = response.details.currentLog
            dg.el('tracker_main', { clear: true, top: true }).appendChild(showTrackers(currentLog, true))
          } else {
            dg.el('tracker_main', { clear: true, top: true }).appendChild(dg.span('Error getting page info'))
          }
        })
      }, 2000)
    } else if (options && options.log) {
      dg.el('tracker_main', { clear: true, top: true }).appendChild(showTrackers(options.log, false))// see trackers.js
    } else {
      dg.el('tracker_main', { clear: true }).appendChild(showTrackers(currentLog, true))// see trackers.js
    }
  }
}

// clicks
document.addEventListener('click', function (e) {
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
    case 'search':
      if (args[2] === 'history') history.doSearch()
      if (args[2] === 'marks') marks.doSearch()
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
    case 'markStar':
      toggleMainPageStar(args[2])
      break
    case 'filterStar':
      marks.toggleFilterStar(args[2])
      break
    case 'saveNotesTags':
      saveNotesTags()
      break
    case 'closeWarnings':
      showWarning()
      break
    case 'openpopupintab':
      chrome.tabs.create({ url: 'static/markInTab.html' })
      break
    default:
      console.warn('undefined click ')
  }
}
// keypress events
document.getElementById('idSearchHistoryBox').onkeypress = function (evt) {
  if (evt.keyCode === 13 || evt.keyCode === 32) {
    if (evt.keyCode === 13) evt.preventDefault()
    history.doSearch()
  }
}
document.getElementById('idSearchMarksBox').onkeypress = function (evt) {
  if (evt.keyCode === 13 || evt.keyCode === 32) {
    if (evt.keyCode === 13) evt.preventDefault()
    marks.doSearch()
    // pop_historian.doSearch('marks')
  }
}
document.getElementById('idTagBox').onkeydown = function (evt) {
  if (evt.keyCode === 13 || evt.keyCode === 32 || evt.keyCode === 9) {
    if (evt.keyCode === 13 || evt.keyCode === 9) evt.preventDefault()
    saveNotesTags()
  } else {
    turnOnSaveButt()
  }
}
document.getElementById('idNotesBox').onkeydown = function (evt) {
  if (evt.keyCode === 13 || evt.keyCode === 32 || evt.keyCode === 9) {
    if (evt.keyCode === 13) evt.preventDefault()
    saveNotesTags()
  } else {
    turnOnSaveButt()
  }
}

var turnOffSaveButt = function () {
  document.getElementById('click_saveNotesTags_0').className = 'history_xtra_butt unchosen-star'
}
var turnOnSaveButt = function () {
  document.getElementById('click_saveNotesTags_0').className = 'history_xtra_butt chosen-star'
}

const convertPasteToText = function (evt) {
  setTimeout(function () {
    evt.target.innerHTML = evt.target.innerText
  }, 5)
}
document.getElementById('idSearchHistoryBox').onpaste = convertPasteToText
document.getElementById('idSearchMarksBox').onpaste = convertPasteToText
document.getElementById('idTagBox').onpaste = convertPasteToText
document.getElementById('idNotesBox').onpaste = convertPasteToText

// initialize freezr related
freezr.app.isWebBased = false
freezr.app.loginCallback = function (error, jsonResp) {
  console.log({ error, jsonResp })
  if (error) {
    showWarning('Could not log you in - ' + error.message, 3000)
  } else if (!jsonResp.appToken) {
    showWarning('Please install vulog on your personal server and log in again.')
  } else {
    /*
    freezrMeta.appToken = jsonResp.access_token
    freezrMeta.userId = jsonResp.user_id
    freezrMeta.tokenExpires = jsonResp.expires_in
    freezrMeta.serverAddress =
    */

    chrome.runtime.sendMessage({ msg: 'loggedin', freezrMeta: jsonResp }, function (response) {
      if (response && response.success) {
        showWarning('Successful login')
        dg.hideEl('notloggedinmsg')
        freezr.ceps.getquery({ collection: 'marks' }, function (error, returndata) {
          chrome.runtime.sendMessage({ msg: 'newOnlineMarks', marks: returndata, error: error }, function (response) {
            marks.doSearch(true)
          })
        })
      } else {
        showWarning('Note : Logged in but failed to register credentials')
      }
    })
  }
}
freezr.app.logoutCallback = function (resp) {
  if (resp && resp.error) {
    showWarning('There was an error logging you out.')
  }
  chrome.runtime.sendMessage({ msg: 'logged_out' }, function (response) {
    if (!response || !response.success) {
      showWarning('Error trying to save logout information')
    } else {
      freezrMeta.reset()
      freezr.utils.freezrMenuClose()
      opentab('action')
      showWarning('You have been logged out, and your unsynced history has been kept locally. Go to "More" to remove your data.')
    }
  })
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
      history.doSearch(true)
      marks.doSearch(true)
      showWarning('Local data removed.')
    } else {
      showWarning('Error trying to remove local data.')
    }
  })
}
var removeHistoryOnly = function () {
  chrome.runtime.sendMessage({ msg: 'removeHistoryOnly', tabinfo: tabinfo }, function (response) {
    if (response.success) {
      history.doSearch(true)
      showWarning('History removed.')
    } else {
      showWarning('Error trying to remove local data.')
    }
  })
}
var trySyncing = function () {
  chrome.runtime.sendMessage({ msg: 'trySyncing' }, function (response) {
    if (response && response.success) {
      opentab('history')
    } else {
      showWarning('Could not sync right now ')
    }
  })
}

// Marks
var showCurrentUserMark = function () {
  if (marks.current.vulog_mark_stars && marks.current.vulog_mark_stars.length > 0) {
    marks.current.vulog_mark_stars.forEach(function (aStar) {
      var starDiv = document.getElementById('click_markStar_' + aStar + '_0')
      if (starDiv) starDiv.className = 'fa fa-' + aStar + ' stars chosen-star'
    })
  }
  if (marks.current.vulog_mark_notes) document.getElementById('idNotesBox').textContent = marks.current.vulog_mark_notes
  if (marks.current.vulog_mark_tags) document.getElementById('idTagBox').textContent = marks.current.vulog_mark_tags.join(' ')
  if (marks.current.vulog_highlights && marks.current.vulog_highlights.length > 0) {
    const hlArea = dg.el('highlights_area', { show: true })
    hlArea.appendChild(dg.div({ style: { 'font-weight': 'bold' } }, 'Quotes (Highlights)'))
    marks.current.vulog_highlights.forEach((item, i) => hlArea.appendChild(marks.drawHighlight(item, { include_delete: true, show_display_errs: true })))
  }
}
var toggleMainPageStar = function (theStar) {
  var starDiv = dg.el('click_markStar_' + theStar + '_0')
  var starIsChosen = (starDiv && starDiv.className.indexOf('unchosen') < 0)
  var publishChange = (theStar === 'bullhorn')
  if (!theStar || !starDiv) {
    showWarning('internal error - no stars', theStar)
  } else if (publishChange && !freezrMeta.serverAddress) {
    showWarning('This button makes a link public. You have to be logged in to your personal server to be able to do this. (Press the button on the top right to log in to your server.)')
  } else {
    if (!publishChange || gotBullHornPublicWarning) {
      chrome.runtime.sendMessage({
        msg: 'mark_star',
        purl: (marks.current ? marks.current.purl : null) || (currentLog ? currentLog.purl : null),
        id: (marks.current ? (marks.current._id || marks.current.fj_local_temp_unique_id) : null),
        theStar: theStar,
        doAdd: !starIsChosen,
        publishChange: publishChange,
        tabinfo: tabinfo
      }, function (response) {
        if (!response || response.error) {
          showWarning((response ? response.error : 'Error saving mark.'))
        } else {
          starDiv.className = 'fa fa-' + theStar + ' stars ' + (starIsChosen ? 'unchosen-star' : 'chosen-star')
        }
      })
    } else {
      freezr.perms.getAllAppPermissions(function (error, resp) {
        if (error) {
          showWarning('Error connecting to server')
        } else {
          let granted = false
          try {
            granted = resp['com.salmanff.vulog'].thisAppToThisApp[0].granted
            if (!granted) showWarning('Pressing the Bullhorn icon makes this link PUBLIC, but you have not yet granted permission to share your items with the public. You can do that by pressing the freezr button on the top right.')
            else {
              showWarning('Pressing the Bullhorn icon makes this link PUBLIC. Press again if you are sure you want to move ahead')
              gotBullHornPublicWarning = true
            }
          } catch (e) {
            showWarning('Pressing the Bullhorn icon makes this link PUBLIC. There was an error confirming permissions')
          }
          // onsole.log(granted, resp)
        }
      })
    }
  }
}
var saveNotesTags = function () {
  var theNotes = document.getElementById('idNotesBox').textContent
  var theTags = document.getElementById('idTagBox').textContent.replace(/ {2}/g, ' ').trim().split(' ')
  if (!marks.current) marks.current = {}
  marks.current.vulog_mark_notes = theNotes
  marks.current.vulog_mark_tags = theTags
  chrome.runtime.sendMessage({
    msg: 'save_notes',
    purl: marks.current.purl || currentLog.purl,
    id: marks.current._id,
    notes: theNotes,
    tags: theTags,
    tabinfo: tabinfo
  }, function (response) {
    if (!response || response.error) showWarning((response ? response.error : null))
    turnOffSaveButt()
  })
}

var showPauseGraphics = function () {
  document.getElementById('click_pause_0').className = 'fa topBut_Mobile fa-' + (recordingPaused ? 'play' : 'pause')
  document.getElementById('click_pause_1').innerHTML = (recordingPaused ? 'resume logging' : 'pause logging &nbsp; ')
}
var showWarning = function (msg, timing) {
  console.log('WARNING : ' + JSON.stringify(msg))
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

// Generic functions
var corePath = function (aUrl) {
  if (aUrl.indexOf('#') > 0) aUrl = aUrl.slice(0, aUrl.indexOf('#'))
  // if (aUrl.indexOf('http://')== 0){ aUrl=aUrl.slice(7)} else if (aUrl.indexOf('https://')== 0) {aUrl=aUrl.slice(8)}
  if (aUrl.slice(-1) === '/') { aUrl = aUrl.slice(0, -1) }
  return aUrl.trim()
}

freezr.utils.addFreezerDialogueElements()

/*
document.getElementById('inputFileToLoad').onchange = function () {
  // utility used to encode images fir background url. (from stackoverflow)

  var filesSelected = document.getElementById('inputFileToLoad').files
  if (filesSelected.length > 0) {
    var fileToLoad = filesSelected[0]

    var fileReader = new FileReader()

    fileReader.onload = function (fileLoadedEvent) {
      var srcData = fileLoadedEvent.target.result // <--- data: base64

      var newImage = document.createElement('img')
      newImage.src = srcData

      document.getElementById('imgTest').innerHTML = newImage.outerHTML
      alert('Converted Base64 version is ' + document.getElementById('imgTest').innerHTML)
      // onsole.log('Converted Base64 version is ' + document.getElementById('imgTest').innerHTML)
    }
    fileReader.readAsDataURL(fileToLoad)
  }
}
*/
