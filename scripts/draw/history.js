
// version 0.0.2 - march 2020

var search_state;
const SEARCH_STATE_INIT = {
  itemsfetched:0,
  last_words_searched:'',
  more_items:20,
  allresults:[]
}
const HIST_DIV_ID = "vulog_history_records"
const CSS = {
  LIGHT_GREY: "rgb(151, 156, 160)"
}


const history = {
  init_state: function(){
    //onsole.log("INIT STATE")
    const historydiv = dg.el(HIST_DIV_ID,{clear:true});
    search_state = JSON.parse(JSON.stringify(SEARCH_STATE_INIT)) //Object.assign({},SEARCH_STATE_INIT)
  },
  clear_search: function() {
    this.init_state()
    dg.el('idSearchHistoryBox').textContent=''
    this.doSearch();
  },
  doSearch: function () {
    let searchTerms = this.removeSpaces(dg.el('idSearchHistoryBox').textContent).toLowerCase()
    if (search_state.last_words_searched!=searchTerms) this.init_state();
    search_state.last_words_searched=searchTerms;

    var query_params = {
        words   : ((searchTerms && searchTerms.length>0)? searchTerms.split(" "):[]),
        skip    : search_state.itemsfetched,
        count   : search_state.more_items
    }
    chrome.runtime.sendMessage({msg: "searchLocally", list:"logs", query_params:query_params}, function(response) {
        //onsole.log("history",response)
        if (!response || !response.success) {
            showWarning("Error trying to do backgroundLocalSearch");
        } else {
          // {success:true, results:results, nomore: current_item==0}
          search_state.allresults.push( response.results)
          search_state.nomore = response.nomore
          search_state.itemsfetched+= response.results.length
          dg.el(HIST_DIV_ID,{clear:true,top:true}).appendChild(history.drawItems(response.results,search_state.allresults.length, search_state.nomore));
        }
    });
  },

  // draw history
  drawItems : function (results, page, nomore) {
    let recentdate
    let resultsdiv=dg.div(
      {style:{'margin-bottom':'20px','padding-left':'5px'}},
    )
    if (results && results.length>0){
      results.forEach(alog => {
        let thisdate = new Date(alog.vulog_timestamp).toDateString()
        if (thisdate != recentdate) {
          recentdate=thisdate;
          resultsdiv.appendChild(
            dg.div(
              {style:{'font-size':'18px',color:'indianred','margin-top':'40px'}
              },
              (thisdate)
            )
          )
        }
        resultsdiv.appendChild(this.drawItem(alog))
      });
    }

    more_hist = dg.el('history_more',{clear:true});
    if (search_state.allresults.length>1) {
      more_hist.appendChild(dg.span("Pages:"))
      for (let i=0; i<search_state.allresults.length; i++) {
        if (page==i) {
          more_hist.appendChild(dg.span(" .. "))
        } else {
          more_hist.appendChild(dg.span({
            style:{color:'cornflowerblue',cursor:'pointer','margin-right':'3px'},
            onclick:() => dg.el(HIST_DIV_ID,{clear:true,top:true}).appendChild(history.drawItems(search_state.allresults[i],i, nomore))
          },(" "+(i+1)+" ")))
        }
      }
      more_hist.appendChild(dg.span({style:{'margin-right':'20px'}},' '))
    }
    if (nomore) {
      more_hist.appendChild(dg.span({style:{'margin-left':'20px',color:CSS.LIGHT_GREY}},' No more items'))
    } else {
      more_hist.appendChild(dg.span({
        style:{color:'cornflowerblue',cursor:'pointer','margin-left':'20px'},
        onclick:function() {history.doSearch()}
      },'More items'))
    }
    return resultsdiv

  },
  drawItem : function (alog) {
    itemdiv=dg.div({style:{'margin-top':'10px'}})
    //onsole.log(alog)

    // Top line
    let timeString = (new Date(alog.vulog_timestamp).toTimeString()).split(":")
    timeString = timeString[0]+":"+timeString[1]
    itemdiv.appendChild( dg.span(
      dg.span( // time
        {style:{
          color: CSS.LIGHT_GREY,
          width: '45px',
          'font-size': '14px',
          'vertical-align': 'middle',
        }},
        timeString
      ),
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
            this.src= 'images/favicon_www.png';
          }
        })
      ),
      dg.a({
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
          },
          href:alog.url,
          target:'_blank'
        },
        (alog.title? (alog.domain_app+" - "+alog.title): alog.url)
      )
    ))

    itemdiv.appendChild(this.draw_detail_header(alog));
    //
    itemdiv.appendChild(this.draw_detailsdiv(alog));

    return itemdiv


  },
  draw_detail_header : function (alog) {
    alog.vulog_visit_details = alog.vulog_visit_details || []
    reducerArray = [0, ...alog.vulog_visit_details]
    let time_spent = reducerArray.reduce(function(total, obj) {
      let end = obj.end || obj.mid
      let newdiff = (end && !isNaN(end) && obj.start && !isNaN(obj.start))? (end - obj.start):0
      return total + newdiff
    });
    let [ttl_cookies, tracker_num, tracker_visits] = count_trackers(alog)
    let thediv = dg.div(
      {style:{
          'margin-left':'60px',
          cursor: 'pointer',
          color: CSS.LIGHT_GREY,
        },
        onclick:function(evt) {
          const blocktotoggle = this.nextSibling;
          var isExpanded = toggleCollapse(blocktotoggle);
          let arrow = evt.target.className.includes('fa-chevron')? evt.target:evt.target.firstChild;
          arrow.className =  isExpanded? ("fa-chevron-down hist_details_expanded"): ("fa-chevron-right  hist_details_collapse")
        }
      },
      dg.span({className:'fa-chevron-right hist_details_collapse',
              style:{color:(alog._id? "green":"cornflowerblue")}}),

      ((time_spent? ("Est. time "+ this.timeSpentify(time_spent)):"") +
       (alog.vulog_max_scroll? " - Scroll:"+Math.round(100*alog.vulog_max_scroll/alog.vuLog_height)+"% ": "") +
       (" - Left "+ttl_cookies+" cookies, using "+tracker_num+" tracker"+(tracker_num!=1?"s":""))
      )
    )
    return thediv;
  },
  draw_detailsdiv: function(alog){
    let detailsdiv = dg.div({style:{
        color:CSS.LIGHT_GREY,
        'font-size':'10px',
        'padding-left':'65px',
        height:'0px',
        overflow:'hidden',
        transition:'height 0.3s ease-out'
      }},dg.div(dg.b("Full url: "),alog.url))
    if (alog.author) detailsdiv.appendChild(dg.div(dg.b("By: "),alog.author ))
    if (alog.description) detailsdiv.appendChild(dg.div(dg.b("Summary: "),alog.description))
    if (alog.keywords && alog.keywords.length>0) detailsdiv.appendChild(dg.div(dg.b("Key words: "),alog.description ))
    const vtime = function(time) {return new Date(time).toLocaleTimeString().split(' ')[0]}
    const wtime = function(time) {
      mins = Math.round(time/60000);
      return ( (mins? (mins+"m "):"")+Math.round((time%60000)/1000)+"s");
    }
    alog.vulog_visit_details.forEach(visit => detailsdiv.appendChild(dg.div(dg.b("Visited "),"from ",vtime(visit.start)," to ",vtime(visit.end || visit.mid),(visit.vid_start? (" - Watched Video for "+wtime((visit.end || visit.mid)-visit.vid_start)):""  ))))

    detailsdiv.appendChild(dg.div(
      dg.span(
        {style:{color:'cornflowerblue', 'margin-right':'10px', cursor:'pointer'},
         onclick: function() { opentab("trackers", {log: alog})}
        },
        "Show tracker details"
      ),
      dg.span({style:{'margin-left':'50px'}}),
      dg.span({style:{color:'cornflowerblue', 'margin-right':'10px', cursor:'pointer'},
       onclick: function(e) {
         chrome.runtime.sendMessage({msg: "removeLocalItem", list:"logs", item:alog}, function(response) {
           //onsole.log(response)
           if (!response || !response.success) {
             showWarning("Error removing item - "+(response?response.error:""))
           } else {
             toggleCollapse(e.target.parentElement.parentElement);
             setTimeout(function(){e.target.parentElement.parentElement.parentElement.style.display="none"},280)
             if (response.otherSimilar && response.otherSimilar.length>0) {
               showWarning("Item was deleted. But note that there are "+response.otherSimilar.length+" other items with the same url still remaining",5000)
             }
           }
         })
      }},
      "Remove history item")
    ))

    return detailsdiv
  },

  // utilities
  removeSpaces : function(aText) {
      aText = aText.replace(/&nbsp;/g," ").trim();
      while (aText.indexOf("  ")>-1) {
          aText = aText.replace(/  /," ");
      }
      return aText;
  },
  timeSpentify: function (aTime) {
      //
      return (Math.floor(aTime/60000)>0? (Math.floor(aTime/60000)+"mins" ):"" )+(Math.round((aTime%60000)/1000,0))+"s"
  },
  getdomain: function(aUrl) {
      // 8 represents "h t t p s://" - todo - make algo mroe robust
      if(!aUrl) return "Missing aUrl";
      var start = aUrl.indexOf("//")+2
      var stop = aUrl.slice(start).indexOf("/");
      return aUrl.slice(0,stop+start);
  }

}
