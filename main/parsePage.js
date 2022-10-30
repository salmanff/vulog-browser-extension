/*
To review and delete unused parts (2022-10)
*/


// test if works
// get messages in background and add them to main record and calculate time
// add time to pop up and check time...
// collapse cookies
// Test if cookies and other params change mid field - do that in every x increments
// FIX connecting to freezr and pause
// Make sure Add marks works... and then history results and search

// Note document.focus is most reliable way to know if user has gone from focvus to Not being focused... but document.focus does not turn true reliably so activity detection is used

/* global VuPageData, chrome, HTMLMediaElement, localStorage , pureUrlify */

const INTERVAL_BETWEEN_CHECKING_ACTIVITY = 10000
const ASSUME_IDLE_AFTER = 30000
const TIME_TO_SEND_SUB_PAGE = 500
const TIME_TO_SEND_MAIN_PAGE = 10

let parsedPage = null
let focusTimer
let heightSpecs
let focusedItervaler
let assumeIdleTimer
const FOCUS_TIMERS_INIT = {
  start: null,
  mid: null,
  end: null
}
const HEIGHT_INIT = {
  doc_height: 0,
  max_scroll: 0
}

const startParse = function () {
  // Called on each new page to parse it - initiates keys based on page and sends to background
  // onsole.log('startparse started, ', new Date())
  parsedPage = new VuPageData()
  // onsole.log({parsedPage})

  if (!parsedPage.props.url) throw new Error('Deal with no url')
  // onsole.log('vulog parsedPage.props '+(parsedPage.props.hasBody? 'hasBody':'NOBODY NONODY')+document.getElementsByTagName('BODY')[0].scrollHeight)

  const isMainPage = (parsedPage.props.hasBody && !parsedPage.props.isiframe)
  const timeToSend = isMainPage ? TIME_TO_SEND_MAIN_PAGE : TIME_TO_SEND_SUB_PAGE
  focusTimer = Object.assign({}, FOCUS_TIMERS_INIT)
  heightSpecs = Object.assign({}, HEIGHT_INIT)
  setTimeout(function () {
    chrome.runtime.sendMessage({ props: parsedPage.props, msg: 'newpage' }, function (response) {
      if (document.hasFocus()) { startTimer() } else { addreFocusListeners() }
    })
  }, timeToSend)
}
const startTimer = function () {
  const nowTime = new Date().getTime()
  focusTimer.start = nowTime
  focusTimer.last_activity = nowTime
  if (videoIsPlaying()) {
    focusTimer.vid_start = nowTime
  } else if (focusTimer.vid_start) {
    delete focusTimer.vid_start
  }
  focusTimer.mid = null
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
  if (isActiveDoc()) {
    continueTimerFromActivityDetection()
  } else {
    endTimer()
  }
}
const continueTimerFromActivityDetection = function () {
  if (currentUrlPurePath() !== parsedPage.props.purl) {
    startParse()
  } else if (!focusTimer.last_activity) {
    startTimer()
  } else if (focusTimer.vid_start && !videoIsPlaying()) { // video was playing but is no longer
    endTimer() // marks end to video
    startTimer()
  } else {
    if (new Date().getTime() - focusTimer.last_activity > INTERVAL_BETWEEN_CHECKING_ACTIVITY) {
      recordInterval()
    }
    focusTimer.last_activity = new Date().getTime()
    resetIdleTimer()
  }
}
const isActiveDoc = function () {
  return (document.hasFocus() || videoIsPlaying())
}
const videoIsPlaying = function () {
  return (document.querySelector('video') && document.querySelector('video').playing)
}
const recordFocusedIncrement = function () {
  if (currentUrlPurePath() !== parsedPage.props.purl) {
    // site url has changed - restart
    clearInterval(focusedItervaler)
    startParse()
  } else if (focusTimer.vid_start && !videoIsPlaying()) { // video was playing but is no longer
    endTimer() // marks end to video
    startTimer()
  } else {
    if (!isActiveDoc()) {
      endTimer()
    } else {
      recordInterval()
    }
  }
}
const recordInterval = function () {
  // onsole.log('record mid interval')
  // todo - get new links  from page?
  const nowTime = new Date().getTime()
  focusTimer.mid = nowTime
  if (!focusTimer.vid_start && videoIsPlaying()) focusTimer.vid_start = nowTime
  if ((window.innerHeight + window.scrollY) > heightSpecs.max_scroll) {
    heightSpecs.max_scroll = window.scrollY + window.innerHeight
  }
  heightSpecs.doc_height = (document.getElementsByTagName('BODY') && document.getElementsByTagName('BODY')[0]) ? document.getElementsByTagName('BODY')[0].scrollHeight : 0
  heightSpecs.doc_height = Math.max(heightSpecs.doc_height, heightSpecs.max_scroll)
  // onsole.log('sending msg updatepage')

  chrome.runtime.sendMessage({ focusTimer: focusTimer, heightSpecs: heightSpecs, purl: parsedPage.props.purl, msg: 'updatepage', props: parsedPage.props },
    function (resp) {
      if (resp && resp.error) console.warn('Error sending info to background ', parsedPage)
    }
  )
}
const endTimer = function () {
  // onsole.log("endTimer")
  clearTimeout(assumeIdleTimer)
  if (focusedItervaler) clearInterval(focusedItervaler)
  focusTimer.end = new Date().getTime()
  focusTimer.last_activity = null
  focusTimer.mid = null
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
  // onsole.log('activityDetected hasfocus?'+document.hasFocus()+' visibile?'+document.visibilityState+' - '+(new Date().toTimeString()),'focus ',document.hasFocus() )
  if (document.hasFocus()) {
    document.removeEventListener('mousemove', activityDetected, false)
    document.removeEventListener('click', activityDetected, false)
    document.removeEventListener('keydown', activityDetected, false)
    document.removeEventListener('scroll', activityDetected, false)
  }
  continueTimerFromActivityDetection()
}

// from stackoverflow.com/questions/6877403/how-to-tell-if-a-video-element-is-currently-playing
Object.defineProperty(HTMLMediaElement.prototype, 'playing', {
  get: function () {
    return !!(this.currentTime > 0 && !this.paused && !this.ended && this.readyState > 2)
  }
})

// Get Started
startParse()

// additional message receipts from popup

// refresh page...
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  let nums
  if (request.action === 'refresh') { // done after highlight has been removed
    setTimeout(function () { window.location.reload(false) }, 50)
  } else if (request.action === 'loadurl') { // done when pressing a mark on popup
    setTimeout(function () { window.open(request.url, '_self') }, 50)
  } else if (request.action === 'removeLocalStorage') { // done when pressing a mark on popup
    nums = removeLocalStorage()
  }
  sendResponse({ success: true, nums: nums })
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
