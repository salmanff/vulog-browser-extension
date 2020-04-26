
/*
    background.js
    info.freezr.vulog - chrome app for browser view history and book marking
    version 0.0.2 - march 2020

*/

freezr_app_version = "0.0.2";
freezr_app_name="info.freezr.vulog";
freezr_app_display_name="Vulog";

freezr.app.isWebBased = false;

var sync_timer=null, syncinprogress=false, logs_details_in_RAM={}, page_in_RAM = null;

const SYNC_INTERVAL = 20*1000 // idle time before sync
const ICON_PATHS = {
  norm: '../static/vulog_logo_48.png',
  paused: '../static/vulog_closed_48.png',
  red: '../static/vulog_redeye_48.png'
}
console.log("re-initializing vulog")
chrome.storage.local.getBytesInUse(['vulogCopy'], function(bytes){console.log("Used bytes: "+bytes)})

let vulog = new jlos("vulog", {'saver':'nosave','numItemsToFetchOnStart':50});
// Get locally stored copy of vulog from chrome local storage
chrome.storage.local.get("vulogCopy", function (items) {
    if (items && items.vulogCopy && !isEmpty(items.vulogCopy)) {
      vulog.data = items.vulogCopy;
    } else  {
      //onsole.log("initiating vulog");
      vulog.data ={
          'freezr_user_id': null, // user id
          'freezr_server_address':null, // used for offline usage
          'freezr_app_token': null, // used for offline usage
          'deleted_unbackedupdata':false,
          'logs': [],
          'marks':[],
          'fj_local_id_counter':1,
      }
    }
    //onsole.log("vulog is now "+JSON.stringify(vulog.data.logs.length));

    freezr_app_token = vulog.data.freezr_app_token;
    freezr_user_id = vulog.data.freezr_user_id;
    freezr_server_address= vulog.data.freezr_server_address;
    freezr_user_is_admin = vulog.data.freezr_user_is_admin;
})

// Highligher FUNCTIONS from github.com/jeromepl/highlighter
chrome.contextMenus.create({ title: "Highlight text (vulog)", onclick: highlightTextFromContext, contexts: ["selection"] });
//chrome.contextMenus.create({ title: "Add selected links to Inbox (vulog)", onclick: getLinksFromContext, contexts: ["selection"] });
chrome.contextMenus.create({ title: "Add to inbox (vulog)",  onclick: AddLinkToInboxFromContext, contexts: ["link"] });
function highlightTextFromContext() {
  chrome.tabs.executeScript({file: 'scripts/start_highlight.js'});
}
//function getLinksFromContext() {chrome.tabs.executeScript({file: 'scripts/links_from_highlight.js'});  }
function AddLinkToInboxFromContext(resp) {
  //onsole.log(resp)
  const purl = pureUrlify(resp.linkUrl)
  let current_mark = vulog.queryLatest('marks', {purl})
  if (current_mark) {
    if (!current_mark.vulog_mark_stars.includes('inbox')) current_mark.vulog_mark_stars.push('inbox')
    jlos_mark_changed(current_mark);
  } else {
    current_mark = {
      referrer:resp.pageUrl,
      vulog_mark_stars : ['inbox'],
      purl:purl,
      url:resp.linkUrl,
      vulog_timestamp : new Date().getTime(),
      vulog_sub_pages : [],
      domain_app : domainAppFromUrl(resp.linkUrl)
    }

    fetch(resp.linkUrl).then(function(response) {
        return (response.text());
      }).then(function(responseText) {
        let parsedResponse = (new window.DOMParser()).parseFromString(responseText, "text/html");
        let all_metas = parsedResponse.getElementsByTagName('meta')
        current_mark = addMetaTotags(current_mark,all_metas)
        current_mark = vulog.add('marks',current_mark)
      }, error => {
        console.error('Got error fetching data for inbox' + error.message);
        if (resp.selectionText) current_mark.title = resp.selectionText
        current_mark = vulog.add('marks',current_mark)
        console.warn(current_mark)
      });
  }
}

// savetochrome and timee and reducing size
let saveLater, lastSave=0;
const TIME_TO_SAVE_FROM_IDLE= 10000
const saveToChrome = function(forceSave, callFwd, from) {
  //onsole.log("SaveToChrome forceSave?"+forceSave+ "from "+from+" last Save "+(new Date(lastSave)).toTimeString() )

  if (!callFwd) callFwd = function() {}
  if (chrome.storage.local.QUOTA_BYTES <200000) reduceSize();
  var nowTime = new Date().getTime();
  if (forceSave || (nowTime - lastSave > TIME_TO_SAVE_FROM_IDLE)){
    lastSave = nowTime;
    const handleError = function(){
      console.warn("error on save")
      console.warn(chrome.runtime.lastError)
      window.clearTimeout(saveLater); saveLater= null;
      reduceSize();
      if (from!="fromerror") {
        saveToChrome(true, callFwd, "fromerror")
      } else {
        trySavingLater();
        callFwd({'success':false});
      }
    }
    try{
      chrome.storage.local.set({'vulogCopy':vulog.data}, function(){
        window.clearTimeout(saveLater); saveLater= null;
        callFwd({'success':true});
      });
    } catch(e) {
      handleError()
    }
  } else if (from!="savetochrome timer"){
    trySavingLater()
    callFwd({'success':'later'});
  }
}
const trySavingLater = function (){
  if (saveLater) clearTimeout(saveLater)
  saveLater = setTimeout(function() {saveToChrome(false,null,"savetochrome timer")},TIME_TO_SAVE_FROM_IDLE);
}
var reduceSize = function() {
  for (var i=0; i<Math.min(100,vulog.data.logs.length-1) ;i++){
    if (!(vulog.data.logs[i]._id && !vulog.data.logs[i].fj_modified_locally)){
      //onsole.log("deleted_unbackedupdata ",i," - ",vulog.data.logs[i])
      vulog.data.deleted_unbackedupdata= true;
    }
  }
  vulog.data.logs.splice(0,Math.min(100,vulog.data.logs.length-1) );
  if (sizeOfObject(vulog.data.marks) >3000000) {
    for (var i=0; i<Math.min(10,vulog.data.marks.length-1) ;i++){
      if (!(vulog.data.marks[i]._id && !vulog.data.marks[i].fj_modified_locally))
          vulog.data.deleted_unbackedupdata= true;
    }
    vulog.data.marks.splice(0,Math.min(10,vulog.data.logs.length-1) );
  }
  vulog.data.marks_data_size= sizeOfObject(vulog.data.marks);
}

