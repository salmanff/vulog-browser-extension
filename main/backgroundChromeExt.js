// 
/* 
- since logDetailsInRAM doesnt pesist if marking a page and no currentmark can be found the mark needs to be quried from the tab

- finish move to fetch - options etc - check it works using other apps (vc trackr etc)
- when add mark or highlight or comment should also redo searchwords??

- add these to iod? vulog_visit_details, vuLog_height, vulog_max_scroll, vulog_visits, vulog_ttl_time, pageInRAM.vulog_sub_pages, vulog_favIconUrl, 
- TO CHECK when doing popup and overlay - what happens when service worker dies:
  - editModes, pageInRAM, logDetailsInRAM
- later
  - reDo FrozenJlos -> 

*/
/*
    backgroundChroimeExt.js
    com.salmanff.vulog - chrome app for browser view history and book marking
    version 0.0.3 - June 2020

*/

/* global chrome, fetch */ // from system
/* global pureUrlify, domainAppFromUrl, addMetaTotags, addToListAsUniqueItems, cleanTextForEasySearch */ // from pageData.js
/* global JLOS, jlosMarkChanged  */ // from jlos-frozen.js
/* global mapColor  */ // from utils.js
/* global freezr */ // from freezr_core.js
/* global freezrMeta  */ // from freezr_app_init

// v3-manifest 
importScripts ('../sharedIosResources/overlay_constants.js', '../sharedIosResources/utils.js', '../freezr/freezr_app_init.js', '../freezr/freezr_core.js' ,'../freezr/jlos-frozen.js', '../sharedIosResources/highlight.js' , '../sharedIosResources/pageData.js')
freezr.app.isWebBased = false 

var syncTimer = null
var syncinprogress = false
var logDetailsInRAM = {}
const overLayShow = {}
var pageInRAM = null
var fatalErrors = null
var editModes = {}
var recentMarks = []
const incompleteMetaFiller = { // tryCompletingIncompleteMeta and checkForAddingMetaToIncompletes
  list: [],
  currentPurl: null,
  currentTabId: null,
  wip: false
} 

const SYNC_INTERVAL = 5 * 1000 // idle time before sync
const ICON_PATHS = {
  norm: '../static/hipercardsLogo_small_blue_48.png', // blue
  paused: '../static/hipercardsLogo_small_grey_48.png', // grey
  red: '../static/hipercardsLogo_small_128.png' // green
}

console.log('re-initializing vulog')
chrome.storage.local.getBytesInUse(['vulogCopy'], function (bytes) { console.log('Used bytes: ' + bytes) })

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
      recordHistory: false //,
      // pause_vulog: true
    }
  }
  if (!vulog.data.hColor) vulog.data.hColor = 'green'
  if (!vulog.data.defaultHashTag) vulog.data.defaultHashTag = ''

  freezrMeta.set(vulog.data.freezrMeta)
  if (!freezrMeta.appName) freezrMeta.appName = 'com.salmanff.vulog' // temp fix
})

// ContextMenus
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ title: 'Highlight text (vulog)', contexts: ['selection'], id:'highlightTextFromContext' })
  chrome.contextMenus.create({ title: 'Add to inbox (vulog)', contexts: ['link'], id:'addLinkToInboxContext' })
})
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'addLinkToInboxContext') {
    setTimeout(async () => {
      await addStarFromMenuOrOverlay({ linkUrl: info.linkUrl, referrerUrl: info.pageUrl, theStar: 'inbox', note: (vulog.data.defaultHashTag ? ('#' + vulog.data.defaultHashTag) : '')})
      //makeMarkFromLinkWithStars({ linkUrl: info.linkUrl, referrerUrl: info.pageUrl, theStar: 'inbox', note: (vulog.data.defaultHashTag ? ('#' + vulog.data.defaultHashTag) : '')})
    }, 10)
    // addLinkToInboxFromContext(info)
  } else if (info.menuItemId === 'highlightTextFromContext') {
    chrome.scripting.executeScript({
      target: {tabId: tab.id},
      files: ['main/start_highlight.js']
    })
  } 
})

// MESSSAGES - requestApi
const requestApi = {}
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async function () {
    // const resp = await testFunc()
    let resp 
    if (request && request.msg && requestApi[request.msg]) {
      resp = await requestApi[request.msg](request, sender)
    } else {
      resp = { success: false, error: 'invalid message.', options: null }
      console.warn('Empty request - ' + ((request && request.msg) ? request.msg : 'No message'))
    }
    sendResponse (resp)
    clearTimeout(syncTimer)
    syncTimer = setTimeout(trySyncing, SYNC_INTERVAL)

  })()
  return true
})


