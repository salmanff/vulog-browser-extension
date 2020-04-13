/*
    vuLog_popup.js
    info.freezr.vulog - chrome app for browser view history and book marking
    version 0.0.2 - march 2020


*/
// already defined in freezr_app_post_scripts
freezr_app_version = "0.0.104";
freezr_app_name = "info.freezr.vulog";
freezr_app_display_name = "Vulog - a CEPS compatible app";
const tab_open_time = new Date().getTime()
var freezr_app_token, freezr_user_id, freezr_server_address;

var recording_paused, warningTimeOut, errCommToBackground=false, gotBullHornPublicWarning = false;
var current_log
var tabinfo

chrome.tabs.query({active:true,currentWindow:true},function(tabArray){
  var purl;
  if (tabArray && tabArray.length>0 && tabArray[0].url){
    console.log(tabArray[0])
    purl = corePath(tabArray[0].url);
    tabinfo = {
      url: tabArray[0].url,
      purl: purl,
      title: tabArray[0].title,
      tabid: tabArray[0].id
    }
  } else {
    showWarning("Error trying to get information on the web page (2)");
  }
  if (!purl) {
    opentab('action')
    dg.el("userMarks_area").style.display="none";
    dg.el("thispage_title",{clear:true}).appendChild(dg.div("Could not get page info - no url available"))
  } else {
    setTimeout(function(){
      chrome.runtime.sendMessage({msg: "getPageData", purl:purl, tabinfo:tabinfo}, function(response) {
        console.log('getPageData',response)
        if (response && response.success) {
          current_log = response.details.current_log;
          marks.current = response.details.current_mark;
          freezr_app_token = response.details.freezr_app_token;
          freezr_user_id = response.details.freezr_user_id;
          freezr_server_address = response.details.freezr_server_address;
          freezr_user_is_admin = response.details.freezr_user_is_admin;
          gotBullHornPublicWarning = response.details.gotBullHornPublicWarning;
          recording_paused = response.details.pause_vulog;

          if (!freezr_app_token) dg.showEl('notloggedinmsg')
          if (response.details.syncErr) showWarning("There was an error syncing. ",response.details.syncErr);
          if (response.details.deleted_unbackedupdata)
            showWarning("Some of your logged items were deleted! Please do find a Personal Data Store to be able to keep mroe data, as the web browser doesnt have any more space.", 10000);
          if (response.details.marks_data_size && response.details.marks_data_size>1500000)
            showWarning("You have a large amount of marks (notes and highlights) - you really need to get a personal data store or risk losing these.", 10000);

          if (current_log) {
              dg.el("thisPage_details").appendChild(dg.div({style:{'margin-left':'15px'}},
                dg.div({style:{'font-size':'14px','font-weight':'bold','margin-left':'60px','margin-bottom':'5px'}},
                        (current_log.title? ((current_log.domain_app? current_log.domain_app:"file")+" - "+current_log.title): current_log.url)),
                history.draw_detail_header(current_log),
                history.draw_detailsdiv(current_log)
              ))
          } else{
              dg.el("thisPage_details",{clear:true}).appendChild(dg.div({className:"vulog_title  vulog_title_emph"},purl))
              dg.el("thisPage_details").appendChild(dg.div({style:{'margin-left':'75px','padding-top':'20px'}},"No meta-data available for this page."))
          }
          opentab('action')
          if (marks.current) {
            showCurrentUserMark();
          } else if (freezr_server_address) {
            freezr.ceps.getquery({'collection':'marks', 'q':{'purl':purl}},
              function (returndata) {
                if (returndata.err || returndata.error) {
                  showWarning("Could not connect to your data store to retrieve online marks. Your marks can be synced later.");
                } else if (!returndata || returndata.length==0){
                  marks.current={}
                } else {
                  marks.current = returndata[0];
                  showCurrentUserMark();
                  chrome.runtime.sendMessage({msg: "onlineMark", purl:purl, marks:returndata}, function(response) {
                    //onsole.log('updated online mark ',response)
                  })
                }
                opentab('action')
              }
            );
          }
        } else {
          opentab('action')
          dg.el("userMarks_area").style.display="none";
          dg.el("thispage_title",{clear:true}).appendChild(dg.div("Internal Error. Please refresh the page to try again"))
        }
      });
    },100);
  }
});
var opentab = function(tabName, options={}) {

	var alltabs=["action",'trackers',"history","marks","more"]
	alltabs.forEach (function(aTab) {
		document.getElementById(aTab+"_tab").style = "display:"+ (aTab==tabName? "block;":"none;")
		document.getElementById("click_gototab_"+aTab).className = "top_menu_item tm_"+(aTab==tabName? "opened":"closed");
	})

	if (tabName=="history") {
    if (dg.el('vulog_history_records').innerHTML=="") {
      history.clear_search()
    }
  } else if (tabName == "marks") {
    if (dg.el('vulog_marks_records').innerHTML=="") {
      marks.clear_search()
    }
  } else if (tabName == "more") {
    showPauseGraphics();
  } else if (tabName=="action") {
  } else if (tabName=="trackers") {
    if (options && options.source=='clicktab' && (!current_log || tab_open_time-current_log.vulog_timestamp<2000) ) {
      dg.el("tracker_main",{clear:true}).appendChild(dg.div({style:{'margin-left':'250px','margin-top':'100px'}},dg.img({src:"../freezrPublic/static/ajaxloaderBig.gif"})))
      setTimeout(function(){
        chrome.runtime.sendMessage({msg: "getPageData", purl:current_log.purl}, function(response) {
          if (response && response.success) {
            current_log = response.details.current_log;
            dg.el("tracker_main",{clear:true,top:true}).appendChild(showTrackers(current_log, true))
          } else {
            dg.el("tracker_main",{clear:true,top:true}).appendChild(dg.span("Error getting page info"))
          }
        })
      },2000)
    } else if (options && options.log) {
      dg.el("tracker_main",{clear:true,top:true}).appendChild(showTrackers(options.log, false))// see trackers.js
    } else {
      dg.el("tracker_main",{clear:true}).appendChild(showTrackers(current_log, true))// see trackers.js
    }
  }
}


