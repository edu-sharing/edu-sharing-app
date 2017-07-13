angular.module('starter.controllers', [])

/*
 *  AppCtrl --> contoller for header  and menu
 */

.controller('AppCtrl', function($log, $rootScope, $scope, $location, $ionicSideMenuDelegate, Account, $timeout, $window, $ionicLoading, $ionicPopup, $cordovaCamera, System, Toolbox, Share, EduApi, $ionicHistory, $ionicActionSheet) {

        $scope.activePage = "";
        $rootScope.searchword = "";

        $rootScope.editFolderNotAllowed = false;

        $scope.logout = function() {
            $ionicLoading.show({
                template: '<img src="./img/spinner.gif">'
            });
            Account.loginOut();
            window.postMessage({command: "logout", message: ""}, "*");


            var finishLogout = function(){
            $timeout(function(){
                var url = window.location.href;
                url = url.substring(0,url.indexOf("#"));
                window.location.href = url;
            },1500);
            };

            // clear iOS share extension login data
            try {
                window.AppGroupsUserDefaults.save({ suite: "group.edusharing", key: "access_token", value: "" }, function () {
                    window.AppGroupsUserDefaults.save({ suite: "group.edusharing", key: "refresh_token", value: "" }, function () {
                        window.AppGroupsUserDefaults.save({ suite: "group.edusharing", key: "expires_in", value: "0" }, function () {
                            finishLogout();
                        }, function () {
                            //alert("FAIL clean 'expires_in'");
                            finishLogout();
                        });
                    }, function () {
                        //alert("FAIL clean 'refresh_token'");
                        finishLogout();
                    });
                }, function () {
                    //alert("FAIL clean 'access_token'");
                    finishLogout();
                });
            } catch (e) {
                //Exception: when not ios - OK
                finishLogout();
            }

        };

        $scope.back = function() {
            var backView = $ionicHistory.backView();
            if ((backView!==null) && (!System.hasWebIntent())) {
                backView.go();
            } else {
                ionic.Platform.exitApp();
            }
        };

        $scope.detailDownload = function() {
            // send to detail controller
            $scope.$broadcast('detail:button:download', null);
        };

        $scope.detailOptions = function() {
            // send to detail controller
            $scope.$broadcast('detail:button:options', null);
        };

        $scope.$on('$ionicView.enter', function() {

                // push active path to scope - to highlight active selection
                $scope.activePage = $location.$$path;

                // default header bar settings
                $scope.headerShowWorkspaceOptions = false;
                $scope.headerShowOptionMore = false;
                $scope.headerShowOptionLogout = false;
                $scope.headerShowCollectionsOptions = false;

                $scope.headerShowProfile = false;
                $scope.headerShowCollections = false;
                $scope.headerShowSearch = false;
                $scope.headerShowWorkspace = false;
                $scope.headerShowShare = false;
                $scope.headerDetail = false;
                $scope.headerCollectionEdit = false;
                $scope.headerCollectionAdd = false;
                $scope.headerCollectionNew = false;

                // dont show anything when not logged in
                if (!Account.isLoggedIn()) return;

                $timeout(function(){
                // adjust header bar based on page displayed
                if ($scope.activePage === "/app/collections") {
                    $scope.headerShowCollections = true;
                    $scope.headerShowCollectionsOptions = true;
                }
                else if ($scope.activePage === "/app/search") {
                    $scope.headerShowSearch = true;
                    $scope.headerShowOptionMore = true;
                }
                else if ($scope.activePage === "/app/workspace") {
                    $scope.headerShowWorkspace = true;
                    $scope.headerShowWorkspaceOptions = true;
                    $scope.headerShowOptionMore = true;
                }
                else if ($scope.activePage === "/app/account") {
                    $scope.headerShowOptionLogout = true;
                    $scope.headerShowProfile = true;
                }
                else if ($scope.activePage === "/app/share") {
                    $scope.headerShowShare = true;
                } 
                else if ($scope.activePage.indexOf("/app/collectionedit/0") === 0) {
                    $scope.headerCollectionNew = true;
                } 
                else if ($scope.activePage.indexOf("/app/collectionedit") === 0) {
                    $scope.headerCollectionEdit = true;
                } 
                else if ($scope.activePage.indexOf("/app/collectionadd") === 0) {
                    $scope.headerCollectionAdd = true;
                } 
                },250);

        });

        /*
         * MULTISELECTION (running on rootScope)
         */

        $rootScope.multiSelectionMode = false;
        $rootScope.headerSwitchMultiselection = function() {
            $timeout(function(){
                $rootScope.multiSelectionMode = !$rootScope.multiSelectionMode;
                if ($rootScope.multiSelectionMode) {
                    // MULTI SELECT ON
                    $rootScope.multiSelectionText = "";
                    $rootScope.multiSelection = [];
                    $timeout(function(){
                        if ($rootScope.multiSelection.length===0) $rootScope.multiSelectionText = "ALLE AUSWÄHLEN";
                    },1800);
                } else {
                    // MULTI SELECT OFF
                    for (var i=0; i<$rootScope.multiSelection.length; i++) {
                        $rootScope.multiSelection[i].isSelected = false;
                    }
                }
            },10);
        };

        $rootScope.headerMultiselectAll = function() {
            if ($rootScope.multiSelection.length===0) {
                $scope.$broadcast('workspace:select:all', null);
            } else {
                Toolbox.openItemsEditDialog($scope, $rootScope.multiSelection);
            }
        };

        // called when 'search' option is pressed
        $scope.headerButtonSearch = function() {
            $timeout(function () {
                $location.path("/app/search");
            }, 100);
        };

        // called when user hits search button
        $scope.doSearch = function(str) {
            if (str.trim().length===0) str="*";
            $scope.$broadcast('search:keyword', str.trim());
        };

        // called when user types searchword
        $scope.changedSearch = function(event, str) {
            if (event.keyCode===13) {
                if (str.trim().length===0) return;
                $scope.$broadcast('search:keyword', str.trim());
            }
        };

        $scope.headerButtonNewCollection = function() {
            $rootScope.displayDiv = "";
            $scope.$broadcast('collection:new');
        };

        $scope.headerButtonNewFolder = function() {
            $scope.$broadcast('folder:new');
        };

        $scope.headerButtonEditCollection = function() {
            $rootScope.displayDiv = "";
            $scope.$broadcast('collection:edit');
        };

       $scope.headerButtonDeleteCollection = function() {
            $scope.$broadcast('collection:delete');
        };

        $scope.headerButtonUpload = function() {

            var buttons = [];
            buttons.push({ 
                action: 'album',
                text: '<i class="icon ion-images action-sheet-icon"></i> Bild Aus Galerie'
            });
            buttons.push({ 
                action: 'camera',
                text: '<i class="icon ion-camera action-sheet-icon"></i> Bild Von Kamera'
            });
            buttons.push({ 
                action: 'close',
                text: '<i class="icon ion-close action-sheet-icon"></i> Abbrechen'
            });

            // Show the action sheet
            var hidesheet = $ionicActionSheet.show({
                buttons: buttons,
                titleText: 'Hochladen',
                //cancelText: '<i class="icon ion-close action-sheet-icon"></i> Abbrechen',
                cancel: function() {
                    onEndActionSheet();
                },
                buttonClicked: function(index) {
                    onEndActionSheet();
                    if (buttons[index].action==='album') {
                        $scope.uploadGallery()
                    } 
                    else if (buttons[index].action==='camera') {
                        $scope.uploadCamera();
                    } 
                    else if (buttons[index].action==='close') {
                    } 
                    else {
                        alert("unkown action("+buttons[index].action+")");
                    }
                    return true;
                }
            });

            // temp overide of back button
            
            //scope.onBackUnbind();
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

        $scope.uploadGallery = function() {

            var options = {
                destinationType: 0, //Camera.DestinationType.DATA_URL
                sourceType: 0, // Camera.PictureSourceType.PHOTOLIBRARY
                encodingType: 0 //Camera.EncodingType.JPEG
            };

            var fail = function() {
                $ionicPopup.alert({
                    title: 'Problem',
                    template: 'Konnte nicht auf die Gallerie zugreifen.'
                }).then(function() {});
            };

            $rootScope.ignorePause = true; // set flag so that app is not existing when background
            $cordovaCamera.getPicture(options).then(function(imageData) {
                $rootScope.ignorePause = false; // reset flag

                $scope.createImageNode(imageData);

            }, function(err) {
                $rootScope.ignorePause = false; // reset flag
                fail();
                console.dir(err);
            });
        };

        $scope.uploadCamera = function() {

            var options = {
                correctOrientation: true,
                destinationType: 0, //Camera.DestinationType.DATA_URL
                sourceType: 1, // Camera.PictureSourceType.CAMERA
                encodingType: 0 //Camera.EncodingType.JPEG
            };

            var fail = function() {
                $ionicPopup.alert({
                    title: 'Problem',
                    template: 'Konnte nicht auf Kamera zugreifen.'
                }).then(function() {});
            };

            $rootScope.ignorePause = true; // set flag so that app is not existing when background
            $cordovaCamera.getPicture(options).then(function(imageData) {

                $rootScope.ignorePause = false; // reset flag
                          
                // TODO: show preview with "data:image/jpeg;base64,"
                $scope.createImageNode(imageData);

            }, function(err) {
                $rootScope.ignorePause = false; // reset flag
                fail();
                console.dir(err);
            });
        };

        $scope.createImageNode = function(imageData) {

            var parentNodeID = Share.pullParentNodeId();
            if ((typeof parentNodeID === "undefined") || (parentNodeID===null)) {
                alert("No parent Node ID.");
                return;
            }

            var fail = function(){
                $ionicLoading.hide();
                $ionicPopup.alert({
                    title: 'Problem',
                    template: 'Fehler beim Speichern.'
                }).then(function() {});
            };

            $ionicLoading.show({
                template: '<img src="img/spinner.gif" /><div class="upload-progress-panel" ng-show="(progress>0) && (progress<100)">{{progress}} %</div>'
            });
            EduApi.createImageNode(parentNodeID, "Bild "+Date.now(), null, imageData, true, "image/jpeg", function(newNodeId){
                // WIN
                $ionicLoading.hide();
                $scope.$broadcast('workspace:reload', newNodeId);
            }, fail, function(progress){
                $timeout(function(){$rootScope.progress = progress;},10);
            });

        };

        $scope.toggle = function() {
            // dont show while multi select mode
            if ($rootScope.multiSelectionMode) $rootScope.headerSwitchMultiselection();
            $ionicSideMenuDelegate.toggleLeft();
        };

        // register on MENU event from server frame
        angular.element(window).on('message', function(m) {
            if (m.data.command) {
                if (m.data.command==="menu") {
                    $rootScope.$apply(function() {
                        $ionicSideMenuDelegate.toggleLeft();
                    });
                }
            }
        });

    })

/*
 *  AccountCtrl --> contoller for account section
 */

.controller('AccountCtrl', function($scope, $log, $rootScope, $location, Account, $ionicPopup, System, $sce, $timeout, EduApi) {

        $log.debug("AccountCtrl");

        $scope.linkiFrame = $sce.trustAsResourceUrl("wait.html");

        $scope.$on('$ionicView.enter', function() {

            System.checkIfAppNeedFreshStart();
            $scope.serverBase = Account.getClientSettings().selectedServer.url;

            $log.debug("Enter Login View");
            $scope.showiFrame = Account.isLoggedIn();
            if (!$scope.showiFrame) {
                Account.rememberPathBeforeLogin($location.$$path);
                $location.path("/app/login");
            } else {
                $timeout(function() {
                    $scope.linkiFrame = $sce.trustAsResourceUrl(EduApi.serverUrls($scope.serverBase).profile);
                },10);

            }
        });

    });