// Getting New Page data and update page
requestApi.newpage = function (request, sender) {
  // onsole.log('newpage url ', sender.tab.url, 'purl ', request.props.purl, ' tab id:', sender.tab.id)
  const subPage = (request.props.purl !== pureUrlify(sender.tab.url) || request.props.isiframe) // some pages send themselves as sub iframes
  // const isPaused = vulog.data.pause_vulog
  const isPaused = !vulog.data.recordHistory
  
  if (!subPage) { // is master page
    console.log('ADDING new master page on ', request.props.purl, sender.tab.id, request.props)
    if (request.props.isiframe) console.warn('master page is iframe?')

    request.props.tabid = sender.tab.id
    request.props.tabWindowId = sender.tab.windowId
    request.props.tabGroupId = sender.tab.groupId

    request.props.vulog_favIconUrl = sender.tab.favIconUrl
    request.props.vulog_ttl_time = 0

    if (!logDetailsInRAM[sender.tab.id]) logDetailsInRAM[sender.tab.id] = []
    logDetailsInRAM[sender.tab.id].unshift(JSON.parse(JSON.stringify(request.props)))
    pageInRAM = logDetailsInRAM[sender.tab.id][0]

    delete request.props.vulog_3rdParties
    delete request.props.vulog_cookies

    const currentMark = vulog.queryLatest('marks', { purl: request.props.purl })

    checkForAddingMetaToIncompletes(sender.tab.id, request.props)

    const possibleMaster = getMasterPage(sender.tab.id, request.props.purl)
    const timeFromLastLoad = possibleMaster ? (new Date().getTime() - (possibleMaster.vCreated || 0)) : null
    const createNewLogRecord = !isPaused && (!possibleMaster || timeFromLastLoad > (24 * 60 * 60 * 1000)) // 1 day
    if (createNewLogRecord) vulog.add('logs', request.props)

    const iconpath = (currentMark ? ICON_PATHS.red : ICON_PATHS.norm)
    //  v2-manifest  chrome.browserAction.setIcon({ path: iconpath, tabId: sender.tab.id }, function () { })
    // v3-manifest 
    chrome.action.setIcon({ path: iconpath, tabId: sender.tab.id }, function () { })
    return ({ success: true })
  } else if (isPaused) {
    return({ success: true })
  } else { // cookie related for sub pages
    // onsole.log("added new subpage on "+sender.tab.id,sender.tab,request.props)
    // if (!request.props.isiframe) console.warn("subpage not iframe")

    pageInRAM = (logDetailsInRAM[sender.tab.id] && logDetailsInRAM[sender.tab.id].length > 0) ? logDetailsInRAM[sender.tab.id][0] : null
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
      return ({ success: true })
    } else if (!request.secondtry) {
      request.secondtry = true
      setTimeout(function () { requestApi.newpage(request, sender) }, 2000)
    } else {
      if (pageInRAM) {
        console.warn('MISMATCH of purl on currentpage in RAM', pageInRAM, ' and send tab:', sender.tab)
      } else if (!['chrome://newtab/'].includes(sender.tab.url)) {
        console.warn('COULD NOT FIND MASTER PAGE for ' + sender.tab.url)
      }
      return({ success: false })
    }
  }
}
requestApi.updatepage = function (request, sender) {
  pageInRAM = (logDetailsInRAM[sender.tab.id] && logDetailsInRAM[sender.tab.id].length > 0) ? logDetailsInRAM[sender.tab.id][0] : null
  const subPage = pageInRAM ? (pageInRAM.purl !== request.purl) : /* or if cant fund page */ (!request.props.hasBody || request.props.isiframe)
  // onsole.log('subPage', subPage)
  if (vulog.data.recordHistory && !subPage) {
    const masterPage = getMasterPage(sender.tab.id, request.purl)
    // onsole.log("Got UPDATE masterPage "+sender.tab, masterPage,request.focusTimer)
    if (masterPage) {
      masterPage.vulog_visit_details = addVisitDetails(masterPage.vulog_visit_details, request.focusTimer, sender.tab.id)
      masterPage.vuLog_height = request.heightSpecs.doc_height
      masterPage.vulog_max_scroll = request.heightSpecs.max_scroll
      if (request.focusTimer.vid_start) masterPage.vulog_vidview = true
      if (request.vulogVids && request.vulogVids.length > 0) {
        if (!masterPage.vulogVids || masterPage.vulogVids.length === 0) {
          masterPage.vulogVids = request.vulogVids
        } else {
          request.vulogVids.forEach(videoUpdated => {
            let found = false
            for (let i = 0; i < masterPage.vulogVids.length; i++) {
              if (masterPage.vulogVids[i].currentSrc ===  videoUpdated.currentSrc) {
                found = true
                masterPage.vulogVids[i].currentTime =  videoUpdated.currentTime // should only the time be updated?
                masterPage.vulogVids[i].latestTime = Math.max((masterPage.vulogVids[i].latestTime || 0), (videoUpdated.latestTime || 0))
              }
            }
            if (!found)  masterPage.vulogVids.push(videoUpdated)
          })
        }
      } 
      masterPage.fj_modified_locally = new Date().getTime()
      saveToChrome(false, null, 'updatepage')
      return ({ success: true })
    } else {
      console.warn('LOST MASTER PAGE ' + sender.tab.id, request.props)
      return ({ success: false })
    }
  } else {
    // onsole.log('sub opage update  on subpage',pageInRAM,request)
    if (pageInRAM && pageInRAM.purl === pureUrlify(sender.tab.url)) {
      // Add vukog_3rd_parties too
      request.props.vulog_visits = [request.props.vCreated]
      pageInRAM.vulog_sub_pages = addNonduplicateObject(pageInRAM.vulog_sub_pages, request.props, ['vCreated', 'vulog_visits'], true)
      pageInRAM.vulog_sub_cookies = addToListAsUniqueItems(pageInRAM.vulog_sub_cookies, request.props.vulog_cookies)
      pageInRAM.vulog_hidden_subcees = (pageInRAM.vulog_hidden_subcees || 0) + (request.props.vulog_hidden_cees ? 1 : 0)
      return({ success: true })
    } else {
      console.warn('Ignoring subpage ON UPDATE ' + sender.tab.id, request.props, sender.tab)
    }
    return ({ success: false })
  } // else is paused
}
function getMasterPage (tabid, purl) {
  var params = { tabid }
  if (purl !== undefined) params.purl = purl
  return vulog.queryLatest('logs', params)
}
function addVisitDetails (currentDetails = [], newTime, tab) {
  const lastTime = currentDetails[currentDetails.length - 1]
  if (!lastTime || lastTime.start !== newTime.start) { // lastTime.end added for clarity (redundant)
    currentDetails.push(newTime)
  } else {
    if (newTime.end) lastTime.end = newTime.end
    if (newTime.lastRec) lastTime.lastRec = newTime.lastRec
    if (newTime.vid_start) lastTime.vid_start = newTime.vid_start
  }
  return currentDetails
}
requestApi.getMarkOnlineInBg = function (request, sender) {
  // chrome.runtime.sendMessage({msg: "onlineMark", purl:purl, mark:returndata.results[0]}, function(response) {
  freezr.ceps.getquery({ collection: 'marks', q: { purl: request.purl } }, function (error, returndata) {
    if (error) {
      if (!error.errorCode || error.errorCode === 'noServer') console.warn('Could not connect to server to check marks for overlay ', returndata)
    } else if (returndata || returndata.length > 0) {
      vulog.data.marks.push(returndata[0])
      vulog.data.marks.sort(sortBycreatedDate)
    }
  })
  return ({ success: true })
}
requestApi.showThisFromOverlay = async function (request, sender) {
  // can specify what to show on the overlay.. as a refresh should happen immediately after this is called, only one item is stored at a time
  // showThis can be none (dont show any highlights), ownMark, redirectmark or messages
  if (request.purl && request.showThis) {
    overLayShow.purl = pureUrlify(request.purl)
    overLayShow.showThis = request.showThis
    overLayShow.time = new Date().getTime()
    // for redirectmark
    overLayShow.tabid = sender.tab.id
    overLayShow.redirectmark = request.redirectmark
    // onsole.log('recording redirect mark', { redirectmark: request.redirectmark, hlights: JSON.stringify(request.redirectmark.vHighlights)})
  } else {
    overLayShow.purl = null
    overLayShow.showThis = null
    overLayShow.time = null
  }
  return ({ success: true })
}
requestApi.getMarkFromVulog = async function (request, sender) {

  request.purl = pureUrlify(request.purl)
  var currentMark = vulog.queryLatest('marks', { purl: request.purl })
  if (currentMark && currentMark.vHighlights && currentMark.vHighlights.length > 0) {
    currentMark = JSON.parse(JSON.stringify(currentMark))
    // currentMark.vHighlights.forEach((item, i) => {
    //   currentMark.vHighlights[i].color = mapColor(currentMark.vHighlights[i].color)
    // })
  }

  const gotMessages = vulog.queryObjs('gotMsgs', { purl: request.purl }, { makeCopy: true })
  const sentMessages =  vulog.queryObjs('sentMsgs', { purl: request.purl }, { makeCopy: true })

  const messages = [...sentMessages, ...gotMessages]

  const showThisInoverlay = {show: 'ownMark' }
  let redirectmark = null
  const doShowRedirectedMarkOnOverlay = (overLayShow.purl && overLayShow.purl === request.purl && overLayShow.time && (new Date().getTime() - overLayShow.time < 10000) && overLayShow.showThis === 'redirectmark') 
  if (doShowRedirectedMarkOnOverlay) {
    showThisInoverlay.show = overLayShow.showThis // ie 'redirectmark'
    redirectmark = overLayShow.redirectmark
    // onsole.log('Sending redirect mark', { redirectmark, hlights: JSON.stringify(redirectmark.vHighlights)})
  }
  // ? // 10 seconds to reload new Date().getTime() - overLayShow.time < 30000
  // const showThisInoverlay = (overLayShow.purl && overLayShow.purl === request.purl && overLayShow.time && (new Date().getTime() - overLayShow.time < 10000)) ? // 10 seconds to reload new Date().getTime() - overLayShow.time < 30000
  //   { show: overLayShow.showThis } : null
  
  const freezrMeta = { userId: vulog.data.freezrMeta?.userId, serverAddress: vulog.data.freezrMeta?.serverAddress}
  return { success: true, mark: currentMark, messages, showThisInoverlay, redirectmark, freezrMeta, hcolor: vulog.data.hColor, defaultHashTag: vulog.data.defaultHashTag }

}
requestApi.getFreezrInfo = function (request, sender) {
  const freezrInfo = {
    serverAddress: vulog.data.freezrMeta?.serverAddress,
    userId: vulog.data.freezrMeta?.userId,
    test: vulog.data.test?.userId
  }
  return({ success: true, freezrInfo, freezrMeta: vulog.data.freezrMeta })
}
requestApi.getRecentTabData = async function (request, sender) {
  // chrome.runtime.sendMessage({msg: "onlineMark", purl:purl, mark:returndata.results[0]}, function(response) {
  const currentTabs = await chrome.tabs.query({})
  // todo need to merge current tabs and logdetailsinram
  return ({ success: true, logDetailsInRAM, currentTabs })
}

