
// version 0.0.2 - march 2020

let mark_search;
const MARK_SEARCH_STATE_INIT = {
  itemsfetched:0,
  last_words_searched:'',
  more_items:20,
  allresults:[],
  star_filters:[]
}
const MARK_DIV_ID = "vulog_marks_records"
const MCSS = {
  LIGHT_GREY: "rgb(151, 156, 160)"
}
const MAIN_STARS = ["bookmark", "star", "inbox", "bullhorn"]
const XTRA_STARS = ["tags","sticky-note","quote-left","quote-right"]

dg.addAttributeException('db_id')
dg.addAttributeException('fj_id')
dg.addAttributeException('purl')



var endsWith = function (longertext, checktext) {
  if (!longertext || !checktext || !(typeof longertext === 'string')|| !(typeof checktext === 'string')) {return false} else
  if (checktext.length > longertext.length) {return false} else {
  return (checktext == longertext.slice(longertext.length-checktext.length));}
}

var marks = {
  viewMode:(endsWith(window.location.pathname,'markInTab.html')? 'markInTab':'popup'),
  current:{},
  init_state: function(){
    //onsole.log("INIT STATE")
    const markdiv = dg.el(MARK_DIV_ID,{clear:true});
    mark_search = JSON.parse(JSON.stringify(MARK_SEARCH_STATE_INIT)) //Object.assign({},MARK_SEARCH_STATE_INIT)
  },
  clear_search: function() {
    this.init_state()
    MAIN_STARS.forEach(aStar => dg.el('click_filterStar_'+aStar+'_0').className = "fa fa-"+aStar+" stars unchosen-star");

    dg.el('idSearchMarksBox').textContent=''
    this.doSearch();
  },
  doSearch: function (reinit) {
    let searchTerms = this.removeSpacesEtc(dg.el('idSearchMarksBox').textContent).toLowerCase()
    if (mark_search.last_words_searched!=searchTerms || reinit) this.init_state();
    mark_search.last_words_searched=searchTerms;
    mark_search.star_filters = []
    MAIN_STARS.forEach(aStar => {if (dg.el('click_filterStar_'+aStar+'_0').className.includes(" chosen-star")) mark_search.star_filters.push(aStar)} );

    var query_params = {
        words   : ((searchTerms && searchTerms.length>0)? searchTerms.split(" "):[]),
        star_filters   : mark_search.star_filters,
        skip    : mark_search.itemsfetched,
        count   : mark_search.more_items,

    }
    console.log(query_params)
    chrome.runtime.sendMessage({msg: "searchLocally", list:"marks", query_params:query_params}, function(response) {
        //onsole.log('search repsonse ',response)
        if (!response || !response.success) {
            showWarning("Error trying to do backgroundLocalSearch");
        } else if (response.results.length>0 || mark_search.allresults.length ==0) {
          // {success:true, results:results, nomore: current_item==0}
          mark_search.allresults.push( response.results)
          mark_search.nomore = response.nomore
          mark_search.itemsfetched+= response.results.length
          dg.el(MARK_DIV_ID,{clear:true,top:true}).appendChild(marks.drawItems(response.results,mark_search.allresults.length, mark_search.nomore));
        }
    });
  },

  // draw marks
  drawItems : function (results, page, nomore) {
    let resultsdiv=dg.div(
      {style:{'margin-bottom':'20px','padding-left':'5px'}},
    )
    if (results && results.length>0){
      results.forEach(alog => {
        resultsdiv.appendChild(this.drawItem(alog))
      });
    }

    more_hist = dg.el('marks_more',{clear:true});
    if (mark_search.allresults.length>1) {
      more_hist.appendChild(dg.span("Pages:"))
      for (let i=0; i<mark_search.allresults.length; i++) {
        if (page==i) {
          more_hist.appendChild(dg.span(" .. "))
        } else {
          more_hist.appendChild(dg.span({
            style:{color:'cornflowerblue',cursor:'pointer','margin-right':'3px'},
            onclick:() => dg.el(MARK_DIV_ID,{clear:true,top:true}).appendChild(marks.drawItems(mark_search.allresults[i],i, nomore))
          },(" "+(i+1)+" ")))
        }
      }
      more_hist.appendChild(dg.span({style:{'margin-right':'20px'}},' '))
    }
    if (nomore) {
      more_hist.appendChild(dg.span({style:{'margin-left':'20px',color:MCSS.LIGHT_GREY}},' No more items stored locally'))
      if (false && freezr_app_token) {more_hist.appendChild(dg.span({style:{'margin-left':'20px',color:'cornflowerblue',cursor:'pointer'},
        onclick:function(){
          console.log("todo - find online")
        }
      },
      'Get more online items'))}
    } else {
      more_hist.appendChild(dg.span({
        style:{color:'cornflowerblue',cursor:'pointer','margin-left':'20px','padding-bottom':'20px'},
        onclick:function() {marks.doSearch()}
      },'More items'))
    }
    return resultsdiv

  },
  drawItem : function (alog) {
    let that=this;
    itemdiv=dg.div({style:{'margin-top':'10px'}})
    //onsole.log(alog)

    itemdiv.appendChild( dg.span(
      dg.span( // favicon
        //{style:{'max-width':'15px'}},
        dg.img({
          style:{
            'vertical-align': 'middle',
            width: '15px',
            height: '15px',
            'margin-left': '5px',
            'margin-right': '5px',
          },
          src:(alog.vulog_favIconUrl? alog.vulog_favIconUrl : (this.getdomain(alog.url)+"/favicon.ico")),
          onerror:function(){
            this.onerror = null;
            this.src= 'favicon_www.png';
          }
        })
      ),
      dg.span({
          style:{
            overflow: "hidden",
            "text-overflow": "ellipsis",
            'font-weight':'bold',
            'font-size': '14px',
            cursor: 'pointer',
            width: '500px',
            height: '18px',
            display: 'inline-block',
            'vertical-align': 'top',
          color:'darkgrey',
          },
          onclick: function(){
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
              //onsole.log("tabs[0].url",tabs[0].url)
              if (that.viewMode=='markInTab' || tabs[0].url.indexOf('chrome-extension')==0){
                let left = window.screenLeft != undefined ? window.screenLeft : window.screenX;
                let top = window.screenTop != undefined ? window.screenTop : window.screenY;
                let height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;
                that.urlwin = window.open(alog.url,"window","width=800, height="+height+",  left ="+(left+500)+", top="+top+"")//toolbar=0, menubar=0,
              }else{
                chrome.tabs.sendMessage(tabs[0].id, {action: 'loadurl',url:alog.url}, function(response) {
                  console.log("GOT ERROR ON RETIURN")
                  window.open(alog.purl,'_blank')
                });
              }
            });
          }
        },
        (alog.title? (alog.domain_app+" - "+alog.title): alog.url)
      )
    ))

    // Stars / top header
    let toptag = dg.div(
      {style:{'margin-left':'30px' } },
      dg.span({className:'fa-chevron-right hist_details_collapse',
              style:{cursor: 'pointer', color:(alog._id? "green":"cornflowerblue"),'padding-right':'10px'},
              onclick:function(evt) {
                const blocktotoggle = this.parentElement.nextSibling;
                var isExpanded = toggleCollapse(blocktotoggle);
                let arrow = evt.target.className.includes('fa-chevron')? evt.target:evt.target.firstChild;
                arrow.className =  isExpanded? ("fa-chevron-down hist_details_expanded"): ("fa-chevron-right  hist_details_collapse")
              }
      })
    )
    let topstars = [...XTRA_STARS, ...MAIN_STARS]
    let chosenstars = (alog.vulog_highlights && alog.vulog_highlights.length>0)? ["quote-left","quote-right"]:[]
    chosenstars = alog.vulog_mark_stars?[...chosenstars , ...alog.vulog_mark_stars]:chosenstars;
    if (alog.vulog_mark_tags && alog.vulog_mark_tags.length>0) chosenstars.push("tags")
    if (alog.vulog_mark_notes && alog.vulog_mark_notes.length>0) chosenstars.push("sticky-note")
    topstars.forEach(aStar => {
      let chosen = (chosenstars.includes(aStar))? "chosen":"unchosen";
      let changable = MAIN_STARS.includes(aStar)
      toptag.appendChild(dg.span({
        className: 'fa fa-'+aStar+' littlestars '+chosen+'-star',
        style:{cursor:(changable?'pointer':'cursor')},
        dgdata:changable,
        purl:((changable)?alog.purl:null),
        db_id:((changable && alog.id)?alog.id:null),
        fj_id:((changable && alog.fj_local_temp_unique_id)?alog.fj_local_temp_unique_id:null),
        onclick:function(e){
          if (aStar=='bullhorn' && (chosen=="unchosen")){
            showWarning("You can only publish an item from the 'Current' page."+(aStar._id?"":".. and you have to be logged into your Personal Data Store."))
          } else if (changable) {
            chrome.runtime.sendMessage({
                msg: "mark_star",
                purl: this.getAttribute('purl'),
                id: (this.getAttribute('db_id') || this.getAttribute('fj_id')),
                theStar:aStar,
                doAdd:(chosen=="unchosen"),
                publishChange:false
            }, function(response) {
              if (!response || response.error) {
                showWarning((response? response.error: "Error changing mark."))
              } else {
                chosen = ((chosen=="unchosen")?"chosen":"unchosen")
                e.target.className = 'fa fa-'+aStar+' littlestars '+(chosen)+'-star';
              }
            })
          }
        }
      }))
      if (aStar !="quote-left") toptag.appendChild(dg.span({style:{'margin-left':'10px'}}," "))
    })

    itemdiv.appendChild(toptag)
    let detailsdiv = dg.div({style:{
        'padding-left':'45px',
        height:'0px',
        overflow:'hidden',
        transition:'height 0.3s ease-out',
        width: '500px'
      }},
      dg.div({style:{'margin-top':'3px', color:'darkgray'}},
      dg.div({style:{'height':'16px','overflow':'hidden','text-overflow':'ellipsis'}},"url: ",dg.a({href:alog.purl,target:'_blank'},alog.purl)),
      dg.div("Created: "+ (new Date (alog.vulog_timestamp).toLocaleDateString() + " "+new Date (alog.vulog_timestamp).toLocaleTimeString() +" (Modified: "+(new Date (alog._date_modified || alog.fj_modified_locally).toLocaleDateString())+")" )),
      dg.div({style:{'height':'16px','overflow':'hidden','text-overflow':'ellipsis',display:(alog.referrer?'block':'none')}},
        "referrer: ",dg.a({href:alog.referrer,target:'_blank'},alog.referrer))
      )
    )

    if (alog.description) {
      detailsdiv.appendChild(dg.div(
        {style:{'margin-bottom':'3px', color:'darkgray'}},
        alog.description
      ))
    }
    if (alog.vulog_mark_tags && alog.vulog_mark_tags.length>0) {
      detailsdiv.appendChild(dg.div(
        {style:{'color':'darkgrey'}},
        "Tags: ",
        dg.span({style:{'color':'indianred','font-weight':'bold'}},(alog.vulog_mark_tags.join(", "))),
        "."
      ))
    }
    if (alog.vulog_mark_notes) {
      detailsdiv.appendChild(dg.div(
        {style:{'color':'darkgrey','margin-bottom':'3px'}},
        "Notes: ",
        dg.span(
        {style:{'color':'indianred','font-weight':'bold'}},
        alog.vulog_mark_notes)
      ))
    }
    if (alog.vulog_highlights && alog.vulog_highlights.length>0) {
      alog.vulog_highlights.forEach((item, i) => detailsdiv.appendChild(marks.drawHighlight(item, {include_delete:false, show_display_errs:false})));
    }

    itemdiv.appendChild(detailsdiv)

    return itemdiv


  },
  toggleFilterStar: function(theStar) {
      var starDiv = dg.el("click_filterStar_"+theStar+"_0");
      var starIsChosen = (starDiv && starDiv.className.indexOf("unchosen")<0);
      if (!theStar || !starDiv) {
          console.warn("Error - no stars")
          showWarning("internal error - no stars",theStar)
      } else {
        starDiv.className = "fa fa-"+theStar+" stars "+(starIsChosen?"un":"")+"chosen-star";
        this.init_state();
        marks.doSearch();
      }
  },

  // draw highlights
  drawHighlight: function(item, options) {
    let deleter = dg.div({}), display_err=dg.div({});
    if (options.include_delete) {
      deleter = dg.div({
        className:'del_quote',
        onclick:function(e) {
          let h_date = this.getAttribute('highlight-date')
          chrome.runtime.sendMessage({msg: "deleteHighlight", purl:marks.current.purl , h_date:h_date}, function(response) {
            if (!response || !response.success) {
              showWarning("Error trying to delete highlight ("+response.error+")");
            } else {
              chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {action: 'refresh'}, function(response) {
                  e.target.parentElement.style.color="indianred"
                  e.target.parentElement.style['margin-left']="30px";
                  e.target.parentElement.innerHTML=""
                });
              });
            }
          })
        },
        style:{display:'none'}}, "Click to remove quote")
      deleter.setAttribute('highlight-date', item.h_date)
    }
    if (options.show_display_errs && item.display_err) {
      display_err=dg.div({className:'quote_display_err'},
        'This quote was not found and so it is not highlighted on the page')
    }
    return dg.div({className:"quote_outer"},
      dg.span({className:"quote_left"}),
      dg.span({className:"quote_inner"},
        dg.span({style:{cursor:(options.include_delete?'pointer':'cursor')},ondblclick:function(e){
            if (options.include_delete) {
              e.target.style['color']=(e.target.style['color']=='yellow'?"white":"yellow")
              dg.toggleShow (e.target.parentElement.nextSibling.nextSibling)
            }
          }}, item.string
        ),
      display_err),
      dg.span({className:"quote_right"}),

      deleter
    )
  },

  // utilities
  removeSpacesEtc : function(aText) {
      aText = aText.replace(/&nbsp;/g," ").trim();
      aText = aText.replace(/\//g," ").trim();
      aText = aText.replace(/,/g," ").trim();
      aText = aText.replace(/\:/g," ").trim();
      aText = aText.replace(/\-/g," ").trim();
      aText = aText.replace(/\./g," ").trim();
      while (aText.indexOf("  ")>-1) {
          aText = aText.replace(/  /," ");
      }
      return aText.toLowerCase();
  },
  timeSpentify: function (aTime) {
      //
      return (Math.floor(aTime/60000)>0? (Math.floor(aTime/60000)+"mins" ):"" )+(Math.round((aTime%60000)/1000,0))+"s"
  },
  getdomain: function(aUrl) {
      if(!aUrl) return "Missing aUrl";
      var start = aUrl.indexOf("//")+2
      var stop = aUrl.slice(start).indexOf("/");
      return aUrl.slice(0,stop+start);
  }
}
