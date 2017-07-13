
angular.module('starter.controllerCollectionEdit', [])

.controller('CollectionEditCtrl', function($rootScope, $scope, $log, $location, EduApi, $ionicLoading, $timeout, $ionicHistory, $stateParams, System, $cordovaToast, Account) {

    $scope.collectionId = '0';
    $scope.parentId = null;

    $scope.title = "";
    $scope.description = "";
    $scope.selectedTab = "EDU_ALL";
    $scope.validToSave = false;

    $scope.loadedCollection = null;

    $scope.pressedSelectorMy = function() {
        $scope.isValidToSave($scope.title, $scope.description, $scope.selectedTab);
        $scope.selectedTab = "MY";
    };

    $scope.pressedSelectorOrga = function() {
        $scope.isValidToSave($scope.title, $scope.description, $scope.selectedTab);
        $scope.selectedTab = "EDU_GROUPS";
    };

    $scope.pressedSelectorAll = function() {
        $scope.isValidToSave($scope.title, $scope.description, $scope.selectedTab);
        $scope.selectedTab = "EDU_ALL";
    };

    $scope.onBack = function() {
        $backView = $ionicHistory.backView();
	    if ($backView!=null) $backView.go();
    };

    $scope.isValidToSave = function(title,desc,scope) {

        var result = true;
        
        // general basic settings
        if (title.trim().length==0) result=false;

        $scope.validToSave = result;
        console.log(result);
        return result;
    };

    $scope.buttonSave = function(title,desc,scope) {
    
        if (!$scope.validToSave) return;

        title = title.trim();
        desc = desc.trim();

        $ionicLoading.show({
            template: '<img src="./img/spinner.gif">'
        });

        if ($scope.collectionId=='0') {

            /* CREATE */

            if ($scope.parentId=='_root_') $scope.parentId = "-root-";

            EduApi.createCollection('-home-', $scope.parentId, title, desc, scope, "#507997", function(result){
                // WIN
                $ionicLoading.hide();
                try {
                    $cordovaToast.show("OK - Sammlung wurde erstellt", 'long', 'bottom');
                } catch(e) {} 
                $timeout(function(){
                    $rootScope.$broadcast('collections:child', result.collection.ref.id);
                },700);
                $scope.onBack();
            }, function(e){
                // FAIL
                $ionicLoading.hide();
                try {
                    $cordovaToast.show("Sammlung konnte nicht erstellt werden", 'long', 'bottom')
                } catch(e) {alert('FAIL');}
            });

        } else {

            /* UPDATE */

            $scope.loadedCollection.title = title;
            $scope.loadedCollection.description = desc;           
            $scope.loadedCollection.scope = scope; 

            EduApi.updateCollection($scope.loadedCollection, function(){
                // WIN
                $ionicLoading.hide();
                try {
                    $cordovaToast.show("Speichern OK", 'long', 'bottom');
                } catch(e) {} 
                $timeout(function(){
                    $rootScope.$broadcast('collections:reload', null);
                },700);
                $scope.onBack();
            }, function(){
                $ionicLoading.hide();
                try {
                    $cordovaToast.show("Sammlung konnte nicht aktualisiert werden", 'long', 'bottom')
                } catch(e) {alert('FAIL');}
            });

        }

    };

    $scope.$on('$ionicView.enter', function(e) {

        $timeout(function(){
            $rootScope.displayDiv = "display:block;";
        },300);

        System.checkIfAppNeedFreshStart();

        // if user is not logged in -> go to login screen
        if (!Account.isLoggedIn()) {
            Account.rememberPathBeforeLogin($location.$$path);
            $location.path("/app/login");
            return;
        }

        // BACK button receiver
        $scope.onBackUnbind = $scope.$on('button:back',$scope.onBack);

        $scope.collectionId = $stateParams.id;
        $scope.parentId = $stateParams.second;
        if ($scope.parentId == 'null') $scope.parentId = null;

        if ($scope.collectionId!='0') {

            $ionicLoading.show({
                template: '<img src="./img/spinner.gif">'
            });

            EduApi.getCollection($scope.collectionId, function(data){
                // WIN

                $ionicLoading.hide();
                $scope.loadedCollection = data;

                $scope.title = data.title;
                $scope.description = data.description;
                $scope.selectedTab = data.scope;

            }, function(e){
                // FAIL
                $ionicLoading.hide();
                console.warn("FAILED LOADING COLLECTION("+$scope.collectionId+") --> "+JSON.stringify(e));
                $scope.onBack();
            });
        }

    });

    $scope.$on('$ionicView.leave', function(e) {

        console.log("leave");

        // BACK Button unbind
        $scope.onBackUnbind();

    });

});