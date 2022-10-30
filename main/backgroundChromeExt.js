
/*
    background.js
    com.salmanff.vulog - chrome app for browser view history and book marking
    version 0.0.3 - June 2020

*/

/* global chrome, fetch */ // from system
/* global pureUrlify, domainAppFromUrl, addMetaTotags, addToListAsUniqueItems, cleanTextForEasySearch */ // from pageData.js
/* global JLOS, jlosMarkChanged  */ // from jlos-frozen.js
/* global mapColor  */ // from utils.js
/* global freezr */ // from freezr_core.js
/* global freezrMeta  */ // from freezr_app_init

freezr.app.isWebBased = false
freezrMeta.initialize('com.salmanff.vulog', '0.0.3', 'Vulog - bookmarker, highlighter and logger')

var syncTimer = null
var syncinprogress = false
var logDetailsInRAM = {}
var pageInRAM = null
var fatalErrors = null
var editModes = {}
var recentMarks = []

const SYNC_INTERVAL = 20 * 1000 // idle time before sync
const ICON_PATHS = {
  norm: '../static/vulog_logo_48.png',
  paused: '../static/vulog_closed_48.png',
  red: '../static/vulog_redeye_48.png'
}
console.log('re-initializing vulog')
chrome.storage.local.getBytesInUse(['vulogCopy'], function (bytes) { console.log('Used bytes: ' + bytes) })

const vp5Tranformmark = function (item) {
  const v2Translations = {
    domain_app: 'domainApp',
    vulog_timestamp: 'vCreated',
    vulog_highlights: 'vHighlights',
    vulog_mark_notes: 'vNote',
    vulog_mark_stars: 'vStars',
    vulog_kword2: 'vSearchWords',
    vulog_source: 'vSource'
  }
  for (const [oldKey, newKey] of Object.entries(v2Translations)) {
    if (item[oldKey]) item[newKey] = item[oldKey]
    delete item[oldKey]
  }
  return item
}

const vulog = new JLOS('vulog', { saver: 'nosave', numItemsToFetchOnStart: 50 })
// Get locally stored copy of vulog from chrome local storage
chrome.storage.local.get('vulogCopy', function (items) {
  // onsole.log('vulogCopy meta is' + JSON.stringify(items.vulogCopy.freezrMeta))
  if (items && items.vulogCopy && !isEmpty(items.vulogCopy)) {
    vulog.data = items.vulogCopy
  } else {
    vulog.data = {
      freezrMeta: freezrMeta,
      deleted_unbackedupdata: false,
      logs: [],
      marks: [],
      fj_local_id_counter: 1,
      pause_vulog: true
    }
  }
  if (!vulog.data.hColor) vulog.data.hColor = 'green'
  if (!vulog.data.defaultHashTag) vulog.data.defaultHashTag = ''
  // onsole.log("vulog is now "+JSON.stringify(vulog.data.logs.length));

  freezrMeta.set(vulog.data.freezrMeta)
})

// Highligher FUNCTIONS from github.com/jeromepl/highlighter
chrome.contextMenus.create({ title: 'Highlight text (vulog)', onclick: highlightTextFromContext, contexts: ['selection'] })
chrome.contextMenus.create({ title: 'Add to inbox (vulog)', onclick: AddLinkToInboxFromContext, contexts: ['link'] })
function highlightTextFromContext () {
  chrome.tabs.executeScript({ file: 'main/start_highlight.js' })
}
//   chrome.tabs.executeScript({ file: 'main/toggle_edit_mode.js' })

function AddLinkToInboxFromContext (resp) {
  // onsole.log(resp)
  const purl = pureUrlify(resp.linkUrl)
  let currentMark = vulog.queryLatest('marks', { purl })
  if (currentMark) {
    if (!currentMark.vStars.includes('inbox')) currentMark.vStars.push('inbox')
    jlosMarkChanged(currentMark)
  } else {
    currentMark = {
      referrer: resp.pageUrl,
      vStars: ['inbox'],
      purl: purl,
      url: resp.linkUrl,
      vCreated: new Date().getTime(),
      vulog_sub_pages: [],
      vNote: vulog.data.defaultHashTag ? ('#' + vulog.data.defaultHashTag) : null,
      vSource: 'chrome_browser',
      domainApp: domainAppFromUrl(resp.linkUrl)
    }

    fetch(resp.linkUrl).then(function (response) {
      return (response.text())
    }).then(function (responseText) {
      const parsedResponse = (new window.DOMParser()).parseFromString(responseText, 'text/html')
      const allMetas = parsedResponse.getElementsByTagName('meta')
      currentMark = addMetaTotags(currentMark, allMetas)
      currentMark = vulog.add('marks', currentMark)
    }, error => {
      console.error('Got error fetching data for inbox' + error.message)
      if (resp.selectionText) currentMark.title = resp.selectionText
      currentMark = vulog.add('marks', currentMark)
      console.warn(currentMark)
    })
  }
}

// savetochrome and timee and reducing size
let saveLater
let lastSave = 0
const TIME_TO_SAVE_FROM_IDLE = 10000
const saveToChrome = function (forceSave, callFwd, from) {
  // onsole.log("SaveToChrome forceSave?"+forceSave+ "from "+from+" last Save "+(new Date(lastSave)).toTimeString() )

  if (!callFwd) callFwd = function () { }
  if (getStorageUsed() > (chrome.storage.local.QUOTA_BYTES * 0.8)) reduceSize()
  var nowTime = new Date().getTime()
  if (forceSave || (nowTime - lastSave > TIME_TO_SAVE_FROM_IDLE)) {
    lastSave = nowTime

    chrome.storage.local.set({ vulogCopy: vulog.data }, function () {
      saveLater = null
      const success = (!chrome.runtime.lastError)
      const message = success ? null : chrome.runtime.lastError.message
      if (message) console.warn('chrome runtume err chrome.runtime.lastError:', chrome.runtime.lastError)
      if (message === 'QUOTA_BYTES quota exceeded' && from !== 'fromerror') {
        reduceSize()
        saveToChrome(true, callFwd, 'fromerror')
      } else {
        window.clearTimeout(saveLater); saveLater = null
        trySavingLater()
        fatalErrors = message //
        callFwd({ success, message })
      }
      // trySavingLater
    })
  } else if (from !== 'savetochrome timer') {
    trySavingLater()
    callFwd({ success: 'later' })
  }
}
const trySavingLater = function () {
  if (saveLater) clearTimeout(saveLater)
  saveLater = setTimeout(function () { saveToChrome(false, null, 'savetochrome timer') }, TIME_TO_SAVE_FROM_IDLE)
}
var getStorageUsed = function () {
  const theLen = JSON.stringify(vulog.data).length * 2
  return Math.round(theLen / 1024)
}
var reduceSize = function () {
  for (var i = 0; i < Math.min(100, vulog.data.logs.length - 1); i++) {
    if (!(vulog.data.logs[i]._id && !vulog.data.logs[i].fj_modified_locally)) {
      vulog.data.deleted_unbackedupdata = true
    }
  }
  vulog.data.logs.splice(0, Math.min(100, vulog.data.logs.length - 1))
  vulog.data.messages.splice(0, Math.min(50, vulog.data.logs.length - 1))
  // console.log - todo - if one shared item is HUGE, this needs to be dealt with... potential spam from others
  if (sizeOfObject(vulog.data.marks) > 3000000) {
    for (i = 0; i < Math.min(10, vulog.data.marks.length - 1); i++) {
      if (!(vulog.data.marks[i]._id && !vulog.data.marks[i].fj_modified_locally)) vulog.data.deleted_unbackedupdata = true
    }
    vulog.data.marks.splice(0, Math.min(10, vulog.data.logs.length - 1))
  }
  vulog.data.marks_data_size = sizeOfObject(vulog.data.marks)
}

