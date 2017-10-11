angular.module('starter.controllerSearch', [])

.controller('SearchCtrl', function($rootScope, $scope, $log, Account, $location, EduApi, $ionicPopup, System, $ionicScrollDelegate, $ionicLoading, $timeout, Share, $ionicPlatform, $ionicSideMenuDelegate, Toolbox) {

    $scope.actualSearchWord = "";

    $scope.loadPerBatch = 16;
    $scope.moreResultsAvailable = false;
    $scope.actualSkipCount = 0;

    $scope.loading = false;
    $scope.startInfo = true;
    $scope.error = "";
    $scope.empty = true;
    $scope.cacheTS = 0;
    $scope.nodeData = {
        nodes: [],
        pagination: {
            count: 0,
            from: 0,
            total: 0
        }
    };
    $scope.showIntro = false;

    $scope.breadCrumbs = [];

    $scope.setIntroShown = function() {
        var clientSettings = Account.getClientSettings();
        clientSettings.introShownSearch = true;
        Account.storeClientSettings(clientSettings);
        $scope.showIntro = false;
    };

    // BACK button receiver
    $scope.onBack = function() {
        if ($rootScope.actionSheet) return;
        $scope.back();
    };
    $scope.onBackUnbind = $scope.$on('button:back',$scope.onBack);

   $scope.back = function() {
        if ($scope.breadCrumbs.length>1) {
            //console.log("$scope.breadCrumbs - before",$scope.breadCrumbs);
            var previousSearch = $scope.breadCrumbs[$scope.breadCrumbs.length-2];
            $scope.breadCrumbs = $scope.breadCrumbs.slice(0,$scope.breadCrumbs.length-1);
            //console.log("previousSearch",previousSearch);
            //console.log("$scope.breadCrumbs - after",$scope.breadCrumbs);
            $scope.startSearch(previousSearch);
            $timeout(function(){
                $rootScope.$broadcast('search:keyword:set', previousSearch);
            },100);
        } else {
            $ionicSideMenuDelegate.toggleLeft();
        }
    };

    // when the user long taps an item
    $scope.longPressItem = function(item) {

        if (!$rootScope.multiSelectionMode) {

            /* ACTIVATE MULSTI SELECT */

            // make sure all items are unselected
            if (typeof $scope.nodeData.nodes !== "undefined") {
                for (var i=0; i < $scope.nodeData.nodes.length; i++) {
                   $scope.nodeData.nodes[i].isSelected = false;
                }    
            }
            // preselect log press item
            item.isSelected = true;
            $rootScope.multiSelection = [item];

            // activate multi select
            $rootScope.multiSelectionMode = true;
            $timeout(function(){
                $rootScope.multiSelectionText = "1 BEARBEITEN";
            },800);

        } else {

            /* DEACTIVATE MULTI SELECT */

            // deselect all selected
            if (typeof $rootScope.multiSelection !== "undefined") {
                   for (var i=0; i < $rootScope.multiSelection.length; i++) {
                   $rootScope.multiSelection[i].isSelected = false;
                }     
            }

            // deactivate multi select
            $rootScope.multiSelection = [];
            $rootScope.multiSelectionMode = false;
        }

    };

    $scope.$on('$ionicView.enter', function() {

        System.checkIfAppNeedFreshStart();

        $scope.serverBase = Account.getClientSettings().selectedServer.url;

        // force to tiles - because search is always in tiles at the moment
        $rootScope.contentViewMode="tiles"; 

        $log.debug("Enter Search View");
        $scope.cacheTS = new Date().getTime();

        // if user is not logged in -> go to login screen
        if (!Account.isLoggedIn()) {
            Account.rememberPathBeforeLogin($location.$$path);
            //console.log("--> /app/login from WorkspaceCtrl (1)");
            $location.path("/app/login");
            return;
        }

        // check if intro was shown
        var clientSettings = Account.getClientSettings();
        if (typeof clientSettings.introShownSearch === "undefined") {
            clientSettings.introShownSearch = false;
            Account.storeClientSettings(clientSettings);
        }
        $scope.showIntro = !clientSettings.introShownSearch;

        if ($scope.empty) {
            $scope.breadCrumbs.push("*");
            $scope.startSearch("*");
        }

    });

    // trigger search from outside (normally its from the header bar)
    $scope.$on('search:keyword', function(event, data) {

        // invalid intro screen if search gets fired
        if ($scope.showIntro) $scope.setIntroShown();

        // add breadCrumb
        $scope.breadCrumbs.push(data);
        $scope.startSearch(data);
    });

    $rootScope.$on('app:resume', function() {
        //console.log("resume on search");
        var lastSearch = "*";
        if ($scope.breadCrumbs.length>0) lastSearch = $scope.breadCrumbs[$scope.breadCrumbs.length-1];
        $scope.startSearch(lastSearch);
    });

    // search for keyword
    $scope.startSearch = function(data) {

        // remove focus from input to make soft-keyboard close on mobile
        try {
            document.activeElement.blur();
            document.getElementById("searchareabutton").focus();
        } catch (e) {
            console.warn("FAILED TextInput Blur");
        }

        $scope.startInfo = false;
        $scope.loading = false;
        $scope.error = "";
        $scope.empty = false;
        $ionicLoading.show({
            template: $rootScope.spinnerSVG
        });
        $scope.actualSearchWord = data;
        $scope.actualSkipCount = 0;
        EduApi.searchNodes(data, $scope.loadPerBatch , $scope.actualSkipCount, function(data) {
            // WIN
            $scope.actualSkipCount = $scope.loadPerBatch ;
            $scope.moreResultsAvailable = (data.pagination.total>(data.pagination.from+data.pagination.count));

            $scope.nodeData = Toolbox.afterProcessNodeDataFromServer(data, function(numberOfValidNodes){
                $scope.empty=(numberOfValidNodes===0);
            });
            $scope.loading = false;
            $ionicLoading.hide();

            $timeout(function(){
                $ionicScrollDelegate.scrollTop();
            },200);

        }, function(err) {
            // FAIL
            $scope.loading = false;
            $scope.error = "FAILED SEARCH: "+JSON.stringify(err);
            $ionicLoading.hide();
        });
    };

    $scope.itemClick = function(item) {

        // when loading is going on
        if ($scope.loading) {
            console.log("itemClick: double event prevent");
            return;
        }

        // when multi select mode is running
        if ($rootScope.multiSelectionMode) {
            if (item!==null) {
                if (typeof item.isSelected === "undefined") item.isSelected = false;
                item.isSelected = !item.isSelected;
                if (item.isSelected) {
                    // add to selection
                    $rootScope.multiSelection.push(item);
                } else {
                    // remove from selection
                    for(var i = $rootScope.multiSelection.length - 1; i >= 0; i--) {
                        if($rootScope.multiSelection[i] === item) {
                            $rootScope.multiSelection.splice(i, 1);
                        }
                    }
                }
            }

            if ($rootScope.multiSelection.length===0) {
                $rootScope.multiSelectionText = "ALLE AUSWÄHLEN";
            } else {
                $rootScope.multiSelectionText = $rootScope.multiSelection.length+" BEARBEITEN";
            }

            return;
        }

        // click on single selection
        if (typeof item.contentUrl !== "undefined") {

                // unregister Back Button
                $scope.onBackUnbind();
                Toolbox.showItemDetailsModal($scope, item.ref.id, function() {
                    // WHEN DONE - reregister Back Button
                    $scope.onBackUnbind = $scope.$on('button:back',$scope.onBack);
                });          
                
        } else {
            console.log("node "+item.ref.id+" clicked but missing contentUrl");
        }
    };

    $scope.secondaryItemClick = function($event, item) {

        if ($event) {
            if ($event.stopPropagation) $event.stopPropagation();
            if ($event.preventDefault) $event.preventDefault();
            $event.cancelBubble = true;
            $event.returnValue = false;
        }

        if (item.typeStyle==='file') {
            Toolbox.downloadItem(item, function() {
                // DONE
            });
        } else {
            $scope.itemClick(item);
        }
    };

    $scope.loadMore = function() {

        //console.log("Load More scope.moreResultsAvailable("+$scope.moreResultsAvailable+") scope.empty("+$scope.empty+")");

        if (($scope.empty) || (!$scope.moreResultsAvailable)) {
            $timeout(function(){
                $scope.$broadcast('scroll.infiniteScrollComplete');
            }, 500);
            return;
        }

        EduApi.searchNodes($scope.actualSearchWord, $scope.loadPerBatch , $scope.actualSkipCount, function(data) {
            // WIN
            $scope.actualSkipCount += $scope.loadPerBatch ;
            $scope.moreResultsAvailable = (data.pagination.total>(data.pagination.from+data.pagination.count));

            var loadingResult = Toolbox.afterProcessNodeDataFromServer(data, function(){});

            for (var i=0; i < loadingResult.nodes.length; i++) {
                $scope.nodeData.nodes.push( loadingResult.nodes[i] );
            }

            $scope.$broadcast('scroll.infiniteScrollComplete');

        }, function(err) {

            // FAIL
            $scope.error = "FAILED SEARCH: "+JSON.stringify(err);
            $scope.$broadcast('scroll.infiniteScrollComplete');

        });
    }

});