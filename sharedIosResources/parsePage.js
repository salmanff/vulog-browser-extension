/*
To review and delete unused parts (2022-10)
*/

// Note document.focus is most reliable way to know if user has gone from focvus to Not being focused... but document.focus does not turn true reliably so activity detection is used

/* global VuPageData, chrome, HTMLMediaElement, localStorage , pureUrlify */

const INTERVAL_BETWEEN_CHECKING_ACTIVITY = 5000
const ASSUME_IDLE_AFTER = 10000
const TIME_TO_SEND_SUB_PAGE = 500
const TIME_TO_SEND_MAIN_PAGE = 10

let parsedPage = null
let focusTimer
let heightSpecs
const vulogVids = []
let focusedItervaler
let assumeIdleTimer
const FOCUS_TIMERS_INIT = {
  start: null,
  lastRec: null,
  end: null,
  vid_start: null
}
const HEIGHT_INIT = {
  doc_height: 0,
  max_scroll: 0
}

const startParse = function () {
  // Called on each new page to parse it - initiates keys based on page and sends to background
  // onsole.log('startparse started, ', new Date())
  parsedPage = new VuPageData()

  if (!parsedPage.props.url) throw new Error('Deal with no url')
  // onsole.log('vulog parsedPage.props '+(parsedPage.props.hasBody? 'hasBody':'NOBODY NONODY')+document.getElementsByTagName('BODY')[0].scrollHeight)

  const isMainPage = (parsedPage.props.hasBody && !parsedPage.props.isiframe)
  const timeToSend = isMainPage ? TIME_TO_SEND_MAIN_PAGE : TIME_TO_SEND_SUB_PAGE
  focusTimer = Object.assign({}, FOCUS_TIMERS_INIT)
  heightSpecs = Object.assign({}, HEIGHT_INIT)
  setTimeout(function () {
    chrome.runtime.sendMessage({ props: parsedPage.props, msg: 'newpage' }, function (response) {
      // onsole.log('sending new page', { response })
      if (document.hasFocus()) { startTimer() } else { addreFocusListeners() }
    })
  }, timeToSend)
}
const startTimer = function () {
  const nowTime = new Date().getTime()
  focusTimer.start = nowTime
  focusTimer.last_activity = nowTime
  if (aVideoIsPlaying()) {
    focusTimer.vid_start = nowTime
  } else if (focusTimer.vid_start) {
    delete focusTimer.vid_start
  }
  focusTimer.lastRec = null
  focusTimer.end = null
  if (document.hasFocus()) {
    focusedItervaler = setInterval(recordFocusedIncrement, INTERVAL_BETWEEN_CHECKING_ACTIVITY)
  } else {
    resetIdleTimer()
  }
}
const resetIdleTimer = function () {
  clearTimeout(assumeIdleTimer)
  assumeIdleTimer = setTimeout(endIfInactive, ASSUME_IDLE_AFTER)
}
const endIfInactive = function () {
  // onsole.log('vulog endIfInactive')
  if (isActiveDoc()) { // document.hasFocus() || aVideoIsPlaying()
    continueTimerFromActivityDetection()
  } else {
    endTimer()
  }
}
const continueTimerFromActivityDetection = function () {
  // onsole.log('vulog continueTimerFromActivityDetection')
  if (currentUrlPurePath() !== parsedPage.props.purl) {
    startParse()
  } else if (!focusTimer.last_activity) {
    startTimer()
  } else if (focusTimer.vid_start && !aVideoIsPlaying()) { // video was playing but is no longer
    endTimer() // marks end to video
    startTimer()
  } else {
    if (new Date().getTime() - (focusTimer.lastRec || 0) > INTERVAL_BETWEEN_CHECKING_ACTIVITY) {
      recordInterval()
    }
    focusTimer.last_activity = new Date().getTime()
    resetIdleTimer()
  }
}
const recordFocusedIncrement = function () {
  // onsole.log('vulog recordFocusedIncrement')
  if (currentUrlPurePath() !== parsedPage.props.purl) {
    // site url has changed - restart
    clearInterval(focusedItervaler)
    startParse()
  } else if (focusTimer.vid_start && !aVideoIsPlaying()) { // video was playing but is no longer
    endTimer() // marks end to video
    startTimer()
  } else {
    resetIdleTimer()
    recordInterval()
    if (!isActiveDoc()) {
      if (focusedItervaler) clearInterval(focusedItervaler)
      // addreFocusListeners() consider adding if find bugs? make sure it doesnt trigger twice (nov23)
    }
  }
}
const recordInterval = function () {
  // onsole.log('vulog recordInterval')
  // todo - get new links  from page?
  const nowTime = new Date().getTime()
  focusTimer.lastRec = nowTime
  if (!focusTimer.vid_start && aVideoIsPlaying()) focusTimer.vid_start = nowTime
  if ((window.innerHeight + window.scrollY) > heightSpecs.max_scroll) {
    heightSpecs.max_scroll = window.scrollY + window.innerHeight
  }
  heightSpecs.doc_height = (document.getElementsByTagName('BODY') && document.getElementsByTagName('BODY')[0]) ? document.getElementsByTagName('BODY')[0].scrollHeight : 0
  heightSpecs.doc_height = Math.max(heightSpecs.doc_height, heightSpecs.max_scroll)
  const playingVideo = getPlayingVideo()
  if (playingVideo) {
    if (!playingVideo.currentSrc) playingVideo.currentSrc = playingVideo.getAttribute('src')
    let existingEntry = null
    if (vulogVids.length > 0) {
      vulogVids.forEach(video => {
        if (video.currentSrc === playingVideo.currentSrc) {
          existingEntry = video
          video.currentTime = playingVideo.currentTime
          video.latestTime = Math.max(video.latestTime || 0, playingVideo.currentTime)
        }
      });
    }
    if (!existingEntry) {
      const newVid = {
        baseURI: playingVideo.baseURI, 
        currentSrc: playingVideo.currentSrc, 
        currentTime: playingVideo.currentTime, 
        latestTime: playingVideo.currentTime, 
        duration: playingVideo.duration
      }
      vulogVids.push(newVid)
    }
  }
  // onsole.log('vulog sending msg updatepage', focusTimer, heightSpecs, vulogVids)

  chrome.runtime.sendMessage({ focusTimer: focusTimer, heightSpecs, vulogVids, purl: parsedPage.props.purl, msg: 'updatepage', props: parsedPage.props },
    function (resp) {
      if (resp && resp.error) console.warn('Error sending info to background ', parsedPage)
    }
  )
}
const endTimer = function () {
  // onsole.log("vulog endTimer")
  clearTimeout(assumeIdleTimer)
  if (focusedItervaler) clearInterval(focusedItervaler)
  focusTimer.end = new Date().getTime()
  focusTimer.last_activity = null
  focusTimer.lastRec = null
  addreFocusListeners()

  chrome.runtime.sendMessage({ focusTimer: focusTimer, heightSpecs: heightSpecs, purl: parsedPage.props.purl, msg: 'updatepage', props: parsedPage.props },
    function (resp) {
      if (resp && resp.error) console.warn('Error sending info to background ', parsedPage)
    }
  )
}
// INACTIVITY See (www.kirupa.com/html5/detecting_if_the_user_is_idle_or_inactive.htm)
const addreFocusListeners = function () {
  document.addEventListener('mousemove', activityDetected, false)
  document.addEventListener('click', activityDetected, false)
  document.addEventListener('keydown', activityDetected, false)
  document.addEventListener('scroll', activityDetected, false)
}
const activityDetected = function (e) {
  // onsole.log('vulog activityDetected forceFocus ', 'forceFocus ', ' hasfocus?'+document.hasFocus()+' visibile?'+document.visibilityState+' - '+(new Date().toTimeString()),'focus ',document.hasFocus() )
  if (document.hasFocus()) {
    document.removeEventListener('mousemove', activityDetected, false)
    document.removeEventListener('click', activityDetected, false)
    document.removeEventListener('keydown', activityDetected, false)
    document.removeEventListener('scroll', activityDetected, false)
  }
  continueTimerFromActivityDetection()
}
const videoElementIsPlaying = function (videoEl) {
  return (videoEl.tagName === 'VIDEO' && videoEl.currentTime > 0 && !videoEl.paused && !videoEl.ended && videoEl.readyState > 2)
}

