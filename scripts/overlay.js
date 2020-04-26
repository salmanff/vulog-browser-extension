

const vulog_overlay_global= {
  self_mark:null,
  redirect_mark:null,
  others_marks:null,
  shown_highlight:null,

  is_open:false,
  close: function () {
    vulog_overlay_global.is_open=false;
    if (document.getElementById('vulog_overlay_outer')) document.getElementById('vulog_overlay_outer').remove();
  },
  timer: null,
  extend_timer: function() {this.timer = setTimeout(this.close, 20000)},
  toggleMark: function (theStar, starWasChosen) {
    const thediv = document.getElementById('vulog_overlay_'+theStar+(starWasChosen?'_ch':'_nc'))
    if (thediv) {
      chrome.runtime.sendMessage({
          msg: "mark_star",
          purl:parsedPage.props.purl,
          id: (vulog_overlay_global.self_mark?vulog_overlay_global.self_mark._id:null),
          theStar:theStar,
          doAdd:!starWasChosen,
          publishChange:false,
          tabinfo:null
        }, function(response) {
        thediv.id=('vulog_overlay_'+theStar+(starWasChosen?'_nc':'_ch'))
      })
    } else {
      //onsole.log("not div means it's not chosen")
    }
  },
  copy_highs: function(){
    if (!vulog_overlay_global.self_mark.vulog_highlights)vulog_overlay_global.self_mark.vulog_highlights=[]
    vulog_overlay_global.redirect_mark.vulog_highlights.forEach(ahigh => vulog_overlay_global.self_mark.vulog_highlights.push(ahigh))
    chrome.runtime.sendMessage({purl:parsedPage.props.purl, highlights:vulog_overlay_global.redirect_mark.vulog_highlights, msg:"copyHighlights"},
      function(resp) {
        if (resp.error) console.warn("Error sending info to background ",parsedPage)
        else window.location.reload(false);
      }
    );
  }
}


