// background.js - 20220705 checked - iosApp only => Only used for ios Safari extension

/* global chrome, browser  */

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // ios initialisation
  // onsole.log('in background', { request })
  const url = request.url // todo - ned to change requests with purl to pnes with url only and convert afetewards

  if (request.msg === 'changeHlightColor') {
    // onsole.log('got a changeHlightColor - send back purl and data', { request })
    const hColor = request.hColor
    const hlightId = request.hlightId
    sendResponse({ success: 'probably' })
    browser.runtime.sendNativeMessage('changeHlightColor', {
      message: 'changeHlightColor', url, hlightId, hColor
    }, function (response) {
      // onsole.log({ response })
    })
  } else if (request.msg === 'newPageInfo') {
    // onsole.log('got a new page - send back purl and data')
    sendResponse({ url: request.url, test: 'yes' })
    
    browser.runtime.sendNativeMessage('newPageInfo', {
      message: 'newPageInfo', url, pageInfoFromPage: request.pageInfoFromPage
    }, function (response) {
      // setTimeout(function () {
      const jsonMark = JSON.parse(response.jsonMark)
      // onsole.log({ jsonMark })
      setTimeout(function () {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'newPageInfo', msg: 'got previous marks', mark: jsonMark, url }, function (response) {
            // onsole.log('back from sending newPageInfo ', response)
          })
        })
      }, 10)
      // }, 15000)
    })

    //
  } else if (request.msg === 'newHighlight') {
    // onsole.log('got a newHighlight - send back purl and data', { request })
    const hlightIdentifier = request.hlightIdentifier

    browser.runtime.sendNativeMessage('newHighlight', {
      message: 'newHighlight', url, pageInfoFromPage: request.pageInfoFromPage, hlightIdentifier: request.hlightIdentifier, highlight: request.highlight
    }, function (response) {
      // onsole.log(response)
      const jsonMark = JSON.parse(response.jsonMark)
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'highlightRecorded', msg: 'highlight is recorded', hlightIdentifier, url }, function (response) {
          // onsole.log('back from sending highlightRecorded ', response)
        })
      })
    })
    // sendResponse({ purl });
  } else if (request.msg === 'addHLightComment') {
    const comment = request.comment
    const hlightId = request.hlightId
    browser.runtime.sendNativeMessage('addHLightComment', {
      message: 'addHLightComment', url, hlightId, comment
    }, function (response) {
      // onsole.log({ response })
    })
  } else if (request.msg === 'hlightDisplayErr') {
    const hlightId = request.hlightId
    browser.runtime.sendNativeMessage('hlightDisplayErr', {
      message: 'hlightDisplayErr', url, hlightId
    }, function (response) {
      // onsole.log({ response })
    })
  } else if (request.msg === 'setHColor') {
    sendResponse({ success: 'todo later' })
  } else if (request.msg === 'removeHighlight') {
    const hlightId = request.hlightId
    browser.runtime.sendNativeMessage('removeHighlight', {
      message: 'removeHighlight', url, hlightId
    }, function (response) {
        // onsole.log({ response })
    })
  // } else if (request.msg === 'marksDisplayErrs') {
  //   const displayErrs = request.display_errs
  //   browser.runtime.sendNativeMessage('marksDisplayErrs', {
  //     message: 'marksDisplayErrs', url, displayErrs: displayErrs
  //   }, function (response) {
  //   })
  }
})

