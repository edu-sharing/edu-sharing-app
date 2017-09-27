angular.module('starter.controllerIntro', [])
.controller('IntroCtrl', function($scope, $rootScope, $location, Account, $ionicPopup, System, EduApi, $ionicLoading, $timeout) {

    $scope.loading = true;

    /*
     * INIT AND INTRO
     */

    $scope.showLoginIntro = false;
    $scope.showLoginStep = 0;
    $scope.showLoginAnim = false;

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

    // either IONIC still needs some time to get ready .. then wait for event
    $scope.$on('ionic-ready', function() {
        $scope.checkIfLoginScreenIsToShow();
    });

    // or IONIC is ready then ... then already start
    if ($rootScope.ionicReady) $scope.checkIfLoginScreenIsToShow();

    // Button Intro Next
    $scope.clickIntroNext = function() {
        if ($scope.showLoginStep>=4) return;
        if ($scope.showLoginAnim) return;
        $scope.showLoginAnim = true;
        $timeout(function(){
            $scope.showLoginAnim=false;
            $scope.showLoginStep++;
        },800);
    };

    // Button Intro Skip or Done
    $scope.clickIntroDone = function() {
        $location.path("/app/serverselect");
    };

    $scope.onEnter = function() {

        // as long ionic is not ready ... wait
        if (!$rootScope.ionicReady) {
            $timeout($scope.onEnter,500);
            return;
        }

        // lock screen orientation to potrait on login screen and intro
        try {
            screen.orientation.lock('portrait');
        } catch (e) {
            console.log("FAIL screen.orientation.lock('portrait')");
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
                    template: $rootScope.spinnerSVG
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
                                alert("SESSION OK --> TODO: finsihLogin");

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
            tryExistingAccessToken();
        }

    };

    $scope.$on('$ionicView.enter', function () {
        $scope.onEnter();
    });

    // TODO manage Landscape fix and release
    $scope.$on('$ionicView.leave', function() {

        // unlock screen orientation on leave
        try {
            screen.orientation.unlock();
        } catch (e) {
            alert("FAIL screen.orientation.unlock()");
        }

    });

});