// overlay.js - part of vulog

/* global chrome, parsedPage, setHighlightsToColor */

const vulogOverlayGlobal = {
  self_mark: null,
  redirect_mark: null,
  others_marks: null,
  shown_highlight: null,

  is_open: false,
  close: function () {
    vulogOverlayGlobal.is_open = false
    if (document.getElementById('vulog_overlay_outer')) document.getElementById('vulog_overlay_outer').remove()
  },
  timer: null,
  extend_timer: function () {
    clearTimeout(vulogOverlayGlobal.timer)
    vulogOverlayGlobal.timer = setTimeout(this.close, 20000)
  },
  toggleMark: function (theStar, starWasChosen) {
    vulogOverlayGlobal.extend_timer()
    const thediv = document.getElementById('vulog_overlay_' + theStar + (starWasChosen ? '_ch' : '_nc'))
    if (thediv) {
      chrome.runtime.sendMessage({
        msg: 'mark_star',
        purl: parsedPage.props.purl,
        id: (vulogOverlayGlobal.self_mark ? vulogOverlayGlobal.self_mark._id : null),
        theStar: theStar,
        doAdd: !starWasChosen,
        publishChange: false,
        tabinfo: null
      }, function (response) {
        thediv.id = ('vulog_overlay_' + theStar + (starWasChosen ? '_nc' : '_ch'))
      })
    } else {
      // onsole.log("not div means it's not chosen")
    }
  },
  copy_highs: function () {
    vulogOverlayGlobal.extend_timer()
    if (!vulogOverlayGlobal.self_mark.vulog_highlights)vulogOverlayGlobal.self_mark.vulog_highlights = []
    vulogOverlayGlobal.redirect_mark.vulog_highlights.forEach(ahigh => vulogOverlayGlobal.self_mark.vulog_highlights.push(ahigh))
    chrome.runtime.sendMessage({ purl: parsedPage.props.purl, highlights: vulogOverlayGlobal.redirect_mark.vulog_highlights, msg: 'copyHighlights' },
      function (resp) {
        if (resp.error) console.warn('Error sending info to background ', parsedPage)
        else window.location.reload(false)
      }
    )
  }
}