chrome.windows.onRemoved.addListener(function(windowId){
  saveToChrome(true,null,"window closed");
});
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    let response = {};
    if (request && request.msg && request_api[request.msg]) {
      response = request_api[request.msg](request, sender, sendResponse)
    } else {
      sendResponse ({success:false, options:null})
      console.warn("Empty request - "+((request && request.msg)?request.msg:"No message"))
    }
    clearTimeout(sync_timer);
    sync_timer = setTimeout(trySyncing,SYNC_INTERVAL)
  }
);

var vulog_temp_device_id;
var trySyncing = function(callFwd) {
  //onsole.log("try syncing "+new Date())
  if (!callFwd) callFwd = console.log

  vulog.data.syncErr=null;
  if (vulog.data.freezr_server_address && !syncinprogress) {
    //onsole.log("will ping ")
    freezr.utils.ping(null, function(resp){
      // console 2019 - whgat is use of ping here?
      resp = freezr.utils.parse(resp);
      if (!vulog.data.deviceId) {
        vulog_temp_device_id = new Date().getTime();
        freezr.ceps.create (
          {'device': vulog_temp_device_id, 'ua':navigator.userAgent},
          {'collection': 'devices'},
          function(returnData) {
            returnData = freezr.utils.parse(returnData);
            if (returnData.error) {
              vulog.data.syncErr="error_writing_device";
              callFwd({error:returnData.error})
            } else {
              vulog.data.deviceId = vulog_temp_device_id;
              saveToChrome(true,function(){trySyncing(callFwd)},"deviceId write");
            }
          }
        )
      } else {
        vulog.data.syncErr = null;
        syncinprogress = true;
        if (vulog) {
          vulog.sync("logs", {'endCallBack':function(){checkMarks(callFwd)}, 'uploadedItemTransform':addDeviceId})
        } else {
          console.warn("vulog not defined")
          callFwd({error:"vulog not defined"});
        }
      }

    })
  } else if (!syncinprogress) {
    callFwd({error:"You are not logged into a personal data store"});
  }
}
var addDeviceId = function(anItem) {
  if (!anItem) {console.warn("ERROR - NO ITEM to add deviceId to"); anItem={}}
  anItem.vulog_deviceId = vulog.data.deviceId;
  return anItem;
}
var checkMarks = function(callFwd) { // checks to make sure there are no conflicts
  let itemtocheck = null, idx=-1;
  vulog.data.marks.forEach((item, i) => {
    if (!item._id && !item.checked) {itemtocheck=item; idx=i}
  });
  if (!itemtocheck){

    syncMarks(callFwd)
  } else {
    //onsole.log("itemtocheck", itemtocheck)

    freezr.ceps.getquery({'collection':'marks', 'q':{'purl':itemtocheck.purl}}, function (returndata) {
      if (returndata.err || returndata.error) {
        console.warn("Could not connect to server to check marks conflict ",returndata)
        endofSync()
      } else if (!returndata || returndata.length==0){

        itemtocheck.checked=true;
        checkMarks(callFwd)
      } else {
        let online_item = returndata[0];

        online_item.vulog_mark_stars = addToListAsUniqueItems(online_item.vulog_mark_stars,itemtocheck.vulog_mark_stars)
        online_item.vulog_mark_tags =  addToListAsUniqueItems(online_item.vulog_mark_tags,itemtocheck.vulog_mark_tags)
        if (itemtocheck.vulog_mark_notes) online_item.vulog_mark_notes+= (" "+itemtocheck.vulog_mark_notes)
        online_item.vulog_highlights = online_item.vulog_highlights || []
        if (itemtocheck.vulog_highlights) online_item.vulog_highlights = [...online_item.vulog_highlights, ...itemtocheck.vulog_highlights]
        jlos_mark_changed(online_item)
        vulog.data.marks[idx] = online_item

        checkMarks(callFwd)
      }
    })
  }
}
var syncMarks = function(callFwd){
    vulog.sync("marks", {'endCallBack':function() {managePublishChange(callFwd)}});
}
var managePublishChange = function(callFwd){
  //onsole.log("managePublishChange - list now ",vulog.data.publishChange);
  if (!callFwd) callFwd = function(thing) {/*console.log(thing)*/}

  if (vulog.data.publishChange && vulog.data.publishChange.length>0) {
      var thePath = vulog.data.publishChange[vulog.data.publishChange.length-1];
      let current_mark = vulog.queryLatest('marks', {purl:thePath})
      var action = null;
      if (!current_mark) {
        console.warn("Couldnt find user mark in managePublishChange for path ", thePath," - mark may have bee removed by user.")
        vulog.data.publishChange.pop();
        // console - should send back an error message
        endofSync()
        callFwd({success:true})
      } else  if (!current_mark._id){
        console.warn("error  - need to be have synced item to publish")
        vulog.data.publishChange.pop();
          // console - should send back an error message
        endofSync()
        callFwd({error:"error  - need to be have synced item to publish"})
      } else {
        action = (current_mark.vulog_mark_stars.indexOf("bullhorn")>-1)?"grant":"deny"
        var options = { 'action': action, 'shared_with_group':'public', 'collection': 'marks'};
        freezr.perms.setObjectAccess('publish_favorites', current_mark._id, options, function (returndata) {
          if (returndata.issues && returndata.issues.length>0) console.warn("INTERNAL ERROR: "+returndata.issues)
          if (returndata.err || returndata.error) {
              console.warn("Error reaching freezr. Will sync later.")
              endofSync()
              callFwd({error:"Error reaching freezr. Will sync later."});
          } else {
            vulog.data.publishChange.pop();
            managePublishChange(callFwd);
          }
        })
      }
  } else {
    endofSync()
    callFwd({"success":"End of Sync after publishchanges"});
  }
}
var endofSync = function(){
  syncinprogress = false;
}


