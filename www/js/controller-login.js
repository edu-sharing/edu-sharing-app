angular.module('starter.controllerLogin', [])
.controller('LoginCtrl', function($scope, $rootScope, $location, Account, $ionicPopup, System, EduApi, $ionicLoading, $timeout, $ionicHistory, $state, $cordovaToast) {

    $scope.loading = false;
    $scope.showTopSpace = true;

    $scope.loginUser = "";
    $scope.loginPassword = "";
    $scope.focus = "";

    $scope.loginServer = null;

    $scope.inputFocus = function(gotFocus) {
        $scope.showTopSpace = false;
    };

    $scope.serverBack = function() {
        // go back to server select page
        $state.go('app.serverselect');
        $ionicHistory.nextViewOptions({ disableBack: true, disableAnimate: false, historyRoot: true });
    };

    $scope.$on('$ionicView.enter', function () {

        $scope.loading = false;

        // load selected server from client settings
        var clientSettings = Account.getClientSettings();
        $scope.loginServer = clientSettings.selectedServer;
        $rootScope.serverName = clientSettings.selectedServer.name;
        
    });

    // allow landscape mode when app leaves login screen
    $scope.$on('$ionicView.leave', function() {

        // unlock screen orientation on leave
        try {
            screen.orientation.unlock();
        } catch (e) {
        }

    });

    // get called if login was success
    $scope.finishLogin = function() {

        // unlock screen orientation
        try {
            screen.orientation.unlock();
            console.log("Screen should be unlocked now");
        } catch (e) {
        }

        $rootScope.isLoggedIn = true;

        $timeout(function(){
            // after login - check what to do
            if (System.hasWebIntent()) {
                // got started by web intent -> show sharing page
                $state.go('app.collectionadd');
                $ionicHistory.nextViewOptions({ disableAnimate: true, historyRoot: true });
            } else {
                // no webIntent
                var path = Account.getPathBeforeLogin();
                if (path.length>0) {
                    Account.rememberPathBeforeLogin("");
                    $location.path(path);
                } else {
                    $state.go('app.collections');
                    $ionicHistory.nextViewOptions({ disableAnimate: true, historyRoot: true });
                }
            }
        },10);
    };

    // when user clicks login
    $scope.loginClick = function(user, pass) {

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

            var serverUrl = $scope.loginServer.url;
            if (serverUrl.length>0) {

                    serverUrl = System.buildFullApiUrlFromUserInput(serverUrl);

                    $scope.loading = true;
                    EduApi.testServer(serverUrl, function(majorVersion, minerVersion){

                        // WIN - URL OK
                        //$ionicLoading.hide();
                        $scope.loading = false;

                        // persist seleted server
                        $scope.loginServer.url = serverUrl;
                        $scope.loginServer.apiVersionMajor = majorVersion;
                        $scope.loginServer.apiVersionMinor = minerVersion;
                        var clientSettings = Account.getClientSettings();
                        clientSettings.selectedServer = $scope.loginServer;
                        Account.storeClientSettings(clientSettings);

                        // set server and login
                        EduApi.setBaseUrl(EduApi.serverUrls(serverUrl).api, majorVersion, minerVersion);
                        $scope.loginWithNameAndPassword(user, pass);

                    }, function(e) {

                        $scope.loading = false;
                        $ionicLoading.hide();

                        if ((typeof e !== "undefined") && (e.length>0)) {
                            // FAIL - with message
                            $ionicPopup.alert({
                                title: 'Verbindung nicht möglich',
                                template: '<div style="text-align: center">'+e+'<br></div>'
                            }).then(function() {});
                        } else {
                            // FAIL - URL NOT WORKING
                            $ionicPopup.alert({
                                title: 'Verbindung nicht möglich',
                                template: '<div style="text-align: center">Bitte Internetverbindung prüfen.<br></div>'
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
                template: $rootScope.spinnerSVG
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
                    //$scope.loading = false;
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
                try {
                    $cordovaToast.show("Nutzerkennung oder Passwort ist falsch. Bitte Angaben prüfen.", 'long', 'bottom');
                } catch (e) {
                    $ionicPopup.alert({title: 'Nutzerkennung oder Passwort ist falsch. Bitte Angaben prüfen.'});
                }

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