chrome.windows.onRemoved.addListener(function (windowId) {
  saveToChrome(true, null, 'window closed')
})
chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    if (request && request.msg && requestApi[request.msg]) {
      requestApi[request.msg](request, sender, sendResponse)
    } else {
      sendResponse({ success: false, options: null })
      console.warn('Empty request - ' + ((request && request.msg) ? request.msg : 'No message'))
    }
    clearTimeout(syncTimer)
    syncTimer = setTimeout(trySyncing, SYNC_INTERVAL)
  }
)

var vulogTempDeviceId
var trySyncing = function (callFwd) {
  if (!callFwd) callFwd = function () {} // onsole.log

  vulog.data.syncErr = null
  if (vulog.data.freezrMeta.serverAddress && !syncinprogress) {
    freezr.utils.ping(null, function (error, resp) {
      // console 2019 - whgat is use of ping here?
      resp = freezr.utils.parse(resp)
      if (error) {
        callFwd(error)
      } else if (!vulog.data.deviceId) {
        vulogTempDeviceId = new Date().getTime()
        freezr.ceps.create(
          { device: vulogTempDeviceId, ua: navigator.userAgent },
          { collection: 'devices' },
          function (error, returnData) {
            returnData = freezr.utils.parse(returnData)
            if (error) {
              vulog.data.syncErr = 'error_writing_device'
              callFwd({ error })
            } else {
              vulog.data.deviceId = vulogTempDeviceId
              saveToChrome(true, function () { trySyncing(callFwd) }, 'deviceId write')
            }
          }
        )
      } else {
        vulog.data.syncErr = null
        syncinprogress = true
        if (vulog) {
          syncContacts(callFwd)
        } else {
          console.warn('vulog not defined')
          callFwd({ error: 'vulog not defined' })
        }
      }
    })
  } else if (!syncinprogress) {
    callFwd({ error: 'You are not logged into a personal data store' })
  }
}
var addDeviceId = function (anItem) {
  if (!anItem) { console.warn('ERROR - NO ITEM to add deviceId to'); anItem = {} }
  anItem.vulog_deviceId = vulog.data.deviceId
  return anItem
}
var syncContacts = function (callFwd) {
  // onsole.log('syncContacts')
  vulog.sync('contacts', { app_table: 'dev.ceps.contacts', endCallBack: function (callFwd) { syncMessages(callFwd) } })
}
var syncMessages = function (callFwd) {
  // onsole.log('syncMessages')
  vulog.sync('messages', {
    app_table: 'dev.ceps.messages.got',
    downloadedItemTransform: function (message) {
      message = JSON.parse(JSON.stringify(message))
      if (message && message.record && message.record.purl) {
        message.purl = message.record.purl
        const msgText = message.record.vNote
          ? message.record.vNote + ' : '
          : (message.record.vulog_mark_notes ? message.record.vulog_mark_notes + ' : ' : '')
        // console.log todo - check if sender is a contact before notifying - also add as an option to not get notifications
        const options = {
          type: 'basic',
          iconUrl: 'vulog logo v1.png',
          title: ('A link from ' + message.sender_id + ' @ ' + message.sender_host),
          message: msgText + message.record.title,
          priority: 2
        }
        try {
          chrome.notifications.create(message._id, options) // function (ret) { console.log({ ret }) }
        } catch (e) {
          console.warn('error creating cotification', e)
        }
      }
      return message
    },
    xtraQueryParams: { app_id: 'com.salmanff.vulog' },
    endCallBack: function (callFwd) { checkMarks(callFwd) }
  })
}
if (chrome.notifications) {
  chrome.notifications.onClicked.addListener(function (notifId) {
    const linkObj = vulog.get('messages', notifId)
    const linkUrl = (linkObj && linkObj.record && linkObj.record.url) ? linkObj.record.url : '/main/viewintab.html?vulogTab=messages'
    chrome.tabs.create({ url: linkUrl })
  })
}

var checkMarks = function (callFwd) { // checks to make sure there are no conflicts
  let itemtocheck = null
  var idx = -1
  vulog.data.marks.forEach((item, i) => {
    if (item && !item._id && !item.checked) { itemtocheck = item; idx = i }
  })
  if (!itemtocheck) {
    syncMarks(callFwd)
  } else {
    freezr.ceps.getquery({ collection: 'marks', q: { purl: itemtocheck.purl } }, function (error, returndata) {
      if (error) {
        if (!error.errorCode || error.errorCode === 'noServer') console.warn('Could not connect to server to check marks conflict ', returndata)
        endofSync()
      } else if (!returndata || returndata.length === 0) {
        itemtocheck.checked = true
        checkMarks(callFwd)
      } else {
        const onlineItem = returndata[0]

        onlineItem.vStars = addToListAsUniqueItems(onlineItem.vStars, itemtocheck.vStars)
        if (itemtocheck.vNote) onlineItem.vNote += (' ' + itemtocheck.vNote)
        onlineItem.vHighlights = onlineItem.vHighlights || []
        if (itemtocheck.vHighlights) onlineItem.vHighlights = [...onlineItem.vHighlights, ...itemtocheck.vHighlights]
        jlosMarkChanged(onlineItem)
        vulog.data.marks[idx] = onlineItem

        checkMarks(callFwd)
      }
    })
  }
}
var syncMarks = function (callFwd) {
  // onsole.log('syncMarks')
  vulog.sync('marks', {
    handleConflictedItem: handleConflictedItem,
    downloadedItemTransform: vp5Tranformmark,
    endCallBack: function () { syncLogs(callFwd) }
  })
}
const handleConflictedItem = function (onlineItem, storedLocalitem) {
  console.warn('handleConflictedItem: Syncing conflict arised in syncing at' + new Date())
  console.warn({ onlineItem, storedLocalitem })
}
const syncLogs = function (callFwd) {
  // onsole.log('syncLogs')
  vulog.sync('logs', {
    endCallBack: function (err) {
      console.warn('end sync logs ', (err ? (' - error: ', err) : ''))
      endofSync(callFwd)
    },
    uploadedItemTransform: addDeviceId
  })
}
var endofSync = function (callFwd) {
  syncinprogress = false
  if (callFwd && typeof callFwd === 'function') callFwd()
  if (callFwd && callFwd.error) vulog.data.syncErr = (callFwd.message || callFwd.error)
}