var request_api={}
// Getting New Page data and update page
request_api.newpage = function(request, sender, sendResponse) {
  let subPage = (request.props.purl!= pureUrlify(sender.tab.url) || request.props.isiframe) // some pages send themselves as sub iframes
  let success=true, iconpath
  const isPaused = vulog.data.pause_vulog
  if (!subPage) { // is master page
    console.log("ADDING new page on ",sender.tab.id,request.props)//,sender.tab,request.props)
    if (request.props.isiframe) console.warn("master page is iframe?")

    request.props.tabid = sender.tab.id;
    request.props.vulog_favIconUrl = sender.tab.favIconUrl
    request.props.vulog_ttl_time = 0;
    logs_details_in_RAM[sender.tab.id]= JSON.parse(JSON.stringify(request.props))
    page_in_RAM = logs_details_in_RAM[sender.tab.id]

    delete request.props.vulog_3rdParties;
    delete request.props.vulog_cookies;

    let current_mark = vulog.queryLatest('marks', {purl:request.props.purl})
    if (isPaused){
      iconpath = (current_mark? ICON_PATHS.red:ICON_PATHS.paused)
      sendResponse ({success:false})
    } else{
      iconpath = (current_mark? ICON_PATHS.red:ICON_PATHS.norm)

      let possible_master = get_master_page(sender.tab.id,request.props.purl);
      let time_from_last_load = possible_master? (new Date().getTime() - (possible_master.vulog_timestamp || 0)):null
      let create_new_log_record = (!possible_master || time_from_last_load > (24*60*60*1000)) //1 day
      if (create_new_log_record) vulog.add("logs", request.props)
    }

    chrome.browserAction.setIcon({path:iconpath , tabId: sender.tab.id}, function(){
      saveToChrome(false, null, "newpage");
    })
    sendResponse({success})
  } else {
    //onsole.log("added new subpage on "+sender.tab.id,sender.tab,request.props)
    //if (!request.props.isiframe) console.warn("subpage not iframe")
    page_in_RAM = logs_details_in_RAM[sender.tab.id];
    if (page_in_RAM && (page_in_RAM.purl==pureUrlify(sender.tab.url) || page_in_RAM.purl==pureUrlify(request.props.referrer) || page_in_RAM.purl==pureUrlify(sender.tab.pendingUrl))) {
      request.props.vulog_visits = [request.props.vulog_timestamp]
      page_in_RAM.vulog_sub_pages = add_nonduplicate_object(page_in_RAM.vulog_sub_pages,request.props,['vulog_timestamp','vulog_visits'], true)
      page_in_RAM.vulog_sub_cookies = addToListAsUniqueItems(page_in_RAM.vulog_sub_cookies, request.props.vulog_cookies )
      if (!page_in_RAM.vulog_3rdParties) page_in_RAM.vulog_3rdParties = {js:[] , img:[]}
      if (request.props.vulog_3rdParties && request.props.vulog_3rdParties.js)
        page_in_RAM.vulog_3rdParties.js = addToListAsUniqueItems(page_in_RAM.vulog_3rdParties.js, request.props.vulog_3rdParties.js )
      if (request.props.vulog_3rdParties && request.props.vulog_3rdParties.img)
        page_in_RAM.vulog_3rdParties.img = addToListAsUniqueItems(page_in_RAM.vulog_3rdParties.img, request.props.vulog_3rdParties.img )
    page_in_RAM.vulog_hidden_subcees = (page_in_RAM.vulog_hidden_subcees || 0) + (request.props.vulog_hidden_cees? 1:0)
      sendResponse({success});
    } else if (!request.secondtry){
      request.secondtry=true
      setTimeout(function() {request_api.newpage(request, sender, sendResponse)},2000);
    } else {
      if (page_in_RAM)
        console.warn("MISMATCH of purl on currentpage in RAM",page_in_RAM," and send tab:",sender.tab )
      else if (!['chrome://newtab/'].includes(sender.tab.url))
        console.warn("COULD NOT FIND MASTER PAGE for "+sender.tab.url)
      sendResponse({success:false});
    }
  }
}
request_api.updatepage = function(request, sender, sendResponse) {
  page_in_RAM = logs_details_in_RAM[sender.tab.id];
  let subPage =  page_in_RAM? (page_in_RAM.purl != request.purl) : /* or if cant fund page */(!request.props.hasBody || request.props.isiframe)
  //onsole.log("vulog.data.pause_vulog",vulog.data.pause_vulog,'subPage',subPage)
  if (!vulog.data.pause_vulog && !subPage){
    let master_page = get_master_page(sender.tab.id, request.purl)
    //onsole.log("Got UPDATE master_page "+sender.tab, master_page,request.focus_timer)
    if (master_page) {
      master_page.vulog_visit_details = add_visit_details(master_page.vulog_visit_details, request.focus_timer, sender.tab.id)
      master_page.vuLog_height = request.height_specs.doc_height
      master_page.vulog_max_scroll = request.height_specs.max_scroll
      if (request.focus_timer.vid_start) master_page.vulog_vidview = true
      master_page.fj_modified_locally = new Date().getTime()
      saveToChrome(false, null, "updatepage") ;
      sendResponse ({success:true})
    } else {
      console.warn("LOST MASTER PAGE "+sender.tab.id,request.props)
      sendResponse ({success:false})
    }
  } else {
    //onsole.log('sub opage update  on subpage',page_in_RAM,request)
    if (page_in_RAM && page_in_RAM.purl==pureUrlify(sender.tab.url)) {
      // Add vukog_3rd_parties too
      request.props.vulog_visits = [request.props.vulog_timestamp]
      page_in_RAM.vulog_sub_pages = add_nonduplicate_object(page_in_RAM.vulog_sub_pages,request.props,['vulog_timestamp','vulog_visits'], true)
      page_in_RAM.vulog_sub_cookies = addToListAsUniqueItems(page_in_RAM.vulog_sub_cookies, request.props.vulog_cookies )
      page_in_RAM.vulog_hidden_subcees = (page_in_RAM.vulog_hidden_subcees || 0) + (request.props.vulog_hidden_cees? 1:0)
      sendResponse({success:true});
    } else {
      console.warn("Ignoring subpage ON UPDATE "+sender.tab.id, request.props, sender.tab)
    }
    sendResponse ({success:false})
  } // else is paused
}
request_api.searchLocally = function(request, sender, sendResponse) {
  /*
  var query_params = {
      words   : ((searchTerms && searchTerms.length>0)? searchTerms.split(" "):[]),
      skip    : search_state.itemsfetched,
      list
      star_filters
      count   : search_state.more_items
  }
  */
  //onsole.log("searchLocally",request.list, request.query_params )
  let theList = vulog.data[request.list], params = request.query_params
  if (!theList) theList =[]
  let results = [], aLog = null;
  let current_item = theList.length;
  let foundcounter=0;

  while (--current_item>=0 && results.length<params.count) {
      aLog = theList[current_item];
      if (!aLog.fj_deleted && aLog.url) {
          if (params.words && params.words.length>0) {
              var gotHit = true;
              for (j=0;j<params.words.length;j++) {
                if (typeof aLog.vulog_kword2=="string") {
                  console.warn("aLog stillhas string keyword",aLog) // tem,p bug fix
                  aLog.vulog_kword2 =aLog.vulog_kword2.split(' ')
                }
                if (gotHit &&
                    (   aLog.vulog_kword2 &&
                        aLog.vulog_kword2.length>0 &&
                        aLog.vulog_kword2.join(' ').toLowerCase().indexOf(params.words[j])>=0
                    )
                  ) {
                    gotHit = true;
                } else {gotHit = false;}
              }
          } else if (!params.words || params.words.length==0){
            gotHit = true;
          }
          if (gotHit &&  params.star_filters && !wordsInList1InList2(params.star_filters, aLog.vulog_mark_stars)) gotHit=false;
          //onsole.log("filters",params.star_filters,' existing stars:', aLog.vulog_mark_stars,' 1in2?',wordsInList1InList2(params.star_filters, aLog.vulog_mark_stars))

          if (gotHit && ++foundcounter > params.skip) {results.push(aLog);}
      }
  }
  //onsole.log("results")
  //onsole.log(results)

  sendResponse( {success:true, results:results, nomore: (current_item<=0)} )
    // ie {success:true, results:results, nomore: current_item==0}
}
request_api.trySyncing = function (request, sender, sendResponse) {
  //
  trySyncing(sendResponse)
}