const isActiveDoc = function () {
  return (document.hasFocus() || aVideoIsPlaying())
}
const aVideoIsPlaying = function () { // assumes only one video is played at a time
  // return (document.querySelector('video') && !document.querySelector('video').pause)
  if (getPlayingVideo()) return true
  return false
  // const videos = document.querySelectorAll('video')
  // let aVideoIsPlaying = false
  // videos.forEach(video => { if (videoElementIsPlaying(video)) aVideoIsPlaying = true })
  // return aVideoIsPlaying
  // baseURI, currentSrc, currentTime, duration
}
const getPlayingVideo = function () { // assumes only one video is played at a time
  // return (document.querySelector('video') && !document.querySelector('video').pause)
  const videos = document.querySelectorAll('video')
  let playingVideo = null
  videos.forEach(video => { if (videoElementIsPlaying(video)) playingVideo = video })
  return playingVideo
  // baseURI, currentSrc, currentTime, duration
}

// Get Started
startParse()

// additional message receipts from popup

// refresh page...
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === 'refresh') { // done after highlight has been removed
    setTimeout(function () { window.location.reload(false) }, 50)
    sendResponse({ success: true })
  } else if (request.action === 'loadurl') { // done when pressing a mark on popup
    setTimeout(function () { window.open(request.url, '_self') }, 50)
  } else if (request.action === 'removeLocalStorage') { // done when pressing a mark on popup
    const nums = removeLocalStorage()
    sendResponse({ success: true, nums: nums })
  } else if (request.action === 'getUrlInfo') {
    console.warn('got request for info from backgrouns - send ing ', vulogOverlayGlobal.pageInfoFromPage )
    sendResponse({ pageInfoFromPage: parsedPage.props })
  } else {
    sendResponse({ success: false, error: 'unknown action'})
  }
})
const removeLocalStorage = function () {
  let nums = 0
  for (var x in localStorage) {
    if (localStorage.hasOwnProperty(x)) { localStorage.removeItem(x); nums++ }
  }
  return nums
}

const currentUrlPurePath = function () {
  //
  return pureUrlify(window.location.href)
}