var requestApi = {}
// Getting New Page data and update page
requestApi.newpage = function (request, sender, sendResponse) {
  const subPage = (request.props.purl !== pureUrlify(sender.tab.url) || request.props.isiframe) // some pages send themselves as sub iframes
  let iconpath
  const isPaused = vulog.data.pause_vulog
  if (!subPage) { // is master page
    // onsole.log('ADDING new page on ', sender.tab.id, request.props)
    if (request.props.isiframe) console.warn('master page is iframe?')

    request.props.tabid = sender.tab.id
    request.props.vulog_favIconUrl = sender.tab.favIconUrl
    request.props.vulog_ttl_time = 0
    logDetailsInRAM[sender.tab.id] = JSON.parse(JSON.stringify(request.props))
    pageInRAM = logDetailsInRAM[sender.tab.id]

    delete request.props.vulog_3rdParties
    delete request.props.vulog_cookies

    const currentMark = vulog.queryLatest('marks', { purl: request.props.purl })
    if (isPaused) {
      iconpath = (currentMark ? ICON_PATHS.red : ICON_PATHS.paused)
      sendResponse({ success: false })
    } else {
      iconpath = (currentMark ? ICON_PATHS.red : ICON_PATHS.norm)

      const possibleMaster = getMasterPage(sender.tab.id, request.props.purl)
      const timeFromLastLoad = possibleMaster ? (new Date().getTime() - (possibleMaster.vCreated || 0)) : null
      const createNewLogRecord = (!possibleMaster || timeFromLastLoad > (24 * 60 * 60 * 1000)) // 1 day
      if (createNewLogRecord) vulog.add('logs', request.props)
    }

    chrome.browserAction.setIcon({ path: iconpath, tabId: sender.tab.id }, function () {
      saveToChrome(false, null, 'newpage')
    })
    sendResponse({ success: true })
  } else {
    // onsole.log("added new subpage on "+sender.tab.id,sender.tab,request.props)
    // if (!request.props.isiframe) console.warn("subpage not iframe")
    pageInRAM = logDetailsInRAM[sender.tab.id]
    if (pageInRAM && (pageInRAM.purl === pureUrlify(sender.tab.url) || pageInRAM.purl === pureUrlify(request.props.referrer) || pageInRAM.purl === pureUrlify(sender.tab.pendingUrl))) {
      request.props.vulog_visits = [request.props.vCreated]
      pageInRAM.vulog_sub_pages = addNonduplicateObject(pageInRAM.vulog_sub_pages, request.props, ['vCreated', 'vulog_visits'], true)
      pageInRAM.vulog_sub_cookies = addToListAsUniqueItems(pageInRAM.vulog_sub_cookies, request.props.vulog_cookies)
      if (!pageInRAM.vulog_3rdParties) pageInRAM.vulog_3rdParties = { js: [], img: [] }
      if (request.props.vulog_3rdParties && request.props.vulog_3rdParties.js) {
        pageInRAM.vulog_3rdParties.js = addToListAsUniqueItems(pageInRAM.vulog_3rdParties.js, request.props.vulog_3rdParties.js)
      }
      if (request.props.vulog_3rdParties && request.props.vulog_3rdParties.img) {
        pageInRAM.vulog_3rdParties.img = addToListAsUniqueItems(pageInRAM.vulog_3rdParties.img, request.props.vulog_3rdParties.img)
      }
      pageInRAM.vulog_hidden_subcees = (pageInRAM.vulog_hidden_subcees || 0) + (request.props.vulog_hidden_cees ? 1 : 0)
      sendResponse({ success: true })
    } else if (!request.secondtry) {
      request.secondtry = true
      setTimeout(function () { requestApi.newpage(request, sender, sendResponse) }, 2000)
    } else {
      if (pageInRAM) {
        console.warn('MISMATCH of purl on currentpage in RAM', pageInRAM, ' and send tab:', sender.tab)
      } else if (!['chrome://newtab/'].includes(sender.tab.url)) {
        console.warn('COULD NOT FIND MASTER PAGE for ' + sender.tab.url)
      }
      sendResponse({ success: false })
    }
  }
}
requestApi.updatepage = function (request, sender, sendResponse) {
  pageInRAM = logDetailsInRAM[sender.tab.id]
  const subPage = pageInRAM ? (pageInRAM.purl !== request.purl) : /* or if cant fund page */ (!request.props.hasBody || request.props.isiframe)
  // onsole.log('subPage', subPage)
  if (!vulog.data.pause_vulog && !subPage) {
    const masterPage = getMasterPage(sender.tab.id, request.purl)
    // onsole.log("Got UPDATE masterPage "+sender.tab, masterPage,request.focusTimer)
    if (masterPage) {
      masterPage.vulog_visit_details = addVisitDetails(masterPage.vulog_visit_details, request.focusTimer, sender.tab.id)
      masterPage.vuLog_height = request.heightSpecs.doc_height
      masterPage.vulog_max_scroll = request.heightSpecs.max_scroll
      if (request.focusTimer.vid_start) masterPage.vulog_vidview = true
      masterPage.fj_modified_locally = new Date().getTime()
      saveToChrome(false, null, 'updatepage')
      sendResponse({ success: true })
    } else {
      console.warn('LOST MASTER PAGE ' + sender.tab.id, request.props)
      sendResponse({ success: false })
    }
  } else {
    // onsole.log('sub opage update  on subpage',pageInRAM,request)
    if (pageInRAM && pageInRAM.purl === pureUrlify(sender.tab.url)) {
      // Add vukog_3rd_parties too
      request.props.vulog_visits = [request.props.vCreated]
      pageInRAM.vulog_sub_pages = addNonduplicateObject(pageInRAM.vulog_sub_pages, request.props, ['vCreated', 'vulog_visits'], true)
      pageInRAM.vulog_sub_cookies = addToListAsUniqueItems(pageInRAM.vulog_sub_cookies, request.props.vulog_cookies)
      pageInRAM.vulog_hidden_subcees = (pageInRAM.vulog_hidden_subcees || 0) + (request.props.vulog_hidden_cees ? 1 : 0)
      sendResponse({ success: true })
    } else {
      console.warn('Ignoring subpage ON UPDATE ' + sender.tab.id, request.props, sender.tab)
    }
    sendResponse({ success: false })
  } // else is paused
}
requestApi.searchLocally = function (request, sender, sendResponse) {
  /*
  var queryParams = {
      words   : ((searchTerms && searchTerms.length>0)? searchTerms.split(" "):[]),
      skip    : searchState.itemsFetched,
      list
      star_filters
      count   : searchState.more_items
  }
  */
  // onsole.log("searchLocally",request.list, request.queryParams )
  const theList = vulog.data[request.list] || []
  const params = request.queryParams
  var results = []
  let aLog = null
  let currentItem = theList.length
  let foundcounter = 0

  // onsole.log('searchlocally params', params)

  while (--currentItem >= 0 && results.length < params.count) {
    aLog = theList[currentItem]
    if (aLog && !aLog.fj_deleted) {
      const innerLog = request.list === 'messages' ? aLog.record : aLog
      if (innerLog && innerLog.url) {
        if (params.words && params.words.length > 0) {
          var gotHit = true
          for (let j = 0; j < params.words.length; j++) {
            if (typeof innerLog.vSearchWords === 'string') {
              console.warn('aLog stillhas string keyword', innerLog) // temp bug fix
              innerLog.vSearchWords = innerLog.vSearchWords.split(' ')
            }
            if (gotHit &&
                (innerLog.vSearchWords &&
                 innerLog.vSearchWords.length > 0 &&
                 innerLog.vSearchWords.join(' ').toLowerCase().indexOf(params.words[j]) >= 0
                )
            ) {
              // do nothing - onsole.log("got hit for "+params.words[j])
            } else {
              gotHit = false
            }
          }
        } else if (!params.words || params.words.length === 0) {
          gotHit = true
        }
        if (gotHit && params.star_filters && !wordsInList1InList2(params.star_filters, innerLog.vStars)) gotHit = false
        if (gotHit && params.exstar_filters && params.exstar_filters.length > 0) {
          params.exstar_filters.forEach(exstar => {
            if (innerLog.vStars.indexOf(exstar) >= 0) gotHit = false
          })
        }

        if (gotHit && ++foundcounter > params.skip) { results.push(aLog) }
      }
    }
  }
  // onsole.log({results})

  sendResponse({ success: true, results, nomore: (currentItem <= 0) })
  // ie {success:true, results:results, nomore: currentItem==0}
}
requestApi.trySyncing = function (request, sender, sendResponse) {
  if (!vulog.data.freezrMeta.serverAddress) {
    sendResponse({ success: false, error: 'You need to be connected to a ceps server to sync' })
  } else if (syncinprogress) {
    sendResponse({ success: false, error: 'Already syncing' })
  } else {
    sendResponse({ success: true })
    trySyncing()
  }
}
requestApi.shared = function (request, sender, sendResponse) {
  if (request.grantee.nickname === '_public') {
    // onsole.log('neeed to handle public ??? ')
  } else {
    const theContact = vulog.queryLatest('contacts', { username: request.grantee.username, serverurl: request.grantee.serverurl })
    if (theContact) {
      theContact.used = new Date().getTime()
    }
  }
  requestApi.trySyncing(request, sender, sendResponse)
}

