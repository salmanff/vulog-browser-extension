// Highligher FUNCTIONS from github.com/jeromepl/highlighter

"use strict";

var HIGHLIGHT_CLASS = 'VULOG--highlighter--highlighted';

var selection = window.getSelection();
var selectionString = selection.toString();

if (selectionString) { // If there is text selected

    var container = selection.getRangeAt(0).commonAncestorContainer;

    // Sometimes the element will only be text. Get the parent in that case
    // TODO: Is this really necessary?
    while (!container.innerHTML) {
        container = container.parentNode;
    }

    var color = "yellow"; // todo: Get from preferences
    //onsole.log("Vu-highlights storing...: ",selection," from ",window.location.pathname)
        let the_highlight = {
            h_date: new Date().getTime(),
            string: selection.toString(),
            container: getQuery(container),
            anchorNode: getQuery(selection.anchorNode, "anchorNode"), // start of selection
            anchorOffset: selection.anchorOffset,
            focusNode: getQuery(selection.focusNode, "focusnode"), // end of selection
            focusOffset: selection.focusOffset,
            color: color
        }
        chrome.runtime.sendMessage({purl:parsedPage.props.purl, highlight:the_highlight, msg:"newHighlight"},
          function(resp) {
            if (resp.error) console.warn("Error sending info to background ",parsedPage)
            highlight(selectionString, container, selection, color);
          }
        );
}


// From an DOM element, get a query to that DOM element
function getQuery(element,eltype) {
    if (element.id)
        return [{id:element.id}];
    if (element.localName == 'html')
        return [{'type':'html'}];

    var parent = element.parentNode;
    var parentSelector = getQuery(parent);

    let type = element.localName || 'text'
    // ..
    let realindex=-1, offset=0;
    while (parent.childNodes[++realindex] && parent.childNodes[realindex]!=element) {
      if (eltype && parent.childNodes[realindex].className==HIGHLIGHT_CLASS) {
        offset+=(parent.childNodes[realindex].previousSibling?2:1) //1 for the span and 1 for the next text element
      }
    }
    let index = (parent.childNodes[realindex]==element)? (realindex-offset):-1
    //if (index<0) console.warn("DID NOT find the getQuery")
    //let index = Array.prototype.indexOf.call(parent.childNodes, element);
    parentSelector.push({type,index})
    return parentSelector
}
