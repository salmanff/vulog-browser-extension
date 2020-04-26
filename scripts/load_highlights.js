// Highligher FUNCTIONS from github.com/jeromepl/highlighter


const initiate_highlights = function(){
  if (!parsedPage.props.isiframe){
    chrome.runtime.sendMessage({purl:parsedPage.props.purl, msg:"getMarkFromVulog"}, function(response) {
  		//onsole.log(response)
      let showthis = null
  		if (!response || response.error) {
  			console.warn(response? response.error:"No response from vulog extension - internal error?")
  		} else {
        if (response.mark) {
          vulog_overlay_global.self_mark = response.mark
          showthis = 'self_mark'
        }
        if (response.redirectedmark) {
          vulog_overlay_global.redirect_mark = response.redirectedmark
          showthis = 'redirect_mark'
        }
      }
      let display_errs = show_highlights(showthis);
      if (display_errs.length>0){
        if (showthis == 'self_mark') {
          chrome.runtime.sendMessage({purl:parsedPage.props.purl, msg:"marksDisplayErrs", display_errs:display_errs}, function(response) {
            //onsole.log(response)
          })
        } else {
          console.warn(display_errs)
        }
      }
      if (response.redirectedmark) show_vulog_overlay()

  	});
  }
}
const show_highlights = function(showthis) {
  let display_errs=[], color = 'yellowgreen';
  if (showthis) {
    if (showthis == 'redirect_mark') color = 'yellow'
    if (vulog_overlay_global[showthis].vulog_highlights.length>0){
      let highlights = JSON.parse(JSON.stringify(vulog_overlay_global[showthis].vulog_highlights))
      highlights.forEach((a_high, idx) => {
        if (!load_highlights(a_high, color)) display_errs.push({err:true, idx:idx});
        else if (a_high.display_err) display_errs.push({err:false, idx:idx})
      });
      vulog_overlay_global.shown_highlight = showthis
    }
  }
  return display_errs
}

function load_highlights(highlightVal, color) {
    var selection = {
        anchorNode: elementFromQuery(highlightVal.anchorNode,"anchor",highlightVal.string),
        anchorOffset: highlightVal.anchorOffset,
        focusNode: elementFromQuery(highlightVal.focusNode,"focus",highlightVal.string),
        focusOffset: highlightVal.focusOffset
    };

    //onsole.log(selection)

    var selectionString = highlightVal.string;
    var container = elementFromQuery(highlightVal.container);

    if (!selection.anchorNode || !selection.focusNode || !container) {
      console.warn("NO Anchor or focusNode...",selection)
        return false;
    } else {
        let success = highlightFromSelection(selectionString, container, selection, color); // returns true on success or false on err
        if (!success) console.warn("could not load highlight ",selection)
        return success
    }
}
function elementFromQuery(storedQuery, eltype, thestring) {
  let last_node, aquery=storedQuery[0];
  if (!storedQuery || storedQuery.length==0) console.warn("NO Query sent")
  if (!storedQuery || storedQuery.length==0)
    return null
  else if (aquery.id)
    last_node = document.getElementById(aquery.id)
  else if (aquery.type == 'html')
    last_node = document.getElementsByTagName('html')[0]

  if (!last_node) console.warn("1 No First node found for ",storedQuery,thestring)

  storedQuery.shift()
  while (last_node && storedQuery.length>0){
    let current_child=-1;
    let target_child = storedQuery[0].index;
    while (current_child<target_child) {
      current_child++
      if (storedQuery.length==1){
        if (last_node.childNodes[current_child] && last_node.childNodes[current_child].className==HIGHLIGHT_CLASS) {
          target_child+=1
        } else if (last_node.childNodes[current_child] && last_node.childNodes[current_child].nextSibling && last_node.childNodes[current_child].nextSibling.className==HIGHLIGHT_CLASS) {
          target_child+=2; current_child++;
        }
      }
    }
    last_node = last_node.childNodes[current_child]

    // put while statement to traverse
    //last_node = last_node.childNodes[storedQuery[0].index]
    //onsole.log("last_node.localName "+(last_node? last_node.localName:"none"))
    if (!last_node || !( (last_node.localName===undefined && storedQuery[0].type=="text")
        || last_node.localName == storedQuery[0].type) ) console.warn("Got typemismatch on ",last_node,storedQuery[0])
    storedQuery.shift()
  }

  if (!last_node) console.warn("No First node found for "+eltype+" "+thestring,storedQuery)

  return last_node;

}

if (
    document.readyState === "complete" ||
    (document.readyState !== "loading" && !document.documentElement.doScroll)
) {
  initiate_highlights();
} else {
  document.addEventListener("DOMContentLoaded", initiate_highlights);
}


// refresh page...
chrome.runtime.onMessage.addListener( function(request, sender, sendResponse) {
  setTimeout(function(){window.location.reload(false)},50)
  sendResponse({success: true});
});
