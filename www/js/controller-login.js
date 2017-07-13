angular.module('starter.controllerLogin', [])
.controller('LoginCtrl', function($scope, $log, $rootScope, $location, Account, $ionicPopup, System, $sce, EduApi, $ionicLoading, $timeout) {

        $scope.showLoginIntro = false;
        $scope.showLoginStep = 0;
        $scope.showLoginAnim = false;

        $scope.loading = true;
        $scope.isLoggedIn = false;
        $scope.loginUser = "";
        $scope.loginPassword = "";
        $scope.focus = "user";

        // register in LOGOUT event from server frame
        angular.element(window).on('message', function(m) {
            if (m.data.command) {
                if (m.data.command==="logout") {
                    $rootScope.$apply(function() {
                        Account.loginOut();
                        $scope.loginPassword = "";
                        $scope.isLoggedIn = false;
                    });
                }
            }
        });


        /*** SERVER SELECTION ***/

        $scope.loginServer = {
            'name' : null,
            'url'  : null
        };


        $scope.inputFocus = function(gotFocus) {
            $scope.showTopLogo = !gotFocus;
        };

        // if user clicks to select a server
        $scope.selectServer = function(e) {

            e.preventDefault();
            e.stopPropagation();

            $ionicLoading.show({
                template: '<img src="./img/spinner.gif">'
            });

            // real request from internet
            EduApi.loadPublicServerList(function(json){
                // WIN
                $scope.serverDirectory = json;
                $scope.selectSeverDialog();
            },function(){
                // FAIL
                $scope.serverDirectory = [];
                $scope.selectSeverDialog();
            });

        };

        $scope.selectSeverDialog = function() {

            $ionicLoading.hide();

            $scope.setServer = function(server) {
                $scope.loginServer = server;
                $scope.serverChoosePopup.close();
            };

            $scope.serverChoosePopup = $ionicPopup.show({
                templateUrl: './templates/pop-selectserver.html',
                title: '',
                subTitle: '',
                cssClass: 'serverselect',
                scope: $scope,
                buttons: []
            });
        };

        // only call after ionic is ready
        $scope.checkIfLoginScreenIsToShow = function() {

            // **** set selected server ****

            var clientSettings = Account.getClientSettings(); 
            if (typeof clientSettings.selectedServer === "undefined") clientSettings.selectedServer = {name:null,url:null};
            $scope.loginServer = clientSettings.selectedServer;

            // **** checkIfLoginScreenIsToShow ****

            // determine if login intro should be shown after login
            var preLoginAccount = Account.getAccount();
            var loginIntroShouldBeShown =  ((typeof preLoginAccount.lastLogin === "undefined") || (preLoginAccount.lastLogin===0));

            if (loginIntroShouldBeShown) {

                // lock into portrait while intro
                // after leaving login screen it will unlock
                if ((typeof window.screen !== "undefined") && (typeof window.screen.lockOrientation !== "undefined"))  window.screen.lockOrientation('portrait');
                
                // show intro screen
                $scope.showLoginIntro = true;
            }

        };

        if ($rootScope.ionicReady) $scope.checkIfLoginScreenIsToShow();

        $scope.$on('ionic-ready', function() {
            $scope.checkIfLoginScreenIsToShow();
        });

        $scope.clickIntroNext = function() {
            if ($scope.showLoginStep>=4) return;
            if ($scope.showLoginAnim) return;
            $scope.showLoginAnim = true;
            $timeout(function(){
                $scope.showLoginAnim=false;
                $scope.showLoginStep++;
            },800);
        };

        $scope.clickIntroDone = function() {
            $scope.showLoginIntro = false;
        };

        // allow landscape mode when app leaves login screen
        $scope.$on('$ionicView.leave', function() {
                if ((typeof window.screen !== "undefined") && (typeof window.screen.lockOrientation !== "undefined"))   window.screen.unlockOrientation();
        });

        $scope.onEnter = function() {

            // as long ionic is not ready ... wait
            if (!$rootScope.ionicReady) {
                $timeout($scope.onEnter,500);
                return;
            }

            $scope.showTopLogo = true;

            System.appWentOverLoginScreen();

            // check if oauth data is available
            var account = Account.getAccount();
            var clientSettings = Account.getClientSettings();

            var tryExistingAccessToken = function () {

                if ((typeof account.accessToken !== "undefined")
                    && (account.accessToken.length > 0)
                    && (typeof clientSettings.selectedServer !== "undefined")
                    && (typeof clientSettings.selectedServer.url !== "undefined")
                    && (clientSettings.selectedServer.url !== null)) {

                    // init API url
                    EduApi.setBaseUrl(EduApi.serverUrls(clientSettings.selectedServer.url).api);

                    // check if oauth is working
                    EduApi.setOAuthTokens(
                        account.accessToken,
                        account.refreshToken,
                        account.expiresIn,
                        account.lastRefresh,
                        Account.storeOAuthData
                    );
                    $ionicLoading.show({
                        template: '<img src="./img/spinner.gif">'
                    });

                    try {

                        $scope.loading = true;
                        $timeout(function () {

                            EduApi.getUserSessionInfo(function (sessionData) {

                                // WIN

                                // is still session valid ...
                                if ((sessionData !== null) && (typeof sessionData.isValidLogin !== "undefined") && (sessionData.isValidLogin)) {

                                    //alert("VALID");

                                    // OK valid
                                    $ionicLoading.hide();
                                    Account.setSessionData(sessionData);
                                    $scope.finishLogin();

                                } else {

                                    //alert("NOT VALID");

                                    console.log("FAIL oAuth tokens were invalid.");
                                    $ionicLoading.hide();
                                    $scope.loading = false;

                                    // if not logged in & has web intent -> show alert, stay on this page
                                    if (System.hasWebIntent()) {
                                        var alertPopup = $ionicPopup.alert({
                                            title: 'Login nötig',
                                            template: 'Zum Teilen bitte einloggen.'
                                        });
                                        alertPopup.then(function () { });
                                    }

                                }

                            }, function () {

                                // FAIL - server or internet error
                                $ionicLoading.hide();
                                $scope.loading = false;

                                var alertPopup = $ionicPopup.alert({
                                    title: 'Internet',
                                    template: 'Keine Internetverbindung - bitte prüfen oder später noch einmal probieren.'
                                });
                                alertPopup.then(function () {
                                    try {
                                        ionic.Platform.exitApp();
                                    } catch (e) { alert("Bitte App schließen und neu laden."); }
                                });

                            });

                        }, 1500);

                    } catch (e) {
                        console.warn("FAIL: testing oauth");
                    }

                } else {
                    $scope.loading = false;
                    $timeout(function () {
                        // if not logged in & has web intent -> show alert, stay on this page
                        if (System.hasWebIntent()) {
                            var alertPopup = $ionicPopup.alert({
                                title: 'Login nötig',
                                template: 'Zum Teilen bitte einloggen.'
                            });
                            alertPopup.then(function () { });
                        }
                    }, 1100);
                }

            };


            // sync access token with iOS sharing extension
            try {

                window.AppGroupsUserDefaults.load({
                    suite: "group.edusharing",
                    key: "access_token"},
                        function(acessToken) {
                            // success

                            // check if a valid acces token
                            if ((acessToken!==null) && (acessToken!=="")) {

                                //alert("Got 'access_token' from Sharing Extension Group: "+JSON.stringify(result));
                                if (acessToken!==account.accessToken) {

                                    //alert("AccessToken has changed ... load the rest und store in account");
                                    
                                    account.accessToken = acessToken;
                                    window.AppGroupsUserDefaults.load({
                                        suite: "group.edusharing",
                                        key: "refresh_token"},
                                        function(refreshToken) {

                                            account.refreshToken = refreshToken;
                                            window.AppGroupsUserDefaults.load({
                                                suite: "group.edusharing",
                                                key: "expires_in"},
                                                function(expiresIn) {

                                                    // convert expire info
                                                    expiresIn = parseInt(expiresIn) + new Date().getTime();

                                                    // update local account
                                                    Account.storeOAuthData(account.accessToken, account.refreshToken, expiresIn);
                                                    account = Account.getAccount();
                                                    tryExistingAccessToken();

                                                }, function() {
                                                    console.log("changed access_token on share extension, but falied to load 'expires_in'");
                                                    tryExistingAccessToken();
                                                });

                                        }, function() {
                                            console.log("changed access_token on share extension, but falied to load 'refresh_token'");
                                            tryExistingAccessToken();
                                        });

                                } else {
                                    console.log("AccessToken still the same ... no need to update");
                                    tryExistingAccessToken();
                                }

                            } else {
                                console.log("No 'access_token' in Sharing Extension Group");
                                tryExistingAccessToken();
                            }

                        }, function() {
                            // failed
                            tryExistingAccessToken();
                    });

            } catch (e) {
                //alert("EXCEPTION:"+JSON.stringify(e));
                tryExistingAccessToken();
            }

        };

        $scope.$on('$ionicView.enter', function () {
            $scope.onEnter();
        });

        $scope.finishLogin = function() {
            $timeout(function(){
                $rootScope.isLoggedIn = true;
                // after login - check what to do
                if (System.hasWebIntent()) {
                    // got started by web intent -> show sharing page
                    //$location.path("/app/share");
                    $location.path("/app/collectionadd");
                } else {
                    // no webIntent
                    var path = Account.getPathBeforeLogin();
                    if (path.length>0) {
                        Account.rememberPathBeforeLogin("");
                        $location.path(path);
                    } else {
                        $location.path("/app/collections");
                    }
                }
            },10);
        };

        $scope.isUrlUnsave = function(url) {
            if (typeof url === "undefined") return false;
            if (url===null) return false;
            return url.trim().indexOf("http:") === 0;
        };

        // when user clicks login or triggered when user and password are stored
        $scope.loginClick = function(user, pass, server) {

            // check username
            if ((typeof user === "undefined") || (user.trim().length===0)) {
                $scope.userAnimationPulsateSimple=true;
                $scope.focus="user";
                $timeout(function(){$scope.userAnimationPulsateSimple=false;},2000);
                return;
            }

            // check password
            if ((typeof pass === "undefined") || (pass.trim().length===0)) {
                $scope.passAnimationPulsateSimple=true;
                $scope.focus="password";
                $timeout(function(){$scope.passAnimationPulsateSimple=false;},2000);
                return;
            }

            // check that url/server is set
            if ((typeof server.url === "undefined") || (server.url===null) || (server.url.trim().length===0) || (server.url==='https://')) {
                $scope.serverAnimationPulsateSimple=true;
                $scope.focus="server";
                $timeout(function(){$scope.serverAnimationPulsateSimple=false;},2000);
                return;
            }

            var serverUrl = server.url.trim();
            if (serverUrl.length>0) {

                    serverUrl = System.buildFullApiUrlFromUserInput(serverUrl);

                    // $ionicLoading.show({
                    //    template: '<img src="./img/spinner.gif">'
                    //});
                    $scope.loading = true;
                    EduApi.testServer(serverUrl, function(){

                        // WIN - URL OK
                        //$ionicLoading.hide();
                        $scope.loading = false;

                        // persist seleted server
                        $scope.loginServer.url = serverUrl;
                        var clientSettings = Account.getClientSettings(); 
                        clientSettings.selectedServer = $scope.loginServer;
                        Account.storeClientSettings(clientSettings);

                        // set server and login
                        EduApi.setBaseUrl(EduApi.serverUrls(serverUrl).api);
                        $scope.loginWithNameAndPassword(user, pass);

                    }, function(e) {

                        if ((typeof e !== "undefined") && (e.length>0)) {
                            // FAIL - with message
                            //$ionicLoading.hide();
                            $scope.loading = false;
                            $ionicPopup.alert({
                                title: 'Verbindung nicht möglich',
                                template: '<div style="text-align: center">'+e+'<br></div>'
                            }).then(function() {});
                        } else {
                            // FAIL - URL NOT WORKING
                            //$ionicLoading.hide();
                            $scope.loading = false;
                            $ionicPopup.alert({
                                title: 'Verbindung nicht möglich',
                                template: '<div style="text-align: center">Bitte Internetverbindung und eingegebene Adresse prüfen.<br><span style="font-size: 65%;">'+server.url+'</span><br></div>'
                            }).then(function() {});
                        }

                    });

            }

        };

        $scope.loginWithNameAndPassword = function(user, pass) {

            if ($scope.loading) {
                console.log("double catch");
                return;
            }
            $ionicLoading.show({
                template: '<img src="./img/spinner.gif">'
            });
            $scope.loading = true;

            Account.loginUser(user, pass, function() {

                // WIN - Login User
                $scope.loginPassword = "";

                // store oauth tokens
                var account = Account.getAccount();
                EduApi.setOAuthTokens(account.accessToken, account.refreshToken, account.expiresIn, account.lastRefresh, Account.storeOAuthData);

                if (!Account.isLoggedIn()) {
                    $ionicPopup.alert({title: "Login fehlgeschlagen."});
                    $ionicLoading.hide();
                    $scope.loading = false;
                    return;
                }

                // get fresh profile for user from server
                EduApi.getOwnUserProfile(function(profile){

                    // WIN - Get Profile
                    Account.storeProfile(profile);
                    $timeout(function(){$rootScope.profileName = profile.profile.firstName + " " +profile.profile.lastName;},100);
                    $ionicLoading.hide();

                    $scope.finishLogin();

                }, function(){

                    // FAIL - Get Profile
                    $ionicLoading.hide();
                    $scope.loading = false;

                    // if there is a profile backup local ok - otherwise fail
                    if (typeof Account.getProfile().homeFolder === "undefined") {
                        $ionicPopup.alert({title: "Verbindung fehlgeschlagen."});
                    } else {
                        console.warn("was not able to load fresh profile after login - but using local backup");
                        $scope.finishLogin();
                    }

                });

            }, function() {

                // FAIL - Login User

                // end loading state
                $ionicLoading.hide();
                $scope.loading = false;

                // make sure old user and pass are not longer persistent
                Account.loginOut();

                // show message to user
                $ionicPopup.alert({title: 'Login fehlgeschlagen. Nutzername oder Passwort falsch?'});

            });

        };

        // trigger login in hitting enter
        $scope.passwordOnKey = function(e, user, pass, server) {
            var charCode = (e.which) ? e.which : e.keyCode;
            if (charCode===13) {
                $timeout(function(){
                    $scope.loginClick(user, pass, server);
                },10);
            }
        };

});