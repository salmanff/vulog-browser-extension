
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
    let outer = dg.div({
      className:"cookie_details hidden_cookies"
    })
    if (cookies && Object.keys(cookies).length>0) {
    for (let [key, value] of Object.entries(cookies)) {
      outer.appendChild(
        dg.div(
          dg.span(
            {style:{'font-weight':'bold'}},
            key
          ),
          dg.span(": "),
          dg.span(value))
        )
      }
    } else {outer.innerHTML="None"}
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

  // draw Overview
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
  //if (!ttl_cookies) dg.hide_els('subtit1','trackers');

  // show main site cookies
  main_div.appendChild(
    dg.div(
      {className:"subtitle"},
      ("The web page left "+(cnum(the_log.vulog_cookies)?(cnum(the_log.vulog_cookies)+""):"no ")+" cookies itself. "),
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
        draw_cookie_details(the_log.vulog_cookies)
      )
    )
  )

  // Show sub page cookies
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
              dg.div("Cookies:")
            ),
            draw_cookie_details(asubpage.vulog_cookies)
          )
        )
      )
    })
  }
  main_div.appendChild(trackersDiv)


  // Show sub page cookies
  let resourcesDiv = dg.div({style:{}});
  the_log.vulog_3pjs = the_log.vulog_3pjs || []
  the_log.vulog_3pimg = the_log.vulog_3pimg || []
  the_log.vulog_3pjs = the_log.vulog_3pjs.sort()
  the_log.vulog_3pimg = the_log.vulog_3pimg.sort()
  const rlist_len = the_log.vulog_3pjs.length + the_log.vulog_3pimg.length;
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
    if (the_log.vulog_3pjs.length>0) {
      details_3p.appendChild(dg.div({className:'subtitle',style:{'margin-top':'5px'}},"Scripts (Javascript files):"))
      the_log.vulog_3pjs.forEach(aUrl => details_3p.appendChild(dg.div({className:"wrapurl small_space"},aUrl)))
    }
    if (the_log.vulog_3pimg.length>0) {
      details_3p.appendChild(dg.div({className:'subtitle',style:{'margin-top':'5px'}},"Images (and other):"))
      the_log.vulog_3pimg.forEach(aUrl => details_3p.appendChild(dg.div({className:"wrapurl small_space"},aUrl)))
      details_3p.appendChild(dg.div({className:'subtitle',style:{'margin-top':'5px'}},"These files may also be depositing 3rd party cookies."))
    }
    resourcesDiv.appendChild(details_3p)
  }
  main_div.appendChild(resourcesDiv)


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