// Adding from menu and overlay and fetching meta data
const addStarFromMenuOrOverlay = async function (request, sender) {
  /* 
    todo

    checkForAddingMetaToIncompletes - add to newPage and do merge -> needs to be tab based in case url changes
      DO MERE OF REDIRECTED MARK BELOW
    try forwarded urls
    check logDetailsInRAM
    cjeck makeMarkFromLinkWithStars replace with this (check name conventions egreerrerUrl verus referrer)
  */

  const { linkUrl, referrerUrl, theStar, note } = request
  const purl = pureUrlify(linkUrl)

  let currentMark = vulog.queryLatest('marks', { purl })
  const logtomark = vulog.queryLatest('logs', { purl }) || logFromLogDetailsInRAM(purl)
  if (!purl) {
    return {error: 'purl not sent to do the operation' }
  } else if (currentMark) {
    if (theStar && !currentMark.vStars.includes(request.theStar)) currentMark.vStars.push(theStar)
    if (!currentMark.vNote) currentMark.vNote = ''
    if (request.note) currentMark.vNote += (' ' + request.note).trim()
    if (!currentMark.referrer && referrerUrl) currentMark.referrer = referrerUrl

    currentMark.vSearchString = resetVulogKeyWords(currentMark)
    addToRecentMarks(currentMark)
    jlosMarkChanged(currentMark)
    checkForUpdatingPages(currentMark, sender?.tab?.id, 'addStarFromMenuOrOverlay')
    saveToChrome(true, null, 'addStarFromMenuOrOverlay')
    setTimeout(trySyncing, 100)
    return ({ success: true, current_mark: currentMark })
  } else if (logtomark) {
    const convertedLog = convertLogToMark(logtomark)
    if (request.theStar) convertedLog.vStars = [request.theStar]
    convertedLog.vNote = request.note || ''
    convertedLog.referrer = referrerUrl
    convertedLog.vSearchString = resetVulogKeyWords(convertedLog)
    const convertedMark = vulog.add('marks', convertedLog)
    checkForUpdatingPages(convertedMark, sender?.tab?.id, 'addStarFromMenuOrOverlay')
    saveToChrome(true, null, 'addStarFromMenuOrOverlay')
    setTimeout(trySyncing, 100)
    return ({ success: true, current_mark: convertedMark })
  } else {
    const props = { purl, url: linkUrl, referrer: referrerUrl }
    const options = { note, theStar }
    const convertedMark = makeMarkFromLogInfo(props, options)
    convertedMark.incompeteMeta = true
    incompleteMetaFiller.list.push(purl)
    tryCompletingIncompleteMeta()
    const convertedMarkWithId = vulog.add('marks', convertedMark)
    checkForUpdatingPages(convertedMarkWithId, sender?.tab?.id, 'addStarFromMenuOrOverlay')
    saveToChrome(true, null, 'addStarFromMenuOrOverlay')
    setTimeout(trySyncing, 100)
    return ({ success: true, current_mark: convertedMarkWithId })
  }
}
const tryCompletingIncompleteMeta = async function () {
  /*  list:[], currentPurl: null, currentTabId: null, wip: false */
  if (incompleteMetaFiller.list.length === 0) return
  if (incompleteMetaFiller.wip) return

  incompleteMetaFiller.wip = true
  incompleteMetaFiller.currentPurl = incompleteMetaFiller.list[0]
  const tab = await chrome.tabs.create({url: incompleteMetaFiller.currentPurl, active: false})
  incompleteMetaFiller.currentTabId = tab.id
  setTimeout(() => { // if offline and tab is still opem, close it
    if (incompleteMetaFiller.currentTabId === tab.id) { // todo also make sure user hasnt switched to it - checlknot active
      resetIncompleteMetaFiller()
      chrome.tabs.remove(tab.id)
    }
  }, 6000);
}
const checkForAddingMetaToIncompletes = function (tabid, pageData) {
  // onsole.log('checkForAddingMetaToIncompletes ', { tabid, pageData })
  if (tabid && tabid === incompleteMetaFiller.currentTabId) {
    const currentMark = vulog.queryLatest('marks', { purl: incompleteMetaFiller.currentPurl })
    if (!currentMark) {
      console.warn('error - no mark found from purl in checkForAddingMetaToIncompletes')
    } else if (pageData.purl === currentMark.purl) {
      LOG_FIELDS_USED_IN_MARKS.forEach((item) => {
        if (!currentMark[item] && pageData[item]) {
          currentMark[item] = JSON.parse(JSON.stringify(pageData[item]))
        }
      })
      delete currentMark.incompeteMeta
      if (!pageData.title) {
        // ie has at least some data and is not offline-  todo consider stopping the flow and also adding this to the end of the list
        console.warn('consider stopping the flow and also adding this to the end of the list - checkForAddingMetaToIncompletes')
      }
      currentMark.vSearchString = resetVulogKeyWords(currentMark)
      addToRecentMarks(currentMark)
      checkForUpdatingPages(currentMark, null, 'checkForAddingMetaToIncompletes')
      jlosMarkChanged(currentMark)
  
    } else { // url points to another url
      const existingMark = vulog.queryLatest('marks', { purl: pageData.purl })
      if (!existingMark) {
        currentMark.purl = pageData.purl
        currentMark.url = pageData.url
        LOG_FIELDS_USED_IN_MARKS.forEach((item) => {
          if (!currentMark[item] && pageData[item]) {
            currentMark[item] = JSON.parse(JSON.stringify(pageData[item]))
          }
        })
        currentMark.domainApp = pageData.domainApp
        delete currentMark.incompeteMeta
        currentMark.vSearchString = resetVulogKeyWords(currentMark)
        checkForUpdatingPages(currentMark, null, 'checkForAddingMetaToIncompletes')
        addToRecentMarks(currentMark)
        jlosMarkChanged(currentMark)
      } else { // copy new attributes to existing mark and delete current mark
        existingMark.vStars = addNonduplicateObject(existingMark.vStars, currentMark.vStars[0])
        existingMark.vNote = ((existingMark.vNote ? (existingMark.vNote + (currentMark.vNote  ? ' - ' : '')) : '') + (currentMark.vNote || ''))
        if (!existingMark.referrer) {
          existingMark.referrer = currentMark.referrer
        }
        if (!existingMark.referrer) {
          existingMark.referrer = currentMark.purl
        } else { // only have one referrer so domainapp is added to note
          existingMark.vNote += ' (from ' +  currentMark.domainApp + ')'
        }
        existingMark.vSearchString = resetVulogKeyWords(existingMark)

        checkForUpdatingPages(existingMark, null, 'checkForAddingMetaToIncompletes')
        checkForUpdatingPages(existingMark, null, 'DeleteFromcheckForAddingMetaToIncompletes')
        vulog.markDeleted('marks', currentMark)  
        jlosMarkChanged(existingMark)
      }
    }

    chrome.tabs.remove(incompleteMetaFiller.currentTabId)
    const idx = incompleteMetaFiller.list.indexOf(incompleteMetaFiller.currentPurl)
    if (idx > -1) {
      incompleteMetaFiller.list.splice(idx, 1)
    } else {
      console.warn('serious error finding purl in list - checkForAddingMetaToIncompletes')
      // serious error finding purl in list
    }
    resetIncompleteMetaFiller()
    
    tryCompletingIncompleteMeta()
  }
}
const resetIncompleteMetaFiller = function () {
  incompleteMetaFiller.wip = false
  incompleteMetaFiller.currentPurl = null
  incompleteMetaFiller.currentTabId = null
}
requestApi.addStarFromOverlay = async function (request, sender) {
  /*         chrome.runtime.sendMessage({
              msg: "addStarFromOverlay",
              linkUrl: XX
              referrerUrl;
              theStar: 'inbox'
          },
  */
  return addStarFromMenuOrOverlay(request, sender)

}