function wordsInList1InList2 (requiredWords, wordsToCheck) {
  var tempret = true
  if (!requiredWords || requiredWords.length === 0) return true
  if (!wordsToCheck || wordsToCheck.length === 0) return false
  requiredWords.forEach(function (aWord) { if (aWord !== ' ' && wordsToCheck && wordsToCheck.indexOf(aWord) < 0) tempret = false })
  return tempret
}
function addVisitDetails (currentDetails = [], newTime, tab) {
  const lastTime = currentDetails[currentDetails.length - 1]
  if (!lastTime || lastTime.start !== newTime.start) { // lastTime.end added for clarity (redundant)
    currentDetails.push(newTime)
  } else {
    if (newTime.end) lastTime.end = newTime.end
    if (newTime.mid) lastTime.mid = newTime.mid
    if (newTime.vid_start) lastTime.vid_start = newTime.vid_start
  }
  return currentDetails
}

function getMasterPage (tabid, purl) {
  var params = { tabid }
  if (purl !== undefined) params.purl = purl
  return vulog.queryLatest('logs', params)
}

// pop up APIs
requestApi.getFreezrmeta = function (request, sender, sendResponse) {
  const freezrMeta = vulog.data.freezrMeta
  sendResponse({ freezrMeta, success: true })
}
requestApi.getPageData = function (request, sender, sendResponse) {
  const details = {
    pause_vulog: vulog.data.pause_vulog || false,
    syncErr: vulog.data.syncErr || false,
    deleted_unbackedupdata: vulog.data.deleted_unbackedupdata || false,
    marks_data_size: vulog.data.marks_data_size || null,
    num_logs: (vulog.data.logs ? vulog.data.logs.length : 0),
    num_marks: (vulog.data.marks ? vulog.data.marks.length : 0),

    offlineCredentialsExpired: (freezr && freezr.app && freezr.app.offlineCredentialsExpired),

    freezrMeta: vulog.data.freezrMeta,

    cookieRemovalHasBeenCalled: vulog.data.cookieRemovalHasBeenCalled
  }
  vulog.data.deleted_unbackedupdata = false
  const NUM_FRENDS_TO_FETCH = 10
  details.contacts = (vulog.data.contacts && vulog.data.contacts.length > NUM_FRENDS_TO_FETCH)
    ? vulog.data.contacts.slice(0, NUM_FRENDS_TO_FETCH)
    : ((vulog.data.contacts && vulog.data.contacts.length > 0) ? vulog.data.contacts.slice(0) : [])
  details.contacts = details.contacts.sort(function (a, b) {
    if (a.used && b.used) return a.used > b.used
    if (a.used) return 1
    if (b.used) return -1
    return 0
  })

  if (request.purl) {
    const masterPage = vulog.queryLatest('logs', { purl: request.purl })
    if (request.tabinfo && request.tabinfo.tabid && logDetailsInRAM[request.tabinfo.tabid] && logDetailsInRAM[request.tabinfo.tabid].purl === request.purl) {
      details.currentLog = logDetailsInRAM[request.tabinfo.tabid]
      details.currentLog.vulog_visit_details = masterPage ? masterPage.vulog_visit_details : [] // RAM has cookie details and masterPage has visit details
    } else {
      console.warn('NO log from logDetailsInRAM - got from vulog', request.tabinfo, logDetailsInRAM[request.tabinfo.tabid])
      details.currentLog = masterPage
    }
    if (!details.currentLog && request.tabinfo) details.currentLog = convertTabinfoToLog(request.tabinfo)

    if (!details.currentLog) console.warn('no tab info for getpagedata ', request, sender)
    details.current_mark = vulog.queryLatest('marks', { purl: request.purl })

    details.edit_mode = getEditMode(((request.tabinfo && request.tabinfo.tabid) ? request.tabinfo.tabid : null), request.purl)
  }
  sendResponse({ details: details, hcolor: vulog.data.hColor, defaultHashTag: vulog.data.defaultHashTag, success: true, fatalErrors })
  trySyncing()
}

requestApi.loggedin = function (request, sender, sendResponse) {
  if (request.freezrMeta && request.freezrMeta.appToken) {
    freezrMeta.set(request.freezrMeta)
    freezr.app.offlineCredentialsExpired = false
    vulog.data.freezrMeta = freezrMeta
    // onsole.log('freezrMeta post set', vulog.data.freezrMeta)
    saveToChrome(true, null, 'loggedin')
    sendResponse({ success: true })
    trySyncing()
  } else {
    sendResponse({ success: false })
  }
}
requestApi.logged_out = function (request, sender, sendResponse) {
  vulog.removeSyncedFreezrInfo('logs')
  vulog.removeSyncedFreezrInfo('marks')
  vulog.removeSyncedFreezrInfo('contacts')
  vulog.removeSyncedFreezrInfo('messages')
  vulog.data.offlineMarks = []
  vulog.data.last_server_sync_time = {}
  freezrMeta.reset()
  vulog.data.freezrMeta = freezrMeta
  saveToChrome(true, null, 'logged_out')
  sendResponse({ success: true })
}

