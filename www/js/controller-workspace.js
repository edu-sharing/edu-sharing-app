angular.module('starter.controllerWorkspace', [])

.controller('WorkspaceCtrl', function($rootScope, $scope, $log, Account, $location, EduApi, $ionicPopup, System, $ionicScrollDelegate, $ionicLoading, $timeout, Share, $ionicPlatform, $ionicSideMenuDelegate, Toolbox, $cordovaKeyboard, $cordovaToast, $ionicActionSheet) {

    $scope.loadPerBatch = 20;
    $scope.moreResultsAvailable = false;
    $scope.actualSkipCount = 0;

    $scope.rootNode = "";

    $scope.loading = true;
    $scope.error = "";
    $scope.empty = false;
    $scope.actualNodeId = "";
    $scope.cacheTS = 0;
    $scope.nodeData = {
        nodes: [],
        folders: [],
        items:[],
        pagination: {
            count: 0,
            from: 0,
            total: 0
        }
    };

    $scope.progress = 0;

    $scope.breadCrumbs = [];

    $log.debug("WorkspaceCtrl");

    // BACK button receiver
    $scope.onBack = function() {
        if ($rootScope.actionSheet) {
            console.log("ignore action sheet is open");
            return;
        }
        console.log("Workspace Back Button");
        if ($scope.breadCrumbs.length>1) {
            $scope.back();
        } else {
            $ionicSideMenuDelegate.toggleLeft();
        }
    };
    $scope.onBackUnbind = $scope.$on('button:back',$scope.onBack);


    $scope.setNodeRoot = function(newRoot) {

        // check if already set
        if ($scope.rootNode === newRoot) return;

        // set new root
        $scope.rootNode = newRoot;
        if ($scope.rootNode==="-userhome-") {
            $scope.breadCrumbs = [{ name: 'Meine Inhalte', nodeId: $scope.rootNode}];
        } else
        if ($scope.rootNode==="-shared_files-") {
            $scope.breadCrumbs = [{ name: 'Gemeinsame Inhalte', nodeId: $scope.rootNode}];
        } else {
            alert("unkown rootNode("+$scope.rootNode+")");
        }

        $scope.actualNodeId = $scope.rootNode;
        $scope.refreshDataFromServer();

    };

    $scope.changeRoot = function() {

            var buttons = [];

            buttons.push({ 
                action: '-userhome-',
                text: '<i class="icon ion-android-person action-sheet-icon"></i> Meine Inhalte '+( $scope.rootNode==='-userhome-' ? '<i class="icon ion-android-done action-sheet-icon-selected"></i>' : '')
            });

            buttons.push({ 
                action: '-shared_files-',
                text: '<i class="icon ion-android-people action-sheet-icon"></i> Gemeinsame Inhalte'+( $scope.rootNode==='-shared_files-' ? '<i class="icon ion-android-done action-sheet-icon-selected"></i>' : '')
            });

            // Show the action sheet
            var hidesheet = $ionicActionSheet.show({
                buttons: buttons,
                cssClass: 'select-sheet',
                titleText: 'Einstiegspunkt wählen',
                cancel: function() {
                    onEndActionSheet();
                },
                buttonClicked: function(index) {
                    onEndActionSheet();
                    if (buttons[index].action==='-userhome-') {
                        $scope.setNodeRoot("-userhome-");
                    } 
                    else if (buttons[index].action==='-shared_files-') {
                        $scope.setNodeRoot("-shared_files-");
                    } 
                    else {
                        alert("unkown action("+buttons[index].action+")");
                    }
                    return true;
                }
            });

            $rootScope.actionSheet = true;
            var unbindBack = $scope.$on('button:back',function(){
                hidesheet();
            });

            //reset back button to old function
            var onEndActionSheet = function() {
                $rootScope.actionSheet = false;
                unbindBack();
            }; 

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

    $scope.changeViewMode= function() {
        var clientSettings = Account.getClientSettings();
        if (clientSettings.workspaceViewMode==="tiles") {
           clientSettings.workspaceViewMode="list"; 
        } else {
           clientSettings.workspaceViewMode="tiles"; 
        }
       Account.storeClientSettings(clientSettings);
       $rootScope.contentViewMode = clientSettings.workspaceViewMode;
    };

    $scope.refreshDataFromServer = function(win) {

        $rootScope.editFolderNotAllowed = $scope.actualNodeId === "-shared_files-";

        $scope.loading = true;
        $scope.empty = false;
        $scope.error = "";
        $ionicScrollDelegate.scrollTop();
        $ionicLoading.show({
            template: '<img src="./img/spinner.gif">'
        });

        // remember last parent node in service
        Share.pushParentNodeId($scope.actualNodeId);

        $scope.moreResultsAvailable = false;
        $scope.actualSkipCount = 0;
        EduApi.getChildNodes($scope.actualNodeId, function(data){

            $scope.actualSkipCount += $scope.loadPerBatch ;
            $scope.moreResultsAvailable = (data.nodes.length>=$scope.loadPerBatch );

            // WIN
            $timeout(function(){
                $scope.nodeData = null;
                $scope.loading = false;
                $timeout(function(){
                    $scope.nodeData = Toolbox.afterProcessNodeDataFromServer(data, function(numberOfValidNodes){
                         $scope.empty=(numberOfValidNodes===0);
                    });
                    //console.log("NodeData",$scope.nodeData);
                    for (var i=0; i < $scope.nodeData.nodes.length; i++) {
                        if ($scope.nodeData.nodes[i].typeStyle==="folder") {
                        $scope.nodeData.folders.push( $scope.nodeData.nodes[i] );
                        } else {
                            $scope.nodeData.items.push( $scope.nodeData.nodes[i] );
                        }    
                    }
                    $ionicLoading.hide();
                    if ((typeof win !== "undefined") && (win!==null)) win();

                    // load parent node data to determine if user is allowed to edit this folder
                    EduApi.getNode("-home-",$scope.actualNodeId, function(win){
                        if (typeof win.access !== "undefined") {
                            var allowedToEdit = false;
                            for (var i=0;i<win.access.length;i++) {
                                //console.log(win.access[i]);
                                if (win.access[i]==="Write") allowedToEdit = true;
                            }
                            $rootScope.editFolderNotAllowed = !allowedToEdit;
                        }
                    }, function(){
                        console.log("FAIL - was not able to get Permissions for node: "+$scope.actualNodeId);
                    });

                },100);
            },10);
        }, function(err){
            // FAIL
            $ionicLoading.hide();
            $ionicPopup.alert({title: "Bitte Internetverbindung prüfen."});
            console.log("FAIL EduApi.getChildNodes: "+err);
            $scope.loading = false;
            $scope.error = "Der Verzeichnisinhalt konnte nicht geladen werden. Bitte Internetverbindung überprüfen und erneut probieren.";
        }, $scope.loadPerBatch, $scope.actualSkipCount);
    };

    $scope.$on('$ionicView.enter', function() {

        System.checkIfAppNeedFreshStart();

        $scope.serverBase = Account.getClientSettings().selectedServer.url;

        $log.debug("Enter Workspace View");
        $scope.cacheTS = new Date().getTime();

        // if user is not logged in -> go to login screen
        if (!Account.isLoggedIn()) {
            Account.rememberPathBeforeLogin($location.$$path);
            //console.log("--> /app/login from WorkspaceCtrl (1)");
            $location.path("/app/login");
        }

        // set view mode for data
        var clientSettings = Account.getClientSettings();
        if (typeof clientSettings.workspaceViewMode === "undefined") {
            clientSettings.workspaceViewMode = "list";
            Account.storeClientSettings(clientSettings);
        }
        $rootScope.contentViewMode = clientSettings.workspaceViewMode;

        // init on first enter and load data
        if ($scope.rootNode.length===0) $scope.setNodeRoot("-userhome-");

    });

    $rootScope.$on('app:resume', function() {
        //console.log("resume on workspace");
        $scope.refreshDataFromServer();
    });

    $scope.breadCrumbClick = function(crumb) {

        // dont when loading
        if ($scope.loading) {
            console.log("breadCrumbClick: double event prevent");
            return;
        }

        // dont show while multi select mode
        if ($rootScope.multiSelectionMode) {
            $rootScope.headerSwitchMultiselection();
            return;
        }

        // find clicked crumb in list and throw away the following
        var arrayIndex = -1;
        for (var i=0; i<$scope.breadCrumbs.length; i++) {
            if ($scope.breadCrumbs[i].nodeId===crumb.nodeId) {
                arrayIndex = i;
                break;
            }
        }
        if (arrayIndex>=0) {
            //alert("arrayIndex("+arrayIndex+")");
            $scope.actualNodeId = crumb.nodeId;
            $scope.breadCrumbs = $scope.breadCrumbs.slice(0,arrayIndex+1);
            $scope.refreshDataFromServer();
        } else {
            alert("clicked crumb not found in breadCrumbs");
        }
    };

    $scope.$on('workspace:select:all', function() {

        $rootScope.multiSelection = [];
        for (var i=0; i<$scope.nodeData.nodes.length; i++) {
            $scope.nodeData.nodes[i].isSelected = true;
            $rootScope.multiSelection.push($scope.nodeData.nodes[i]);
        }

        $scope.itemClick(null);
    });

    $scope.$on('workspace:reload', function(event, data) {
        if ($rootScope.multiSelectionMode) $rootScope.headerSwitchMultiselection();
        $scope.refreshDataFromServer(function(){
            // TODO
            console.log("TODO: scroll to item --> tile-"+data);
        });
    });

    // new folder dialog
    $scope.$on('folder:new', function(event, data) {
            $scope.data = {};
            $scope.closeKeyboard = function() {
                try {
                    $cordovaKeyboard.close();
                } catch (e) {}
            };
            $ionicPopup.show({
                template: '<input class="input-foldername" type="text" ng-model="data.name" placeholder="Name des Ordners" autofocus ng-keyup="$event.keyCode == 13 && closeKeyboard()">',
                title: 'Neuen Ordner erstellen',
                scope: $scope,
                cssClass: 'dialog-new-folder',
                buttons: [
                    { text: 'ABBRECHEN' },
                    {
                        text: 'OK',
                        type: 'button-positive',
                        onTap: function(e) {
                        if (!$scope.data.name) {
                                e.preventDefault();
                            } else {
                                $scope.data.name = $scope.data.name.trim();
                                if ($scope.data.name.length<=0) return;
                                $ionicLoading.show({
                                    template: '<img src="./img/spinner.gif">'
                                });
                                EduApi.createFolderNode($scope.actualNodeId, $scope.data.name, 
                                function(){
                                    // WIN
                                    $ionicLoading.hide();
                                    try {
                                        $cordovaToast.show("Ordner wurde erstellt.", 'long', 'bottom');
                                    } catch(e) {} 
                                     $scope.$broadcast('workspace:reload');
                                }, function(fail){
                                    // FAIL
                                    $ionicLoading.hide();
                                    if ((typeof fail !== "undefined") && (typeof fail.data.error !== "undefined") && (fail.data.error==="org.edu_sharing.restservices.DAODuplicateNodeNameException")) {
                                        $ionicPopup.alert({
                                            title: 'Hinweis',
                                            template: 'Der Name wird bereits verwendet.'
                                        });
                                        return;
                                    }
                                    console.dir(fail);
                                    $ionicPopup.alert({
                                            title: 'Hinweis',
                                            template: 'Es war nicht möglich den Ordner anzulegen.'
                                    });
                                });
                            }
                        }
                    }
                ]
            });
    });

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
        if ((item.typeStyle==='folder') || (item.typeStyle==='collection')) {
            // folder
            $scope.actualNodeId = item.ref.id;
            $scope.breadCrumbs.push({ name: item.name, nodeId: $scope.actualNodeId});
            $scope.refreshDataFromServer();
        } else {
            // content item
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

    $scope.secondaryItemClick = function($event, item) {

        // dont while loading
        if ($scope.loading) {
            console.log("secondaryItemClick: double event prevent");
            return;
        }

        // dont show while multi select mode
        if ($rootScope.multiSelectionMode) {
            console.log("no secondaryItemClick on item while multi select");
            return;
        }

        if ($event) {
            if ($event.stopPropagation) $event.stopPropagation();
            if ($event.preventDefault) $event.preventDefault();
            $event.cancelBubble = true;
            $event.returnValue = false;
        }

    
        $scope.itemClick(item);

    };

    $scope.back = function() {
        if ($scope.breadCrumbs.length>1) {
            var backCrumbIndex = $scope.breadCrumbs.length-2;
            var backCrumb = $scope.breadCrumbs[backCrumbIndex];
            $scope.breadCrumbClick(backCrumb);
        }
    };

    $scope.loadMore = function() {

        if (!$scope.moreResultsAvailable) {
            $timeout(function(){
                $scope.$broadcast('scroll.infiniteScrollComplete');
            }, 500);
            return;
        }
        EduApi.getChildNodes($scope.actualNodeId, function(data){
            // WIN

            $scope.actualSkipCount += $scope.loadPerBatch ;
            $scope.moreResultsAvailable = (data.nodes.length>=$scope.loadPerBatch );

            var loadingResult = Toolbox.afterProcessNodeDataFromServer(data, function(){});

            if ($scope.nodeData===null) $scope.nodeData = {nodes:[], folders:[], items:[]};
            for (var i=0; i < loadingResult.nodes.length; i++) {
                $scope.nodeData.nodes.push( loadingResult.nodes[i] );
                if (loadingResult.nodes[i].typeStyle==="folder") {
                    $scope.nodeData.folders.push( loadingResult.nodes[i] );
                } else {
                    $scope.nodeData.items.push( loadingResult.nodes[i] );       
                }
            }

            $scope.$broadcast('scroll.infiniteScrollComplete');

        }, function(err){
            // FAIL
            $ionicLoading.hide();
            $ionicPopup.alert({title: "Bitte Internetverbindung prüfen."});
            console.log("FAIL EduApi.getChildNodes: "+err);
            $scope.loading = false;
            $scope.error = "Der Verzeichnisinhalt konnte nicht geladen werden. Bitte Internetverbindung überprüfen und erneut probieren.";
        }, $scope.loadPerBatch, $scope.actualSkipCount);


    }

});