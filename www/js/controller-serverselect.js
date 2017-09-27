angular.module('starter.controllerServerselect', [])
.controller('ServerSelectCtrl', function($scope, $rootScope, $location, Account, $ionicPopup, EduApi, $ionicLoading) {

    $scope.loading = true;

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

    };

    $scope.clickServerDirectory = function(server) {

        // persist selected server
        var clientSettings = Account.getClientSettings();
        clientSettings.selectedServer = server;
        Account.storeClientSettings(clientSettings);

        // go to login page
        $location.path("/app/login");
    };

    // TODO
    $scope.clickServerCustom = function() {
        alert("TODO: set own server");
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