requestApi.newSharingPerms = function (request, sender, sendResponse) {
  if (!vulog.data.freezrMeta.perms) vulog.data.freezrMeta.perms = {}
  vulog.data.freezrMeta.perms.link_share = { granted: request.link_share }
  vulog.data.freezrMeta.perms.friends = { granted: request.friends }
  saveToChrome(true, null, 'logged_out')
  sendResponse({ success: true })
}
requestApi.set_edit_mode = function (request, sender, sendResponse) {
  // from webBox
  // request: {set: true/false , purl:}
  // onsole.log('set_edit_mode ', request.purl, sender.tab, request.tabinfo)
  const tab = ((sender.tab && sender.tab.id) ? sender.tab.id : (request.tabinfo && request.tabinfo.tabid) ? request.tabinfo.tabid : null)
  if (tab && request.purl) {
    if (request.set) {
      editModes[tab] = {
        set: true,
        purl: request.purl
      }
    } else if (editModes[tab]) {
      delete editModes[tab]
    }
    sendResponse({ success: true })
  } else {
    sendResponse({ success: false })
  }
}
const getEditMode = function (tab, purl) {
  if (!tab || !purl || !editModes[tab]) {
    return false
  } else {
    return (editModes[tab].purl === purl && editModes[tab].set)
  }
}
requestApi.get_edit_mode = function (request, sender, sendResponse) {
  const error = (!request.purl || !sender || sender.tab || !sender.tab.id)
  const tab = ((sender.tab && sender.tab.id) ? sender.tab.id : (request.tabinfo && request.tabinfo.tabid) ? request.tabinfo.tabid : null)
  const set = getEditMode(tab, request.purl)
  sendResponse({ success: (!error), set })
}
requestApi.get_recent_marks = function (request, sender, sendResponse) {
  sendResponse({ recentMarks })
}

requestApi.pause = function (request, sender, sendResponse) {
  vulog.data.pause_vulog = true
  chrome.tabs.query({}, function (tabArray) {
    if (tabArray && tabArray.length > 0) {
      tabArray.forEach(item => {
        chrome.browserAction.setIcon({ path: ICON_PATHS.paused, tabId: item.tabId })
      })
    }
  })
  saveToChrome(false, null, 'pause')
  sendResponse({ success: true })
}
requestApi.unpause = function (request, sender, sendResponse) {
  vulog.data.pause_vulog = false
  chrome.tabs.query({}, function (tabArray) {
    if (tabArray && tabArray.length > 0) {
      tabArray.forEach(item => {
        chrome.browserAction.setIcon({ path: ICON_PATHS.norm, tabId: item.tabId })
      })
    }
  })
  saveToChrome(true, null, 'unpause')
  sendResponse({ success: true })
}
requestApi.removeLocalData = function (request, sender, sendResponse) {
  vulog.data.logs = []
  vulog.data.marks = []
  vulog.data.offlineMarks = []
  saveToChrome(true, null, 'removeLocalData')
  sendResponse({ success: true })
}
requestApi.removeHistoryOnly = function (request, sender, sendResponse) {
  vulog.data.logs = []
  saveToChrome(true, null, 'removeHistoryOnly')
  sendResponse({ success: true })
}
requestApi.removeLocalItem = function (request, sender, sendResponse) {
  // assumes it is a log;
  // onsole.log("removeLocalItem",request)
  if (!request.list) request.list = 'logs'
  if (!request.item || !request.item.purl) {
    sendResponse({ success: false, error: 'incorrect query - no purl' })
  } else {
    const thequery = { purl: request.item.purl }
    if (request.item._id) thequery._id = request.item._id
    else if (request.item.fj_local_temp_unique_id) thequery.fj_local_temp_unique_id = request.item.fj_local_temp_unique_id

    const [thelog, idx] = vulog.queryObjs(request.list, thequery, { getOne: true, getIndex: true })

    if (!thelog) {
      sendResponse({ success: false, error: 'item not found' })
    } else {
      if (thelog._id) {
        vulog.markDeleted(request.list, thelog._id)
      } else {
        vulog.data[request.list].splice(idx, 1)
      }
      const otherSimilar = vulog.queryObjs(request.list, { purl: request.item.purl })
      saveToChrome(true, null, 'removeLocalItem')
      sendResponse({ success: true, otherSimilar: otherSimilar })
    }
  }
}

requestApi.cookieRemovalCalled = function (request, sender, sendResponse) {
  vulog.data.cookieRemovalHasBeenCalled = true
  saveToChrome(false, null, 'cookieRemovalCalled')
  sendResponse({ success: true })
}

// marks
const getMarkOrLog = function (purl, idcheck) {
  // onsole.log("finding purl",purl)
  let currentMark = vulog.queryLatest('marks', { purl })
  if (!purl) {
    return [new Error('Insufficient data was sent to do the operation')]
  } else if (currentMark) {
    if (idcheck && ((idcheck + '') !== (currentMark._id + '')) && ((idcheck + '') !== (currentMark.fj_local_temp_unique_id + ''))) {
      return [{ error: new Error('wrong id ' + idcheck + ' vs ' + currentMark._id + ' or temp-id: ' + currentMark.fj_local_temp_unique_id) }]
    } else {
      return [null, currentMark]
    }
  } else {
    const logtomark = vulog.queryLatest('logs', { purl })
    if (logtomark) {
      currentMark = convertLogToMark(logtomark)
    } else { // logging has been or had been paused
      for (var tabid in logDetailsInRAM) {
        if (!currentMark && logDetailsInRAM[tabid].purl === purl) currentMark = convertLogToMark(logDetailsInRAM[tabid])
      }
    }
    const err = currentMark ? null : { error: new Error('Could not retrieve mark to complete the operation') }
    return [err, currentMark]
  }
}
const convertTabinfoToLog = function (tabinfo) {
  if (!tabinfo) return null
  // tabinfo should have purl, url and title
  tabinfo.isiframe = false
  tabinfo.vCreated = new Date().getTime()
  tabinfo.fj_modified_locally = new Date().getTime()
  tabinfo.vulog_sub_pages = []
  tabinfo.domainApp = tabinfo.url.split(':')[0] // for 'file' or 'chrome'
  if (tabinfo.domainApp.indexOf('http') === 0) tabinfo.domainApp = domainAppFromUrl(tabinfo.url)
  tabinfo.vSearchWords = addToListAsUniqueItems([], cleanTextForEasySearch((tabinfo.url + ' ' + tabinfo.title).split(' ')))

  return vulog.add('logs', tabinfo)
}
const convertLogToMark = function (logtomark) {
  const newmark = { vulog_mark_tags: [], vHighlights: [], vNote: '', vStars: [] }
  const ToTransfer = ['url', 'purl', 'description', 'domainApp', 'title', 'author', 'image', 'keywords', 'type', 'vulog_favIconUrl', 'vSearchWords', 'vCreated']
  ToTransfer.forEach((item) => {
    if (logtomark[item]) {
      newmark[item] = JSON.parse(JSON.stringify(logtomark[item]))
    }
  })
  newmark.vSource = 'chrome_browser'
  newmark.vNote = vulog.data.defaultHashTag ? ('#' + vulog.data.defaultHashTag) : null

  if (!newmark.purl) throw Error('trying to convert log to mark with no purl ', logtomark)
  return vulog.add('marks', newmark)
}