// clicks
    document.addEventListener('click', function(e) {
        var elSects = e.target.id.split('_');
        if (elSects[0]== "click") {doClick(elSects)}
    }, false);
    var doClick = function (args) {
        switch(args[1]) {
            case 'pause':
                if (errCommToBackground){
                    showWarning("There has been an error communicating with background processses. please start again.")
                } else if (recording_paused) {
                    pause_vulog(false);
                } else {
                    pause_vulog(true);
                }
                break;
            case 'gototab':
                opentab(args[2],{source:'clicktab'});
                break;
            case 'search':
                if (args[2]=='history') history.doSearch();
                break;
            case 'removeLocalData':
                removeLocalData();
                break;
            case 'trySyncing':
                trySyncing();
                break;
            case 'markStar':
                toggleMainPageStar(args[2])
                break;
            case 'filterStar':
              marks.toggleFilterStar(args[2])
              break;
            case 'saveNotesTags':
                saveNotesTags();
                break;
            case 'closeWarnings':
                showWarning();
                break;
            default:
                 console.warn('undefined click ')
        }
    }
// keypress events
  document.getElementById('idSearchHistoryBox').onkeypress= function (evt) {
      if (evt.keyCode == 13 || evt.keyCode == 32) {
          if (evt.keyCode == 13) evt.preventDefault();
          history.doSearch();
      }
  }
  document.getElementById('idSearchMarksBox').onkeypress= function (evt) {
      if (evt.keyCode == 13 || evt.keyCode == 32) {
          if (evt.keyCode == 13) evt.preventDefault();
          //pop_historian.doSearch("marks");
      }
  }
  document.getElementById('idTagBox').onkeypress= function (evt) {
      if (evt.keyCode == 13 || evt.keyCode == 32) {
          if (evt.keyCode == 13) evt.preventDefault();
          saveNotesTags();
      } else {
          turnOnSaveButt();
      }
  }
  document.getElementById('idNotesBox').onkeypress= function (evt) {
      if (evt.keyCode == 13 || evt.keyCode == 32) {
          if (evt.keyCode == 13) evt.preventDefault();
          saveNotesTags();
      } else {
          turnOnSaveButt();
      }
  }
  var turnOffSaveButt = function () {
      document.getElementById("click_saveNotesTags_0").className = "history_xtra_butt unchosen-star"
  }
  var turnOnSaveButt = function () {
        document.getElementById("click_saveNotesTags_0").className = "history_xtra_butt chosen-star"
    }

