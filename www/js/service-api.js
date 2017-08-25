angular.module('starter.serviceApi', [])

/*
 * Providing access to the edu-sharing API.
 */
.factory('EduApi', ['Base64', '$http', '$timeout', function(Base64, $http, $timeout) {

  // set minimum version of api
  var minApiVersionMajor = 1;
  var minApiVersionMinor = 0;

  /*
   * PRIVATE VARS
   */

  // base url to API endpoints
  var baseUrl = "";

  var oAuthClientId = "eduApp";
  var oAuthClientSecret = "secret";
  var oAuthAccessToken = "n/a";
  var oAuthRefreshToken = "";
  var oAuthExpiresIn = 0;
  var oAuthLastRefresh = 0;
  var oAuthRefreshCallback = null;
  var userSessionDataRefreshListener = null;

  var refreshingTokenIsRunning = 0;

  /*
   * PRIVATE METHODS
   */

  // to be used in the beginning of every public method
  // questioning the API to check if everything is ready
  var checkIfReady = function() {

    // check if base url undefined
    if ((typeof baseUrl === "undefined") || (baseUrl===null)) {
        console.warn("EduApi > checkIfReady > baseUrl is undefined");
        return false;
    }

    // check if base url set
    if (baseUrl.length <= 3) {
        console.warn("EduApi > checkIfReady > baseUrl is NOT set --> use 'EduApi.setBaseUrl' to do so");
        return false;
    }

    // check if auth method is set
    if (oAuthAccessToken.length === 0) {
        console.warn("EduApi > checkIfReady > no oAuth tokens yet");
        return false;
    }

    return true;

  };

  // get the template config for http requests
  // with auth and other stuff
  var getBasicConfig = function() {

    // basic headers + timeout
    var config = {
        timeout : 40000,
        cache: false,
        //withCredentials: true,
        headers: {
            'Accept' : 'application/json',
            'locale' : 'de_DE'
        }
    };

    // add access oAuth access token
    config.headers.Authorization = 'Bearer ' + oAuthAccessToken;

    return config;
  };

  // take a node and inject the access token
  var optimzePreviewUrl = function(node, width, height) {

      if (typeof width === "undefined") width = 160;
      if (typeof height === "undefined") height = 140;

      // if no node.previewUrl but preview - replace
      if ((typeof node.previewUrl === "undefined") && (typeof node.preview !== "undefined")) {

          // just set previewURL if real preview url (not default icon)
          if (!node.preview.isIcon) {
            node.previewUrl = node.preview.url;
          } else {
            node.previewUrl = null;
          }

      }

      // modify URL
      if ((typeof node.previewUrl !== "undefined") && (node.previewUrl!==null) && (node.previewUrl.length>0)) {

          // security check
          if ((node.previewUrl.indexOf("http://")===0) && (baseUrl.indexOf("https://")===0)) {
              alert("Security Warning. API is HTTPS but Preview URL is NOT!");
              console.warn("Unsecure URL: "+node.previewUrl);
              node.previewUrl = "ERROR: UNSECURE URL";
              return node;
          }

          // add access token - if needed (should not be needed)
          if (node.previewUrl.indexOf('accessToken')<=0) {
            node.previewUrl = node.previewUrl + "&accessToken="+oAuthAccessToken;
            console.warn("added access token to preview URL");
          }


          var quality = 50;
          if (width<50) quality = 90; 

          // ad parameters for picture quality and caching
          node.previewUrl = node.previewUrl + "&width="+width+"&height="+height+"&quality="+quality+"&crop=true&modified="+encodeURI(node.modifiedAt);

      } else {
          //node has no preview url
          node.previewUrl = null;
      }

      return node;
  };

  // get user session info (user needs to be logged in)
  var getUserSessionInfoIntern = function(win,fail) {

    // REQUEST CONFIG
    var config = getBasicConfig();
    config.method = 'GET';
    config.url = baseUrl+'authentication/v1/validateSession';
              
    // FAIL
    var errorCallback = function(response) {
        console.log("FAIL:");
        console.dir(response);
        fail(response);
    };

    // SUCCESS
    var successCallback = function(response) {
        if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
            win(response.data);
        } else {
            errorCallback(response);
        }
    };

    // DO REQUEST
    $http(config).then(successCallback, errorCallback);
  };

  // is used within this service to wrap API calls
  // make sure just running once
  var makeSureOAuthTokensAreFresh = function(onError, whenDone, optionalTag) {

      //console.log("called makeSureOAuthTokensAreFresh ("+optionalTag+")");

      // check if oAuth was ever set
      if (oAuthExpiresIn===0) {
        console.log("makeSureOAuthTokensAreFresh: oAuth tokens not set");
        onError("oAuth tokens not set");
        return;
      }

      // the main works of the function - after sync with sharing extension token sync
      var afteriOSsync = function () {

          // check if oAuth access token is still valid
          var tokensValidUntil = oAuthLastRefresh + (oAuthExpiresIn * 1000) - 10000;
          
          //console.log("makeSureOAuthTokensAreFresh: token("+oAuthAccessToken+") valid until ("+JSON.stringify(new Date(tokensValidUntil))+")");

          if (tokensValidUntil > (new Date().getTime())) {
              // ok access token should be valid - done
              //console.log("AUTH OK");
              whenDone();
              return;
          }

          // OAUTH TOKENS NEED REFRESH

          // check if refresh is already in process
          if (refreshingTokenIsRunning > 0) {

              // check if running refresh is outdated (just in case)
              var refreshRunningTime = new Date().getTime() - refreshingTokenIsRunning;
              if (refreshRunningTime<5000) {
                  //console.log("WAIT 1sec for tokemn refresh on other request to finish - refreshRunningTime("+refreshRunningTime+") ... ");
                  $timeout(function(){
                      makeSureOAuthTokensAreFresh(onError, whenDone, optionalTag)
                  },1000);
                  return;
              } else {
                  console.log(" if first refresh request takes more than 5 secs consider it failed - refreshRunningTime("+refreshRunningTime+") ... ");
              }

          }

          // remember when refreshing of token started
          refreshingTokenIsRunning = new Date().getTime();

          // DO REFRESH OF OAUTH TOKENS
          console.log("REFRESH TOKEN -->");
          var reducedBaseUrl = baseUrl.substr(0, baseUrl.length - 5);
          var config = getBasicConfig();
          config.method = 'POST';
          config.url = reducedBaseUrl + 'oauth2/token';
          config.headers = {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': '*/*'
          };
          config.data = "grant_type=refresh_token&client_id=" + oAuthClientId + "&client_secret=" + oAuthClientSecret + "&refresh_token=" + encodeURIComponent(oAuthRefreshToken);
          var errorCallback = function (response) {
              console.log("makeSureOAuthTokensAreFresh: FAIL refresh token:");
              console.dir(response);
              refreshingTokenIsRunning = 0;
              onError("fail on refresh token");
          };
          var successCallback = function (response) {
              if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {

                  console.log("oAuth REFRESH done newToken("+response.data.access_token+")");

                  // remember new tokens local
                  oAuthAccessToken = response.data.access_token;
                  oAuthRefreshToken = response.data.refresh_token;
                  oAuthExpiresIn = response.data.expires_in;
                  oAuthLastRefresh = new Date().getTime();

                  // report new tokens to the outside
                  if (oAuthRefreshCallback !== null) {
                      oAuthRefreshCallback(oAuthAccessToken, oAuthRefreshToken, oAuthExpiresIn);
                  } else {
                      console.log("Got new OAuth tokens, but no oAuthRefreshCallback set.");
                  }

                  // refresh user session data
                  if (userSessionDataRefreshListener !== null) {
                      getUserSessionInfoIntern(function (sessionData) {
                          // win
                          userSessionDataRefreshListener(sessionData);
                      }, function () {
                          // fail
                          console.warn("Was not able to get userSessionData.");
                      });
                  } else {
                      console.log("No userSessionDataRefreshListener set.");
                  }

                  // now execute the following task
                  refreshingTokenIsRunning = 0;
                  whenDone();

              } else {
                  refreshingTokenIsRunning = 0;
                  onError("fail on refresh token return data");
              }
          };

          // DO REQUEST
          $http(config).then(successCallback, errorCallback);
      };

      // check if oAuth tokens are in sync with iOS sharing extension
      try {
                window.AppGroupsUserDefaults.load({
                    suite: "group.edusharing",
                    key: "access_token"},
                        function(acessToken) {
                            // check if a valid acces token
                            if ((acessToken!==null) && (acessToken!=="")) {
                                if (acessToken!==oAuthAccessToken) {
                                    //alert("AccessToken has changed ... load the rest und store in account");
                                    oAuthAccessToken = acessToken;
                                    window.AppGroupsUserDefaults.load({
                                        suite: "group.edusharing",
                                        key: "refresh_token"},
                                        function(refreshToken) {
                                            oAuthRefreshToken = refreshToken;
                                            window.AppGroupsUserDefaults.load({
                                                suite: "group.edusharing",
                                                key: "expires_in"},
                                                function(expiresIn) {
                                                    oAuthExpiresIn = parseInt(expiresIn) + new Date().getTime();
                                                    oAuthLastRefresh = new Date().getTime();
                                                    if (oAuthRefreshCallback!==null) oAuthRefreshCallback(oAuthAccessToken, oAuthRefreshToken, oAuthExpiresIn);
                                                    afteriOSsync();
                                                }, function() {
                                                    console.log("changed access_token on share extension, but falied to load 'expires_in'");
                                                    afteriOSsync();
                                                });

                                        }, function() {
                                            console.log("changed access_token on share extension, but falied to load 'refresh_token'");
                                            afteriOSsync();
                                        });

                                } else {
                                    console.log("AccessToken still the same ... no need to update");
                                    afteriOSsync();
                                }

                            } else {
                                console.log("No 'access_token' in Sharing Extension Group");
                                afteriOSsync();
                            }

                        }, function() {
                            // failed
                            afteriOSsync();
                    });
      } catch (e) {
          // OK - when not running on iOS
          afteriOSsync();
      }

  };

  var createImageNodeIntern = function(parentNodeId, name, keywordStrArray, imageData, isBase64, mimeType, win, fail, progressCallback) {

          var tagStrArray = [];
          if (keywordStrArray!==null) tagStrArray = keywordStrArray;
          if (name===null) {
              alert("WARN createImageNodeIntern: name == null");
              name = "Object"+new Date().getTime();
          }

          makeSureOAuthTokensAreFresh(fail, function(){

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'POST';
              config.url = baseUrl+'node/v1/nodes/-home-/'+parentNodeId+'/children?renameIfExists=true&type=%7Bhttp%3A%2F%2Fwww.campuscontent.de%2Fmodel%2F1.0%7Dio';
              config.data = {
                "{http://www.alfresco.org/model/content/1.0}name": [
                    name
                ],
                "cclom:general_keyword": tagStrArray   
              };
              config.eventHandlers = {
                progress: function (c) {
                    console.log("eventHandlers:"+c);
                }
              };
              config.uploadEventHandlers = {
                progress: function (e) {
                    console.log("uploadEventHandlers:"+e);
                }
              };

              /* DEACTIVATED because plugin no longer compatible

              // GET WAKELOCK SO THAT NOT GOES TO SLEEP ON BIG UPLOADS
              // https://github.com/Viras-/cordova-plugin-powermanagement
              var wakelocked = false;
              try {
                window.powerManagement.acquire(function() {
                    //alert("GOT WAKELOCK");
                    wakelocked = true;
                }, function() {
                    //alert("NO WAKELOCK");
                    console.log("FAILED to get WakeLock");
                });
              } catch (e) { alert("EXCEPTION WAKELOCK"); console.log("EXCEPTION to get wakelock");}

              */

              // FAIL
              var errorCallback = function(response) {

                  /*
                  // RELEASE WAKELOCK
                  try {
                      if (wakelocked) window.powerManagement.release(function() { console.log('Wakelock released');}, function() { console.log('FAILED to release wakelock'); });
                      wakelocked = false;
                  } catch (e) { console.log("EXCEPTION  to unwakelock"); }
                  */

                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined") && (typeof response.data.error !== "undefined") && (response.data.error === "org.edu_sharing.restservices.DAODuplicateNodeNameException")) {
                      console.log("Name already in use ... try again.");
                      createImageNodeIntern(parentNodeId, "_"+name, keywordStrArray, imageData, isBase64, mimeType, win, fail);
                  } else {
                      console.log("FAIL:");
                      console.dir(response);
                      fail(response);
                  }

              };

              // SUCCESS
              var successCallback = function(response) {

                  /*
                  // RELEASE WAKELOCK
                  try {
                      if (wakelocked) window.powerManagement.release(function() { console.log('Wakelock released');}, function() { console.log('FAILED to release wakelock'); });
                      wakelocked = false;
                  } catch (e) { console.log("EXCEPTION  to unwakelock"); }
                  */

                  if ((typeof response !== "undefined")
                      && (typeof response.data !== "undefined")
                      && (typeof response.data.node !== "undefined")
                      && (typeof response.data.node.ref !== "undefined")
                      && (typeof response.data.node.ref.id !== "undefined")) {

                      var createdNodeId = response.data.node.ref.id;

                      var url = baseUrl+'node/v1/nodes/-home-/'+createdNodeId+'/content?versionComment=upload&mimetype='+encodeURIComponent(mimeType);

                      var byteCharactersToBlob = function(byteCharacters, contentType, sliceSize) {

                          //console.log("byteCharactersToBlob - byteCharacters",byteCharactersToBlob );

                          contentType = contentType || '';
                          sliceSize = sliceSize || 512;

                          var byteArrays = [];

                          for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
                              var slice = byteCharacters.slice(offset, offset + sliceSize);

                              var byteNumbers = new Array(slice.length);
                              for (var i = 0; i < slice.length; i++) {
                                  byteNumbers[i] = slice.charCodeAt(i);
                              }

                              var byteArray = new Uint8Array(byteNumbers);

                              byteArrays.push(byteArray);
                          }

                          return new Blob(byteArrays, {type: contentType});
                      };

                      var b64ToBlob = function(b64Data, contentType, sliceSize){
                          var byteCharacters = atob(b64Data);
                          return byteCharactersToBlob(byteCharacters, contentType, sliceSize);
                      };

                      var sendData = function(url, data) {

                          var XHR = new XMLHttpRequest();
                          var FD  = new FormData();

                          // We push our data into our FormData object
                          for(name in data) {
                              var fileName = "upload.jpg";
                              if (mimeType==="image/png") fileName = "upload.png";
                              if (mimeType==="image/gif") fileName = "upload.gif";
                              if (mimeType==="image/x-windows-bmp") fileName = "upload.bmp";
                              FD.append(name, data[name], fileName);
                          }

                          // We define what will happen if the data are successfully sent
                          XHR.addEventListener('load', function() {
                              if ((typeof progressCallback!=="undefined") && (progressCallback!==null)) progressCallback(100);
                              win(createdNodeId);
                          });

                          // on progress
                          XHR.upload.addEventListener("progress", function(event) {
                              if (typeof event !== "undefined") {
                                  if ((typeof event.total !== "undefined") && (typeof event.loaded !== "undefined")) {
                                      try {
                                          var progress = Math.round((event.loaded / event.total) * 100);
                                          console.log(progress+"% loaded("+event.loaded+") total("+event.total+")");
                                          if ((typeof progressCallback!=="undefined") && (progressCallback!==null)) progressCallback(progress);
                                      } catch (e) { console.log("E:"); }
                                  }
                              }
                          });

                          // We define what will happen in case of error
                          XHR.addEventListener('error', function() {
                                if ((typeof progressCallback!=="undefined") && (progressCallback!==null)) progressCallback(-1);
                                fail();
                          });

                          // We setup our request
                          XHR.open('POST', url);

                          XHR.setRequestHeader("Accept","application/json");
                          XHR.setRequestHeader("Authorization",'Bearer ' + oAuthAccessToken);
                          XHR.setRequestHeader("X-Requested-With",'XMLHttpRequest');

                          if ((typeof progressCallback!=="undefined") && (progressCallback!==null)) progressCallback(0);

                          XHR.send(FD);
                      };

                      if (isBase64) {
                          sendData(url, {
                              file: b64ToBlob(imageData, mimeType, 1024)
                          });
                      } else {
                          sendData(url, {
                              file: byteCharactersToBlob(imageData, mimeType, 1024)
                          });
                      }

                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);

          }, "createImageNodeIntern");

  };

  /*
   * PUBLIC SERVICE
   */

  return {
      isReady : function() {
          return checkIfReady();
      },
      testServer : function (serverBaseUrl, win, fail) {

            var config = {
                method : 'GET',
                url : serverBaseUrl + 'rest/_about',
                cache: false,
                headers: {
                    'Accept' : 'application/json'
                }
            };

            // DO REQUEST
            $http(config).then(function(response){
                if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {

                      var apiTooOldMessage = "Die API des Servers ist zu alt für die App. Server hat "+response.data.version.major+"."+response.data.version.minor+" und App braucht mindestens "+minApiVersionMajor+"."+minApiVersionMinor;

                      if ((typeof response.data.version !== "undefined")) {
                          if (response.data.version.major === minApiVersionMajor) {
                              if (response.data.version.minor < minApiVersionMinor) {
                                fail(apiTooOldMessage);
                                return;   
                              }
                          }
                          if (response.data.version.major < minApiVersionMajor) {
                              fail(apiTooOldMessage);
                              return;
                          }
                      }
                      win();
                  } else {
                      fail();
                  }
            }, fail);
      },
      setBaseUrl: function(baseUrlPara) {
          // last char needs to be /
          if (baseUrlPara.indexOf("/", baseUrlPara.length - 1) === -1) baseUrlPara = baseUrlPara + "/";
          baseUrl = baseUrlPara;
      },
      getBaseUrl: function() {
          return baseUrl.substring(0, baseUrl.length - 1);
      },
      getOAuthTokensByUsernamePassword : function(username, password, win, fail) {

          var reducedBaseUrl = baseUrl.substr(0,baseUrl.length-5);

          // CONFIG
          var config = getBasicConfig();
          config.method = 'POST';
          config.url = reducedBaseUrl+'oauth2/token';
          config.headers = {
              'Content-Type' : 'application/x-www-form-urlencoded',
              'Accept' : '*/*'
          };
          config.data = "grant_type=password&client_id="+oAuthClientId+"&client_secret="+oAuthClientSecret+"&username="+encodeURIComponent(username)+"&password="+encodeURIComponent(password);

          // FAIL
          var errorCallback = function(response) {
              console.log("FAIL LOGIN:");
              console.dir(response);
              fail(response);
          };

          // SUCCESS
          var successCallback = function(response) {
              if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                oAuthAccessToken = response.data.access_token;
                // refresh user session data
                if (userSessionDataRefreshListener!==null) {
                  getUserSessionInfoIntern(function(sessionData){
                      // win
                      userSessionDataRefreshListener(sessionData);
                  }, function(){
                      // fail
                      console.warn("Was not able to get userSessionData.");
                  });
                } else {
                    console.log("No userSessionDataRefreshListener set.");
                }
                win(response.data);
              } else {
                  errorCallback(response);
              }
          };

          // DO REQUEST
          $http(config).then(successCallback, errorCallback);
      },
      setOAuthTokens : function(accessToken, refreshToken, expiresIn, lastRefresh, refreshCallback) {

          oAuthAccessToken = accessToken;
          oAuthRefreshToken = refreshToken;
          oAuthExpiresIn = expiresIn;
          oAuthLastRefresh = lastRefresh;
          oAuthRefreshCallback = refreshCallback;

      },
      getOAuthAccessToken : function() {
          return oAuthAccessToken;
      },
      buildDownloadUrl : function(repo, nodeId) {
          var reducedBaseUrl = baseUrl.substr(0,baseUrl.length-5);
          return reducedBaseUrl+"eduservlet/redirect?APP_ID="+repo+"&NODE_ID="+nodeId+"&params=display%3Ddownload";
      },
      setUserSessionDataRefreshListener : function (listener) {
          userSessionDataRefreshListener = listener;
      },
      loadPublicServerList : function (win, fail) {

              // REQUEST CONFIG

              var config = {
                method : 'GET',
                url : 'http://app-registry.edu-sharing.com/public-server-directory.php',
                timeout : 10000,
                cache: false,
                headers: {
                    'Accept' : 'application/json'
                }
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                      win(response.data);
                  } else {
                      fail(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, fail);

      },
      getApiInfo : function (win, fail) {

          makeSureOAuthTokensAreFresh(fail, function() {

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'GET';
              config.url = baseUrl+'_about';

              // FAIL
              var errorCallback = function(response){
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                      win(response.data);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);

          },"getApiInfo");

      },
      getChildNodes : function(nodeId, win, fail, maxItems, skipCount) {

          if (typeof maxItems === "undefined") maxItems = 500;
          if (typeof skipCount === "undefined") skipCount = 0;

          makeSureOAuthTokensAreFresh(fail, function(){

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'GET';
              config.url = baseUrl+'node/v1/nodes/-home-/'+nodeId+'/children?propertyFilter=-all-&maxItems='+maxItems+'&skipCount='+skipCount+"&sortProperties=cm%3Aname&sortAscending=true";

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined") && (typeof response.data.nodes !== "undefined")) {
                      for (var i=0; i<response.data.nodes.length; i++) {
                        response.data.nodes[i] = optimzePreviewUrl (response.data.nodes[i], 160, 140);

                        // rename standard system folder
                        if (typeof response.data.nodes[i].properties['ccm:maptype']!== "undefined") {
                            //console.log("MAPTYPE",response.data.nodes[i]);
                            if (response.data.nodes[i].properties['ccm:maptype'][0]==="USERDATAFOLDER") {
                                response.data.nodes[i].name = "Dokumente";
                            }
                          if (response.data.nodes[i].properties['ccm:maptype'][0]==="IMAGES") {
                                response.data.nodes[i].name = "Bilder";
                            }                            
                        }

                      }
                      win(response.data);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);

          },"getChildNodes");

      },
      searchNodes : function(keyword, maxItems, skipCount, win, fail) {

          makeSureOAuthTokensAreFresh(fail, function(){

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'POST';
              config.url = baseUrl+'search/v1/queries/-home-/-default-/ngsearch?maxItems='+maxItems+'&skipCount='+skipCount;
              config.data = '{"criterias":[{"property":"ngsearchword","values":["'+keyword+'"]}],"facettes":["cm:creator"]}';

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {

                      for (var i=0; i<response.data.nodes.length; i++) {
                         response.data.nodes[i]  = optimzePreviewUrl (response.data.nodes[i], 160, 140);
                      }

                      win(response.data);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);

          },"searchNodes");

      },      
      getCollections : function(parentId, win, fail, scopeStr) {

          makeSureOAuthTokensAreFresh(fail, function(){

              var eduScope = "EDU_ALL";
              if (typeof scopeStr !== "undefined") eduScope = scopeStr;

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'GET';
              config.url = baseUrl+'collection/v1/collections/-home-/'+parentId+'/children?scope='+eduScope;

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {

                      if ((typeof response.data.collections !== "undefined") && (response.data.collections!==null)) {
                          for (var i=0; i<response.data.collections.length; i++) {
                              response.data.collections[i] = optimzePreviewUrl (response.data.collections[i],160,140);
                          }
                      } else {
                          console.log("WARN collection result is missing 'collections' field");
                      }

                      if ((typeof response.data.references !== "undefined") && (response.data.references!==null)) {
                          for (var i=0; i<response.data.references.length; i++) {

                              // optimize preview url
                              if (typeof response.data.references[i].previewUrl !== "undefined") {
                                  response.data.references[i].reference.previewUrl = response.data.references[i].previewUrl;
                              }
                              response.data.references[i].reference = optimzePreviewUrl (response.data.references[i].reference,160,140);

                              // title and name 
                              if ((typeof response.data.references[i].reference.title === "undefined") || (response.data.references[i].reference.title===null)) {
                                response.data.references[i].reference.title = response.data.references[i].reference.name;  
                              }
                          }
                      } else {
                          console.log("WARN collection result is missing 'references' field");
                      }

                      win(response.data);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);

          },"getCollections");

      },
      getCollection : function(collectionId, win, fail) {

          makeSureOAuthTokensAreFresh(fail, function(){

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'GET';
              config.url = baseUrl+'collection/v1/collections/-home-/'+collectionId;

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                      response.data.collection = optimzePreviewUrl (response.data.collection, 160, 140);
                      response.data.collection.typeStyle="collection";
                      win(response.data.collection);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);

          },"getCollection");

      },
      getUsersOrganization : function(win, fail) {

          makeSureOAuthTokensAreFresh(fail, function(){

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'GET';
              config.url = baseUrl+'organization/v1/organizations/-home-';
            
              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                      win(response.data.organizations);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);

          },"getUsersOrganization");

      },
      serachCollections : function(query, maxItems, skipCount, win, fail) {

          makeSureOAuthTokensAreFresh(fail, function(){

              if (query===null) query = "*";

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'GET';
              config.url = baseUrl+'collection/v1/collections/-home-/search?query='+encodeURIComponent(query)+'&maxItems='+maxItems+'&skipCount='+skipCount;

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                      console.log("Respose:",response);
                      for (var i=0; i<response.data.collections.length; i++) {
                        response.data.collections[i] = optimzePreviewUrl (response.data.collections[i], 30, 30);
                      }
                      win(response.data);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);

          },"serachCollections");

      },
      createCollection : function(repoId, parentCollectionId, title, description, scope, color, win, fail) {

          makeSureOAuthTokensAreFresh(fail, function(){

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'POST';
              config.url = baseUrl+'collection/v1/collections/'+repoId+'/'+parentCollectionId+'/children';
            config.data = '{"title": "'+title+'","description": "'+description+'", "scope":"'+scope+'", "type": "default", "color" : "'+color+'"}';

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                      win(response.data);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);

          },"createCollection");

      },
      updateCollection : function(collectionObj, win, fail) {

          makeSureOAuthTokensAreFresh(fail, function(){


              delete collectionObj['previewUrl'];
              delete collectionObj['typeStyle'];            

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'PUT';
              config.url = baseUrl+'collection/v1/collections/'+collectionObj.ref.repo+'/'+collectionObj.ref.id;
              config.data = JSON.stringify(collectionObj);
              config.headers.Accept = 'text/html';
              //config.headers['Content-Type'] = 'application/json';

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                      win(response.data);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);

          },"updateCollection");

      },
      deleteCollection : function(collectionObj, win, fail) {

          makeSureOAuthTokensAreFresh(fail, function(){

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'DELETE';
              config.url = baseUrl+'collection/v1/collections/'+collectionObj.ref.repo+'/'+collectionObj.ref.id;
              config.headers.Accept = 'text/html';
              //config.headers['Content-Type'] = 'application/json';

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                      win(response.data);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);

          },"deleteCollection");

      },
      addContentToCollection : function(repoId, collectionId, nodeId, win, fail) {

          makeSureOAuthTokensAreFresh(fail, function(){

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'PUT';
              config.url = baseUrl+'collection/v1/collections/'+repoId+'/'+collectionId+'/references/'+nodeId;

              // FAIL
              var errorCallback = function(response) {

                  // if dublicate conflict --> then count as success 
                  if ((typeof response !== "undefined")
                  && (typeof response.data !== "undefined")
                  && (typeof response.data.error !== "undefined")) {
                    if (response.data.error ==="org.edu_sharing.restservices.DAODuplicateNodeNameException") {
                        successCallback(response);
                        return;
                    }
                  }

                  // normal fail
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                      win(response.data);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);

          },"addContentToCollection");

      },
      removeContentFromCollection : function(repoId, collectionId, nodeId, win, fail) {

          makeSureOAuthTokensAreFresh(fail, function(){

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'DELETE';
              config.url = baseUrl+'collection/v1/collections/'+repoId+'/'+collectionId+'/references/'+nodeId;

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                      win(response.data);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);

          },"removeContentFromCollection");

      },
      getTitleFromHTMLWebsite : function(url, win, fail) {


            var config = {
                timeout : 12000,
                cache: true,
                headers: {
                    'Accept' : 'application/json'
                }
            };

            config.method = 'GET';
            config.url = url;

            var successCallback = function(result) {
                console.log("WIN",result);
                win("TEST");
            };

            // DO REQUEST
            $http(config).then(successCallback, fail);

      },
      getNodePersmission : function(id, win, fail, optionalData) {
          makeSureOAuthTokensAreFresh(fail, function(){

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'GET';
              config.url = baseUrl+'node/v1/nodes/-home-/'+id+'/permissions';

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                      win(response.data.permissions, optionalData);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);

          },"getNodePersmission");
      },
      getUserSessionInfo : function(win, fail) {

          makeSureOAuthTokensAreFresh(fail, function() {
            getUserSessionInfoIntern(win,fail);
          }, "getUserSessionInfo");

      },
      getWebsiteInfo : function(url, win, fail) {
          makeSureOAuthTokensAreFresh(fail, function() {

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'GET';
              config.url = baseUrl+'clientUtils/v1/getWebsiteInformation?url='+encodeURIComponent(url);

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                      win(response.data);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);

          },"getWebsiteInfo");
      },
      createFolder : function(parentNodeId, name, win, fail) {

          makeSureOAuthTokensAreFresh(fail, function() {

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'POST';
              config.url = baseUrl+'node/v1/nodes/-home-/'+parentNodeId+'/children?type=%7Bhttp%3A%2F%2Fwww.campuscontent.de%2Fmodel%2F1.0%7Dmap';
              config.data = {
                "cm:name": [
                    name
                ],
                "cm:title": [
                    name
                ]
              };

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                      win(response.data);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);
          },"createFolder");

      },
      createLinkNode : function(parentNodeId, name, link, tagStrArray, win, fail) {

          var nameChanged = false; 
          var createLinkNodeProc = function() {
            makeSureOAuthTokensAreFresh(fail, function(){
              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'POST';

              config.url = baseUrl+'node/v1/nodes/-home-/'+parentNodeId+'/children?type=ccm%3Aio&renameIfExists=true&versionComment=MAIN_FILE_UPLOAD&';
              config.data = {
                "ccm:wwwurl": [
                    link
                ]
              };

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  if ((response.status===409) && (!nameChanged)) {
                    // retry with changed name
                    name = name + " " + (new Date().getTime());
                    nameChanged = true;
                    createLinkNodeProc();
                    return;
                  }
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                      win(response.data.node.ref.id);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);
            },"createLinkNode");
          };
          createLinkNodeProc();
      },
      createFolderNode : function(parentNodeId, name, win, fail) {

          var createLinkNodeProc = function() {
            makeSureOAuthTokensAreFresh(fail, function(){
              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'POST';
              config.url = baseUrl+'node/v1/nodes/-home-/'+parentNodeId+'/children?type=cm%3Afolder&renameIfExists=true';
              config.data = {
                "cm:name": [
                    name
                ]
              };

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                      win(response.data.node.ref.id);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);
            },"createFolderNode");
          };
          createLinkNodeProc();
      },
      createImageNode : function(parentNodeId, name, keywordStrArray, imageData, isBase64, mimeType, win, fail, progressCallback) {
          return createImageNodeIntern(parentNodeId, name, keywordStrArray, imageData, isBase64, mimeType, win, fail, progressCallback);
      },
      getOwnUserProfile : function(win, fail) {

          makeSureOAuthTokensAreFresh(fail, function(){

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'GET';
              config.url = baseUrl+'iam/v1/people/-home-/-me-';

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined") && (typeof response.data.person !== "undefined")) {
                      win(response.data.person);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);
          },"getOwnUserProfile");

      },
      getRenderSnippetForContent : function(contentId, win, fail) {

          //var url = this.apiBaseUrl+;
          makeSureOAuthTokensAreFresh(fail, function(){

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'GET';
              config.url = baseUrl+'rendering/v1/details/-home-/'+contentId;

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined") && (typeof response.data.detailsSnippet !== "undefined")) {
                      win(response.data.detailsSnippet);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);
          },"getRenderSnippetForContent");

      }, 
      getNode : function(repoid, nodeid, win, fail) {

          makeSureOAuthTokensAreFresh(fail, function(){

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'GET';
              config.url = baseUrl+'node/v1/nodes/'+repoid+'/'+nodeid+'/metadata';

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined") && (typeof response.data.node !== "undefined")) {
                    response.data.node.typeStyle = "unknown";
                    if ((typeof response.data.node.type!== "undefined") && (response.data.node.type!==null)) {
                        if (response.data.node.type.indexOf("}folder") > 0) response.data.node.typeStyle = "folder";
                        if (response.data.node.type.indexOf("}map") > 0) response.data.node.typeStyle = "folder";
                        if (response.data.node.type.indexOf("}io") > 0) {
                            response.data.node.typeStyle = "file";
                            // check properties if maybe a link
                            try {
                                if ((typeof response.data.node.mediatype!=="undefined") && (response.data.node.mediatype==="link")) response.data.node.typeStyle = "link";
                            } catch (e) { console.warn("service-api.js -> FAIL ON check properties if maybe a link"); }
                        }
                    }

                    response.data.node = optimzePreviewUrl (response.data.node, 160, 140);

                    win(response.data.node);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);
          },"getNode");

      },
      deleteNode : function(nodeID, win, fail) {

          makeSureOAuthTokensAreFresh(fail, function(){

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'DELETE';
              config.url = baseUrl+'node/v1/nodes/-home-/'+nodeID;

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                      win(response.data);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);
          },"deleteNode");

      },  
      updateMetadataNode : function(nodeID, propertiesObject, win, fail) {

          makeSureOAuthTokensAreFresh(fail, function(){

              // REQUEST CONFIG
              var config = getBasicConfig();
              config.method = 'PUT';
              config.url = baseUrl+'node/v1/nodes/-home-/'+nodeID+'/metadata';
              config.data = propertiesObject;

              // FAIL
              var errorCallback = function(response) {
                  console.log("FAIL:");
                  console.dir(response);
                  fail(response);
              };

              // SUCCESS
              var successCallback = function(response) {
                  if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                      win(response.data.node.ref.id);
                  } else {
                      errorCallback(response);
                  }
              };

              // DO REQUEST
              $http(config).then(successCallback, errorCallback);
          },"updateMetadataNode");

      },  
    simpleGetHttp : function(url, win, fail) {
        var config = {
            timeout : 40000,
            cache: true,
            method: 'GET',
            url: url
        };
        $http(config).then(function(response){
            if ((typeof response !== "undefined") && (typeof response.data !== "undefined")) {
                win(response.data);
            } else {
                fail(response);
            }
        }, fail);
    },
    serverUrls: function(url) {

          if ((typeof url === "undefined") || (url===null)) {
            console.warn("serverUrls --> url parameter not valid");
            return {};
          }

          // build all the different endpoints from base url
          return {
              base      : url,
              api       : url+'rest',
              discover  : url+'angular/index.html#/discover',
              search    : url+'?app=1&locale=de_DE#discoverymode',
              profile   : url+'angular/index.html#/profile'
          };

      }
  };
}]);