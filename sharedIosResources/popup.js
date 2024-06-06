// popup.js for safari extension

/* global chrome, browser */

var url
var mark

const noteDiv = document.getElementById('notes')
noteDiv.onkeydown = function (e) {
  scheduleSend()
}
// todo - onpaste schedule

let timer = null
const scheduleSend = function () {
  clearTimeout(timer)
  timer = setTimeout(function () {
    browser.runtime.sendNativeMessage('application.id', { message: 'noteChanges', notes: noteDiv.innerText, url }, function (response) {
      // onsole.log('got msg back', response)
      if (!response.success) {
        console.warn('Need to handle error todo')
      }
    })
  }, 2000)
}
noteDiv.onpaste = function (evt) {
  scheduleSend()
}

document.getElementById('mark_inbox').onclick = function (e) {
  toggleStar('inbox')
}
document.getElementById('mark_star').onclick = function (e) {
  toggleStar('star')
}

const toggleStar = function (star) {
  if (!url || !mark) {
    console.warn('need to show error')
  } else {
    const isCurrentlyMarked = mark.vStars.includes(star)
    browser.runtime.sendNativeMessage('application.id', { message: 'toggleStar', star, doMark: !isCurrentlyMarked, url }, function (response) {
      // onsole.log('got msg back', response)
      if (response.success) {
        const newColor = isCurrentlyMarked ? 'grey' : 'green'
        document.getElementById('mark_' + star).src = 'images/' + star + '_' + newColor + '.png'
      }
    })
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, function (tabArray) {
  // onsole.log('got tab array ' + tabArray)
  if (tabArray && tabArray.length > 0 && tabArray[0].url) {
    url = tabArray[0].url
    if (!browser || !browser.runtime || !browser.runtime.sendNativeMessage) {
      console.warn('do not have browser.runtime.sendNativeMessage')
    } else {
      browser.runtime.sendNativeMessage('application.id', { message: 'newPageInfo', url }, function (response) {
        // onsole.log('Received sendNativeMessage response:', response)
        mark = JSON.parse(response.jsonMark)
        if (mark.vNote && mark.vNote !== '') {
          noteDiv.innerText = mark.vNote
        }
        // setTimeout(function() {
        ['star', 'inbox'].forEach(star => {
          if (mark.vStars.includes(star)) {
            document.getElementById('mark_' + star).src = 'images/' + star + '_green.png'
          }
        })
        // },5000)
        document.getElementById('loader').style.display = 'none'
        document.getElementById('outer').style.display = 'block'
      })
    }
  }
})
