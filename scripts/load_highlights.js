// Highligher FUNCTIONS from github.com/jeromepl/highlighter

const show_highlights = function(){
  if (!parsedPage.props.isiframe){
    chrome.runtime.sendMessage({purl:parsedPage.props.purl, msg:"getMarks"}, function(response) {
  		//onsole.log(response)
  		if (response.error) {
  			console.warn(response.error)
  		} else if (response.mark && response.mark.vulog_highlights) {
        let display_errs=[];
  			response.mark.vulog_highlights.forEach((a_high, idx) => {
          //setTimeout(function(){load_highlights(a_high)},(10000*idx))
          if (!load_highlights(a_high)) display_errs.push({err:true, idx:idx});
          else if (a_high.display_err) display_errs.push({err:false, idx:idx})
        });
        if (display_errs.length>0) chrome.runtime.sendMessage({purl:parsedPage.props.purl, msg:"marksDisplayErrs", display_errs:display_errs}, function(response) {
          //onsole.log(response)
        })
  		}
  	});
  }
}

function load_highlights(highlightVal) {
    var selection = {
        anchorNode: elementFromQuery(highlightVal.anchorNode,"anchor",highlightVal.string),
        anchorOffset: highlightVal.anchorOffset,
        focusNode: elementFromQuery(highlightVal.focusNode,"focus",highlightVal.string),
        focusOffset: highlightVal.focusOffset
    };

    //onsole.log(selection)

    var selectionString = highlightVal.string;
    var container = elementFromQuery(highlightVal.container);
    var color = highlightVal.color;

    if (!selection.anchorNode || !selection.focusNode || !container) {
      console.warn("NO Anchor or focusNode...",selection)
        return false;
    } else {
        let success = highlight(selectionString, container, selection, color); // returns true on success or false on err
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
  show_highlights();
} else {
  document.addEventListener("DOMContentLoaded", show_highlights);
}


// refresh page...
chrome.runtime.onMessage.addListener( function(request, sender, sendResponse) {
  setTimeout(function(){window.location.reload(false)},50)
  sendResponse({success: true});
});
