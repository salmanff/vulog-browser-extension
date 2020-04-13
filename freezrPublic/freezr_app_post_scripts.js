// info.freezr.public -
/*
  for electron - script file to be included after freezr_app_init.js and app_config.js . If there is no app_config.js, then freezr_app_name must be defined by the app
  for others (eg vulog) can be included after freezr_core
*/

// Below used for electron
var exports = exports || null;
var freezr_app_name = (exports && exports.structure && exports.structure.meta && exports.structure.meta.app_name)? exports.structure.meta.app_name: "";
var freezr_app_version = (exports && exports.structure && exports.structure.meta && exports.structure.meta.app_version)? exports.structure.meta.app_version: "N/A";
var freezr_app_display_name = (exports && exports.structure && exports.structure.meta && exports.structure.meta.app_display_name)? exports.structure.meta.app_display_name: freezr_app_name;


	freezr.app.isWebBased = false;
	document.addEventListener("DOMContentLoaded", function(){
			freezr.utils.addFreezerDialogueElements();
			if (freezr.initPageScripts) freezr.initPageScripts();
	});

  freezer_restricted.menu.add_standAloneApp_login_dialogue = function(divToInsertInId) {
    var divToInsertIn = document.getElementById(divToInsertInId);
    if (document.getElementById("freezer_dialogue_viewDataButt")) document.getElementById("freezer_dialogue_viewDataButt").style.left=(parseInt(window.innerWidth/2)-30)+"px";

    var cont = "";
    cont+= '<div align="center">'
    cont+= '<div id="freezr_server_server_name_area">'
      cont+= '<div class="freezer_dialogue_topTitle" style="padding:20px;" >Log in to freezr or any CEPS-compatible Data Store (PDS)</div>'
      cont+= '<div><div class="appLogin_name">Personal Data Store url: </div> <div contenteditable class="appLogin_input" id="freezr_server_name_input" >'+(freezr_server_address? freezr_server_address:'https://')+'</div></div>'
      cont+= '<div><br><span class="appLogin_name"></span><span class="freezer_butt" id="freezr_server_pingprelogin_butt">next</span></div>'
    cont+= '</div>'
    cont+= '<div id="freezr_server_login_name_area" style="display:none">'
     cont+= '<div id="freezr_login_username_area"><div class="appLogin_name" style="font-weight:bold">User Name: </div> <div contenteditable class="appLogin_input" id="freezr_login_username" >'+(freezr_user_id? freezr_user_id:'')+'</div></div>'
      cont+= '<div><div class="appLogin_name" style="font-weight:bold">One-time App Password:<br>(Please get a one time app password from your Personal Server App.) </div><input contenteditable class="appLogin_input" id="freezr_login_pw" type="password"></input></div>'
      cont+= '<br><div><span class="appLogin_name"></span><span class="freezer_butt" id="freezr_server_login_butt">log in to your PDS</span></div>'
    cont+= '</div>'
    cont+= '</div>'
    divToInsertIn.innerHTML = cont;
    document.getElementById('freezr_server_login_butt').onclick = function(){
      freezr_user_id = document.getElementById('freezr_login_username').innerText;
      var password = document.getElementById('freezr_login_pw').value;
      if (freezr_user_id && freezr_user_id.length>0 && password && password.length>0 && freezr_server_address && freezr_server_address.length > 0 ) {
        var theInfo = { "username": freezr_user_id, "password": password, 'client_id':freezr_app_name, grant_type:"password"};
        if (!freezr_app_name) {
            alert("developer error: variable freezr_app_name needs to be defined");
        } else {
          freezer_restricted.menu.resetDialogueBox();
          freezer_restricted.connect.ask("/oauth/token", theInfo, function(resp) {
            resp = freezr.utils.parse(resp);
            if (resp.error) {
              document.getElementById('freezer_dialogueInnerText').innerHTML= "Error logging you in: "+(resp.message? resp.message: resp.error);
              freezr.app.loginCallback? freezr.app.loginCallback(resp): console.warn("Error " + JSON.stringify(resp));
            } else if (!resp.access_token) {
              document.getElementById('freezer_dialogueInnerText').innerHTML= "Error logging you in.";
              freezr.app.loginCallback? freezr.app.loginCallback(resp): console.warn("Error " + JSON.stringify(resp));
            } else if (resp.app_name == freezr_app_name) {
              freezer_restricted.menu.close()
              freezr_app_token = resp.access_token;
              freezr_server_version = resp.freezr_server_version;
              freezr.app.offlineCredentialsExpired = false;
              freezr.app.loginCallback? freezr.app.loginCallback(resp): console.warn("Warning: Set freezr.app.loginCallback to handle log in response: " + JSON.stringify(resp));
            } else {
                document.getElementById('freezer_dialogueInnerText').innerHTML= 'developper error  2- loggedin_app_name '+resp.login_for_app_name+' is not correct.';
            }
          });
        }
      }
    }


    document.getElementById('freezr_server_name_input').onkeypress= function (evt) {
      if (evt.keyCode == 13) {evt.preventDefault(); document.getElementById("freezr_server_pingprelogin_butt").click();};
    }
    document.getElementById('freezr_server_pingprelogin_butt').onclick= function (evt) {
      freezr_server_address = document.getElementById('freezr_server_name_input').innerText;
      if (freezr_server_address.slice(freezr_server_address.length-1)=="/")  freezr_server_address = freezr_server_address.slice(0,freezr_server_address.length-1);
      document.getElementById("freezr_server_server_name_area").innerHTML='<br/><div align="center">.<img src="'+(freezr.app.isWebBased? "/app_files/info.freezr.public/static/ajaxloaderBig.gif": "./freezrPublic/static/ajaxloaderBig.gif")+'"/></div>';
      freezr.utils.ping(null, function(resp) {
        resp = freezr.utils.parse(resp);
        if(resp.error) {
          document.getElementById("freezr_server_server_name_area").innerHTML="The freezr is not available. Please try later.";
        } else {
          document.getElementById("freezr_server_server_name_area").innerHTML="Enter your user name and one-time app password to log into "+freezr_server_address;
          document.getElementById("freezr_server_login_name_area").style.display="block";
          if (resp.logged_in) {
            document.getElementById("freezr_login_username").innerText = resp.user_id
            document.getElementById("freezr_login_pw").focus();
          } else {
            document.getElementById("freezr_login_username").focus();
          }
        }
      }, freezr_app_name)
    }
    document.getElementById('freezr_login_username').onkeypress= function (evt) {
      if (evt.keyCode == 13) {evt.preventDefault(); document.getElementById("freezr_login_pw").focus();};
    }
    document.getElementById('freezr_login_pw').onkeypress= function (evt) {
      if (evt.keyCode == 13) {evt.preventDefault(); document.getElementById("freezr_server_login_butt").click();};
    }
  }
  freezer_restricted.menu.showOfflinePermissions = function(outerPermissions) {
    outerPermissions = freezer_restricted.utils.parse(outerPermissions);

  var innerElText = document.getElementById('freezer_dialogueInnerText');

  document.getElementById('freezer_dialogueOuter').style.display="block";
  freezer_restricted.menu.addLoginInfoToDialogue('freezer_dialogueInnerText');

  if (!outerPermissions || outerPermissions.error || !outerPermissions[freezr_app_name]) {
    innerElText.innerHTML += "<br/><br/>Error connecting to freezr to get permissions";
  } else {
    innerElText.innerHTML += '<div class="freezer_dialogue_topTitle">App Permissions to Access Data</div>';
    let groupedPermissions = outerPermissions[freezr_app_name]

    const IntroText = {
      "outside_scripts":'This app is asking for permission to be able to access programming scripts from the web. This can be VERY DANGEROUS. DO NOT ACCEPT THIS unless you totally trust the app provider and the source of the script. <br/> <b> PROCEED WITH CAUTION.</b> ',
      "thisAppToThisApp": 'This app is asking for permission to share data from this app:',
      "thisAppToOtherApps": "This app is asking for permissions to access data from other apps:",
      "otherAppsToThisApp": 'Other apps are asking for permission to see your data from this app:',
      "unkowns": 'These permissions are uknkown to freezr'
    }
    const add_perm_sentence = function(aPerm) {
      let sentence ="";
      let hasBeenAccepted = (aPerm.granted && !aPerm.outDated)
      let other_app = aPerm.requestee_app != aPerm.requestor_app;
      let access_word = other_app? "access and share":"share";
      sentence+= other_app? ("The app, <b style='color:purple;'>"+aPerm.requestor_app+"</b>,") : "This app"
      sentence += hasBeenAccepted? " is able to ":" wants to be able to "
      if (aPerm.type == "db_query") {
        sentence += access_word + ": "+(aPerm.return_fields? (aPerm.return_fields.join(", ")) : "ERROR") + " with the following groups: "+aPerm.sharable_groups.join(" ")+".<br/>";
      } else if (aPerm.type == "object_delegate") {
        sentence += access_word+ " individual data records with the following groups:  "+(aPerm.sharable_groups? aPerm.sharable_groups.join(" "): "None")+".<br/>";
      } else if (aPerm.type == "outside_scripts") {
        sentence = (hasBeenAccepted? "This app can ":"This app wants to ")+" access the following scripts from the web: "+aPerm.script_url+"<br/>This script can take ALL YOUR DATA and evaporate it into the cloud.<br/>";
      }
      if (aPerm.outDated) sentence+="This permission was previously granted but the permission paramteres have changed to you would need to re-authorise it.<br/>"
      aPerm.sentence = sentence
      aPerm.action = hasBeenAccepted?"Deny":"Accept"
      return aPerm
    }

    var makePermissionElementFrom = function(permission_object) {
			//onsole.log("permission_object",permission_object)
      var permEl = document.createElement('div');
      permEl.className = "freezer_BoxTitle"
      permEl.innerHTML = (permission_object.description?  (permission_object.description+ " ("+permission_object.permission_name+")"): permission_object.permission_name);

      var acceptButt = document.createElement('div');
      acceptButt.className = "freezer_butt";
			acceptButt.id = "freezerperm_"+permission_object.requestee_app_table+"_"+permission_object.requestor_app+"_"+(permission_object.granted?"Deny":"Accept")+"_"+permission_object.permission_name;
      acceptButt.innerHTML= (permission_object.granted && !permission_object.outDated)?"Deny":"Accept";

      var detailText = document.createElement('div');
      detailText.className="freezer_butt_Text"
      detailText.id="sentence_"+permission_object.requestee_app+"_"+permission_object.requestor_app+"_"+permission_object.permission_name;
      permission_object = add_perm_sentence(permission_object)
      detailText.innerHTML  = permission_object.sentence

      var boxOuter = document.createElement('div');
      boxOuter.appendChild(permEl);
      boxOuter.appendChild(acceptButt);
      boxOuter.appendChild(detailText);
      return boxOuter;
    }

    function writePermissions(recordList, type, altText) {
        titleDiv = document.createElement('div');
        titleDiv.className = "freezer_dialogueTitle freezr_dialogueBordered";
        if (recordList && recordList.length >0) {
          titleDiv.innerHTML = IntroText[type];
          innerElText.appendChild(titleDiv);
          for (var i=0; i<recordList.length; i++) {
            innerElText.appendChild(makePermissionElementFrom(recordList[i]));
          }
        } else if (altText) {
          titleDiv.innerHTML = altText+"<br/><br/>";
          innerElText.appendChild(titleDiv);
        }
    }

    if (groupedPermissions.thisAppToThisApp.length + groupedPermissions.outside_scripts.length + groupedPermissions.thisAppToOtherApps.length + groupedPermissions.otherAppsToThisApp.length == 0) {
      writePermissions([], null, 'This app is not asking for any sharing permissions.');
    }

    writePermissions(groupedPermissions.outside_scripts,"outside_scripts");
    writePermissions(groupedPermissions.thisAppToThisApp,"thisAppToThisApp");
    writePermissions(groupedPermissions.otherAppsToThisApp,"otherAppsToThisApp");
    writePermissions(groupedPermissions.thisAppToOtherApps,"thisAppToOtherApps");
    writePermissions(groupedPermissions.unknowns,"unknowns");
  }
}

freezr.utils.logout = function() {
  freezer_restricted.connect.ask("/v1/account/applogout", null, function(resp) {
    resp = freezr.utils.parse(resp);
    freezer_restricted.menu.close()
    if (!resp.error || confirm("There was an error logging you out or connecting to the server. Do you want your login credentials removed?")) {
      freezr_app_code = null;
      freezr_app_token = null;
      document.cookie = 'app_token_'+freezr_user_id+'= null'
      freezr_user_id = null;
      freezr_server_address= null;
      freezr_user_is_admin = false;

      if (freezr.app.logoutCallback) freezr.app.logoutCallback(resp);
    }
  });
}