// initialize freezr related
freezr.app.isWebBased = false;
freezr.app.loginCallback = function(jsonResp){
  if (jsonResp.error) {
		showWarning("Could not log you in - "+jsonResp.error,3000);
	} else if (!freezr_app_token) {
		showWarning("Please install vulog on your personal server and log in again.")
	} else {
      freezrData = {
          freezr_user_id : freezr_user_id,
          freezr_app_token : freezr_app_token,
          freezr_server_address : freezr_server_address,
          freezr_server_version : freezr_server_version
      }
      chrome.runtime.sendMessage({msg: "loggedin", freezrData:freezrData}, function(response) {
        if (response && response.success) {
          showWarning("Successful login")
          dg.hideEl('notloggedinmsg')
          freezr.ceps.getquery({'collection':'marks'}, function (returndata) {
            chrome.runtime.sendMessage({msg: "onlineMark", marks:returndata}, function(response) {
              console.log('todo - need to show marks on marks page... updated online marks ',response)
            })
          })
        } else {
          showWarning("Note : Logged in but failed to register credentials")
        }
      });
	}
}
freezr.app.logoutCallback = function(resp) {
    if (resp && resp.error) {
        showWarning("There was an error logging you out.")
    }
    chrome.runtime.sendMessage({msg: "logged_out"}, function(response) {
        if (!response || !response.success) {
            showWarning("Error trying to save logout information")
        } else {
            freezr_app_token = null;
            freezr_user_id = null;
            freezr_server_address= null;
            freezr.utils.freezrMenuClose();
            opentab("action");
            showWarning("You have been logged out, and your unsynced history has been kept locally. Go to 'More' to remove your data.")
        }
    });

}

// main messaging with background
var pause_vulog = function(doPause) {
  document.getElementById("click_pause_0").className = "";
  document.getElementById("click_pause_1").innerHTML = ". . . .";
  chrome.runtime.sendMessage({msg: (doPause? "pause":"unpause"), tabinfo:tabinfo}, function(response) {
    if (response.success) {
      recording_paused = doPause;
      showPauseGraphics();
    } else {
      showWarning("Error trying to pause.");
    }
  });
}
var removeLocalData = function() {
	chrome.runtime.sendMessage({msg: "removeLocalData", tabinfo:tabinfo}, function(response) {
		if (response.success) {
      showWarning("Local data removed.");
		} else {
			showWarning("Error trying to remove local data.");
		}
  });
}
var trySyncing = function() {
    chrome.runtime.sendMessage({msg: "trySyncing"}, function(response) {
        if (response && response.success) {
            opentab("history")
        } else {
          showWarning("Could not sync right now ");
        }
    });
}

// Marks
var showCurrentUserMark = function(){
    if (marks.current.vulog_mark_stars && marks.current.vulog_mark_stars.length>0) {
      marks.current.vulog_mark_stars.forEach(function(aStar) {
        var starDiv = document.getElementById("click_markStar_"+aStar+"_0")
        if (starDiv) starDiv.className = "fa fa-"+aStar+" stars chosen-star"
      })
    }
    if (marks.current.vulog_mark_notes) document.getElementById("idNotesBox").textContent = marks.current.vulog_mark_notes;
    if (marks.current.vulog_mark_tags) document.getElementById("idTagBox").textContent = marks.current.vulog_mark_tags.join(" ");
    if (marks.current.vulog_highlights && marks.current.vulog_highlights.length>0) {
      const h_area = dg.el("highlights_area",{show:true})
      h_area.appendChild(dg.div({style:{'font-weight':'bold'}},"Quotes (Highlights)"));
      marks.current.vulog_highlights.forEach((item, i) => h_area.appendChild(marks.drawHighlight(item, {include_delete:true, show_display_errs:true})));

    }
}
var toggleMainPageStar = function(theStar) {
    var starDiv = dg.el("click_markStar_"+theStar+"_0");
    var starIsChosen = (starDiv && starDiv.className.indexOf("unchosen")<0);
    var publishChange = (theStar == "bullhorn")
    if (!theStar || !starDiv) {
      showWarning("internal error - no stars",theStar)
    } else if (publishChange && !freezr_server_address) {
      showWarning("This button makes a link public. You have to be logged in to your personal server to be able to do this. (Press the button on the top right to log in to your server.)")
    } else {
      if (!publishChange || gotBullHornPublicWarning) {
        chrome.runtime.sendMessage({
            msg: "mark_star",
            purl:(marks.current? marks.current.purl:null )|| (current_log? current_log.purl:null),
            id: (marks.current?(marks.current._id || marks.current.fj_local_temp_unique_id):null),
            theStar:theStar,
            doAdd:!starIsChosen,
            publishChange:publishChange,
            tabinfo:tabinfo
        }, function(response) {
          if (!response || response.error) {
            showWarning((response? response.error: "Error saving mark."))
          } else {
            starDiv.className = "fa fa-"+theStar+" stars "+(starIsChosen? "unchosen-star":"chosen-star");
          }
        })
      } else {
        freezr.perms.getAllAppPermissions(function(resp) {
          let granted =false
          try {
            granted= resp['info.freezr.vulog']['thisAppToThisApp'][0].granted
            if (!granted) showWarning("Pressing the Bullhorn icon makes this link PUBLIC, but you have not yet granted permission to share your items with the public. You can do that by pressing the freezr button on the top right.")
            else {
              showWarning("Pressing the Bullhorn icon makes this link PUBLIC. Press again if you are sure you want to move ahead");
              gotBullHornPublicWarning=true;
            }
          } catch(e){
            showWarning("Pressing the Bullhorn icon makes this link PUBLIC. There was an error confirming permissions")
          }
          //onsole.log(granted, resp)

        })
      }
    }
}
var saveNotesTags = function() {
    var theNotes = document.getElementById("idNotesBox").textContent;
    var theTags = document.getElementById("idTagBox").textContent.replace(/  /g,' ').trim().split(" ");
    marks.current.vulog_mark_notes = theNotes;
    marks.current.vulog_mark_tags = theTags;
    chrome.runtime.sendMessage({
        msg: "save_notes",
        purl: marks.current.purl || current_log.purl,
        id: marks.current._id,
        notes:theNotes,
        tags:theTags,
        tabinfo:tabinfo
    }, function(response) {
      if (!response || response.error) showWarning((response? response.error: null))
        turnOffSaveButt();
    })
}