const showVulogOverlay = function () {
  vulogOverlayGlobal.extend_timer()
  vulogOverlayGlobal.is_open = true
  // {purl:parsedPage.props.purl, msg:"getMarkFromVulog"}
  chrome.runtime.sendMessage({ msg: 'getMarkFromVulog', purl: parsedPage.props.purl, tabinfo: null }, function (response) {
    if (response.mark) {
      vulogOverlayGlobal.self_mark = response.mark
      nowShowMarks()
    } else if (!response.haveFreezr) {
      vulogOverlayGlobal.self_mark = { purl: parsedPage.props.purl }
      nowShowMarks()
    } else {
      vulogOverlayGlobal.self_mark = { purl: parsedPage.props.purl }
      nowShowMarks()
      chrome.runtime.sendMessage({ msg: 'getMarkOnlineInBg', purl: parsedPage.props.purl, tabinfo: null }, function (response) {})
      setTimeout(function () {
        chrome.runtime.sendMessage({ msg: 'getMarkFromVulog', purl: parsedPage.props.purl, tabinfo: null }, function (response) {
          if (response && response.mark) {
            vulogOverlayGlobal.self_mark = response.mark
            nowShowMarks()
          }
        })
      }, 2000) // time for server to respond
    }
  })
  function nowShowMarks () {
    const vulogToggleOverlay = function (e) {
      var parts = e.target.id.split('_')
      const theStar = parts[2]
      const starWasChosen = (parts[3] === 'ch')
      vulogOverlayGlobal.toggleMark(theStar, starWasChosen)
    }

    const makeEl = function (type, id, className, text) {
      const el = document.createElement(type)
      if (id) el.id = id
      if (className) el.className = className
      if (text) el.innerText = text
      return el
    }

    // Add overloay
    var overlay = makeEl('div', 'vulog_overlay_outer', null, 'vulog bookmarks')

    let adiv = null
    var aspan = makeEl('span', 'vulog_overlay_cross_ch')
    aspan.onclick = vulogOverlayGlobal.close
    overlay.appendChild(aspan)

    var stars = vulogOverlayGlobal.self_mark.vulog_mark_stars || []
    const MAIN_STARS = ['bookmark', 'star', 'inbox', 'archive']
    var stardiv = document.createElement('div')
    MAIN_STARS.forEach(aStar => {
      var adiv = makeEl('div', ('vulog_overlay_' + aStar + (stars.includes(aStar) ? '_ch' : '_nc')), 'vulog_overlay_stars')
      adiv.onclick = vulogToggleOverlay
      stardiv.appendChild(adiv)
    })
    overlay.appendChild(stardiv)

    const vulogOverlayTextListener = function (evt) {
      vulogOverlayGlobal.extend_timer()
      if ([13, 27, 9, 32].includes(evt.keyCode)) {
        if (evt.keyCode === 13) evt.preventDefault() // return key
        vulogOverlaySaveNotesTags()
        if ([13, 27].includes(evt.keyCode) || (evt.keyCode === 9 /* tab */ && evt.target.id === 'vulog_overlay_notes')) vulogOverlayGlobal.close() // return or escape key & tab if on notes
      } else {
        document.getElementById('vulog_overlay_savenotes').className = 'vulog_overlay_green'
      }
    }

    const vulogOverlaySaveNotesTags = function () {
      vulogOverlayGlobal.extend_timer()
      var theNotes = document.getElementById('vulog_overlay_notes').textContent
      var theTags = document.getElementById('vulog_overlay_tags').textContent.replace(/ {2}/g, ' ').trim().split(' ')
      if (theTags.length === 1 && theTags[0] === '') theTags = []
      vulogOverlayGlobal.self_mark.vulog_mark_notes = theNotes
      vulogOverlayGlobal.self_mark.vulog_mark_tags = theTags
      chrome.runtime.sendMessage({
        msg: 'save_notes',
        purl: vulogOverlayGlobal.self_mark.purl,
        id: vulogOverlayGlobal.self_mark._id,
        notes: theNotes,
        tags: theTags,
        tabinfo: null
      }, function (response) {
        if (!response || response.error) console.warn('err' + (response ? response.error : null))
        if (document.getElementById('vulog_overlay_savenotes')) document.getElementById('vulog_overlay_savenotes').className = 'vulog_overlay_grey'
      })
    }

    overlay.appendChild(makeEl('div', null, 'vulog_overlay_titles', 'Tags'))

    adiv = makeEl('div', 'vulog_overlay_tags', 'vulog_overlay_input')
    adiv.setAttribute('contenteditable', 'true')
    adiv.onkeydown = vulogOverlayTextListener
    if (vulogOverlayGlobal.self_mark.vulog_mark_tags && vulogOverlayGlobal.self_mark.vulog_mark_tags.length > 0) adiv.textContent = vulogOverlayGlobal.self_mark.vulog_mark_tags.join(' ')
    overlay.appendChild(adiv)

    overlay.appendChild(makeEl('div', null, 'vulog_overlay_titles', 'Notes'))

    adiv = makeEl('div', 'vulog_overlay_notes', 'vulog_overlay_input')
    adiv.setAttribute('contenteditable', 'true')
    adiv.onkeydown = vulogOverlayTextListener
    if (vulogOverlayGlobal.self_mark.vulog_mark_notes && vulogOverlayGlobal.self_mark.vulog_mark_notes.trim().length > 0) adiv.textContent = vulogOverlayGlobal.self_mark.vulog_mark_notes
    overlay.appendChild(adiv)

    adiv = makeEl('div', 'vulog_overlay_savenotes', 'vulog_overlay_grey', 'Save Notes and Tags')
    adiv.onclick = vulogOverlaySaveNotesTags
    overlay.appendChild(adiv)

    const selfHighlights = (vulogOverlayGlobal.self_mark && vulogOverlayGlobal.self_mark.vulog_highlights && vulogOverlayGlobal.self_mark.vulog_highlights.length > 0) ? vulogOverlayGlobal.self_mark.vulog_highlights : null
    const redirectHighlights = (vulogOverlayGlobal.redirect_mark && vulogOverlayGlobal.redirect_mark.vulog_highlights && vulogOverlayGlobal.redirect_mark.vulog_highlights.length > 0) ? vulogOverlayGlobal.redirect_mark.vulog_highlights : null
    const hasHighlights = (selfHighlights || redirectHighlights)

    if (hasHighlights) {
      let highlightTitle = null
      if (vulogOverlayGlobal.shown_highlight === 'self_mark') {
        highlightTitle = 'Your higlights'
      } else if (vulogOverlayGlobal.shown_highlight === 'redirect_mark') {
        highlightTitle = 'Highlights from ' + vulogOverlayGlobal.redirect_mark._data_owner + ' at server ' + vulogOverlayGlobal.redirect_mark.host
      }
      var theselect = makeEl('div', null, null, highlightTitle)
      theselect.style['font-size'] = '10px'
      theselect.style['margin-top'] = '10px'

      // add buttons
      if (redirectHighlights) {
        var addhighs = makeEl('div', null, 'vulog_overlay_butt', 'Save Highlights')
        addhighs.onclick = function () {
          vulogOverlayGlobal.copy_highs()
        }
        theselect.appendChild(addhighs)

        var remhighs = makeEl('div', null, 'vulog_overlay_butt', 'Remove Highlights')
        remhighs.onclick = function () {
          chrome.runtime.sendMessage({ msg: 'remove_redirect' }, function (response) {
            window.location.reload()
          })
        }
        theselect.appendChild(remhighs)
      } else {
        const makeRadio = function (id, label, attrs) {
          var outer = makeEl('div')
          var input = makeEl('input', id)
          const highlightcolor = (attrs.value === 'hide' ? null : (attrs.value === 'reshow_redirect' ? 'yellow' : 'yellowgreen'))
          Object.keys(attrs).forEach(key => { input.setAttribute(key, attrs[key]) })
          input.onchange = function () { setHighlightsToColor(highlightcolor) }
          outer.appendChild(input)
          var innerlabel = makeEl('label', null, null, label)
          innerlabel.setAttribute('for', attrs.value)
          outer.appendChild(innerlabel)
          return outer
        }
        theselect.appendChild(makeRadio('vulog_h_self', 'Show', { value: 'reshow_self', name: 'show_h', type: 'radio', checked: true }))
        theselect.appendChild(makeRadio('vulog_h_none', 'Hide', { value: 'hide', name: 'show_h', type: 'radio' }))
      }

      overlay.appendChild(theselect)
    }

    document.body.appendChild(overlay)
    if (!redirectHighlights) document.getElementById('vulog_overlay_tags').focus()
  }
}

document.addEventListener('keydown', function (e) {
  if (!vulogOverlayGlobal.is_open && (e.ctrlKey || e.metaKey) && e.keyCode === 83) { // SHOW DIALOGUE
    e.preventDefault()
    showVulogOverlay()
  } else if ((e.ctrlKey || e.metaKey) && vulogOverlayGlobal.is_open && [65, 66, 73, 83].includes(e.keyCode)) {
    e.preventDefault()
    vulogOverlayGlobal.extend_timer()
    const theStar = ['bookmark', 'inbox', 'star', 'archive'][[66, 73, 83, 65].indexOf(e.keyCode)]
    vulogOverlayGlobal.toggleMark(theStar, false)
  } else if (vulogOverlayGlobal.is_open && e.keyCode === 27) {
    vulogOverlayGlobal.close()
  }
})