// Stars, Highlights and Comments
requestApi.mark_star = async function (request, sender) {
  /*         chrome.runtime.sendMessage({
              msg: "mark_star",
              purl: url,
              id: ...._id || fj_local_temp_unique_id,
              theStar:theStar,
              doAdd:!starIsChosen,
              publishChange:(theStar == "bullhorn")
          },
  */
  let iconpath
  if (!request.purl) request.purl = pureUrlify(request.url)
  const [err, currentMark] = await getOrCreateMark(request.purl, request.props, request.id)
  if (err) {
    console.warn(err)
    return ({ error: new Error('Error getting marks. Please refresh the page to try again.') })
  } else {
    iconpath = ICON_PATHS.red
    if (request.theStar == 'trash') {
      if (!request.doAdd) console.error('Cannot remove trash ??? SNBH')
      vulog.markDeleted('marks', currentMark, { idType: 'both' })
    } else if (request.doAdd) { //
      if (request.theStar === 'inbox' || request.theStar === 'star') currentMark.vStars = addNonduplicateObject(currentMark.vStars, request.theStar)
      if (request.addDefaultHashTag && !currentMark.vNote) currentMark.vNote = request.addDefaultHashTag
      currentMark.vSearchString = resetVulogKeyWords(currentMark)
      jlosMarkChanged(currentMark)
    } else { // remove
      var starIdx = currentMark.vStars.indexOf(request.theStar)
      if (starIdx > -1) currentMark.vStars.splice(starIdx, 1)
      if (hasNomarks(currentMark)) {
        iconpath = !vulog.data.recordHistory ? ICON_PATHS.paused : ICON_PATHS.norm
      } else {
        jlosMarkChanged(currentMark)
      }
    }
    addToRecentMarks(currentMark)
    checkForUpdatingPages(currentMark, sender?.tab?.id, 'mark_star')
    saveToChrome(true, null, 'mark_star')
    setTimeout(trySyncing, 100)
    if (request.tabinfo && request.tabinfo.tabid) { // ie marked from popup
      //  v2-manifest  chrome.browserAction.setIcon({ path: iconpath, tabId: request.tabinfo.tabid }, function () {})
      // v3-manifest 
      chrome.action.setIcon({ path: iconpath, tabId: request.tabinfo.tabid }, function () {})
    }

    return ({ success: true, current_mark: currentMark })
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
requestApi.saveMainComment = async function (request, sender) {
  /*         chrome.runtime.sendMessage({
      msg: "saveMainComment",
      purl: ....purl || currentLog.purl,
      id: ..._id,
      notes:theNote
  }
  */
  const purl = pureUrlify(request.purl)
  const [err, currentMark] = await getOrCreateMark(purl, request.props, request.id)
  if (err) {
    console.warn({err, currentMark })
    return ({ error: new Error('error getting data - please try again') })
  } else {
    currentMark.vNote = request.notes
    const iconpath = ICON_PATHS.red
    currentMark.vSearchString = resetVulogKeyWords(currentMark)
    jlosMarkChanged(currentMark)
    saveToChrome(true, null, 'saveMainComment')
    const tabId = (request.tabinfo && request.tabinfo.tabid) ? request.tabinfo.tabid : ((sender && sender.tab && sender.tab.id) ? sender.tab.id : null)
    chrome.action.setIcon({ path: iconpath, tabId: tabId }, function () { })
    checkForUpdatingPages(currentMark, sender?.tab?.id, 'saveMainComment')
    return ({ success: true, current_mark: currentMark })
  }
}
requestApi.newHighlight = async function (request, sender) { 
  // onsole.log(' got new hlight -  request.highlight is ', request.highlight)
  const purl = pureUrlify(request.url)
  const [err, currentMark] = await getOrCreateMark(purl, request.props, request.id)
  if (err) {
    console.warn(err)
    return (err)
  } else {
    if (!currentMark.vHighlights) currentMark.vHighlights = []
    request.highlight.color = (vulog.data.hColor || 'green').toString()
    currentMark.vHighlights.push(request.highlight)
    currentMark.vSearchString = resetVulogKeyWords(currentMark)
    jlosMarkChanged(currentMark)
    addToRecentMarks(currentMark)
    saveToChrome(true, null, 'newHighlight')
    setTimeout(trySyncing, 100)
    const tabId = request.tabinfo ? request.tabinfo.tabid : ((sender.tab && sender.tab.id) ? sender.tab.id : null)
    if (tabId) chrome.action.setIcon({ path: ICON_PATHS.red, tabId: tabId })
    checkForUpdatingPages(currentMark, sender?.tab?.id, 'newHighlight')
    return ({ success: true, current_mark: currentMark, color: request.highlight.color, mappedColor: COLOR_MAP[request.highlight.color] })
  }
}
requestApi.changeHlightColor = async function (request, sender) {
  // { msg: 'changeHlightColor', hColor, hlightId, url: window.location.href }
  // onsole.log(' got  changeHlightColor - current color is ', vulog.data.hColor, { request })
  const purl = pureUrlify(request.url)
  const [err, currentMark] = await getOrCreateMark(purl, null, request.id)
  if (err) {
    console.warn(err)
    return (err)
  } else if (!currentMark) {
    console.error('changeHlightColor: could not fund mark for ' + purl)
    return ({ error: 'Internal error: Could not retrieve mark on changeHlightColor' })
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
    return ({ success, currentMark, error })
  }
}
requestApi.addHLightComment = async function (request, sender) {
  // { msg: 'addHLightComment', hlightId, text, vCreated, url: window.location.href }
  // onsole.log(' got  addHLightComment  ', { request })
  const purl = pureUrlify(request.url)
  const [err, currentMark] = await getOrCreateMark(purl, null, request.id)
  if (err) {
    console.warn(err)
    return (err)
  } else if (!currentMark) {
    console.error('addHLightComment: could not fund mark for ' + purl)
    return ({ error: 'Internal error: Could not retrieve mark on addHLightComment' })
  } else {
    let success = false
    for (let i = currentMark.vHighlights.length - 1; i >= 0; --i) {
      const ahighlight = currentMark.vHighlights[i]
      if (request.hlightId === ahighlight.id) {
        if (!currentMark.vHighlights[i].vComments) currentMark.vHighlights[i].vComments = []
        currentMark.vHighlights[i].vComments.push({ text: request.text, vCreated: request.vCreated })
        currentMark.vHighlights[i].vNote = ''
        success = true
        i = -1
      }
    }
    currentMark.vSearchString = resetVulogKeyWords(currentMark)
    jlosMarkChanged(currentMark)
    checkForUpdatingPages(currentMark, sender?.tab?.id, 'addHLightComment')
    setTimeout(trySyncing, 100)
    const error = success ? '' : 'Could not find highlight'
    saveToChrome(true, null, 'addHLightComment')
    return ({ success, currentMark, error })

  }
}
requestApi.saveHlightComment = async function (request, sender) {
  // msg: (options.hlightId ? 'saveHlightComment' : 'saveMainComment'), url: purl, id: objId, notes: theNote
  // onsole.log(' got  saveHlightComment  ', { request })
  const purl = pureUrlify(request.purl)
  const [err, currentMark] = await getOrCreateMark(purl, null, request.id)
  if (err) {
    console.warn(err)
    return (err)
  } else if (!currentMark) {
    console.error('addHLightComment: could not fund mark for ' + purl)
    return ({ error: 'Internal error: Could not retrieve mark on addHLightComment' })
  } else {
    let success = false
    for (let i = 0; i < currentMark.vHighlights.length; i++) {
      if (request.hlightId === currentMark.vHighlights[i].id) {
        currentMark.vHighlights[i].vNote = request.notes
        success = true
      }
    }
    currentMark.vSearchString = resetVulogKeyWords(currentMark)
    jlosMarkChanged(currentMark)
    checkForUpdatingPages(currentMark, sender?.tab?.id, 'saveHlightComment')
    setTimeout(trySyncing, 200)
    const error = success ? '' : 'Could not find highlight'
    saveToChrome(true, null, 'saveHlightComment')
    return ({ success, currentMark, error })
  }
}
requestApi.copyHighlights = function (request, sender) {
  // chrome.runtime.sendMessage({purl:parsedPage.props.purl, highlights:vState.redirect_mark.vHighlights, msg:"copyHighlights"},
  const [err, currentMark] = getMarkOrLog(request.purl)
  if (err) {
    console.warn(err)
    return ({ error: 'error getting online data - please try again' })
  } else {
    if (!currentMark.vHighlights) currentMark.vHighlights = []
    request.highlights.forEach(ahigh => currentMark.vHighlights.push(ahigh))
    currentMark.vSearchString = resetVulogKeyWords(currentMark)
    addToRecentMarks(currentMark)
    setTimeout(trySyncing, 100)
    checkForUpdatingPages(currentMark, sender?.tab?.id, 'copyHighlights')
    saveToChrome(true, null, 'copyHighlights')
    const tabId = request.tabinfo ? request.tabinfo.tabid : ((sender.tab && sender.tab.id) ? sender.tab.id : null)
    // v3-manifest 
    if (tabId) chrome.action.setIcon({ path: ICON_PATHS.red, tabId: tabId })
    //  v2-manifest if (tabId) chrome.browserAction.setIcon({ path: ICON_PATHS.red, tabId: tabId })
    return ({ success: true, current_mark: currentMark })
  }
}
requestApi.removeHighlight = function (request, sender) {
  // should be changed to remvoe highlight and made consistent with ios
  // { msg: 'removeHighlight', hlightId, url: window.location.href }
  const purl = request.purl || pureUrlify(request.url)

  const currentMark = vulog.queryLatest('marks', { purl })
  let iconpath = ICON_PATHS.red
  let success = false
  if (!purl || !currentMark) {
    return ({ error: 'Internal error: Could not retrieve mark on removeHighlight' })
  } else {
    for (let i = currentMark.vHighlights.length - 1; i >= 0; --i) {
      if (request.hlightId === currentMark.vHighlights[i].id) {
        currentMark.vHighlights.splice(i, 1)
        success = true
        i = -1
      }
    }
    if (hasNomarks(currentMark)) {
      iconpath = !vulog.data.recordHistory ? ICON_PATHS.paused : ICON_PATHS.norm
      // todo nowdo -> change logic for vulog so having nomarks doesnt delete it
      // vulog.markDeleted('marks', currentMark, { idType: 'both' })
    } 
    currentMark.vSearchString = resetVulogKeyWords(currentMark)
    addToRecentMarks(currentMark)
    checkForUpdatingPages(currentMark, sender?.tab?.id, 'removeHighlight')
    setTimeout(trySyncing, 100)
    const error = success ? '' : 'Could not find highlight'
    saveToChrome(true, null, 'removeHighlight')
    const tabId = (request.tabinfo && request.tabinfo.tabid) ? request.tabinfo.tabid : ((sender && sender.tab && sender.tab.id) ? sender.tab.id : null)
    // v3-manifest 
    chrome.action.setIcon({ path: iconpath, tabId: tabId })
    //  v2-manifest chrome.browserAction.setIcon({ path: iconpath, tabId: tabId })
    return ({ success, currentMark, error })
  }
}
requestApi.setHColor = function (request, sender) {
  // onsole.log('setting hcolor to ', request.hColor)
  if (request.hColor) { // todo - check if hcolor is valid
    vulog.data.hColor = request.hColor
    return ({ success: true })
  } else {
    return ({ success: false, error: 'n hcolor sent' })
  }
}
requestApi.marksDisplayErrs = function (request, sender) {
  // chrome.runtime.sendMessage({purl:parsedPage.props.purl, msg:"marksDisplayErrs", display_errs:display_errs}
  // onsole.log("get mark for marksDisplayErrs purl ",request)
  const currentMark = vulog.queryLatest('marks', { purl: request.purl })
  if (!currentMark) {
    return ({ error: 'Could not get mark' })
  } else {
    request.display_errs.forEach(item => { currentMark.vHighlights[item.idx].displayErr = item.err })
    return ({ success: 'updated mark', new_mark: currentMark })
  }
} 

// used o update chrome view page and other pages with changes made elsewhere (eg marks added from other pages)
const isChromeExtensionUrl = function (url) {
  return (url && url.indexOf('chrome-extension://') === 0)
}
const checkForUpdatingPages = function (currentMark, tabId, action) {
  const pagesInRAM = []
  const extensionViewPages = []

  chrome.tabs.query({}, function (tabArray) {
    if (tabArray && tabArray.length > 0) {
      tabArray.forEach(tab => {
        if (!tab.url) {
          console.warn('tab has no url ', tab)
        } else if (currentMark?.purl && pureUrlify(tab.url) === currentMark.purl) {
          chrome.tabs.sendMessage(tab.id, { msg: 'markUpdated', updatedMark: currentMark, action}, function (response) {})
        } 
        if (isChromeExtensionUrl(tab.url) && tab.id !== tabId) {
          try {
            chrome.tabs.sendMessage(tab.id, { msg: 'updateExtenionPage', updatedMark: currentMark, action }, function (response) {})
          } catch (e) { 
            console.warn('error sending message to tab ', tab, e)
          }
        }
      })
    }
  })
}

// Other...
requestApi.setDefaultHashtag = function (request, sender) {
  // onsole.log('setting defaultHashTag to ', request.defaultHashTag)
  vulog.data.defaultHashTag = request.defaultHashTag || null
  saveToChrome(true, null, 'setDefaultHashtag')
  return ({ success: true })
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
requestApi.getOlderitems = async function (request, sender) { //
  /*
    //  msg: 'getOlderitems', list, statParams: { getCount: SEARCHCOUNT, gotCount: statsObject.gotCount, gotAll: statsObject.gotAll, dates: statsObject.dates}
  */
  let typeReturned = 'unfilteredItems'
  const theList = vulog.data[request.list] || []
  if (theList && theList.length > 0) {
    theList.sort(sortBycreatedDate)
  }

  const getCount = request.params?.getCount || 100
  const oldestCreated = request.params?.dates?.oldestCreated 
  const oldestModified = request.params?.dates?.oldestModified 
  
  let oldestReturned = oldestCreated
  let currentItem = theList.length - 1
  let results = []

  // if (request.params.newestModified === 0) {}
  //   console.warn('this is tempo and abvoe should be removed')
  while (!request.params?.alreadyGotFIlteredItems && currentItem >= 0 && results.length < getCount) {
    const aLog = theList[currentItem]
    const logDate = aLog.vCreated || aLog._date_created
    if (aLog && !aLog.fj_deleted && logDate && logDate < oldestCreated && aLog.purl) {
      oldestReturned = logDate
      // const innerLog = (request.list === 'gotMsgs' || request.list === 'sentMsgs') ? aLog.record : aLog
      results.push(aLog)
    }
    currentItem--
  }
  if (results.length === 0 && vulog.data.freezrMeta?.userId) {
    const apptable = appTableFromList(request.list)
    // const q = {} // , _date_modified: { $gt: request.oldestItem } 
    const appId = (request.list === 'sentMsgs' || request.list === 'gotMsgs') ? 'com.salmanff.vulog' : null
    if (!dataExceedsStorageLimits('warn') && (request.list === 'marks' || theList.length < 500)) {
      results = await vulog.getOlderItemsAsync(request.list, { app_table: apptable, count: getCount, app_id: appId })
    } else {
      typeReturned = 'filteredItems'
      if (!oldestModified) {
        console.warn('no oldestModified sent -DNBH')
        oldestModified = new Date().getTime()
      }
      q = convertListerParamsToDbQuery(request.params.queryParams, { '_date_modified': { $lt: oldestModified }, fj_deleted: { $ne: true }})

      const apptable = appTableFromList(request.list)
      results = await freepr.feps.postquery({ app_table: apptable, q, count: getCount, sort: { _date_modified: -1 } })
      results.sort(sortBycreatedDate).reverse()
    }
  }
  return ({ success: true, newItems: results, typeReturned })
}
function wordsInList1InList2 (requiredWords, wordsToCheck) {
  var tempret = true
  if (!requiredWords || requiredWords.length === 0) return true
  if (!wordsToCheck || wordsToCheck.length === 0) return false
  requiredWords.forEach(function (aWord) { if (aWord !== ' ' && wordsToCheck && wordsToCheck.indexOf(aWord) < 0) tempret = false })
  return tempret
}

// pop up APIs admin
requestApi.getFreezrmeta = function (request, sender) {
  const freezrMeta = vulog.data.freezrMeta
  return ({ freezrMeta, success: true })
}
requestApi.getVulogState = function (request, sender) {
  const vState = {
    // pause_vulog: vulog.data.pause_vulog || false,
    recordHistory: vulog.data.recordHistory || false,
    syncErr: vulog.data.syncErr || false,
    deleted_unbackedupdata: vulog.data.deleted_unbackedupdata || false,
    marks_data_size: sizeOfObject(vulog.data.marks),
    
    num_logs: (vulog.data.logs ? vulog.data.logs.length : 0),
    num_marks: (vulog.data.marks ? vulog.data.marks.length : 0),

    offlineCredentialsExpired: (freezr && freezr.app && freezr.app.offlineCredentialsExpired),

    freezrMeta: vulog.data.freezrMeta,

    cookieRemovalHasBeenCalled: vulog.data.cookieRemovalHasBeenCalled
  }
  vulog.data.deleted_unbackedupdata = false
  const NUM_FRENDS_TO_FETCH = 30

  vState.contacts = (vulog.data.contacts && vulog.data.contacts.length > NUM_FRENDS_TO_FETCH)
    ? vulog.data.contacts.slice(0, NUM_FRENDS_TO_FETCH)
    : ((vulog.data.contacts && vulog.data.contacts.length > 0) ? vulog.data.contacts.slice(0) : [])
    vState.contacts = vState.contacts.sort(function (a, b) {
    if (a.used && b.used) return a.used > b.used
    if (a.used) return 1
    if (b.used) return -1
    return 0
  })
  vState.feedcodes = (vulog.data.feedcodes && vulog.data.feedcodes.length > NUM_FRENDS_TO_FETCH)
    ? vulog.data.feedcodes.slice(0, NUM_FRENDS_TO_FETCH)
    : vulog.data.feedcodes ? vulog.data.feedcodes : []
    vState.groups = (vulog.data.groups && vulog.data.groups.length > NUM_FRENDS_TO_FETCH)
    ? vulog.data.groups.slice(0, NUM_FRENDS_TO_FETCH)
    : vulog.data.groups ? vulog.data.groups : []

  let currentLog
  let currentMark
  let purl = request.purl
  if (request.purl) {
    const masterPage = vulog.queryLatest('logs', { purl: request.purl })
    if (request.tabinfo && request.tabinfo.tabid && logDetailsInRAM[request.tabinfo.tabid] && logDetailsInRAM[request.tabinfo.tabid].length > 0 && logDetailsInRAM[request.tabinfo.tabid][0].purl === request.purl) {
      currentLog = logDetailsInRAM[request.tabinfo.tabid][0]
      currentLog.vulog_visit_details = masterPage ? masterPage.vulog_visit_details : [] // RAM has cookie vState and masterPage has visit vState
      currentLog.vulog_max_scroll = masterPage?.vulog_max_scroll
      currentLog.vulogVids = masterPage ? masterPage.vulogVids : []
    } else {
      console.warn('NO log from logDetailsInRAM - got from vulog', request.tabinfo, logDetailsInRAM[request.tabinfo.tabid])
      currentLog = masterPage
    }
    if (!currentLog && request.tabinfo) currentLog = convertTabinfoToLog(request.tabinfo)

    if (!currentLog) console.warn('no tab info for getpagedata ', request, sender)
    currentMark = vulog.queryLatest('marks', { purl: request.purl })

    vState.edit_mode = getEditMode(((request.tabinfo && request.tabinfo.tabid) ? request.tabinfo.tabid : null), request.purl)
  }
  vState.defaultHashTag = vulog.data.defaultHashTag
  vState.hcolor = vulog.data.hColor
  return ({ vState, purl, currentLog, currentMark, success: true, fatalErrors })
  if (!currentLog && request.tabinfo?.tabid) {
    setTimeout(async () => { refreshLogInDetailsFromPage(request.tabinfo.tabid) }, 10);
  }
  trySyncing()
}
const refreshLogInDetailsFromPage = async function(tabid) {
  const tabInfo = await chrome.tabs.sendMessage(tabid, { action: 'getUrlInfo' })
  if (tabInfo &&  tabInfo.pageInfoFromPage) {
    if (!logDetailsInRAM[tabid]) logDetailsInRAM[tabid] = []
    logDetailsInRAM[tabid].unshift(tabInfo.pageInfoFromPage)
  }
}
requestApi.loggedin = function (request, sender) {
  // onsole.log('freezrMeta post set', request.freezrMeta )
  if (request.freezrMeta && request.freezrMeta.appToken) {
    freezrMeta.set(request.freezrMeta)
    freezr.app.offlineCredentialsExpired = false
    vulog.data.freezrMeta = freezrMeta
    saveToChrome(true, null, 'loggedin')
    return ({ success: true })
    trySyncing()
  } else {
    return ({ success: false })
  }
}
requestApi.logged_out = function (request, sender) {
  vulog.removeSyncedFreezrInfo('logs')
  vulog.removeSyncedFreezrInfo('marks')
  vulog.removeSyncedFreezrInfo('contacts')
  vulog.removeSyncedFreezrInfo('groups')
  vulog.removeSyncedFreezrInfo('feedcodes')
  vulog.removeSyncedFreezrInfo('gotMsgs')
  vulog.removeSyncedFreezrInfo('sentMsgs')
  vulog.data.offlineMarks = []
  vulog.data.last_server_sync_time = {}
  freezrMeta.reset()
  freezr.app.offlineCredentialsExpired = false
  vulog.data.freezrMeta = freezrMeta
  saveToChrome(true, null, 'logged_out')
  return ({ success: true })
}
requestApi.set_edit_mode = function (request, sender) {
  // from webBox
  // request: {set: true/false , purl:}

  if (request.purl) {
    if (request.set) {
      editModes[request.purl] = {
        set: true,
        purl: request.purl
      }
    } else if (editModes[request.purl]) {
      delete editModes[request.purl]
    }
    return ({ success: true })
  } else {
    return ({ success: false })
  }
}
const getEditMode = function (tab, purl) {
  if (!purl || !editModes[purl]) {
    return false
  } else {
    return (editModes[purl] && editModes[purl].set)
  }
}
requestApi.get_edit_mode = function (request, sender) {
  const error = (!request.purl || !sender || sender.tab || !sender.tab.id)
  const tab = ((sender.tab && sender.tab.id) ? sender.tab.id : (request.tabinfo && request.tabinfo.tabid) ? request.tabinfo.tabid : null)
  const set = getEditMode(tab, request.purl)
  return ({ success: (!error), set })
}
requestApi.get_recent_marks = function (request, sender) {
  return ({ recentMarks })
}
requestApi.pause = function (request, sender) {
  // vulog.data.pause_vulog = true
  vulog.data.recordHistory = false
  chrome.tabs.query({}, function (tabArray) {
    if (tabArray && tabArray.length > 0) {
      tabArray.forEach(item => {
        //  v3-manifest 
        chrome.action.setIcon({ path: ICON_PATHS.paused, tabId: item.tabId })
        //  v2-manifest  chrome.browserAction.setIcon({ path: ICON_PATHS.paused, tabId: item.tabId })
      })
    }
  })
  saveToChrome(false, null, 'pause')
  return ({ success: true })
}
requestApi.unpause = function (request, sender) {
  // vulog.data.pause_vulog = false
  vulog.data.recordHistory = true
  chrome.tabs.query({}, function (tabArray) {
    if (tabArray && tabArray.length > 0) {
      tabArray.forEach(item => {
        // v3-manifest 
        chrome.action.setIcon({ path: ICON_PATHS.norm, tabId: item.tabId })
        //  v2-manifest chrome.browserAction.setIcon({ path: ICON_PATHS.norm, tabId: item.tabId })
      })
    }
  })
  saveToChrome(true, null, 'unpause')
  return ({ success: true })
}
requestApi.removeLocalData = function (request, sender) {
  vulog.data.logs = []
  vulog.data.marks = []
  vulog.data.offlineMarks = []
  saveToChrome(true, null, 'removeLocalData')
  return ({ success: true })
}
requestApi.removeHistoryOnly = function (request, sender) {
  vulog.data.logs = []
  saveToChrome(true, null, 'removeHistoryOnly')
  return ({ success: true })
}
requestApi.removeLocalItem = function (request, sender) {
  // assumes it is a log;
  // onsole.log("removeLocalItem",request)
  if (!request.list) request.list = 'logs'
  if (!request.item || !request.item.purl) {
    return ({ success: false, error: 'incorrect query - no purl' })
  } else {
    const thequery = { purl: request.item.purl }
    if (request.item._id) thequery._id = request.item._id
    else if (request.item.fj_local_temp_unique_id) thequery.fj_local_temp_unique_id = request.item.fj_local_temp_unique_id

    const [thelog, idx] = vulog.queryObjs(request.list, thequery, { getOne: true, getIndex: true })

    if (!thelog) {
      return ({ success: false, error: 'item not found' })
    } else {
      if (thelog._id) {
        vulog.markDeleted(request.list, thelog._id)
      } else {
        vulog.data[request.list].splice(idx, 1)
      }
      const otherSimilar = vulog.queryObjs(request.list, { purl: request.item.purl })
      saveToChrome(true, null, 'removeLocalItem')
      return ({ success: true, otherSimilar: otherSimilar })
    }
  }
}
requestApi.cookieRemovalCalled = function (request, sender) {
  vulog.data.cookieRemovalHasBeenCalled = true
  saveToChrome(false, null, 'cookieRemovalCalled')
  return ({ success: true })
}

// sharing syncing
requestApi.shared = function (request, sender) {
  if (request.grantee.nickname === '_public') {
    // onsole.log('neeed to handle public ??? ') todo
  } else {
    const theContact = vulog.queryLatest('contacts', { username: request.grantee.username, serverurl: request.grantee.serverurl })
    if (theContact) {
      theContact.used = new Date().getTime()
    }
  }
  requestApi.trySyncing(request, sender)
}
requestApi.syncMessagesAndGetLatestFor = async function (request, sender) {
  if (!vulog.data.freezrMeta?.userId) return null
  const purl = request.purl
  let mergedMessages = null
  let error = null
  try {
    const gotMessageUpdate = await asyncGotMessages()
    const sentMessageUpdate = await asyncSentMessages()
  } catch (e) {
    error = e
  }
  if (!error) {
    const gotMessages = vulog.data.gotMsgs?.filter(m => m.purl === purl)
    const sentMessages = vulog.data.sentMsgs?.filter(m => m.purl === purl)
    mergedMessages = [...gotMessages, ...sentMessages]
  }
  return { mergedMessages,  error }
}
requestApi.asyncListAndGetLatest = async function (request, sender) {
  const list = request.list
  const since = request.since

  if (!list || !since) throw new Error('need list and since to get latest')

  try {
    const errInSync = await asyncItems(list)
    if (errInSync) throw new Error(errInSync.error)
  } catch (error) {
    return { error }
  }
  const items = vulog.data[list].filter((m) => {
    const date = m?._date_modified || m?.fj_modified_locally
    return date && date > since
  })
  return { items }
}

requestApi.trySyncing = function (request, sender) {
  if (!vulog.data.freezrMeta.serverAddress) {
    return ({ success: false, error: 'You need to be connected to a ceps server to sync' })
  } else if (syncinprogress) {
    return ({ success: false, error: 'Already syncing' })
  } else {
    return ({ success: true })
    trySyncing()
  }
}
requestApi.sendMessage = async function (request, sender) {
  const { chosenFriends, text, hLight, markCopy } = request
  const successFullSends = []
  const erroredSends = []

  // send then clear wip and redraw
  // note if from is inline then all highlights and vcomments are removed 

  try {
    if (!chosenFriends || chosenFriends.length === 0) throw new Error('No friends chosen')
    if (!markCopy) throw new Error('mark copy could not be found', purl)
    markCopy.vComments = []
    const createRet = await freepr.ceps.create(markCopy, { app_table: 'com.salmanff.vulog.sharedmarks' })
    if (!createRet || createRet.error) throw new Error('Error creating shared mark: ' + (createRet?.error || 'unknown'))
    markCopy._id = createRet._id
  } catch (error) {
    console.warn('err in sending msg', error)
    return ({ error, successFullSends, erroredSends: chosenFriends })
  }

  const msgToSend = {
    messaging_permission: 'message_link',
    contact_permission: 'friends',
    table_id: 'com.salmanff.vulog.sharedmarks',
    record_id: markCopy._id,
    record: markCopy
  }

  // should do promises all here
  for (const idx in chosenFriends) {
    const friend = chosenFriends[idx]

    msgToSend.recipient_id = friend.username
    msgToSend.recipient_host = friend.serverurl
    msgToSend.record.vComments = [{
      recipient_host: friend.serverurl,
      recipient_id: friend.username,
      sender_host: vulog.data.freezrMeta.serverAddress,
      sender_id: vulog.data.freezrMeta.userId,
      vCreated: new Date().getTime(),
      text: hLight ? '' : text // if it is a highlight then the text goes in the highlights
    }]
    if (hLight) {
      if (from !== 'inlineReply') { console.error('havenot thought through logic of non-inline replies ')}
      hLight.vComments = [{
        recipient_host: friend.serverurl,
        recipient_id: friend.username,
        sender_host: vulog.data.freezrMeta.serverAddress,
        sender_id: vulog.data.freezrMeta.userId,
        vCreated: new Date().getTime(),
        text: text // if it is a highlight then the text goes in the highlights
      }]
      msgToSend.record.vHighlights = [hLight]
    }

    try {
      const sendRet = await freepr.ceps.sendMessage(msgToSend)
      if (!sendRet || sendRet.error) throw new Error('Error sending message: ' + (sendRet?.error || 'unknown'))
      successFullSends.push(friend)
    } catch (e) {
      console.error('error sending message', { e })
      const errJson = JSON.parse(JSON.stringify(friend))
      errJson.error = e.message
      erroredSends.push(errJson)
    }
  }

  return ({ successFullSends, erroredSends })
}

// savetochrome and timee and reducing size
let saveLater
let lastSave = 0
const TIME_TO_SAVE_FROM_IDLE = 10000
const saveToChrome = function (forceSave, callFwd, from) {
  // onsole.log('SaveToChrome forceSave? ' + forceSave + 'from '+from+' last Save '+(new Date(lastSave)).toTimeString() )

  if (!callFwd) callFwd = function () { }
  reduceSize()
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
        clearTimeout(saveLater); saveLater = null
        trySavingLater()
        fatalErrors = message //
        callFwd({ success, message })
      }
      if (saveLater) clearTimeout(saveLater)
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

const getStorageUsed = function () {
  return JSON.stringify(vulog.data).length * 2
  // old in MB: return Math.round(theLen / 1024)
}
const dataExceedsStorageLimits = function (limitType) {
  const HARD_LIMIT = 0.80
  const WARNING_LIMIT = 0.70
  const limit = (limitType === 'warn') ? WARNING_LIMIT : HARD_LIMIT
  return getStorageUsed() > (chrome.storage.local.QUOTA_BYTES * limit)
}
var reduceSize = function (doNotTouchMarks) {
  if (!dataExceedsStorageLimits()) return

  const MIN_LEN = 100 
  while (dataExceedsStorageLimits() &&  vulog.data.logs.length > MIN_LEN) {
    vulog.data.logs.sort(sortByModifedDate) // this should be redundant as already sorted but just in case
    const cutEnd = Math.min(MIN_LEN, vulog.data.logs.length - MIN_LEN)
    for (let i = 0; i < cutEnd; i++) {
      if (!(vulog.data.logs[i]._id && !vulog.data.logs[i].fj_modified_locally)) vulog.data.deleted_unbackedupdata = true
    }
    vulog.data.logs.splice(0, cutEnd)
  }
  if (dataExceedsStorageLimits()) {
    if (vulog.data.gotMsgs && vulog.data.gotMsgs.length > MIN_LEN) {
      vulog.data.gotMsgs.sort(sortByModifedDate) // this should be redundant as already sorted but just in case
      vulog.data.gotMsgs.splice(0, vulog.data.gotMsgs.length - MIN_LEN)
    }
    if (vulog.data.sentMsgs && vulog.data.sentMsgs.length > MIN_LEN) {
      vulog.data.sentMsgs.sort(sortByModifedDate) // this should be redundant as already sorted but just in case
      vulog.data.sentMsgs.splice(0, vulog.data.sentMsgs.length - MIN_LEN)
    }
  }
  const MIN_MARKS_LEN = 400 
  if (!doNotTouchMarks && dataExceedsStorageLimits() && vulog.data.marks.length > MIN_MARKS_LEN) {
    vulog.data.marks.sort(sortByModifedDate) // this should be redundant as already sorted but just in case

    const cutEnd = Math.min(MIN_LEN, vulog.data.marks.length - MIN_LEN)
    for (let i = 0; i < cutEnd; i++) {
      if (!(vulog.data.marks[i]._id && !vulog.data.marks[i].fj_modified_locally)) vulog.data.deleted_unbackedupdata = true
    }
    vulog.data.marks.splice(0, cutEnd)
  }
}

// SYNCING
var vulogTempDeviceId
var trySyncing = function (callFwd) {
  // onsole.log('trysyncing')
  if (!callFwd) callFwd = function () {} // onsole.log

  vulog.data.syncErr = null
  if (vulog.data.freezrMeta?.serverAddress && !syncinprogress) {
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
          syncAppPermissions(callFwd)
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
const syncAppPermissions = function (callFwd) {
  freezr.perms.getAppPermissions(function (err, permsList) {
    if (err) {
      callFwd({ error: 'perms not avalable' })
    } else {
      vulog.data.freezrMeta.perms = {}
      if (permsList && permsList.length > 0) {  
        permsList.forEach(perm => {
          vulog.data.freezrMeta.perms[perm.name] = perm
        })
      }
      syncContacts(callFwd)
    }
  })
}
var syncContacts = function (callFwd) {
  // onsole.log('syncContacts')
  vulog.sync('contacts', {
    app_table: 'dev.ceps.contacts', 
    endCallBack: function (err) { 
      if (err) console.warn('synccontacts message ', err)
      if (err && err.message === 'Token has expired.') {
        console.warn('syn contacts err ', err )
        freezr.app.offlineCredentialsExpired = true
        endofSync(callFwd)
      } else {
        syncGroups(callFwd) 
      }
    }
  })
}
var syncGroups = function (callFwd) {
  // onsole.log('syncContacts')
  vulog.sync('groups', { 
    app_table: 'dev.ceps.groups', 
    endCallBack: function (message) { 
      syncFeedCodes(callFwd) 
    }

  })
}
var syncFeedCodes = function (callFwd) {
//   syncGotMessages(callFwd)
  vulog.sync('feedcodes', {
    // userId: 'public',
    permission: 'privateCodes',
    app_table: 'dev.ceps.privatefeeds.codes',
    xtraQueryParams: { app_id: 'com.salmanff.vulog' },
    endCallBack: function (msg) {
      syncGotMessages(callFwd)
    }
  })
}
var syncGotMessages = function (callFwd) {
  // onsole.log('syncMessages')
  vulog.sync('gotMsgs', {
    app_table: 'dev.ceps.messages.got',
    downloadedItemTransform: function (message) {
      message = JSON.parse(JSON.stringify(message))
      if (message && message.record && message.record.purl) {
        message.purl = message.record.purl // used for getOlderitems

        // chrome notifications
        const msgText = (message.record.vComments && message.record.vComments.length > 0 && message.record.vComments[0].text) ? message.record.vComments[0].text : ''
        const options = {
          type: 'basic',
          iconUrl: '/static/hipercardsLogo.png',
          title: ('A link from ' + message.sender_id + ' @ ' + message.sender_host),
          message: msgText + message.record.title,
          priority: 2
        }
        try {
          if (chrome.notifications?.create) chrome.notifications.create(message._id, options) 
        } catch (e) {
          console.warn('error creating notification', e)
        }
      }
      return message
    },
    xtraQueryParams: { app_id: 'com.salmanff.vulog' },
    endCallBack: function (message) { 
      syncSentMessages(callFwd) 
    }

  })
}
var syncSentMessages = function (callFwd) {
  // onsole.log('syncMessages')
  vulog.sync('sentMsgs', {
    app_table: 'dev.ceps.messages.sent',
    xtraQueryParams: { app_id: 'com.salmanff.vulog' },
    downloadedItemTransform: function (message) {
      message = JSON.parse(JSON.stringify(message))
      if (message && message.record && message.record.purl) {
        message.purl = message.record.purl // used for getOlderitems
      }
      return message
    },
    endCallBack: function (message) { 
      checkMarks(callFwd) 
    }

  })
}
const asyncItems = async function (list) {
  // onsole.log('syncMessages')
  const options = { app_table: appTableFromList(list)}
  if (list === ' sentMsgs' || list === 'gotMsgs') {
    options.xtraQueryParams = { app_id: 'com.salmanff.vulog' }
    options.downloadedItemTransformv = function (message) {
      message = JSON.parse(JSON.stringify(message))
      if (message && message.record && message.record.purl) {
        message.purl = message.record.purl // used for getOlderitems
      }
      return message
    }
  }

  const uploadResults = await vulog.uploadNewItemsAsync(list, options)
  if (uploadResults && uploadResults.error) return uploadResults
  const dlResults = await vulog.getNewitemsAsync(list, options)
  if (dlResults && dlResults.error) return dlResults
  return null
  
}
const asyncSentMessages = async  function () {
  // onsole.log('syncMessages')
  return await vulog.getNewitemsAsync('sentMsgs', {
    app_table: 'dev.ceps.messages.sent',
    xtraQueryParams: { app_id: 'com.salmanff.vulog' },
    downloadedItemTransform: function (message) {
      message = JSON.parse(JSON.stringify(message))
      if (message && message.record && message.record.purl) {
        message.purl = message.record.purl // used for getOlderitems
      }
      return message
    }
  })
}
const asyncGotMessages = async  function () {
  // onsole.log('syncMessages')
  return await vulog.getNewitemsAsync('gotMsgs', {
    app_table: 'dev.ceps.messages.got',
    xtraQueryParams: { app_id: 'com.salmanff.vulog' },
    downloadedItemTransform: async function (message) {
      message = JSON.parse(JSON.stringify(message))
      if (message && message.record && message.record.purl) {
        message.purl = message.record.purl // used for getOlderitems

        // chrome notifications
        const msgText = (message.record.vComments && message.record.vComments.length > 0 && message.record.vComments[0].text) ? message.record.vComments[0].text : ''
        const options = {
          type: 'basic',
          iconUrl: '/static/hipercardsLogo.png',
          title: ('A link from ' + message.sender_id + ' @ ' + message.sender_host),
          message: msgText + ' -  ' + message.record.title,
          priority: 2
        }
        try {
          if (chrome.notifications?.create) await chrome.notifications.create(message._id, options) 
        } catch (e) {
          console.warn('error creating notification', e)
        }
      }
      return message
    }
  })
}
var checkMarks = function (callFwd) { // checks to make sure there are no conflicts
  const itemtocheck = vulog.data.marks.find((item) => (item && !item._id && !item.checked))

  // vulog.data.marks.forEach((item) => {
  //   if (item && !item._id && !item.checked) { 
  //     itemtocheck = item
  //   }
  // })
  if (!itemtocheck) {
    syncMarks(callFwd)
  } else if (itemtocheck.fj_deleted) {
    itemtocheck.checked = true
    checkMarks(callFwd)
  } else if (!itemtocheck.purl) {
    console.warn('error in item with no purl and not deleted', { itemtocheck })
    itemtocheck.checked = true
    itemtocheck.error = true
  } else {
    freezr.ceps.getquery({ collection: 'marks', q: { purl: itemtocheck.purl } }, function (error, returndata) {
      if (error || returndata.error) {
        if (!error) error = { errorCode: returndata.code }
        if (error.errorCode === 'expired') {
          freezr.app.offlineCredentialsExpired = true
          saveToChrome(true, null, 'checkMarks')
        } else if (!error.errorCode || error.errorCode === 'noServer') {
          console.warn('Could not connect to server to check marks conflict ', returndata)
        }
        endofSync(callFwd)
      } else if (!returndata || returndata.length === 0) {
        itemtocheck.checked = true
        checkMarks(callFwd)
      } else {
        const onlineItem = returndata[0]

        itemtocheck._id = onlineItem._id
        itemtocheck.vStars = addToListAsUniqueItems(onlineItem.vStars, itemtocheck.vStars)
        if (onlineItem.vNote) itemtocheck.vNote += (' ' + onlineItem.vNote)
        itemtocheck.vHighlights = itemtocheck.vHighlights || []
        if (onlineItem.vHighlights) onlineItem.vHighlights = [...(onlineItem.vHighlights || []), ...(itemtocheck.vHighlights || [])]
        jlosMarkChanged(itemtocheck)
        // vulog.data.marks[idx] = onlineItem

        checkMarks(callFwd)
      }
    })
  }
}
var syncMarks = function (callFwd) {
  vulog.sync('marks', {
    handleConflictedItem: handleConflictedItem,
    downloadedItemTransform: vp5Tranformmark,
    uploadedItemTransform: function (anItem) {
      if ((!anItem || !anItem.checked) && !anItem._id) {
        console.warn('trying to sync a non-checked item', { anItem })
        return null
      }
      delete anItem.checked
      return anItem
    },
    endCallBack: function (message) { 
      if (message && message.code === 'expired') {
        if (!freezr.app) freezr.app = {}
        freezr.app.offlineCredentialsExpired = true
      }
      syncLogs(callFwd) 
    }
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
    checkForUpdatingPages(null, null, 'endofSync')
    
}
if (chrome.notifications?.onClicked) {
  chrome.notifications.onClicked.addListener(function (notifId) {
    const linkObj = vulog.get('gotMsgs', notifId)
    const linkUrl = (linkObj && linkObj.record && linkObj.record.url) ? linkObj.record.url : '/main/view.html?view=messages'
    chrome.tabs.create({ url: linkUrl })
  })
}

// marks
const getOrCreateMark = async function (purl, props, idcheck) {
  if (!purl) {
    return [new Error('Insufficient data was sent to do the operation')]
  }
  const currentMark = vulog.queryLatest('marks', { purl })
  if (currentMark) {
    if (idcheck && ((idcheck + '') !== (currentMark._id + '')) && ((idcheck + '') !== (currentMark.fj_local_temp_unique_id + ''))) {
      return [{ error: new Error('wrong id ' + idcheck + ' vs ' + currentMark._id + ' or temp-id: ' + currentMark.fj_local_temp_unique_id) }]
    } else {
      return [null, currentMark]
    }
  }

  const logtomark = vulog.queryLatest('logs', { purl })
  if (logtomark) {
    const convertedLog = convertLogToMark(logtomark)
    return [null, vulog.add('marks', convertedLog)]
  }

  if (props && props.purl !== purl) {
    return [new Error('props purl inconcistent with purl provided')]
  }
  if (props) {
    return [null, vulog.add('marks', makeMarkFromLogInfo(props))]
  }

  return [new Error(('coul not get mark')), null]
}
const makeMarkFromLogInfo = function(logDetails, options) {
  const newMark = convertLogToMark(logDetails)

  if (options?.theStar) newMark.vStars = [options.theStar]
  newMark.vNote = (options?.note || ''),
  newMark.vSource = 'chrome_browser'
  newMark.vSearchString = resetVulogKeyWords(newMark)
  return newMark
}
const getMarkOrLog = function (purl, idcheck) { // Old version
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
        if (!currentMark && logDetailsInRAM[tabid] && logDetailsInRAM[tabid].length > 0 && logDetailsInRAM[tabid][0].purl === purl) currentMark = convertLogToMark(logDetailsInRAM[tabid][0])
      }
    }
    const err = currentMark ? null : { error: new Error('Could not retrieve mark to complete the operation') }
    return [err, currentMark]
  }
}
const logFromLogDetailsInRAM = function (purl) {
  let logFromRAM = null
  Object.keys(logDetailsInRAM).forEach(tabid => {
    if (!logFromRAM && logDetailsInRAM[tabid].length > 0) logFromRAM = logDetailsInRAM[tabid].find(log => log.purl === purl)
  })
  return logFromRAM
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
  // tabinfo.vSearchString = addToListAsUniqueItems([], cleanTextForEasySearch((tabinfo.url + ' ' + tabinfo.title.replace(/%/g, ' ')).split(' ')))
  tabinfo.vSearchString = resetVulogKeyWords(tabinfo)
  
  // return vulog.add('logs', tabinfo)
  return tabinfo
}
// const convertLogToMark = function (logtomark) {
//   const newmark = { vulog_mark_tags: [], vHighlights: [], vNote: '', vStars: [] }
//   const ToTransfer = ['url', 'purl', 'description', 'domainApp', 'title', 'author', 'image', 'keywords', 'type', 'vulog_favIconUrl', 'vSearchString', 'vCreated']
//   ToTransfer.forEach((item) => {
//     if (logtomark[item]) {
//       newmark[item] = JSON.parse(JSON.stringify(logtomark[item]))
//     }
//   })
//   if (!logtomark.url && logtomark.linkUrl) newmark.url = logtomark.linkUrl
//   if (!logtomark.referrer && logtomark.referrerUrl) newmark.referrer = logtomark.referrerUrl
//   if (!newmark.purl) newmark.purl = pureUrlify(newmark.url)
//   if (!newmark.domainApp) newmark.domainApp = domainAppFromUrl(newmark.purl)

//   newmark.vSource = 'chrome_browser'
//   newmark.vNote = vulog.data.defaultHashTag ? ('#' + vulog.data.defaultHashTag) : null

//   if (!newmark.url) throw Error('trying to convert log to mark with nopurl ', logtomark)
//   return vulog.add('marks', newmark)
// }

// OTHER
const vp5Tranformmark = function (item) {

  delete item.vulog_mark_tags
  delete item.vSearchWords
  delete item.vulog_kword2

  const v2Translations = {
    domain_app: 'domainApp',
    vulog_timestamp: 'vCreated',
    vulog_highlights: 'vHighlights',
    vulog_mark_notes: 'vNote',
    vulog_mark_stars: 'vStars',
    vulog_source: 'vSource'
  }
  for (const [oldKey, newKey] of Object.entries(v2Translations)) {
    if (item[oldKey]) item[newKey] = item[oldKey]
    delete item[oldKey]
  }

  item.vSearchString = resetVulogKeyWords(item)
  
  return item
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
  if (!anObject) return 0
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
function convertToList (object, addObjectKey) {
  if (!object || !object[obejctKey]) return []
  //iterate all objects and put into list
  const list = []
  Object.keys(object).forEach(key => {
    if (addObjectKey) object[key][addObjectKey] = key
    list.push(object[key])
  })
  return list
}

