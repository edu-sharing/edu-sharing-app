angular.module('starter.controllerServerselect', [])
.controller('ServerSelectCtrl', function($scope, $rootScope, Account, $ionicPopup, EduApi, $ionicLoading, $state, $timeout) {

    $scope.loading = true;
    $scope.showEnterCustomServer = false;
    $scope.customServerError = "";
    $scope.customUrl = "";

    $scope.$on('$ionicView.enter', function () {
        $scope.loadPublicServerList();
    });

    // load the available public servers
    $scope.loadPublicServerList = function() {

        $scope.loading = true;
        $ionicLoading.show({
            template: $rootScope.spinnerSVG
        });

        // real request from internet
        EduApi.loadPublicServerList(function(json){
            // WIN
            $scope.serverDirectory = json;
            $scope.loading = false;
            $ionicLoading.hide();
        },function(){
            // FAIL
            $scope.serverDirectory = [];
            $scope.loading = false;
            $ionicLoading.hide();
        });

        // check if custom server was set before
        var clientSettings = Account.getClientSettings();
        if ((typeof clientSettings.selectedServer != "undefined") && (clientSettings.selectedServer != null)) {
            if ((typeof clientSettings.selectedServer.custom != "undefined") && (clientSettings.selectedServer.custom)) {
                $scope.customUrl = clientSettings.selectedServer.url;
                if ($scope.customUrl.endsWith("/edu-sharing/")) $scope.customUrl = $scope.customUrl.substr(0, $scope.customUrl.length-13);
            }
        }

    };

    $scope.clickServerDirectory = function(server) {

        // persist selected server
        var clientSettings = Account.getClientSettings();
        clientSettings.selectedServer = server;
        Account.storeClientSettings(clientSettings);

        // go to login page
        $state.go('app.login');
    };

    $scope.clickServerCustom = function() {
        $scope.showEnterCustomServer = true;
        $scope.changeServerCustom($scope.customUrl);
    };

    $scope.clickServerCustomCancel = function() {
        $scope.showEnterCustomServer = false;
    };

    $scope.changeServerCustom = function(url) {

        $scope.customServerError = "";

        if (typeof url == "undefined") return;
        if (url == null) return;

        if (url.toLowerCase().indexOf(" ")>-1)
            $scope.customServerError = "Adresse darf keine Leerzeichen enthalten.";

        if (url.toLowerCase().indexOf("http:")==0)
            $scope.customServerError = "Verbindungen ohne https sind nicht sicher.";
    };

    $scope.clickServerCustomOK = function(url) {

        // fix up URL
        if (url==null) return;
        url = url.trim();
        if (url.toLowerCase().indexOf('http')<0) url = "https://" + url;

        $ionicLoading.show({
            template: $rootScope.spinnerSVG
        });


        var whenUrlIsWorking = function(url) {

            $ionicLoading.show({
                template: '<div style="background-color: white; border-radius: 8px; padding: 16px; ">'
                +'<i class="icon ion-checkmark-circled"  style="color: green; font-size:300%; "></i></div>'
            });

            $timeout(function(){

                // prepare URL for displaying
                var shortUrl = url;
                var pathBeginsIndex = url.indexOf('/',8);
                if (pathBeginsIndex > 8) shortUrl = url.substring(0,pathBeginsIndex);

                // extract name from url
                var name = shortUrl;
                if (name.indexOf('https://')===0) name = name.substring(8);
                if (name.indexOf('http://')===0) name = name.substring(7);
                if (name.indexOf('www.')===0) name = name.substring(4);

                var customServer = {
                    "name" : name,
                    "url"  : url,
                    "urlDisplay" : shortUrl,
                    "image": "img/server_custom.png",
                    "custom" : true
                };

                // persist selected server
                var clientSettings = Account.getClientSettings();
                clientSettings.selectedServer = customServer;
                Account.storeClientSettings(clientSettings);

                $scope.showEnterCustomServer = false;
                $ionicLoading.hide();
                $state.go('app.login');
            },2000);

        };

        var whenUrlIsNotWorking = function(url1, url2) {
            $scope.customServerError = "Verbindungstest hat nicht geklappt.";
            $ionicPopup.alert({
                title: 'Verbindung nicht möglich',
                template: '<div style="padding-top: 0px; padding-left: 6px; margin-top: -13px;">'
                +'<span style="font-size:75%;">'+url1+'</span><br>'
                +'Bitte Serveradresse und ggf. Internetverbindung prüfen.<br></div>'
            }).then(function() {});
        };

        EduApi.testServer(url, function(){
            // WIN

            $ionicLoading.hide();
            whenUrlIsWorking(url);

        }, function(){
            // FAIL

            var orgUrl = url;

            // try to fix url a bit more
            if (url.indexOf('/edusharing')>10) url = url.replace("/edusharing", "/edu-sharing");
            if (url.endsWith("/edu-sharing")) url = url + "/";
            if ((url.endsWith("/")) && (!url.endsWith("edu-sharing/"))) url = url + "edu-sharing/";
            if (!url.endsWith("/edu-sharing/")) url = url + "/edu-sharing/";

            // try again
            EduApi.testServer(url, function(){

                // WIN

                $ionicLoading.hide();
                whenUrlIsWorking(url);

            }, function() {

                // FAIL
                $ionicLoading.hide();
                whenUrlIsNotWorking(orgUrl, url);

            });

        });

    };

    /*


            // check that url/server is set
            if ((typeof server.url === "undefined") || (server.url===null) || (server.url.trim().length===0) || (server.url==='https://')) {
                $scope.serverAnimationPulsateSimple=true;
                $scope.focus="server";
                $timeout(function(){$scope.serverAnimationPulsateSimple=false;},2000);
                return;
            }


    $scope.selectSeverDialog = function() {

        $ionicLoading.hide();

        $scope.setServer = function(server) {
            $scope.loginServer = server;
            $scope.serverChoosePopup.close();
        };

        // remove cursor from input fields
        document.getElementById("login-username").blur();
        document.getElementById("login-password").blur();
        document.getElementById("login-server").blur();

        $scope.serverChoosePopup = $ionicPopup.show({
            templateUrl: './templates/pop-selectserver.html',
            title: null,
            subTitle: null,
            cssClass: 'serverselect',
            scope: $scope,
            buttons: []
        });
    };
    */

    $scope.isUrlUnsave = function(url) {
        if (typeof url === "undefined") return false;
        if (url===null) return false;
        return url.trim().indexOf("http:") === 0;
    };

});