function wordsInList1InList2 (requiredWords, wordsToCheck) {
    var tempret=true;
    if (!requiredWords || requiredWords.length==0) return true;
    if (!wordsToCheck || wordsToCheck.length==0) return false;
    requiredWords.forEach(function(aWord) {if (aWord!=" " && wordsToCheck && wordsToCheck.indexOf(aWord)<0) tempret = false });
    return tempret;
}
function add_visit_details(current_details=[], new_time, tab) {
  let last_time = current_details[current_details.length-1]
  if (!last_time || last_time.start != new_time.start) { // last_time.end added for clarity (redundant)
    current_details.push(new_time)
  } else {
    if (new_time.end) last_time.end = new_time.end;
    if (new_time.mid) last_time.mid = new_time.mid;
    if (new_time.vid_start) last_time.vid_start = new_time.vid_start;
  }
  return current_details
}

function get_master_page (tabid, purl) {
    let params = {'tabid':tabid}
    if (purl != undefined) params.purl=purl
    return vulog.queryLatest("logs", params)
}

// pop up APIs
request_api.getPageData = function(request, sender, sendResponse) {
  let success = true, current_log, current_mark;
  let details = {
    pause_vulog     : vulog.data.pause_vulog  || false,
    syncErr         : vulog.data.syncErr || false,
    deleted_unbackedupdata : vulog.data.deleted_unbackedupdata  || false,
    marks_data_size : vulog.data.marks_data_size  || null,
    num_logs: vulog.data.logs.length,
    num_marks: vulog.data.marks.length,

    freezr_app_token : vulog.data.freezr_app_token || null,
    freezr_user_id  : vulog.data.freezr_user_id || null,
    freezr_server_address : vulog.data.freezr_server_address || null,
    freezr_user_is_admin  : vulog.data.freezr_user_is_admin  || null,

    gotBullHornPublicWarning : vulog.data.gotBullHornPublicWarning,

  };
  vulog.data.deleted_unbackedupdata=false;
  if (request.purl) {
    let master_page = vulog.queryLatest("logs", {purl:request.purl});
    if (request.tabinfo && request.tabinfo.tabid && logs_details_in_RAM[request.tabinfo.tabid] && logs_details_in_RAM[request.tabinfo.tabid].purl==request.purl) {
      details.current_log = logs_details_in_RAM[request.tabinfo.tabid]
      details.current_log.vulog_visit_details = master_page.vulog_visit_details // RAM has cookie details and master_page has visit details
    } else {
      console.warn("NO log from logs_details_in_RAM - got from vulog")
      details.current_log= master_page
    }
    if (!details.current_log && request.tabinfo) details.current_log = convert_tabinfo_to_log(request.tabinfo)

    if (!details.current_log) console.warn("no tab info for getpagedata ",request, sender)
    details.current_mark = vulog.queryLatest("marks", {purl:request.purl})
    sendResponse ({details:details, success:true});
  } else {
    sendResponse({success:false})
  }
}