const show_vulog_overlay = function (){
  vulog_overlay_global.extend_timer();
  vulog_overlay_global.is_open= true;
          //{purl:parsedPage.props.purl, msg:"getMarkFromVulog"}
  chrome.runtime.sendMessage({msg: "getMarkFromVulog", purl:parsedPage.props.purl, tabinfo:null}, function(response) {
    if (response.mark) {
      vulog_overlay_global.self_mark = response.mark;
      nowShowMarks()
    } else if (!response.haveFreezr){
      vulog_overlay_global.self_mark = {purl:parsedPage.props.purl};
      nowShowMarks()
    } else {
      vulog_overlay_global.self_mark = {purl:parsedPage.props.purl};
      nowShowMarks();
      chrome.runtime.sendMessage({msg: "getMarkOnlineInBg", purl:parsedPage.props.purl, tabinfo:null}, function(response) {})
      setTimeout(function(){
        chrome.runtime.sendMessage({msg: "getMarkFromVulog", purl:parsedPage.props.purl, tabinfo:null}, function(response) {
          if (response && response.mark) {
            vulog_overlay_global.self_mark = response.mark;
            nowShowMarks()
          }
        })
      },2000) // time for server to respond

    }

  })
  function nowShowMarks(){
    const vulog_toggle_overlay = function(e) {
      let parts = e.target.id.split('_')
      let theStar = parts[2]
      let starWasChosen = (parts[3]=="ch")
      vulog_overlay_global.toggleMark(theStar, starWasChosen)
    }

    const make_el = function(type, id, className, text) {
      let el = document.createElement(type);
      if (id) el.id=id;
      if (className) el.className = className;
      if (text) el.innerText = text
      return el
    }

    // Add overloay

    let overlay = make_el('div', "vulog_overlay_outer", null,  'vulog bookmarks')

    let adiv = null;
    let aspan = make_el ('span', "vulog_overlay_cross_ch")
    aspan.onclick = vulog_overlay_global.close
    overlay.appendChild(aspan)

    let stars = vulog_overlay_global.self_mark.vulog_mark_stars || [];
    const  MAIN_STARS = ["bookmark", "star", "inbox"]
    let stardiv = document.createElement('div');
    MAIN_STARS.forEach(aStar => {
      let adiv = make_el('div', ("vulog_overlay_"+aStar+(stars.includes(aStar)?"_ch":"_nc")), "vulog_overlay_stars")
      adiv.onclick = vulog_toggle_overlay
      stardiv.appendChild(adiv)
    });
    overlay.appendChild(stardiv)


    const vulog_overlay_text_listener = function (evt) {
      vulog_overlay_global.extend_timer()
      if ([13,27,9,32].includes(evt.keyCode) ) {
        if (evt.keyCode == 13) evt.preventDefault(); // return key
        vulog_overlay_saveNotesTags();
        if ([13,27].includes(evt.keyCode) || (evt.keyCode == 9 /*tab*/&& evt.target.id=='vulog_overlay_notes')) vulog_overlay_global.close() // return or escape key & tab if on notes
      } else {
        document.getElementById('vulog_overlay_savenotes').className='vulog_overlay_green';
      }
    }

    const vulog_overlay_saveNotesTags = function(){
      console.warn("to save note")
      var theNotes = document.getElementById("vulog_overlay_notes").textContent;
      var theTags = document.getElementById("vulog_overlay_tags").textContent.replace(/  /g,' ').trim().split(" ");
      if (theTags.length==1 && theTags[0]=='') theTags=[];
      vulog_overlay_global.self_mark.vulog_mark_notes = theNotes;
      vulog_overlay_global.self_mark.vulog_mark_tags = theTags;
      chrome.runtime.sendMessage({
          msg: "save_notes",
          purl: vulog_overlay_global.self_mark.purl,
          id: vulog_overlay_global.self_mark._id,
          notes:theNotes,
          tags:theTags,
          tabinfo:null
      }, function(response) {
        if (!response || response.error) console.warn("err"+(response? response.error: null))
        if (document.getElementById('vulog_overlay_savenotes')) document.getElementById('vulog_overlay_savenotes').className='vulog_overlay_grey';
      })
    }


    overlay.appendChild( make_el('div', null, 'vulog_overlay_titles', 'Tags') );

    adiv = make_el('div', "vulog_overlay_tags", 'vulog_overlay_input')
    adiv.setAttribute('contenteditable','true')
    adiv.onkeydown = vulog_overlay_text_listener;
    if (vulog_overlay_global.self_mark.vulog_mark_tags && vulog_overlay_global.self_mark.vulog_mark_tags.length>0) adiv.textContent = vulog_overlay_global.self_mark.vulog_mark_tags.join(" ");
    overlay.appendChild(adiv);

    overlay.appendChild(make_el('div', null, 'vulog_overlay_titles', 'Notes') );

    adiv = make_el('div', "vulog_overlay_notes", 'vulog_overlay_input')
    adiv.setAttribute('contenteditable','true')
    adiv.onkeydown = vulog_overlay_text_listener;
    if (vulog_overlay_global.self_mark.vulog_mark_notes && vulog_overlay_global.self_mark.vulog_mark_notes.trim().length>0) adiv.textContent = vulog_overlay_global.self_mark.vulog_mark_notes;
    overlay.appendChild(adiv);


    adiv = make_el('div', "vulog_overlay_savenotes", 'vulog_overlay_grey', "Save Notes and Tags")
    adiv.onclick=vulog_overlay_saveNotesTags
    overlay.appendChild(adiv);

    let self_highlights = (vulog_overlay_global.self_mark && vulog_overlay_global.self_mark.vulog_highlights && vulog_overlay_global.self_mark.vulog_highlights.length>0)?vulog_overlay_global.self_mark.vulog_highlights:null;
    let redirect_highlights = (vulog_overlay_global.redirect_mark && vulog_overlay_global.redirect_mark.vulog_highlights && vulog_overlay_global.redirect_mark.vulog_highlights.length>0)?vulog_overlay_global.redirect_mark.vulog_highlights:null;
    let has_highlights = (self_highlights || redirect_highlights)

    if (has_highlights) {

      let highlight_title = null
      if (vulog_overlay_global.shown_highlight == "self_mark")
        highlight_title = "Your higlights"
      else if (vulog_overlay_global.shown_highlight == "redirect_mark")
        highlight_title = "Highlights from "+vulog_overlay_global.redirect_mark._data_owner+" at server "+vulog_overlay_global.redirect_mark.host

      let theselect = make_el('div', null, null, highlight_title)
      theselect.style['font-size']='10px'
      theselect.style['margin-top']='10px'

      // add buttons
      if (redirect_highlights){

        let addhighs = make_el('div', null, 'vulog_overlay_butt', "Save Highlights")
        addhighs.onclick=function(){
          vulog_overlay_global.copy_highs();
        }
        theselect.appendChild( addhighs)

        let remhighs = make_el('div', null, 'vulog_overlay_butt', "Remove Highlights")
        remhighs.onclick=function(){
          chrome.runtime.sendMessage({msg:"remove_redirect"}, function(response) {
            window.location.reload()
          })
        }
        theselect.appendChild(remhighs)

      } else {
        const make_radio =  function(id, label ,attrs) {
          let outer = make_el('div')
          let input = make_el('input', id)
          let highlightcolor = (attrs.value=='hide'?null :(attrs.value=='reshow_redirect'? 'yellow': 'yellowgreen'))
          Object.keys(attrs).forEach(key => { input.setAttribute(key, attrs[key]) } );
          input.onchange= function () {setHighlightsToColor(highlightcolor)},
          outer.appendChild(input)
          let innerlabel = make_el('label', null, null, label)
          innerlabel.setAttribute('for',attrs['value'])
          outer.appendChild(innerlabel)
          return outer
        }
        theselect.appendChild(make_radio('vulog_h_self', "Show", {value:'reshow_self',name:'show_h',type:'radio',checked:true } ))
        theselect.appendChild(make_radio('vulog_h_none', "Hide", {value:'hide',name:'show_h',type:'radio' } ))
      }

      overlay.appendChild(theselect)

    }

    document.body.appendChild(overlay)
    if (!redirect_highlights) document.getElementById('vulog_overlay_tags').focus()

  }
}

document.addEventListener('keydown', function (e) {
  if (!vulog_overlay_global.is_open && (e.ctrlKey || e.metaKey) && e.keyCode==83) { // SHOW DIALOGUE
		e.preventDefault();
    show_vulog_overlay();
  } else if ((e.ctrlKey || e.metaKey) && vulog_overlay_global.is_open && [66,73,83].includes(e.keyCode)) {
    e.preventDefault()
    vulog_overlay_global.extend_timer();
    let theStar = ["bookmark","inbox","star"][ [66,73,83].indexOf(e.keyCode) ]
    vulog_overlay_global.toggleMark (theStar, false)
  } else if (vulog_overlay_global.is_open && e.keyCode==27) {
    vulog_overlay_global.close()
  }
});
