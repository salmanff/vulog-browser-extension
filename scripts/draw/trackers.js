
// user dgelements.js and utils.js
// move all to function

function showTrackers(the_log, is_current) {
  if (!the_log)the_log={}
  const main_div = dg.div(
    {style:{'margin-bottom':'20px'}},
    dg.span(
      {style:{
        height:'16px',overflow:'hidden','text-overflow':'ellipsis',
        'font-size':'18px',color:'indianred','margin-top':'20px'}
      },
      (is_current? dg.span("Trackers on the current Web Page"):
        dg.span("Trackers for: ",dg.span({className:'subtitle'},the_log.purl)))
    )
  )

  // misc functions
  const draw_cookie_details = function(cookies) {
    let outer = dg.span({
      className:"cookie_details hidden_cookies"
    },(cookies && cookies.length>0)? (cookies.join(', ')+".") :"None.")
    return outer
  }
  const NUM_COLOR="indianred"
  const SHOW_COOKIES= "See Details"
  const HIDE_COOKIES= "Hide Details"
  const toggletrackers = function(evt) {
    const toggle_butt = evt.target
    const detail_butt = toggle_butt.parentElement.nextSibling
    toggleDetails(toggle_butt, detail_butt)
  }
  const toggleDetails = function(toggle_butt,detail_butt) {
    var isExpanded = toggleCollapse(detail_butt);
    toggle_butt.innerText = isExpanded? HIDE_COOKIES:SHOW_COOKIES;
  }

  // Calculated aggregate numbers
  if (!the_log.vulog_sub_pages) the_log.vulog_sub_pages=[]
  let [ttl_cookies, tracker_num, tracker_visits] = count_trackers(the_log)

  // draw Overview from
  main_div.appendChild(
    dg.div(
      {className:'subtitle'},
      dg.div(
        dg.span("This site installed "),
        dg.span({style:{color:NUM_COLOR,size:"18px"}},
          (ttl_cookies? ttl_cookies+"":"NO")),
        dg.span(" known cookies. "),
        dg.span(
          {style:{display:(the_log.vulog_sub_pages?"block":"none")}},
          dg.span("It connected to "),
          dg.span({style:{color:NUM_COLOR,size:"18px"}},
            (the_log.vulog_sub_pages.length+"")
          ),
          dg.span(" tracker sites"),
          dg.span(
            {style:{display:(the_log.vulog_sub_pages.length!=tracker_visits?"inline":"none")}},
            dg.span({style:{color:NUM_COLOR,size:"18px"}},
              (" "+tracker_visits+" ")
            ),
            dg.span("times")
          ),
          dg.span(".")
        ),
      ),
      dg.div(
        {style:{display:(the_log.vulog_hidden_subcees?"block":"none")}},
        ("It has "+the_log.vulog_hidden_subcees+" trackers with unknown number of hidden cookies")
      )
    )
  )

  // show main site cookies from the_log.vulog_cookies
  main_div.appendChild(
    dg.div(
      {className:"subtitle"},
      ("The web page left "+(cnum(the_log.vulog_cookies)?(cnum(the_log.vulog_cookies)+""):"no ")+" known cookies itself. "),
      dg.span(
        { className:'toggle_tracker_details',
          style:{display:(cnum(the_log.vulog_cookies)?"block":"none")},
          onclick: function(e){ toggleDetails(e.target, dg.el('site_cookies'))
            //do_hide = dg.el('site_cookies').style.display=="block"
            //dg.el('site_cookies').style.display = (do_hide? "none":"block");
            //e.target.innerText = do_hide? SHOW_COOKIES:HIDE_COOKIES;
          }
        },
        SHOW_COOKIES
      ),
      dg.div({
          id:"site_cookies",
          style:{
            'padding-left':'5px',
            height:"0px",
            overflow:'hidden',
            transition:'height 0.3s ease-out',
          },
        },
        dg.div(dg.span(
          'Cookies:',
          draw_cookie_details(the_log.vulog_cookies)
        ))
      )
    )
  )

  // Show sub page cookies // the_log.vulog_sub_pages.vulog_cookies
  let trackersDiv = dg.div({style:{}});
  const t_list = the_log.vulog_sub_pages;
  if (!t_list || t_list.length==0) {
    trackersDiv.appendChild(dg.div())
  } else {
    trackersDiv.appendChild(
      dg.div(
        {className:'subtitle'},
        dg.span("Tracker sites related to this web page sent data to:")
      )
    )
    t_list.forEach(asubpage => {
      //onsole.log(asubpage)
      let numtoshow = asubpage.vulog_cookies?
                      Object.keys(asubpage.vulog_cookies).length :
                      (asubpage.vulog_hidden_cees? "UNKNOWN number of HIDDEN ":'No ')
      trackersDiv.appendChild(
        dg.div(
          {style:{'margin-top':'5px','margin-right':'5px','margin-right': '15px'}},
          dg.div(
            {style:{height:'16px',overflow:'hidden','text-overflow':'ellipsis'}},
            asubpage.purl.split('?')[0]
          ),
          dg.div(
            dg.span(
              {style:{'margin-left':'5px'}},
              (" - Connected ")
            ),
            dg.span(
              {style:{color:NUM_COLOR}},
              (asubpage.vulog_visits.length>1?(asubpage.vulog_visits.length+" times "):"once ")
            ),
            dg.span("and received "),
            dg.span(
              {style:{color:NUM_COLOR}},
              (cnum(asubpage.vulog_cookies)?
                (cnum(asubpage.vulog_cookies)+""):
                asubpage.vulog_hidden_subcees?"unknown number of hidden":"no"
              )
            ),
            dg.span(" cookies. "),
            dg.span({
              className:'toggle_tracker_details',
              onclick:toggletrackers
              },
              SHOW_COOKIES),
          ),
          dg.div(
            {
              style:{
                height:"0px",
                overflow:'hidden',
                transition:'height 0.3s ease-out',
                'padding-left':'5px'
              },
            },
            dg.span (
              {style:{}},
              "Full site url: ",
              dg.span(
                {className:'cookie_details'},
                asubpage.url
              ),
              dg.div(dg.span(
                'Cookies:',
                draw_cookie_details(asubpage.vulog_cookies)
              ))
            )
          )
        )
      )
    })
  }
  main_div.appendChild(trackersDiv)


  // Show sub page cookies the_log.vulog_3pjs  the_log.vulog_3pimg
  let resourcesDiv = dg.div({style:{}});
  if (!the_log.vulog_3rdParties) the_log.vulog_3rdParties = {js:[] , img:[]}
  the_log.vulog_3rdParties.js  = the_log.vulog_3rdParties.js || []
  the_log.vulog_3rdParties.img = the_log.vulog_3rdParties.img  || []
  the_log.vulog_3rdParties.js  = the_log.vulog_3rdParties.js.sort()
  the_log.vulog_3rdParties.img = the_log.vulog_3rdParties.img.sort()
  const rlist_len = the_log.vulog_3rdParties.js.length + the_log.vulog_3rdParties.img.length;
  if (rlist_len==0) {
    resourcesDiv.appendChild(dg.div())
  } else {
    resourcesDiv.appendChild(
      dg.div(
        {style:{'margin-top':'20px'}},
        dg.div({className:'subtitle'},
        "Accessed ",dg.span({style:{color:NUM_COLOR}},(rlist_len+' ')),"outside resources (scripts, images etc) fetched from 3rd party sites"),
        dg.div("(Some may be servers belonging to the same site) ",
          dg.span(
            {className:'toggle_tracker_details',
            onclick: function(e){ toggleDetails(e.target, dg.el('details_3p') )} },
            SHOW_COOKIES)
        )
      ),
    )
    let details_3p = dg.div(
      {id:"details_3p",
       className:"cookie_details",
        style:{
          'padding-right': '30px',
          'padding-left':'5px',
          height:"0px",
          overflow:'hidden',
          transition:'height 0.3s ease-out'
      }}
    )
    if (the_log.vulog_3rdParties.js.length>0) {
      details_3p.appendChild(dg.div({className:'subtitle',style:{'margin-top':'5px'}},"Scripts (Javascript files):"))
      the_log.vulog_3rdParties.js.forEach(aUrl => details_3p.appendChild(dg.div({className:"wrapurl small_space"},aUrl)))
    }
    if (the_log.vulog_3rdParties.img.length>0) {
      details_3p.appendChild(dg.div({className:'subtitle',style:{'margin-top':'5px'}},"Images (and other):"))
      the_log.vulog_3rdParties.img.forEach(aUrl => details_3p.appendChild(dg.div({className:"wrapurl small_space"},aUrl)))
      details_3p.appendChild(dg.div({className:'subtitle',style:{'margin-top':'5px'}},"These files may also be depositing 3rd party cookies."))
    }
    resourcesDiv.appendChild(details_3p)
  }
  main_div.appendChild(resourcesDiv)

  remove_cookies_butt = dg.div({
      style:{
        'width':'100%',
        'margin-top':'30px',
        'text-align':'center',
        color:'indianred'
      }
    }, dg.span({
    style:{
      'border-radius':'3px',
      border:'1px solid yellowgreen',
      width:'fit-content',
      cursor:'pointer',
      padding: '3px',
      color: '#2060ff'
    },
    onclick: function(evt) {
      let button = evt.target
      let remove_div = button.parentElement
      remove_div.innerHTML=""
      remove_div.style['text-align']='left';
      // get a list of urls from log and all 3p sites... and then sequentialluy delete them
      let all_sites = [the_log.url, ...the_log.vulog_3rdParties.img,  ...the_log.vulog_3rdParties.js]
      the_log.vulog_sub_pages.forEach (subpage => {
        if (subpage.vulog_cookies && subpage.vulog_cookies.length>0) all_sites = [...all_sites, ...subpage.vulog_cookies]})

      let err_count=0, num_removed=0;
      all_sites.forEach(site => {
        if (typeof site == "string"){
          chrome.cookies.getAll({url:site}, function (resp){
            if (resp && resp.length>0) {
              remove_div.appendChild(dg.div(("Removing "+resp.length+" cookies from "+ host_from_url(site))))
              resp.forEach(acookie => {
                try{
                  chrome.cookies.remove({url:site, name:acookie.name}, function (resp) {
                    if (resp) {num_removed++} else {err_count++;}
                  })
                } catch(e){
                  console.warn("could not remove cookie ",acookie,site)
                  err_count++
                }

              });
            }
          })
        } else {
          console.warn("cookie removal problem at ",site)
          err_count++
        }
      });
      setTimeout(function() {remove_div.appendChild(dg.div('Removed '+num_removed+' cookies. Operations completed with '+err_count+' errors'))},2000)

    }
  },"Remove Site Cookies*"),
  dg.div({style:{color:'indianred','text-align':'left','margin-top':'5px'}},"* Clicking 'Remove Site Cookies' will search for cookies related to the page and try to delete them. But sites have various ways of tracking you, so this is no panecea. Also, as all third party cookies will be sought, this may log you out of some services. So please use with caution."))

  main_div.appendChild(remove_cookies_butt)

  return main_div;
}

const count_trackers = function(the_log){
  let ttl_cookies = cnum(the_log.vulog_cookies)
  let tracker_visits = 0
  if (the_log.vulog_sub_pages){
    the_log.vulog_sub_pages.forEach(asubpage => {
      ttl_cookies+= cnum(asubpage.vulog_cookies)
      tracker_visits += asubpage.vulog_visits.length
    })
  } else {the_log.vulog_sub_pages=[]}
  return [ttl_cookies, the_log.vulog_sub_pages.length,  tracker_visits]
}
const cnum =  function(cookies) {
  return (!cookies)? 0 : Object.keys(cookies).length
}
// Utility functions
const host_from_url = function (url){
  if (!url) return url
  let temp = url.split('://')
  if (temp.length>1) temp.shift()
  temp = temp[0].split('/')[0]
  return temp
}