var showPauseGraphics = function() {
  document.getElementById("click_pause_0").className = "fa topBut_Mobile fa-"+(recording_paused? "play":"pause");
  document.getElementById("click_pause_1").innerHTML = (recording_paused? "resume logging":"pause logging &nbsp; ");
}
var showWarning = function(msg, timing) {
    console.log("WARNING : "+msg)
    // null msg clears the message
    if (warningTimeOut) clearTimeout(warningTimeOut);
    if (!msg) {
        dg.el("warning_outer").style.display="none"
        dg.el('warnings',{clear:true})
    } else {
        let new_warning = dg.div(
          {style:{border:'1px solid grey','border-radius':'3px', 'padding':'3px', 'margin':'3px'}})
          new_warning.innerHTML=msg
        dg.el('warnings').appendChild(new_warning)
        dg.el("warning_outer").style.display="block"
        if (timing) {setTimeout(function() {
          new_warning.remove();
          if (dg.el('warnings').innerText=="") dg.el("warning_outer").style.display="none"
        },timing) }
    }
}

// Generic functions
function listIdxByParams(thelist, param1, searchTerm1, param2, searchTerm2){
  var theItemNum=-1;
  if (thelist && thelist.length>0 && searchTerm1) {
    for (var i=thelist.length-1; i>=0; i--) {
      if (thelist[i] &&
            (   thelist[i][param1] == searchTerm1 ||
                (!thelist[i][param1] && !searchTerm1 )
            ) &&
            (!param2 ||
              thelist[i][param2] == searchTerm2 ||
              ( !thelist[i][param2] && !searchTerm2  ))
          ) {
        theItemNum = i;
        return theItemNum;
      }
    }
  }
  return theItemNum;
}
function isEmpty(obj) {
    // stackoverflow.com/questions/4994201/is-object-empty
    if (obj == null) return true;
    if (obj.length > 0)    return false;
    if (obj.length === 0)  return true;
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) return false;
    }
    return true;
}
var corePath = function(aUrl) {
  if (aUrl.indexOf('#')>0) aUrl = aUrl.slice(0,aUrl.indexOf('#'));
  //if (aUrl.indexOf('http://')== 0){ aUrl=aUrl.slice(7)} else if (aUrl.indexOf('https://')== 0) {aUrl=aUrl.slice(8)}
  if (aUrl.slice(-1)=="/") {aUrl = aUrl.slice(0,-1);}
  return aUrl.trim();
}
var addToListAsUnique = function(aList,anItem) {
  if (!anItem) {
    return aList
  } else if (!aList) {
    return [anItem]
  } else if (aList.indexOf(anItem) < 0) {
    aList.push(anItem);
  }
  return aList
}

freezr.utils.addFreezerDialogueElements();