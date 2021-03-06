angular.module('starter.controllerIntro', [])
.controller('IntroCtrl', function($scope, $rootScope, Account, $ionicPopup, System, EduApi, $ionicLoading, $timeout, $state, $ionicHistory) {

    /*
     * INIT AND INTRO
     */

    $scope.showLoginIntro = false;
    $scope.showLoginStep = 0;
    $scope.showLoginAnim = false;

    $scope.$on('$ionicView.enter', function() {

        // just sets a flag
        System.appWentOverLoginScreen();

        // check if IONIC is ready then already start ...
        if ($rootScope.ionicReady) $scope.checkIfLoginScreenIsToShow();

    });

    // ... or IONIC still needs some time to get ready .. then wait for event
    $scope.$on('ionic-ready', function() {
        $rootScope.ionicReady = true;
        $scope.checkIfLoginScreenIsToShow();
    });

    // only call after ionic is ready
    $scope.checkIfLoginScreenIsToShow = function() {


        if (!EduApi.gotInternetConnection()) {
            $scope.noInternetExit();
            return;
        }

        // **** checkIfLoginScreenIsToShow ****

        // lock screen orientation to potrait on login screen and intro
        try {
            screen.orientation.lock('portrait');
            console.log("Screen should be locked now in potrait");
        } catch (e) {
            console.log("FAIL screen.orientation.lock('portrait')");
        }

        // determine if login intro should be shown after login
        var preLoginAccount = Account.getAccount();
        $scope.showLoginIntro =  ((typeof preLoginAccount.lastLogin === "undefined") || (preLoginAccount.lastLogin===0));

        if (!$scope.showLoginIntro) {
            $scope.continueLogin();
        }

    };

    // Button Intro Next
    $scope.clickIntroNext = function() {

        if ($scope.showLoginStep>=3) return;
        if ($scope.showLoginAnim) return;
        $scope.showLoginAnim = true;
        $timeout(function(){
            $scope.showLoginAnim=false;
            $scope.showLoginStep++;
        },800);
    };

    // Button Intro Skip or Done
    $scope.clickIntroDone = function() {
        // go select server
        $state.go('app.serverselect');
        $ionicHistory.nextViewOptions({
            historyRoot: true
        });
    };

    $scope.noInternetExit = function() {
        var alertPopup = $ionicPopup.alert({
            title: 'Internet',
            template: 'Keine Internetverbindung - bitte prüfen oder später noch einmal probieren.'
        });
        alertPopup.then(function () {

            // exit app try one
            try {
                ionic.Platform.exitApp();
            } catch (e) {
                console.log("FAILED ionic.Platform.exitApp");
            }

            // exit app try two
            try {
                navigator.app.exitApp();
            } catch (e) {
                console.log("FAILED navigator.app.exitApp");
            }

            // backup restart
            var url = window.location.href;
            url = url.substring(0,url.indexOf("#"));
            window.location.href = url;
        });
    };

    $scope.continueLogin = function() {

        // as long ionic is not ready ... wait
        if (!$rootScope.ionicReady) {
            $timeout($scope.continueLogin,500);
            return;
        }

        // check if oauth data is available
        var account = Account.getAccount();
        var clientSettings = Account.getClientSettings();

        var tryExistingAccessToken = function () {

            if ((typeof account.accessToken !== "undefined")
                && (account.accessToken.length > 0)
                && (typeof clientSettings.selectedServer !== "undefined")
                && (typeof clientSettings.selectedServer.url !== "undefined")
                && (clientSettings.selectedServer.url !== null)) {

                $rootScope.serverName = clientSettings.selectedServer.name;

                // if stored API version is too old for client (e.g. after upadte)
                // log user out and restart - so app checks again with fresh login
                // if server upadated too
                if ((typeof clientSettings.selectedServer != "undefined") &&
                    (typeof clientSettings.selectedServer.apiVersionMajor != "undefined") &&
                    (typeof clientSettings.selectedServer.apiVersionMinor != "undefined") &&
                    (!EduApi.checkVersionApi( clientSettings.selectedServer.apiVersionMajor, clientSettings.selectedServer.apiVersionMinor ))) {
                    Account.loginOut();
                    var url = window.location.href;
                    url = url.substring(0,url.indexOf("#"));
                    window.location.href = url;
                    return;
                }

                // init API url
                EduApi.setBaseUrl(
                    EduApi.serverUrls(clientSettings.selectedServer.url).api,
                    clientSettings.selectedServer.apiVersionMajor,
                    clientSettings.selectedServer.apiVersionMinor
                );

                // check if oauth is working
                EduApi.setOAuthTokens(
                    account.accessToken,
                    account.refreshToken,
                    account.expiresIn,
                    account.lastRefresh,
                    Account.storeOAuthData
                );
                $ionicLoading.show({
                    template: $rootScope.spinnerSVG
                });

                try {

                    $timeout(function () {

                        EduApi.getUserSessionInfo(function (sessionData) {

                            // WIN

                            // is still session valid ...
                            if ((sessionData !== null) && (typeof sessionData.isValidLogin !== "undefined") && (sessionData.isValidLogin)) {

                                // OK valid
                                $rootScope.isLoggedIn = true;
                                $ionicLoading.hide();
                                Account.setSessionData(sessionData);

                                // unlock screen orientation
                                try {
                                    screen.orientation.unlock();
                                    console.log("Screen should be unlocked now");
                                } catch (e) {
                                    console.log("FAIL screen.orientation.unlock()");
                                }

                                if (System.hasWebIntent()) {
                                    // got Android share intent ... jump to share screen
                                    $state.go('app.collectionadd');
                                } else {
                                    // go do default start screen
                                    $state.go('app.collections');
                                }
                                $ionicHistory.nextViewOptions({
                                    historyRoot: true
                                });

                            } else {

                                console.log("FAIL oAuth tokens were invalid.");
                                $ionicLoading.hide();

                                // if not logged in & has web intent -> show alert, stay on this page
                                if (System.hasWebIntent()) {
                                    $timer(function(){
                                        var alertPopup = $ionicPopup.alert({
                                            title: 'Login nötig',
                                            template: 'Zum Teilen bitte einloggen.'
                                        });
                                        alertPopup.then(function () { });
                                    },1000);
                                }

                                $state.go('app.login');

                            }

                        }, function () {

                            // FAIL - server or internet error
                            $ionicLoading.hide();

                            $scope.noInternetExit();

                        });

                    }, 1500);

                } catch (e) {
                    console.warn("FAIL: testing oauth");
                }

            } else {

                if ((typeof clientSettings.selectedServer === "undefined") ||
                    (typeof clientSettings.selectedServer.url === "undefined") ||
                    (clientSettings.selectedServer.url === null) ||
                    (clientSettings.selectedServer.url.length === 0)) {

                    console.log("NO SERVER SELECTED");
                    $state.go('app.serverselect');
                    $ionicHistory.nextViewOptions({
                        historyRoot: true
                    });
                }

                else {

                    console.log("GOT SERVER ("+clientSettings.selectedServer.url+") - GO LOGIN");
                    $state.go('app.login');
                    $ionicHistory.nextViewOptions({
                        historyRoot: true
                    });

                }

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
            // this normally happens on browser and android
            tryExistingAccessToken();
        }

    };

});