requestApi.mark_star = function (request, sender, sendResponse) {
  /*         chrome.runtime.sendMessage({
              msg: "mark_star",
              purl: marks.current.purl || currentLog.purl,
              id: marks.current._id || fj_local_temp_unique_id,
              theStar:theStar,
              doAdd:!starIsChosen,
              publishChange:(theStar == "bullhorn")
          },
  */
  // onsole.log(request)
  let iconpath
  const [err, currentMark] = getMarkOrLog(request.purl, request.id)
  if (err) {
    console.warn(err)
    sendResponse({ error: new Error('Error getting marks. Please refresh the page to try again.') })
  } else {
    iconpath = ICON_PATHS.red
    if (request.doAdd) { //
      currentMark.vStars = addNonduplicateObject(currentMark.vStars, request.theStar)
      jlosMarkChanged(currentMark)
    } else { // remove
      var starIdx = currentMark.vStars.indexOf(request.theStar)
      if (starIdx > -1) currentMark.vStars.splice(starIdx, 1)
      if (hasNomarks(currentMark)) {
        iconpath = vulog.data.pause_vulog ? ICON_PATHS.paused : ICON_PATHS.norm
        // vulog.markDeleted('marks', currentMark, { idType: 'both' })
      } else {
        jlosMarkChanged(currentMark)
      }
    }

    // onsole.log("currentMark now",currentMark)
    addToRecentMarks(currentMark)
    setTimeout(trySyncing, 100)
    sendResponse({ success: true, current_mark: currentMark })
    if (request.tabinfo && request.tabinfo.tabid) { // ie marked from popup
      chrome.browserAction.setIcon({ path: iconpath, tabId: request.tabinfo.tabid }, function () {})
    }
    saveToChrome(true, null, 'mark_star')
  }
}
requestApi.addStarFromOverlay = function (request, sender, sendResponse) {
  /*         chrome.runtime.sendMessage({
              msg: "addStarFromOverlay",
              linkUrl: XX
              referrer;
              theStar: 'inbox'
          },
  */
  // onsole.log(request)
  const purl = pureUrlify(request.linkUrl)
  var [err, currentMark] = getMarkOrLog(purl)
  if (err) { // ie !currentMark
    // onsole.log('no currentMark - creating a blank one')
    currentMark = {
      referrer: request.referrer,
      vStars: [request.theStar],
      purl: purl,
      url: request.linkUrl,
      vCreated: new Date().getTime(),
      vulog_sub_pages: [],
      vSource: 'chrome_browser',
      vNote: vulog.data.defaultHashTag ? ('#' + vulog.data.defaultHashTag) : null,
      domainApp: domainAppFromUrl(request.linkUrl)
    }
  } else {
    if (!currentMark.vStars.includes(request.theStar)) currentMark.vStars.push(request.theStar)
    if (currentMark.vNote) currentMark.vNote = vulog.data.defaultHashTag ? ('#' + vulog.data.defaultHashTag) : null
    jlosMarkChanged(currentMark)
  }
  addToRecentMarks(currentMark)
  sendResponse({ success: true, current_mark: currentMark })

  if (err) {
    fetch(request.linkUrl).then(function (response) {
      return (response.text())
    }).then(function (responseText) {
      const parsedResponse = (new window.DOMParser()).parseFromString(responseText, 'text/html')
      const allMetas = parsedResponse.getElementsByTagName('meta')
      currentMark = addMetaTotags(currentMark, allMetas)
      currentMark = vulog.add('marks', currentMark)
      saveToChrome(true, null, 'addStarFromOverlay')
    }, error => {
      console.error('Got error fetching data for inbox' + error.message)
      currentMark = vulog.add('marks', currentMark)
      console.warn(currentMark)
    })
  }
}
const hasNomarks = function (mark) {
  return (
    (!mark.vHighlights || mark.vHighlights.length === 0) &&
    (!mark.vulog_mark_tags || mark.vulog_mark_tags.length === 0) &&
    (!mark.vStars || mark.vStars.length === 0) &&
    (!mark.vNote || mark.vNote.length === 0)
  )
}
requestApi.postMainComment = function (request, sender, sendResponse) {
  /*         msg: 'postMainComment',
  url: purl,
  id: options.markId,
  theComment: theComment,
  tabinfo: null
  */
  const purl = pureUrlify(request.url)
  const [err, currentMark] = getMarkOrLog(purl, request.id)
  if (err) {
    console.warn(err)
    sendResponse({ error: new Error('error getting data - please try again') })
  } else if (!request.theComment || !request.theComment.text || !request.theComment.vCreated) {
    console.warn('bad request theComment ', { request })
    sendResponse({ error: new Error('bad commnets - need comment weith text and vCreawted ') })
  } else {
    if (!currentMark.vComments) currentMark.vComments = []
    currentMark.vComments.push(request.theComment)
    currentMark.vNote = ''
    currentMark.vSearchWords = addToListAsUniqueItems(currentMark.vSearchWords, cleanTextForEasySearch(request.theComment.text))
    setTimeout(trySyncing, 100)
    jlosMarkChanged(currentMark)
    sendResponse({ success: true, current_mark: currentMark })
    addToRecentMarks(currentMark)
    const iconpath = ICON_PATHS.red
    const tabId = (request.tabinfo && request.tabinfo.tabid) ? request.tabinfo.tabid : ((sender && sender.tab.id) ? sender.tab.id : null)
    chrome.browserAction.setIcon({ path: iconpath, tabId: tabId }, function () {
      saveToChrome(true, null, 'postMainComment')
    })
  }
}
requestApi.saveMainComment = function (request, sender, sendResponse) {
  /*         chrome.runtime.sendMessage({
      msg: "saveMainComment",
      url: marks.current.purl || currentLog.purl,
      id: marks.current._id,
      notes:theNote
  }
  */
  // onsole.log('saveMainComment ', { request })
  const purl = pureUrlify(request.url)
  const [err, currentMark] = getMarkOrLog(purl, request.id)
  if (err) {
    console.warn(err)
    sendResponse({ error: new Error('error getting data - please try again') })
  } else {
    currentMark.vNote = request.notes
    const iconpath = ICON_PATHS.red
    jlosMarkChanged(currentMark)
    sendResponse({ success: true, current_mark: currentMark })
    const tabId = (request.tabinfo && request.tabinfo.tabid) ? request.tabinfo.tabid : ((sender && sender.tab && sender.tab.id) ? sender.tab.id : null)
    chrome.browserAction.setIcon({ path: iconpath, tabId: tabId }, function () {
      saveToChrome(true, null, 'saveMainComment')
    })
  }
}

requestApi.setHColor = function (request, sender, sendResponse) {
  // onsole.log('setting hcolor to ', request.hColor)
  if (request.hColor) { // todo - check if hcolor is valid
    vulog.data.hColor = request.hColor
    sendResponse({ success: true })
  } else {
    sendResponse({ success: false, error: 'n hcolor sent' })
  }
}
requestApi.setDefaultHashtag = function (request, sender, sendResponse) {
  // onsole.log('setting defaultHashTag to ', request.defaultHashTag)
  if (request.defaultHashTag) { // todo - check if hcolor is valid
    vulog.data.defaultHashTag = request.defaultHashTag
    sendResponse({ success: true })
  } else {
    sendResponse({ success: false, error: 'n defaultHashTag sent' })
  }
}