request_api.loggedin = function(request, sender,sendResponse) {
  if (request.freezrData){
    vulog.data.freezr_user_id = request.freezrData.freezr_user_id;
    vulog.data.freezr_app_token = request.freezrData.freezr_app_token;
    vulog.data.freezr_server_address = request.freezrData.freezr_server_address;
    vulog.data.freezr_server_version = request.freezrData.freezr_server_version;
    freezr_server_address = vulog.data.freezr_server_address;
    freezr_app_token = vulog.data.freezr_app_token;
    freezr_user_id = vulog.data.freezr_user_id;
    saveToChrome(true, null,  "loggedin") ;
    sendResponse({success: true})
  } else {
    sendResponse({success: false}) ;
  }
}
request_api.logged_out = function(request, sender,sendResponse) {
  vulog.removeSyncedFreezrInfo("logs");
  vulog.removeSyncedFreezrInfo("marks");
  vulog.data.offlineMarks = [];
  vulog.data.freezr_app_token = null;
  vulog.data.freezr_user_id = null;
  vulog.data.freezr_server_address = null;
  vulog.data.freezr_user_is_admin = null;
  vulog.data.last_server_sync_time = null;
  freezr_server_address = null;
  freezr_app_token = null;
  freezr_user_id = null;
  saveToChrome(true, null,  "logged_out") ;
  sendResponse({success: true})
}

request_api.pause = function(request, sender, sendResponse) {
  vulog.data.pause_vulog = true;
  chrome.tabs.query({},function(tabArray){
    if (tabArray && tabArray.length>0){
      tabArray.forEach(item => {

        chrome.browserAction.setIcon({path:ICON_PATHS.paused , tabId: item.tabId})
      });
    }
  })
  saveToChrome(false, null, "pause")
  sendResponse({success: true})
}
request_api.unpause = function(request, sender, sendResponse) {
  vulog.data.pause_vulog = false;
  chrome.tabs.query({},function(tabArray){
    if (tabArray && tabArray.length>0){
      tabArray.forEach(item => {

        chrome.browserAction.setIcon({path:ICON_PATHS.norm , tabId: item.tabId})
      });
    }
  })
  saveToChrome(true, null,  "unpause") ;
  sendResponse({success: true})
}
request_api.removeLocalData = function(request, sender, sendResponse) {
  vulog.data.logs=[];
  vulog.data.marks=[];
  vulog.data.offlineMarks = [];
  saveToChrome(true,null,"removeLocalData");
  sendResponse({success: true})
}
request_api.removeHistoryOnly = function(request, sender, sendResponse) {
  vulog.data.logs=[];
  saveToChrome(true,null,"removeHistoryOnly");
  sendResponse({success: true})
}
request_api.removeLocalItem = function(request, sender, sendResponse) {
  // assumes it is a log;
  //onsole.log("removeLocalItem",request)
  if (!request.list) request.list ='logs'
  if (!request.item || !request.item.purl) {
    sendResponse({success: false,error:'incorrect query - no purl'})
  } else {
    let thequery = {purl:request.item.purl}
    if (request.item._id) thequery._id = request.item._id;
    else if (request.item.fj_local_temp_unique_id) thequery.fj_local_temp_unique_id = request.item.fj_local_temp_unique_id;

    let [thelog, idx] = vulog.queryObjs(request.list, thequery, {getOne:true, getIndex:true})

    if (!thelog) {
      sendResponse({success: false,error:'item not found'})
    } else {
      if (thelog._id) {
        vulog.markDeleted(request.list, thelog._id)
      } else {
        vulog.data[request.list].splice(idx, 1)
      }
      let otherSimilar = vulog.queryObjs(request.list, {purl:request.item.purl})
      saveToChrome(true,null,"removeLocalItem");
      sendResponse({success: true, otherSimilar:otherSimilar})
    }
  }
}

