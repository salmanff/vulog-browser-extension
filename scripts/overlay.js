// overlay.js - part of vulog

/* global chrome, parsedPage, setHighlightsToColor */

const vulogOverlayGlobal = {
  self_mark: null,
  redirect_mark: null,
  others_marks: null,
  shown_highlight: null,
  edit_mode: false,
  currentHColor: 'green',

  is_open: false,
  close: function () {
    vulogOverlayGlobal.is_open = false
    if (document.getElementById('vulog_overlay_outer')) document.getElementById('vulog_overlay_outer').remove()
  },
  timer: null,
  extend_timer: function () {
    clearTimeout(vulogOverlayGlobal.timer)
    // vulogOverlayGlobal.timer = setTimeout(this.close, 20000)
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

const vulogutils = {
  makeEl: function (type, id, className, text) {
    const el = document.createElement(type)
    if (id) el.id = id
    if (className) el.className = className
    if (text) el.innerText = text
    return el
  }
}

const showVulogOverlay = function () {
  vulogOverlayGlobal.extend_timer()
  vulogOverlayGlobal.is_open = true
  // {purl:parsedPage.props.purl, msg:"getMarkFromVulog"}
  chrome.runtime.sendMessage({ msg: 'getMarkFromVulog', purl: parsedPage.props.purl, tabinfo: null }, function (response) {
    vulogOverlayGlobal.currentHColor = response.hcolor || 'green'
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

    // Add overloay
    var overlay = vulogutils.makeEl('div', 'vulog_overlay_outer', null, 'vulog bookmarks')

    let adiv = null
    var aspan = vulogutils.makeEl('span', 'vulog_overlay_cross_ch')
    aspan.onclick = vulogOverlayGlobal.close
    overlay.appendChild(aspan)

    var stars = vulogOverlayGlobal.self_mark.vulog_mark_stars || []
    const MAIN_STARS = ['star', 'inbox', 'archive']
    var stardiv = document.createElement('div')
    stardiv.style['text-align']='center'
    MAIN_STARS.forEach(aStar => {
      var adiv = vulogutils.makeEl('div', ('vulog_overlay_' + aStar + (stars.includes(aStar) ? '_ch' : '_nc')), 'vulog_overlay_stars')
      adiv.onclick = vulogToggleOverlay
      stardiv.appendChild(adiv)
    })
    overlay.appendChild(stardiv)


    // Add pallette
    const pallette_outer = vulogutils.makeEl('div')
    pallette_outer.appendChild(vulogutils.makeEl('div', '', 'vulog_overlay_titles', 'Highligher Pallette'))
    pallette_outer.appendChild(vulogutils.makeEl('div', 'vulog_overlay_palletteArea', '', ''))
    overlay.appendChild(pallette_outer)
    setTimeout(addPalleteeArea,5)

    // Add edit_mode
    overlay.appendChild(vulogutils.makeEl('div', null, 'vulog_overlay_titles', 'Edit mode'))
    var editModeArea = vulogutils.makeEl('div', 'vulog_overlay_editModeArea', null, null)
    editModeArea.style['margin-top'] = '-5px'
    overlay.appendChild(editModeArea)
    setTimeout(addEditModeButton,5)

    const vulogOverlayTextListener = function (evt) {
      vulogOverlayGlobal.extend_timer()
      //if (evt.keyCode === 13) evt.preventDefault() // return key
      vulogOverlaySaveNotesTags()
      //if ([13, 27].includes(evt.keyCode) || (evt.keyCode === 9 /* tab */ && evt.target.id === 'vulog_overlay_notes')) vulogOverlayGlobal.close() // return or escape key & tab if on notes
    }

    const vulogOverlaySaveNotesTags = function () {
      vulogOverlayGlobal.extend_timer()
      var theNotes = document.getElementById('vulog_overlay_notes').textContent
      vulogOverlayGlobal.self_mark.vulog_mark_notes = theNotes
      chrome.runtime.sendMessage({
        msg: 'save_notes',
        purl: vulogOverlayGlobal.self_mark.purl,
        id: vulogOverlayGlobal.self_mark._id,
        notes: theNotes,
        tabinfo: null
      }, function (response) {
        if (!response || response.error) console.warn('err' + (response ? response.error : null))
        if (document.getElementById('vulog_overlay_savenotes')) document.getElementById('vulog_overlay_savenotes').className = 'vulog_overlay_grey'
      })
    }

    overlay.appendChild(vulogutils.makeEl('div', null, 'vulog_overlay_titles', 'Notes'))

    adiv = vulogutils.makeEl('div', 'vulog_overlay_notes', 'vulog_overlay_input')
    adiv.style['min-height'] = '36px'
    adiv.style.cursor = 'text'
    adiv.setAttribute('contenteditable', 'true')

    var pasteAsText = function(evt) {
  		// for more details and improvements: stackoverflow.com/questions/12027137/javascript-trick-for-paste-as-plain-text-in-execcommand
  		evt.preventDefault();
  		var text = evt.clipboardData.getData("text/plain");
  	    document.execCommand("insertHTML", false, text);
  	};
  	adiv.onpaste= function(evt) {
      pasteAsText(evt)
      vulogOverlaySaveNotesTags()
    }

    adiv.onkeydown = vulogOverlayTextListener
    if (vulogOverlayGlobal.self_mark.vulog_mark_tags && vulogOverlayGlobal.self_mark.vulog_mark_tags.length > 0) adiv.textContent += vulogOverlayGlobal.self_mark.vulog_mark_tags.join(' ')
    if (vulogOverlayGlobal.self_mark.vulog_mark_notes && vulogOverlayGlobal.self_mark.vulog_mark_notes.trim().length > 0) adiv.textContent += vulogOverlayGlobal.self_mark.vulog_mark_notes
    overlay.appendChild(adiv)

    //adiv = vulogutils.makeEl('div', 'vulog_overlay_savenotes', 'vulog_overlay_grey', 'Save Notes ')
    //adiv.onclick = vulogOverlaySaveNotesTags
    //overlay.appendChild(adiv)

    const selfHighlights = (vulogOverlayGlobal.self_mark && vulogOverlayGlobal.self_mark.vulog_highlights && vulogOverlayGlobal.self_mark.vulog_highlights.length > 0) ? vulogOverlayGlobal.self_mark.vulog_highlights : null
    const redirectHighlights = (vulogOverlayGlobal.redirect_mark && vulogOverlayGlobal.redirect_mark.vulog_highlights && vulogOverlayGlobal.redirect_mark.vulog_highlights.length > 0) ? vulogOverlayGlobal.redirect_mark.vulog_highlights : null
    const hasHighlights = (selfHighlights || redirectHighlights)

    if (hasHighlights) {
      let highlightTitle = null
      if (vulogOverlayGlobal.shown_highlight === 'self_mark') {
        highlightTitle = 'Your highlights'
      } else if (vulogOverlayGlobal.shown_highlight === 'redirect_mark') {
        highlightTitle = 'Highlights from ' + vulogOverlayGlobal.redirect_mark._data_owner + ' at server ' + vulogOverlayGlobal.redirect_mark.host
      }
      var theselect = vulogutils.makeEl('div', null, null, highlightTitle)
      theselect.style['font-size'] = '10px'
      theselect.style['margin-top'] = '10px'

      // add buttons
      if (redirectHighlights) {
        var addhighs = vulogutils.makeEl('div', null, 'vulog_overlay_butt', 'Save Highlights')
        addhighs.onclick = function () {
          vulogOverlayGlobal.copy_highs()
        }
        theselect.appendChild(addhighs)

        var remhighs = vulogutils.makeEl('div', null, 'vulog_overlay_butt', 'Remove Highlights')
        remhighs.onclick = function () {
          chrome.runtime.sendMessage({ msg: 'remove_redirect' }, function (response) {
            window.location.reload()
          })
        }
        theselect.appendChild(remhighs)
      } else {
        const makeRadio = function (id, label, attrs) {
          var outer = vulogutils.makeEl('div')
          var input = vulogutils.makeEl('input', id)
          const highlightcolor = (attrs.value === 'hide' ? null : (attrs.value === 'reshow_redirect' ? 'yellow' : 'yellowgreen'))
          Object.keys(attrs).forEach(key => { input.setAttribute(key, attrs[key]) })
          input.onchange = function () { setHighlightsToColor(highlightcolor) }
          outer.appendChild(input)
          var innerlabel = vulogutils.makeEl('label', null, null, label)
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
    if (!redirectHighlights) document.getElementById('vulog_overlay_notes').focus()
  }
}

  // fix this

function addPalleteeArea () {
  const palletteModeArea = document.getElementById('vulog_overlay_palletteArea')
  palletteModeArea.innerHTML=''

  const COLOR_MAP = {
    'green' :'yellowgreen',
    'yellow' : 'yellow',
    'blue' : 'lightskyblue',
    'pink' : 'lightpink',
    'grey' : 'lightgrey',
    'orange' : 'lightsalmon',
    // 'u' : 'underline'
  }
  var setHColor = function (hcolor, cb) {
    chrome.runtime.sendMessage({ msg: 'setHColor', hcolor }, function (response) {
      vulogOverlayGlobal.currentHColor = hcolor
      addPalleteeArea()
      setCursorColor()
      cb(response)
    })
  }

  const colorTable = vulogutils.makeEl('div', null, 'vulog_colorAreaDiv', '')
  for (let [key, value] of Object.entries(COLOR_MAP)) {
    let colorChoice = vulogutils.makeEl('div', null, 'vulog_colorPalletteChoice', '')
    colorChoice.style['background-color'] = value;
    colorChoice.style.border = '2px solid '+(vulogOverlayGlobal.currentHColor==key? 'darkgrey' : 'white')
    colorChoice.onclick = function() {
      setHColor(key, addPalleteeArea)
    }
    colorTable.appendChild(colorChoice)
  }

  palletteModeArea.appendChild(colorTable)
}

function addEditModeButton(){
  const editModeArea = document.getElementById('vulog_overlay_editModeArea')
  if (editModeArea){
    editModeArea.innerHTML=''
    const modeButton = vulogOverlayGlobal.edit_mode?
      vulogutils.makeEl('div', null, 'vulog_overlay_butt', ' Back to Normal ') :
      vulogutils.makeEl('div', null, 'vulog_overlay_butt', ' Turn On Edit Mode ');
    modeButton.style['background-color'] = 'white'
    modeButton.onclick = toggleEditMode
    editModeArea.appendChild(modeButton)
  }
}

const toggleEditMode = function(){
  vulogOverlayGlobal.edit_mode = !vulogOverlayGlobal.edit_mode;
  addEditModeButton();
  setCursorColor();
  chrome.runtime.sendMessage({ msg: 'set_edit_mode', set: (vulogOverlayGlobal.edit_mode), purl: parsedPage.props.purl }, function (response) {
    //onsole.log(response)
  })
}

const setCursorColor = function (){
  // onsole.log(`url(${chrome.extension.getURL('images/cursor_'+'vulogOverlayGlobal.currentHColor'+'.png')}), auto`)
  const imageUrl = (`url(${chrome.extension.getURL('images/cursor_'+vulogOverlayGlobal.currentHColor+'.png')}), auto`)
  document.body.style.cursor = vulogOverlayGlobal.edit_mode? imageUrl : 'default';
  if (document.getElementById('vulog_overlay_notes')) document.getElementById('vulog_overlay_notes').style.cursor =  vulogOverlayGlobal.edit_mode? 'pointer':'cursor'
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

var vulogMouseDown = {left:0, top:0}
document.addEventListener('mousedown',function(evt) {
  vulogMouseDown = {left:evt.pageX,  top:evt.pageY}
})
document.addEventListener('mouseup',function(evt) {
  const pointsAreFarApart = function(p1, p2, dist) {
    //onsole.log({p1,p2},true, (Math.abs(p1.left-p2.left)>dist || Math.abs(p1.top-p2.top)>dist))
    if (!p1 || !p2) return false
    return (Math.abs(p1.left-p2.left)>dist || Math.abs(p1.top-p2.top)>dist)
  }
  const vulogMouseUp = {left:evt.pageX,  top:evt.pageY}

  if (vulogOverlayGlobal.edit_mode && pointsAreFarApart(vulogMouseDown, vulogMouseUp, 10) && document.getSelection() && document.getSelection().toString().length>0){
    highlightSelection();
  } else {
    // console.log('NOT executing select')
  }
})

document.addEventListener('click', function(evt) {
  if (vulogOverlayGlobal.edit_mode){
    const hrefNode = evt.target.tagName === 'A'? evt.target :
      (evt.target.parentElement && evt.target.parentElement.tagName && evt.target.parentElement.tagName === 'A')? evt.target.parentElement :
      null;
    if (hrefNode) {
      const theTarget = hrefNode.href
      const confirmDiv = vulogutils.makeEl('div', null, 'vulogAddToInboxConfirm', null)
      confirmDiv.style.width='150px'
      const addToInbox = vulogutils.makeEl('div', null, 'vulog_overlay_butt', 'Add to Inbox')
      addToInbox.onclick = function (evt){
        chrome.runtime.sendMessage({
            msg: "addStarFromOverlay",
            linkUrl: theTarget,
            referrer: location.href,
            theStar: 'inbox'
        }, function (response) {
          confirmDiv.innerHTML = 'Added to inbox'
          setTimeout(function(){if (confirmDiv) confirmDiv.remove()}, 5000)
        })
      }
      confirmDiv.appendChild(addToInbox)
      const gotoUrl = vulogutils.makeEl('div', null, 'vulog_overlay_butt', 'Open Url')
      gotoUrl.onclick = function (evt) { location.href = theTarget}
      confirmDiv.appendChild(gotoUrl)
      confirmDiv.style.top = (evt.pageY-30)+"px"
      confirmDiv.style.left = (10+evt.pageX)+"px"
      document.body.appendChild(confirmDiv)
      document.addEventListener('keydown', function (evt) {
        if (evt.keyCode === 27 /* escape */) confirmDiv.remove()
      })
      evt.preventDefault()
      setTimeout(function(){if (confirmDiv) confirmDiv.remove() }, 5000)

    }
  }
})

const highlightSelection = function() {
  var HIGHLIGHT_CLASS = 'VULOG--highlighter--highlighted'

  var selection = window.getSelection()
  var selectionString = selection.toString()

  if (selectionString) {
    // If there is text selected
    var container = selection.getRangeAt(0).commonAncestorContainer

    // Sometimes the element will only be text. Get the parent in that case
    // TODO: Is this really necessary?
    while (!container.innerHTML) {
      container = container.parentNode
    }

    // onsole.log("Vu-highlights storing...: ",selection," from ",window.location.pathname)
    const theHighlight = {
      h_date: new Date().getTime(),
      string: selection.toString(),
      container: getQuery(container),
      anchorNode: getQuery(selection.anchorNode, 'anchorNode'), // start of selection
      anchorOffset: selection.anchorOffset,
      focusNode: getQuery(selection.focusNode, 'focusnode'), // end of selection
      focusOffset: selection.focusOffset,
    }
    chrome.runtime.sendMessage({ purl: parsedPage.props.purl, highlight: theHighlight, msg: 'newHighlight' },
      function (resp) {
        if (!resp || resp.error) console.warn('Error sending info to background ', parsedPage, resp)

        let color = resp.color || 'yellowgreen' // todo: Get from preferences
        highlightFromSelection(selectionString, container, selection, color)
      }
    )
  }

  // From an DOM element, get a query to that DOM element
  function getQuery (element, eltype) {
    if (element.id) return [{ id: element.id }]
    if (element.localName === 'html') return [{ type: 'html' }]

    var parent = element.parentNode
    var parentSelector = getQuery(parent)

    const type = element.localName || 'text'
    // ..
    let realindex = -1
    let offset = 0
    while (parent.childNodes[++realindex] && parent.childNodes[realindex] !== element) {
      if (eltype && parent.childNodes[realindex].className === HIGHLIGHT_CLASS) {
        offset += (parent.childNodes[realindex].previousSibling ? 2 : 1) // 1 for the span and 1 for the next text element
      }
    }
    const index = (parent.childNodes[realindex] === element) ? (realindex - offset) : -1
    // if (index<0) console.warn("DID NOT find the getQuery")
    // let index = Array.prototype.indexOf.call(parent.childNodes, element);
    parentSelector.push({ type, index })
    return parentSelector
  }
}