requestApi.newHighlight = function (request, sender, sendResponse) {
  // onsole.log(' got new hlight - current color is ', vulog.data.hColor)
  // onsole.log(' got new hlight -  request.highlight is ', request.highlight)
  const purl = pureUrlify(request.url)
  const [err, currentMark] = getMarkOrLog(purl, request.id)
  if (err) {
    console.warn(err)
    sendResponse(err)
  } else {
    if (!currentMark.vHighlights) currentMark.vHighlights = []
    request.highlight.color = (vulog.data.hColor || 'green').toString()
    currentMark.vHighlights.push(request.highlight)
    jlosMarkChanged(currentMark)
    addToRecentMarks(currentMark)
    setTimeout(trySyncing, 100)
    sendResponse({ success: true, current_mark: currentMark, color: mapColor(vulog.data.hColor) })
    const tabId = request.tabinfo ? request.tabinfo.tabid : ((sender.tab && sender.tab.id) ? sender.tab.id : null)
    if (tabId) {
      chrome.browserAction.setIcon({ path: ICON_PATHS.red, tabId: tabId }, function () {
        saveToChrome(true, null, 'newHighlight')
      })
    }
  }
}
requestApi.changeHlightColor = function (request, sender, sendResponse) {
  // { msg: 'changeHlightColor', hColor, hlightId, url: window.location.href }
  // onsole.log(' got  changeHlightColor - current color is ', vulog.data.hColor, { request })
  const purl = pureUrlify(request.url)
  const [err, currentMark] = getMarkOrLog(purl)
  if (err) {
    console.warn(err)
    sendResponse(err)
  } else if (!currentMark) {
    console.error('changeHlightColor: could not fund mark for ' + purl)
    sendResponse({ error: 'Internal error: Could not retrieve mark on changeHlightColor' })
  } else {
    let success = false
    for (let i = currentMark.vHighlights.length - 1; i >= 0; --i) {
      const ahighlight = currentMark.vHighlights[i]
      if (request.hlightId === '' + ahighlight.id) {
        currentMark.vHighlights[i].color = request.hColor
        success = true
        i = -1
      }
    }
    jlosMarkChanged(currentMark)
    setTimeout(trySyncing, 100)
    const error = success ? '' : 'Could not find highlight'
    sendResponse({ success, currentMark, error })
  }
}
requestApi.addHLightComment = function (request, sender, sendResponse) {
  // { msg: 'addHLightComment', hlightId, text, vCreated, url: window.location.href }
  // onsole.log(' got  addHLightComment  ', { request })
  const purl = pureUrlify(request.url)
  const [err, currentMark] = getMarkOrLog(purl)
  if (err) {
    console.warn(err)
    sendResponse(err)
  } else if (!currentMark) {
    console.error('addHLightComment: could not fund mark for ' + purl)
    sendResponse({ error: 'Internal error: Could not retrieve mark on addHLightComment' })
  } else {
    let success = false
    for (let i = currentMark.vHighlights.length - 1; i >= 0; --i) {
      const ahighlight = currentMark.vHighlights[i]
      if (request.hlightId === ahighlight.id) {
        if (!currentMark.vHighlights[i].vComments) currentMark.vHighlights[i].vComments = []
        currentMark.vHighlights[i].vComments.push({ text: request.text, vCreated: request.vCreated })
        currentMark.vSearchWords = addToListAsUniqueItems(currentMark.vSearchWords, cleanTextForEasySearch(request.text))
        currentMark.vHighlights[i].vNote = ''
        success = true
        i = -1
      }
    }
    jlosMarkChanged(currentMark)
    setTimeout(trySyncing, 100)
    const error = success ? '' : 'Could not find highlight'
    sendResponse({ success, currentMark, error })
  }
}
requestApi.saveHlightComment = function (request, sender, sendResponse) {
  // msg: (options.hlightId ? 'saveHlightComment' : 'saveMainComment'), url: purl, id: objId, notes: theNote
  // onsole.log(' got  saveHlightComment  ', { request })
  const purl = pureUrlify(request.url)
  const [err, currentMark] = getMarkOrLog(purl)
  if (err) {
    console.warn(err)
    sendResponse(err)
  } else if (!currentMark) {
    console.error('addHLightComment: could not fund mark for ' + purl)
    sendResponse({ error: 'Internal error: Could not retrieve mark on addHLightComment' })
  } else {
    let success = false
    for (let i = currentMark.vHighlights.length - 1; i >= 0; --i) {
      const ahighlight = currentMark.vHighlights[i]
      if (request.id === ahighlight.id) {
        currentMark.vHighlights[i].vNote = request.notes
        success = true
        i = -1
      }
    }
    jlosMarkChanged(currentMark)
    setTimeout(trySyncing, 100)
    const error = success ? '' : 'Could not find highlight'
    sendResponse({ success, currentMark, error })
  }
}
requestApi.copyHighlights = function (request, sender, sendResponse) {
  // chrome.runtime.sendMessage({purl:parsedPage.props.purl, highlights:vulogOverlayGlobal.redirect_mark.vHighlights, msg:"copyHighlights"},
  const [err, currentMark] = getMarkOrLog(request.purl)
  if (err) {
    console.warn(err)
    sendResponse({ error: 'error getting online data - please try again' })
  } else {
    if (!currentMark.vHighlights) currentMark.vHighlights = []
    request.highlights.forEach(ahigh => currentMark.vHighlights.push(ahigh))
    addToRecentMarks(currentMark)
    setTimeout(trySyncing, 100)
    sendResponse({ success: true, current_mark: currentMark })
    const tabId = request.tabinfo ? request.tabinfo.tabid : ((sender.tab && sender.tab.id) ? sender.tab.id : null)
    if (tabId) {
      chrome.browserAction.setIcon({ path: ICON_PATHS.red, tabId: tabId }, function () {
        saveToChrome(true, null, 'copyHighlights')
      })
    }
    redirectItem[sender.tab.id] = null
  }
}
requestApi.removeHighlight = function (request, sender, sendResponse) {
  // should be changed to remvoe highlight and made consistent with ios
  // { msg: 'removeHighlight', hlightId, url: window.location.href }
  const purl = pureUrlify(request.url)

  const currentMark = vulog.queryLatest('marks', { purl })
  let iconpath
  let success = false
  if (!currentMark) {
    sendResponse({ error: 'Internal error: Could not retrieve mark on removeHighlight' })
  } else {
    for (let i = currentMark.vHighlights.length - 1; i >= 0; --i) {
      if (request.hlightId === currentMark.vHighlights[i].id) {
        currentMark.vHighlights.splice(i, 1)
        success = true
        i = -1
      }
    }
    if (hasNomarks(currentMark)) {
      iconpath = vulog.data.pause_vulog ? ICON_PATHS.paused : ICON_PATHS.norm
      // todo nowdo -> change logic for vulog so having nomarks doesnt delete it
      // vulog.markDeleted('marks', currentMark, { idType: 'both' })
    } else {
      iconpath = ICON_PATHS.red
    }
    addToRecentMarks(currentMark)
    setTimeout(trySyncing, 100)
    const error = success ? '' : 'Could not find highlight'
    sendResponse({ success, currentMark, error })
    const tabId = (request.tabinfo && request.tabinfo.tabid) ? request.tabinfo.tabid : ((sender && sender.tab && sender.tab.id) ? sender.tab.id : null)
    chrome.browserAction.setIcon({ path: iconpath, tabId: tabId }, function () {
      saveToChrome(true, null, 'removeHighlight')
    })
  }
}

