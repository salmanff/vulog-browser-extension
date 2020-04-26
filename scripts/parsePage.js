// test if works
// get messages in background and add them to main record and calculate time
// add time to pop up and check time...
// collapse cookies
// Test if cookies and other params change mid field - do that in every x increments
// FIX connecting to freezr and pause
// Make sure Add marks works... and then history results and search

// Note document.focus is most reliable way to know if user has gone from focvus to Not being focused... but document.focus does not turn true reliably so activity detection is used

// add eslint

const INTERVAL_BETWEEN_CHECKING_ACTIVITY = 10000;
const ASSUME_IDLE_AFTER = 30000
const TIME_TO_SEND_SUB_PAGE = 500;
const TIME_TO_SEND_MAIN_PAGE = 10;

let parsedPage = null;
let focus_timer, height_specs, focusedItervaler,assumeIdleTimer;
const FOCUS_TIMERS_INIT = {
	start:null,
	mid:null,
	end:null
}
const HEIGHT_INIT = {
	doc_height:0,
	max_scroll:0
}

const startParse = function() {
	// Called on each new page to parse it - initiates keys based on page and sends to background
	//onsole.log("startparse started, ", new Date())
	parsedPage = new VuPageData();

	//onsole.log({parsedPage})

	//onsole.log(parsedPage)
	if (!parsedPage.props.url) throw new Error("Deal with no url")
	//onsole.log("vulog parsedPage.props "+(parsedPage.props.hasBody? "hasBody":"NOBODY NONODY")+document.getElementsByTagName("BODY")[0].scrollHeight)

	const isMainPage = (parsedPage.props.hasBody && !parsedPage.props.isiframe)
	const time_to_send = isMainPage? TIME_TO_SEND_MAIN_PAGE:TIME_TO_SEND_SUB_PAGE;
	focus_timer = Object.assign({},FOCUS_TIMERS_INIT)
	height_specs = Object.assign({},HEIGHT_INIT)
	setTimeout(function(){
		chrome.runtime.sendMessage({props:parsedPage.props, msg:"newpage"}, function(response) {
			if (document.hasFocus()) { start_timer(); } else {addreFocusListeners();}
		});
	}, time_to_send);
}
const start_timer = function() {
	let nowTime = new Date().getTime();
	focus_timer.start = nowTime;
	focus_timer.last_activity = nowTime;
	if (videoIsPlaying()) {
		focus_timer.vid_start = nowTime;
	} else if (focus_timer.vid_start) {
		delete focus_timer.vid_start
	}
	focus_timer.mid=null;
	focus_timer.end=null;
	if (document.hasFocus() ) {
		focusedItervaler = setInterval(record_focused_increment,INTERVAL_BETWEEN_CHECKING_ACTIVITY)
	} else {
		reset_idle_timer()
	}
}
const reset_idle_timer = function() {
	clearTimeout(assumeIdleTimer)
	assumeIdleTimer = setTimeout(end_if_inactive,ASSUME_IDLE_AFTER)
}
const end_if_inactive = function() {
	if (isActiveDoc()) {
		continue_timer_from_activity_detection()
	} else {
		end_timer();
	}
}
const continue_timer_from_activity_detection = function (){
	if (currentUrlPurePath() != parsedPage.props.purl) {
		startParse();
	} else if (!focus_timer.last_activity) {
		start_timer();
	} else if (focus_timer.vid_start && !videoIsPlaying()){ // video was playing but is no longer
		end_timer(); // marks end to video
		start_timer();
	} else {
		if (new Date().getTime()-focus_timer.last_activity> INTERVAL_BETWEEN_CHECKING_ACTIVITY) {
			record_interval()
		}
		focus_timer.last_activity = new Date().getTime();
		reset_idle_timer()
	}
}
const isActiveDoc = function(){
	return (document.hasFocus() || videoIsPlaying())
}
const videoIsPlaying= function(){
	return (document.querySelector('video') && document.querySelector('video').playing)
}
const record_focused_increment = function(){
	if (currentUrlPurePath() != parsedPage.props.purl) {
		// site url has changed - restart
		clearInterval(focusedItervaler);
		startParse();
	} else if (focus_timer.vid_start && !videoIsPlaying()){ // video was playing but is no longer
		end_timer(); // marks end to video
		start_timer();
	} else {
		if (!isActiveDoc() ){
			//onsole.log("end focus")
			end_timer();
		} else {
			record_interval();
			//onsole.log("new increment")
		}
	}
}
const record_interval = function() {
	//onsole.log("record mid interval")
	// todo - get new links  from page?
	let nowTime = new Date().getTime();
	focus_timer.mid = nowTime;
	if (!focus_timer.vid_start && videoIsPlaying()) focus_timer.vid_start=nowTime;
	if ((window.innerHeight + window.scrollY) > height_specs.max_scroll) {
		height_specs.max_scroll = window.scrollY+window.innerHeight;
	}
	height_specs.doc_height = (document.getElementsByTagName("BODY") && document.getElementsByTagName("BODY")[0])? document.getElementsByTagName("BODY")[0].scrollHeight: 0;
	height_specs.doc_height = Math.max(height_specs.doc_height,height_specs.max_scroll)
	//onsole.log("sending msg updatepage")

	chrome.runtime.sendMessage({focus_timer:focus_timer, height_specs:height_specs, purl:parsedPage.props.purl, msg:"updatepage", props:parsedPage.props},
		function(resp) {
			if (resp && resp.error) console.warn("Error sending info to background ",parsedPage)
		}
	);
}
const end_timer = function (){
	//onsole.log("end_timer")
	clearTimeout(assumeIdleTimer)
	if (focusedItervaler) clearInterval(focusedItervaler)
	focus_timer.end=new Date().getTime();
	focus_timer.last_activity = null;
	focus_timer.mid = null;
	addreFocusListeners();

	chrome.runtime.sendMessage({focus_timer:focus_timer, height_specs:height_specs, purl:parsedPage.props.purl, msg:"updatepage", props:parsedPage.props},
		function(resp) {
			if (resp && resp.error) console.warn("Error sending info to background ",parsedPage)
		}
	);
}
// INACTIVITY See (www.kirupa.com/html5/detecting_if_the_user_is_idle_or_inactive.htm)
const addreFocusListeners = function() {
		document.addEventListener("mousemove",  activityDetected, false );
		document.addEventListener("click",  activityDetected, false );
		document.addEventListener("keydown",  activityDetected, false );
		document.addEventListener("scroll",  activityDetected, false );
};
const activityDetected = function (e) {
	//onsole.log("activityDetected hasfocus?"+document.hasFocus()+" visibile?"+document.visibilityState+" - "+(new Date().toTimeString()),"focus ",document.hasFocus() )
	if (document.hasFocus()) {
		document.removeEventListener("mousemove", activityDetected, false );
		document.removeEventListener("click", activityDetected, false );
		document.removeEventListener("keydown", activityDetected, false );
		document.removeEventListener("scroll", activityDetected, false );
	}
	continue_timer_from_activity_detection();
}

// from stackoverflow.com/questions/6877403/how-to-tell-if-a-video-element-is-currently-playing
Object.defineProperty(HTMLMediaElement.prototype, 'playing', {
    get: function(){
        return !!(this.currentTime > 0 && !this.paused && !this.ended && this.readyState > 2);
    }
})

// Get Started
startParse()
