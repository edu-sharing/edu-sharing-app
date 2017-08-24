
angular.module('starter.controllerCollectionEdit', [])

.controller('CollectionEditCtrl', function($rootScope, $scope, $log, $location, EduApi, $ionicLoading, $timeout, $ionicHistory, $stateParams, System, $cordovaToast, Account, $cordovaKeyboard) {

    $scope.collectionId = '0';
    $scope.parentId = null;

    $scope.title = "";
    $scope.description = "";
    $scope.selectedTab = "EDU_ALL";
    $scope.validToSave = false;
    $scope.allowSetScope = false;
    $scope.focus = "";

    $scope.loadedCollection = null;

    $scope.pressedSelectorMy = function() {
        if (($scope.title.trim().length>0) && ($scope.selectedTab!=="MY")) { $scope.validToSave = true; }
        $scope.selectedTab = "MY";
    };

    $scope.pressedSelectorOrga = function() {
        if (!$scope.allowSetScope) return;
        if (($scope.title.trim().length>0) && ($scope.selectedTab!=="EDU_GROUPS")) { $scope.validToSave = true; }
        $scope.selectedTab = "EDU_GROUPS";
    };

    $scope.pressedSelectorAll = function() {
        if (!$scope.allowSetScope) return;
        if (($scope.title.trim().length>0) && ($scope.selectedTab!=="EDU_ALL")) { $scope.validToSave = true; }
        $scope.selectedTab = "EDU_ALL";
    };

    $scope.onBack = function() {
        var backView = $ionicHistory.backView();
	    if (backView!==null) backView.go();
    };

    $scope.closeKeyboard = function(nextFocus) {
        try {
            $cordovaKeyboard.close();
        } catch (e) { }
        if (typeof nextFocus !== "undefined") {
            $scope.focus = nextFocus;
        } else {
          $scope.focus = "";  
        }
    };

    $scope.isValidToSave = function(title) {

        var result = true;
        
        // general basic settings
        if (title.trim().length===0) {result = false;}

        $scope.validToSave = result;
        return result;
    };

    $scope.buttonSave = function(title,desc,scope) {
    
        if (!$scope.validToSave) return;

        title = title.trim();
        desc = desc.trim();

        $ionicLoading.show({
            template: '<img src="./img/spinner.gif">'
        });

        if ($scope.collectionId==='0') {

            /* CREATE */

            if ($scope.parentId==='_root_') $scope.parentId = "-root-";

            EduApi.createCollection('-home-', $scope.parentId, title, desc, scope, "#507997", function(result){
                // WIN
                $ionicLoading.hide();
                try {
                    $cordovaToast.show("Sammlung wurde erstellt.", 'long', 'bottom');
                } catch(e) {} 
                $timeout(function(){
                    $rootScope.$broadcast('collections:child', result.collection.ref.id);
                },700);
                $scope.onBack();
            }, function(){
                // FAIL
                $ionicLoading.hide();
                try {
                    $cordovaToast.show("Sammlung konnte nicht erstellt werden.", 'long', 'bottom')
                } catch(e) {alert('FAIL');}
            });

        } else {

            /* UPDATE */

            $scope.loadedCollection.title = title;
            $scope.loadedCollection.description = desc;           
            if (scope!="CUSTOM") $scope.loadedCollection.scope = scope;

            EduApi.updateCollection($scope.loadedCollection, function(){
                // WIN
                $ionicLoading.hide();
                try {
                    $cordovaToast.show("Änderungen wurden übernommen.", 'long', 'bottom');
                } catch(e) {} 
                $timeout(function(){
                    $rootScope.$broadcast('collections:reload', null);
                },700);
                $scope.onBack();
            }, function(){
                $ionicLoading.hide();
                try {
                    $cordovaToast.show("Sammlung konnte nicht aktualisiert werden.", 'long', 'bottom')
                } catch(e) {alert('FAIL');}
            });

        }

    };

    $scope.$on('$ionicView.enter', function() {

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
        if ($scope.parentId === 'null') $scope.parentId = null;

        var checkScope = function() {

            EduApi.getUserSessionInfo(function(sessionData){
                // WIN

                // store session data in account
                JSON.stringify(sessionData);
                Account.setSessionData(sessionData);

                // check if user is allowed to set group/public scope
                $scope.allowSetScope = Account.hasToolPermission("TOOLPERMISSION_INVITE");
                if (!$scope.allowSetScope) $scope.selectedTab = "MY";

                $ionicLoading.hide();

            }, function(){
                // FAIL
                $ionicLoading.hide();
                console.warn("FAILED LOADING SESSION DATA");
                $scope.onBack();
            });

        };

        $ionicLoading.show({
            template: '<img src="./img/spinner.gif">'
        });

        if ($scope.collectionId!=='0') {

            EduApi.getCollection($scope.collectionId, function(data){
                // WIN

                $scope.loadedCollection = data;

                $scope.title = data.title;
                $scope.description = data.description;
                $scope.selectedTab = data.scope;

                checkScope();

            }, function(e){
                // FAIL
                $ionicLoading.hide();
                console.warn("FAILED LOADING COLLECTION("+$scope.collectionId+") --> "+JSON.stringify(e));
                $scope.onBack();
            });
        } else {

            checkScope();
        }



    });

    $scope.$on('$ionicView.leave', function() {

        console.log("leave");

        // BACK Button unbind
        $scope.onBackUnbind();

    });

});