const addToRecentMarks = function (currentMark) {
  // let removethis = -1
  recentMarks.forEach((item, i) => {
    if (currentMark.purl === item.purl) recentMarks.splice(i, 1)// removethis = i
  })
  // if (removethis > 0) recentMarks.splice(removethis, 1)
  recentMarks.unshift(currentMark)
  if (recentMarks.length > 10) recentMarks.pop()
}

requestApi.getMarkFromVulog = function (request, sender, sendResponse) {
  // onsole.log('getMarkFromVulog mark for purl ', request.purl)
  // chrome.runtime.sendMessage({purl:parsedPage.props.purl, highlight:the_highlight, msg:"newHighlight"}
  request.purl = pureUrlify(request.purl)
  var currentMark = vulog.queryLatest('marks', { purl: request.purl })
  if (currentMark && currentMark.vHighlights && currentMark.vHighlights.length > 0) {
    currentMark = JSON.parse(JSON.stringify(currentMark))
    currentMark.vHighlights.forEach((item, i) => {
      currentMark.vHighlights[i].color = mapColor(currentMark.vHighlights[i].color)
    })
  }

  let redirectedmark = null
  if (sender.tab && sender.tab.id && redirectItem && redirectItem[sender.tab.id] &&
      request.purl === redirectItem[sender.tab.id].purl) {
    redirectedmark = redirectItem[sender.tab.id]
  }

  var messages = vulog.queryObjs('messages', { purl: request.purl }, { makeCopy: true })
  if (messages && messages.length > 0) {
    for (let j = 0; j < messages.length; j++) {
      // if (messages[j].record.vHighlights && messages[j].record.vHighlights.length > 0) messages[j].record.vHighlights = messages[j].record.vHighlights // ???
      if (messages[j].record.vHighlights && messages[j].record.vHighlights.length > 0) {
        messages[j].record.vHighlights.forEach((item, i) => {
          messages[j].record.vHighlights[i].color = mapColor(messages[j].record.vHighlights[i].color)
        })
      }
    }
  }

  const haveFreezr = (vulog.data.freezrMeta && vulog.data.freezrMeta.serverAddress) ? vulog.data.freezrMeta.serverAddress : null
  sendResponse({ success: true, mark: currentMark, redirectedmark, messages, haveFreezr, hcolor: vulog.data.hColor })
}

requestApi.marksDisplayErrs = function (request, sender, sendResponse) {
  // chrome.runtime.sendMessage({purl:parsedPage.props.purl, msg:"marksDisplayErrs", display_errs:display_errs}
  // onsole.log("get mark for marksDisplayErrs purl ",request)
  const currentMark = vulog.queryLatest('marks', { purl: request.purl })
  if (!currentMark) {
    sendResponse({ error: 'Could not get mark' })
  } else {
    request.display_errs.forEach(item => { currentMark.vHighlights[item.idx].displayErr = item.err })
    sendResponse({ success: 'updated mark', new_mark: currentMark })
  }
}
requestApi.newOnlineMarks = function (request, sender, sendResponse) {
  // chrome.runtime.sendMessage({msg: "onlineMark", purl:purl, mark:returndata.results[0]}, function(response) {

  if (request.marks && request.marks.length > 0) {
    request.marks.forEach((mark, i) => {
      const markOnVulog = vulog.queryLatest('marks', { _id: mark._id })
      if (mark && mark._id && !markOnVulog) vulog.data.marks.push(mark)
    })
    vulog.data.marks.sort(sortBycreatedDate)
    sendResponse({ success: true })
  }
}
requestApi.getMarkOnlineInBg = function (request, sender, sendResponse) {
  // chrome.runtime.sendMessage({msg: "onlineMark", purl:purl, mark:returndata.results[0]}, function(response) {
  freezr.ceps.getquery({ collection: 'marks', q: { purl: request.purl } }, function (error, returndata) {
    if (error) {
      if (!error.errorCode || error.errorCode === 'noServer') console.warn('Could not connect to server to check marks for overlay ', returndata)
    } else if (returndata || returndata.length > 0) {
      vulog.data.marks.push(returndata[0])
      vulog.data.marks.sort(sortBycreatedDate)
    }
  })
  sendResponse({ success: true })
}
function sortBycreatedDate (obj1, obj2) {
  //
  return getCreatedDate(obj1) - getCreatedDate(obj2)
}
function getCreatedDate (obj) {
  // onsole.log("getMaxLastModDate obj is "+JSON.stringify(obj));
  if (!obj) {
    return 0
  } else if (obj._date_created) {
    return obj._date_created
  } else if (obj.fj_modified_locally) {
    return obj.fj_modified_locally
  } else {
    return 0 // error
  }
}

var redirectItem = {}
requestApi.redirect = function (request, sender, sendResponse) {
  // chrome.runtime.sendMessage({msg: "redirect",  item: item }
  redirectItem[sender.tab.id] = request.item
  sendResponse({ success: true })
}

// generics
function isEmpty (obj) {
  // stackoverflow.com/questions/4994201/is-object-empty
  if (obj == null) return true
  if (Object.keys(obj).length > 0) return false
  if (Object.keys(obj).length === 0) return true
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) return false
  }
  return true
}
function sizeOfObject (anObject) {
  return JSON.stringify(anObject).length
}
function addNonduplicateObject (objectList, newObject, ignorekeys = [], uglyexception) {
  if (!objectList || objectList.length === 0) {
    return [newObject]
  }
  const dupl = listHasObject(objectList, newObject, ignorekeys)
  if (dupl) {
    if (uglyexception) dupl.vulog_visits.push(newObject.vCreated) // todo abstract away to add this to vulog_sub_pages
  } else {
    objectList.push(newObject)
  }
  return objectList
}
function listHasObject (objectList, newObject, ignorekeys = []) {
  let isDuplicate = false
  objectList.forEach(anObj => {
    if (!isDuplicate && objectsaresame(anObj, newObject, ignorekeys)) isDuplicate = anObj
  })
  return isDuplicate
}
function objectsaresame (obj1, obj2, ignorekeys = [], dolog = false) {
  if (typeof obj1 !== typeof obj2) {
    return false
  }
  if (!obj1 || ['string', 'boolean', 'number'].includes(typeof obj1)) return obj1 === obj2

  let areSame = true
  for (const key in obj1) {
    if ((!ignorekeys.includes(key)) && !objectsaresame(obj1[key], obj2[key], [], false)) {
      areSame = false
    }
    ignorekeys.push(key)
  }
  if (areSame) {
    for (const key in obj2) {
      if ((!ignorekeys.includes(key)) && !objectsaresame(obj1[key], obj2[key], [])) {
        areSame = false
      }
    }
  }
  return areSame
}
