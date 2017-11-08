
angular.module('starter.controllerCollections', [])

.controller('CollectionsCtrl', function($rootScope, $scope, $log, Account, $location, EduApi, $ionicPopup, System, $ionicScrollDelegate, $ionicLoading, $timeout, Share, $ionicPlatform, $ionicHistory, $ionicSideMenuDelegate, Toolbox, $state, $ionicViewSwitcher, $cordovaToast) {

    $scope.cacheTS = 0;

    $scope.isRoot = true;
    $scope.actualCollection = null;

    $scope.selectedTab = "";
    $scope.breadCrumbs = [];

    $scope.contentViewMode = "tiles";
    $scope.collections = [];
    $scope.contentReferences = [];

    $scope.collectionDivStyle = {};

    $scope.showOrgaTab = false;

    $scope.onBack = function() {
        if ($rootScope.actionSheet) return;
        console.log("Collections Back Button");
        if (($scope.breadCrumbs.length>0) && ($scope.actualCollection!==null)) {
            $scope.breadCrumbClick($scope.breadCrumbs[$scope.breadCrumbs.length-1]);
        } else {
            $ionicSideMenuDelegate.toggleLeft();
        }
    };

    // BACK button receiver
    $scope.onBackUnbind = $scope.$on('button:back',$scope.onBack);

    $scope.reload = function() {
        if ($scope.isRoot) {
            if ($scope.selectedTab==='all') {
                $scope.pressedSelectorAll();
            } else
            if ($scope.selectedTab==='orga') {
                $scope.pressedSelectorOrga();
            } else {
                $scope.pressedSelectorMy();  
            }
        } else {
            $scope.itemClick($scope.actualCollection);
        }
        $ionicHistory.goBack();
    };

    $scope.pressedSelectorMy = function() {
        $scope.emptyRoot = false;
        $scope.emptySub = false;
        $scope.breadCrumbs = [{name:'Meine', nodeId:'-MY'}];
        $scope.collections = [];
        $scope.actualCollection = null;
        $scope.selectedTab = "my";
        $scope.loadCollections('-root-','MY');
    };

    $scope.pressedSelectorOrga = function() {
        $scope.emptyRoot = false;
        $scope.emptySub = false;
        $scope.breadCrumbs = [{name:'Organisationen', nodeId:'-ORGA'}];
        $scope.collections = [];
        $scope.actualCollection = null;
        $scope.selectedTab = "orga";
        $scope.loadCollections('-root-','EDU_GROUPS');    
    };

    $scope.pressedSelectorAll = function() {
        $scope.emptyRoot = false;
        $scope.emptySub = false;
        $scope.breadCrumbs = [{name:'Alle', nodeId:'-ALL'}];
        $scope.collections = [];
        $scope.actualCollection = null;
        $scope.selectedTab = "all";
        $scope.loadCollections('-root-',"EDU_ALL");
    };

    $scope.loadCollections = function(parentId, scopeStr) {

        // determine if parent collection can be edited
        $rootScope.headerShowEditCollection = false;
        $rootScope.headerShowNewCollection = false;
        if ($scope.actualCollection===null) {
            $rootScope.headerShowNewCollection = true;
        } else {
            if (typeof $scope.actualCollection.fromUser === "undefined") $scope.actualCollection.fromUser = true;
            $rootScope.headerShowEditCollection = $scope.actualCollection.fromUser;
            $rootScope.headerShowNewCollection = $rootScope.headerShowEditCollection;
        }

        $ionicLoading.show({
            template: $rootScope.spinnerSVG
        });

        EduApi.getCollections(parentId, function(data){
            // WIN

            // reset error
            $scope.error = "";
            $scope.isRoot = (parentId === '-root-');

            if ($scope.isRoot) {
                $scope.collectionDivStyle = {
                    'display': "table",
                    'min-width': "350px"
                };
            } else {
                $scope.collectionDivStyle = {
                    'display': "table",
                    'width': "100%"
                };
            }

            // set collections with internal typeStyle
            $scope.collections = data.collections;
            for (var i=0; i<$scope.collections.length; i++) {
                $scope.collections[i].typeStyle = "collection";
                $scope.collections[i].name = $scope.collections[i].title;
                if ($scope.collections[i].color===null) $scope.collections[i].color = "#759CB7";
            }

            // set content of collection with typeStyle
            $scope.contentReferences = [];
            for (var i=0; i<data.references.length; i++) {

                var contentItem = data.references[i].reference;

                // validate data
                if (typeof contentItem === "undefined") {
                    console.log("data.references contains UNDEFINED item - ignoring");
                    continue;
                }
                if (contentItem === null) {
                    console.log("data.references contains NULL item - ignoring");
                    continue;
                }

                // determine typestyle for content references
                if (contentItem.type.indexOf("ccm:io") >= 0) {
                    // default is file
                    contentItem.typeStyle = "file";
                    // check properties if maybe a link
                    if ((typeof contentItem.mediatype !== "undefined") && (contentItem.mediatype!==null) && ((contentItem.mediatype==="file-link") || contentItem.mediatype==="link")) {
                        contentItem.typeStyle = "link";
                    }
                }

                // reset name
                if ((typeof contentItem.title !== "undefined") && (contentItem.title!=="")) contentItem.name = contentItem.title;
                contentItem.collection = parentId;

                // add to list
                $scope.contentReferences.push(contentItem);
            }

            // check if empty
            $scope.emptyRoot = ((parentId==="-root-") && ($scope.collections.length===0));
            $scope.emptySub = ((parentId!="-root-") && ($scope.collections.length===0) && ($scope.contentReferences.length===0));

            if (!$scope.isRoot) {

                // refresh data of open collection
                EduApi.getCollection(parentId, function(parentData){
                    // WIN
                    $scope.actualCollection = parentData;
                    Toolbox.setLatestCollection(parentData);
                    $ionicLoading.hide();
                }, function(){
                    // FAIL
                    $ionicLoading.hide();
                    console.warn("Was not able to refresh data of open collection with id("+parentId+")");
                });

            } else {
                $ionicLoading.hide();
            }

            // scroll to top after screen is build
            $timeout(function(){
                $ionicScrollDelegate.scrollTop();
            },100);

        }, function(err){
            // FAIL
            $scope.error = "Fehler beim Laden der Daten: "+JSON.stringify(err);
            $ionicLoading.hide();
        },scopeStr);
    };

    $scope.$on('$ionicView.enter', function() {

        $scope.serverBase = Account.getClientSettings().selectedServer.url;

        System.checkIfAppNeedFreshStart();
        $scope.cacheTS = new Date().getTime();

        $ionicHistory.clearHistory();
        $ionicHistory.clearCache();

        // if user is not logged in -> go to login screen
        if (!Account.isLoggedIn()) {
            Account.rememberPathBeforeLogin($location.$$path);
            $location.path("/app/login");
            return;
        }

        if (($scope.collections.length===0) && ($scope.actualCollection ===  null)) {
            $scope.pressedSelectorMy();
            return;
        }

        // when in sub
        if (!$scope.isRoot) $scope.loadCollections($scope.actualCollection.ref.id, "EDU_ALL");

        // when root
        if ($scope.isRoot) {

            EduApi.getUsersOrganization(function (organizations) {
                // WIN          
                $scope.showOrgaTab = organizations.length>0;
            }, function (e) {
                // FAIL
                console.log("LOADING ORGAS FAIL");
                console.dir(e);
            });

            // refresh
            if ($scope.selectedTab==="my") $scope.loadCollections('-root-','MY');
            if ($scope.selectedTab==="orga") $scope.loadCollections('-root-','EDU_GROUPS');
            if ($scope.selectedTab==="all") $scope.loadCollections('-root-',"EDU_ALL");
        }

    });

    $scope.$on('collections:reload', function() {
        $scope.loadCollections($scope.actualCollection.ref.id, "EDU_ALL");
    });

    $rootScope.$on('app:resume', function() {
        console.log("resume on collections");
        try {
            if ($scope.actualCollection===null) {
                if ($scope.selectedTab==="my") $scope.loadCollections('-root-','MY');
                if ($scope.selectedTab==="orga") $scope.loadCollections('-root-','EDU_GROUPS');
                if ($scope.selectedTab==="all") $scope.loadCollections('-root-',"EDU_ALL");
            } else {
                $scope.loadCollections($scope.actualCollection.ref.id, "EDU_ALL");
            }
        } catch (e) {
            alert("FAIL app:resume --> "+JSON.stringify(e));
        } 
    });
    
    $scope.$on('collection:new', function() {
        $scope.createNewCollection();
    });

    $scope.createNewCollection = function() {
        console.log("new",$scope.actualCollection);
        $timeout(function () {
            var parentId = "_root_";
            if ($scope.actualCollection !==null) parentId = $scope.actualCollection.ref.id;
            $location.path("/app/collectionedit/0/"+parentId );
        }, 100);
    };

    $scope.$on('collection:edit', function() {
        console.log("edit",$scope.actualCollection);
        $timeout(function () {
            $location.path("/app/collectionedit/"+$scope.actualCollection.ref.id+"/null");
        }, 100);
    });

    $scope.$on('collection:delete', function() {

        console.log("Collection delete");

        var confirmPopup = $ionicPopup.confirm({
                title: 'Sammlung wirklich löschen?',
                template: '',
                cancelText: 'ABBRECHEN',
                okText: 'LÖSCHEN',
                cssClass: 'popup-confirm-delete'
            });

        confirmPopup.then(function(res) {
            if(res) {
                EduApi.deleteCollection($scope.actualCollection, function() {
                    // WIN

                    $rootScope.lastActiveCollection = null;
                    try {
                        var message = "Sammlung wurde gelöscht.";
                        $cordovaToast.show(message, 'long', 'bottom');
                    } catch (e) {}

                    $scope.onBack();
                },function() {
                    // FAIL
                    alert("Die Sammlung konnte nicht gelöscht werden.");
                });
            }
        });

    });

    $scope.$on('collections:child', function(event, data) {
        // simulate click
        if ($scope.actualCollection === null) $scope.breadCrumbs = [{name:'Meine', nodeId:'-MY'}];

        $ionicLoading.show({
            template: $rootScope.spinnerSVG
        });

        $timeout(function(){
            $ionicLoading.hide();
            $scope.itemClick({
                ref : {
                    repo: $scope.actualCollection!==null ? $scope.actualCollection.ref.repo : "repo",
                    id: data
                },
                typeStyle: "collection"
            });
        },500);

    });

    $scope.goSearch = function() {
        $state.go('app.search');
    };

    $scope.itemClick = function(item) {
        
        // if collection ...
        if (item.typeStyle==="collection") {

            if (($scope.breadCrumbs.length>0) && ($scope.actualCollection!==null)
            && ( $scope.breadCrumbs[$scope.breadCrumbs.length-1].nodeId!==$scope.actualCollection.ref.id)) $scope.breadCrumbs.push({ name: $scope.actualCollection.title, nodeId: $scope.actualCollection.ref.id});

            // remember the last collection context
            Toolbox.setLatestCollection(item);

            $scope.actualCollection = item;
            $scope.emptyRoot = false;
            $scope.emptySub = false;
            $scope.collections = []; 
            $scope.loadCollections(item.ref.id,'EDU_ALL'); 

        } else
        
        // if content reference ...
        { 

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
        }
    };

    $scope.breadCrumbClick = function(crumb) {

        /* TOP CATEGORIES */

        if (crumb.nodeId==="-MY") {
            $scope.pressedSelectorMy();
            return;
        }

        if (crumb.nodeId==="-ORGA") {
            $scope.pressedSelectorOrga();
            return;
        }

        if (crumb.nodeId==="-ALL") {
            $scope.pressedSelectorAll();
            return;
        }

        /* JUMP BACK ON CRUMB */
        
        var arrayIndex = -1;
        for (var i=0; i<$scope.breadCrumbs.length; i++) {
            if ($scope.breadCrumbs[i].nodeId===crumb.nodeId) {
                arrayIndex = i-1;
                break;
            }
        }
        if (arrayIndex>=0) {
            EduApi.getCollection(crumb.nodeId, function(data){
                // WIN
                $scope.collections = [];
                $scope.breadCrumbs = $scope.breadCrumbs.slice(0,arrayIndex+1);
                $scope.actualCollection = data;
                $scope.actualCollection.typeStyle = "collection";
                $scope.emptyRoot = false;
                $scope.emptySub = false;
                $scope.loadCollections(crumb.nodeId,'EDU_ALL');
            }, function(){
                // FAIL
                console.error("FAILED loading collection("+crumb.nodeId+")");
            });

        } else {
            alert("clicked crumb not found in breadCrumbs");
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

});