// marks
const get_mark_or_log = function(purl, idcheck) {
  //onsole.log("finding purl",purl)
  current_mark = vulog.queryLatest('marks', {purl})
  if (!purl) {
    callback({error: new Error("Insufficient data was sent to do the operation")})
  } else if (current_mark) {
    if (idcheck && current_mark._id != idcheck && current_mark.fj_local_temp_unique_id!=idcheck) {
      return [{error:("wrong id "+idcheck+" vs "+current_mark._id)}]
    } else {
      return [null, current_mark]
    }
  } else {
    let logtomark = vulog.queryLatest('logs', {purl:purl})
    return [null, null, logtomark]
  }
}

const convert_tabinfo_to_log = function (tabinfo) {
  if (!tabinfo) return null
  // tabinfo should have purl, url and title
  tabinfo.isiframe = false
  tabinfo.vulog_timestamp = new Date().getTime()
  tabinfo.fj_modified_locally = new Date().getTime();
  tabinfo.vulog_sub_pages = []
  tabinfo.domain_app = tabinfo.url.split(':')[0]; // for 'file' or 'chrome'
  if (tabinfo.domain_app.indexOf('http')==0) tabinfo.domain_app = domainAppFromUrl(tabinfo.url)
  tabinfo.vulog_kword2 =  addToListAsUniqueItems(cleanTextForEasySearch( (tabinfo.url+" "+tabinfo.title).split(" ") ))

  return vulog.add('logs',tabinfo)
}
const convert_log_to_mark = function (logtomark) {
  let newmark = {vulog_mark_tags:[],vulog_highlights:[],vulog_mark_notes:'',vulog_mark_stars:[]}
  const ToTransfer = ['url','purl', 'description','domain_app','title','image','keywords', 'type', 'vulog_favIconUrl', 'vulog_kword2','vulog_timestamp']
  ToTransfer.forEach((item) => {
    if (logtomark[item]) {
      newmark[item] = JSON.parse(JSON.stringify(logtomark[item]));
    }
  });

  if (!newmark.purl) throw Error("trying to convert log to mark with no purl ",logtomark)
  return vulog.add('marks', newmark)
}
const handlepublicchange = function (current_mark){
  if (!vulog.data.publishChange) vulog.data.publishChange = [];
  vulog.data.gotBullHornPublicWarning = true;
  if (vulog.data.publishChange.indexOf(current_mark.purl)<0) {
    //onsole.log("adding to publishChange "+vulog.data.marks[current_marks_idx].purl)
    vulog.data.publishChange = addToListAsUniqueItems(vulog.data.publishChange,[current_mark.purl]);
  }
}
request_api.mark_star = function (request, sender, sendResponse) {
  /*         chrome.runtime.sendMessage({
              msg: "mark_star",
              purl: marks.current.purl || current_log.purl,
              id: marks.current._id || fj_local_temp_unique_id,
              theStar:theStar,
              doAdd:!starIsChosen,
              publishChange:(theStar == "bullhorn")
          },
  */
  //onsole.log(request)
  let iconpath
  let [err, current_mark, logtomark] = get_mark_or_log(request.purl, request.id)
  if (err) {
    console.warn(err)
    sendResponse({error:"Error getting marks. Please refresh the page to try again."})
  } else {
    iconpath = ICON_PATHS.red
    if (logtomark) current_mark = convert_log_to_mark(logtomark)
    if (request.doAdd) { //
      current_mark.vulog_mark_stars = add_nonduplicate_object(current_mark.vulog_mark_stars, request.theStar)
      jlos_mark_changed(current_mark)
    } else { // remove
      var starIdx = current_mark.vulog_mark_stars.indexOf(request.theStar);
      if (starIdx>-1) current_mark.vulog_mark_stars.splice(starIdx,1);
      if (hasNomarks(current_mark)) {
        iconpath = vulog.data.pause_vulog?ICON_PATHS.paused:ICON_PATHS.norm;
        vulog.markDeleted('marks', current_mark, {idType:'both'})
      } else {
        jlos_mark_changed(current_mark)
      }
    }

    //onsole.log("current_mark now",current_mark)
    if (request.publishChange) handlepublicchange(current_mark);
    setTimeout(trySyncing,100)
    sendResponse ({success:true, current_mark:current_mark, logconverted:logtomark })
    if (request.tabinfo && request.tabinfo.tabid){ // ie marked from popup
      chrome.browserAction.setIcon({path:iconpath , tabId: request.tabinfo.tabid}, function(){})
    }
    saveToChrome(false, null, "mark_star")
  }
}
const hasNomarks = function (mark){
  return (
    (!mark.vulog_highlights || mark.vulog_highlights.length==0) &&
    (!mark.vulog_mark_tags || mark.vulog_mark_tags.length==0) &&
    (!mark.vulog_mark_stars || mark.vulog_mark_stars.length==0) &&
    (!mark.vulog_mark_notes || mark.vulog_mark_notes.length==0)
         )
}

request_api.save_notes = function (request, sender, sendResponse) {
  /*         chrome.runtime.sendMessage({
      msg: "save_notes",
      purl: marks.current.purl || current_log.purl,
      id: marks.current._id,
      notes:theNotes,
      tags:theTags
  }
  */

  let [err, current_mark, logtomark] = get_mark_or_log(request.purl, request.id)
  if (err) {
    console.warn(err)
    sendResponse({error:"error getting data - please try again"})
  } else {
    //onsole.log("logtomark",logtomark,"current_mark",current_mark)
    if (logtomark) current_mark = convert_log_to_mark(logtomark)
    current_mark.vulog_mark_notes=request.notes
    current_mark.vulog_mark_tags=(request.tags.length==1 && request.tags[0]=="")?[]:request.tags;
    setTimeout(trySyncing,100)
    let iconpath
    if (hasNomarks(current_mark)) {
      iconpath = vulog.data.pause_vulog?ICON_PATHS.paused:ICON_PATHS.norm;
      vulog.markDeleted('marks', current_mark, {idType:'both'})
    } else {
      iconpath = ICON_PATHS.red}

    sendResponse ({success:true, current_mark:current_mark, logconverted:logtomark })
    let tabId = (request.tabinfo && request.tabinfo.tabid)? request.tabinfo.tabid : ((sender && sender.tab.id)? sender.tab.id:null)
    //if (tabId)   (commented to see if errors occur... )
    chrome.browserAction.setIcon({path:iconpath , tabId: tabId}, function(){
      saveToChrome(false, null, "save_notes");
    })
  }
}

request_api.newHighlight = function (request, sender, sendResponse) {
  //chrome.runtime.sendMessage({purl:parsedPage.props.purl, highlight:the_highlight, msg:"newHighlight"}
  let [err, current_mark, logtomark] = get_mark_or_log(request.purl, request.id)
  if (err) {
    console.warn(err)
    sendResponse({error:"error getting online data - please try again"})
  } else {
    if (logtomark) current_mark = convert_log_to_mark(logtomark)
    if (!current_mark.vulog_highlights) current_mark.vulog_highlights = []
    current_mark.vulog_highlights.push(request.highlight);
    setTimeout(trySyncing,100)
    sendResponse ({success:true, current_mark:current_mark, logconverted:logtomark })
    let tabId = request.tabinfo?request.tabinfo.tabid:((sender.tab && sender.tab.id)?sender.tab.id:null )
    if (tabId) {chrome.browserAction.setIcon({path:ICON_PATHS.red , tabId: tabId}, function(){
        saveToChrome(false, null, "newHighlight");
      })
    }
  }
}

request_api.copyHighlights = function (request, sender, sendResponse) {
  //chrome.runtime.sendMessage({purl:parsedPage.props.purl, highlights:vulog_overlay_global.redirect_mark.vulog_highlights, msg:"copyHighlights"},
  let [err, current_mark, logtomark] = get_mark_or_log(request.purl)
  if (err) {
    console.warn(err)
    sendResponse({error:"error getting online data - please try again"})
  } else {
    if (logtomark) current_mark = convert_log_to_mark(logtomark)
    if (!current_mark.vulog_highlights) current_mark.vulog_highlights = []
    request.highlights.forEach(ahigh => current_mark.vulog_highlights.push(ahigh));
    setTimeout(trySyncing,100)
    sendResponse ({success:true, current_mark:current_mark, logconverted:logtomark })
    let tabId = request.tabinfo?request.tabinfo.tabid:((sender.tab && sender.tab.id)?sender.tab.id:null )
    if (tabId) {chrome.browserAction.setIcon({path:ICON_PATHS.red , tabId: tabId}, function(){
        saveToChrome(false, null, "copyHighlights");
      })
    }
    redirect_item[sender.tab.id] = null;
  }
}

request_api.deleteHighlight = function (request, sender, sendResponse) {
  //msg: "deleteHighlight", purl:marks.current.purl , h_date:h_date
  let [err, current_mark, logtomark] = get_mark_or_log(request.purl, null)
  let success = false, iconpath
  if (err || !current_mark) {
    console.warn(err)
    sendResponse({error:"Could not retrieve mark on deleteHighlight"})
  } else {
    for (let i = current_mark.vulog_highlights.length-1; i>=0; --i) {
      let ahighlight = current_mark.vulog_highlights[i]
      if (request.h_date == ahighlight.h_date) {
        current_mark.vulog_highlights.splice(i,1)
        success = true;
        i=-1;
      }
    }
    if (hasNomarks(current_mark)) {
      iconpath = vulog.data.pause_vulog?ICON_PATHS.paused:ICON_PATHS.norm;
      vulog.markDeleted('marks', current_mark, {idType:'both'})
    } else {iconpath=ICON_PATHS.red}
    setTimeout(trySyncing,100)
    sendResponse ({success:true, current_mark:current_mark, logconverted:logtomark })
    saveToChrome(false, null, "deleteHighlight")
  }
}

request_api.getMarkFromVulog = function (request, sender, sendResponse) {
  //onsole.log("get mark for purl ",request.purl)
  //chrome.runtime.sendMessage({purl:parsedPage.props.purl, highlight:the_highlight, msg:"newHighlight"}
  let [err, current_mark, logtomark] = get_mark_or_log(request.purl, request.id)
  if (err) {
    console.warn(err)
    sendResponse({error:"error getting online data - please try again"})
  } else {
    let redirectedmark=null
    if (sender.tab && sender.tab.id && redirect_item && redirect_item[sender.tab.id]
        && request.purl == redirect_item[sender.tab.id].purl) {
      redirectedmark = redirect_item[sender.tab.id]
    }
    sendResponse ({success:true,mark:current_mark,redirectedmark:redirectedmark,haveFreezr:freezr_server_address})
  }
}
request_api.remove_redirect = function (request, sender, sendResponse) {
  redirect_item[sender.tab.id] = null;
  sendResponse ({success:true})
}
request_api.marksDisplayErrs = function (request, sender, sendResponse) {
  //chrome.runtime.sendMessage({purl:parsedPage.props.purl, msg:"marksDisplayErrs", display_errs:display_errs}
  //onsole.log("get mark for marksDisplayErrs purl ",request)
  current_mark = vulog.queryLatest('marks', {purl:request.purl})
  if (!current_mark) {
    sendResponse({error:"Could not get mark"})
  } else {
    request.display_errs.forEach(item => current_mark.vulog_highlights[item.idx].display_err=item.err)
    sendResponse({success:'updated mark',new_mark:current_mark})
  }
}
request_api.newOnlineMarks = function (request, sender, sendResponse) {
  //chrome.runtime.sendMessage({msg: "onlineMark", purl:purl, mark:returndata.results[0]}, function(response) {
  if (request.marks && request.marks.length>0) {
    request.marks.forEach((mark, i) => {
      mark_on_vulog = vulog.queryLatest('marks', {_id:mark._id})
      if (!mark_on_vulog ) vulog.data.marks.push(mark)
      vulog.data.marks.sort(sortBycreatedDate)
      sendResponse({success:true})
    });
  }
}
request_api.getMarkOnlineInBg = function (request, sender, sendResponse) {
  //chrome.runtime.sendMessage({msg: "onlineMark", purl:purl, mark:returndata.results[0]}, function(response) {
  freezr.ceps.getquery({'collection':'marks', 'q':{'purl':request.purl}}, function (returndata) {
    if (returndata.err || returndata.error) {
      console.warn("Could not connect to server to check marks for overlay ",returndata)
    } else if (returndata || returndata.length>0){
      vulog.data.marks.push(returndata[0])
      vulog.data.marks.sort(sortBycreatedDate)
    }
  })
  sendResponse({success:true})
}
function sortBycreatedDate(obj1,obj2) {
  //
  return getCreatedDate(obj1) - getCreatedDate(obj2);
}
function getCreatedDate(obj) {
  //onsole.log("getMaxLastModDate obj is "+JSON.stringify(obj));
  if (!obj) {
    return 0;
  } else if (obj._date_created){
    return obj._date_created;
  } else if (obj.fj_modified_locally){
    return obj.fj_modified_locally;
  } else {
    return 0; // error
  }
}

let redirect_item = {}
request_api.redirect = function (request, sender, sendResponse) {
  //chrome.runtime.sendMessage({msg: "redirect",  item: item }
  redirect_item[sender.tab.id] = request.item
  sendResponse({success:true})
}



// generics
function isEmpty(obj) {
  // stackoverflow.com/questions/4994201/is-object-empty
    if (obj == null) return true;
    if (Object.keys(obj).length > 0)    return false;
    if (Object.keys(obj).length === 0)  return true;
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) return false;
    }
    return true;
}
function sizeOfObject(anObject) {
  return JSON.stringify(anObject).length
}
function add_nonduplicate_object(object_list, new_object, ignorekeys=[], uglyexception) {
  //onsole.log("add_nonduplicate_object",object_list,new_object)
  //if (!object_list || object_list.length==0) return new_object? [new_object]:[]
  if (!object_list || object_list.length==0) {
    return [new_object]
  }
  let dupl = list_has_object(object_list,new_object,ignorekeys)
  if (dupl) {
    if (uglyexception) dupl.vulog_visits.push(new_object.vulog_timestamp) // todo abstract away to add this to vulog_sub_pages
  } else {
    object_list.push(new_object)
  }
  return object_list;
}
function list_has_object(object_list, new_object,ignorekeys=[]){
  let is_duplicate = false;
  object_list.forEach(an_obj => {
    if (!is_duplicate && objectsaresame(an_obj, new_object, ignorekeys)) is_duplicate=an_obj
  });
  return is_duplicate;
}
function objectsaresame(obj1, obj2, ignorekeys=[],dolog=false) {
  if (typeof obj1 != typeof obj2) {
    return false
  }
  if (!obj1 || ["string","boolean","number" ].includes(typeof obj1)) return obj1===obj2

  let are_same = true
  for (let key in obj1) {
    if ((!ignorekeys.includes(key)) && !objectsaresame(obj1[key],obj2[key],[], false  )) { //(key=='vulog_cookies')
      are_same = false;
    }
    ignorekeys.push(key)
  }
  if (are_same){
    for (let key in obj2) {
      if ((!ignorekeys.includes(key)) && !objectsaresame(obj1[key],obj2[key],[])) {
        are_same = false;
      }
    }
  }
  return are_same
}
