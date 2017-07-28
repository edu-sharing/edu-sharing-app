
angular.module('starter.controllerCollectionAdd', [])

.controller('CollectionAddCtrl', function($rootScope, $scope, $log, $location, EduApi, $ionicLoading, $timeout, $ionicHistory, $stateParams, System, $cordovaToast, Account, $ionicPopup, $cordovaKeyboard) {

    $scope.DEFAULT_FOLDER_NAME = "InBox";

    $scope.externalContent = false; // external content is when data is not already a node
    $scope.items = [];
    $scope.selectedCollectionId = null;

    $scope.collections = [];
    $scope.showNoCollectionsInfo = false;
    $scope.loadingCollections = false;
    $scope.title = "TODO: Info about content here";
    $scope.collectionSearchTerm = "";
    $scope.shareType= null;
    $scope.linkPreviewData = null;

    $scope.loadPerBatch = 10;
    $scope.moreResultsAvailable = false;
    $scope.actualSkipCount = 0;

    $scope.onBack = function() {
        if ($scope.shareType !== null) {
            ionic.Platform.exitApp();
        } else {
            var backView = $ionicHistory.backView();
            if (backView !== null) backView.go();
        }
    };

    $scope.$on('$ionicView.enter', function() {

        console.log("Enter CollectionAddCtrl");

        System.checkIfAppNeedFreshStart();

        // if user is not logged in -> go to login screen
        if (!Account.isLoggedIn()) {
            Account.rememberPathBeforeLogin($location.$$path);
            $location.path("/app/login");
            return;
        }

        // BACK button receiver
        $scope.onBackUnbind = $scope.$on('button:back',$scope.onBack);

        // load collections on enter
        $scope.changedSearch("");

        // reset content
        $scope.externalContent = false;
        $scope.items = [];
        $scope.shareType= null;
        $rootScope.progress = "";
        $scope.linkPreviewData = null;
        
        // get data that is to add to collection
        if (System.hasWebIntent()) {

            // external content
            $scope.externalContent = true;
            $scope.webIntent = System.peekWebIntent();
            $scope.items = [{}];

            // check if is NULL
            if ($scope.webIntent===null) {
            var alertPop = $ionicPopup.alert({
                title: 'ERROR',
                template: 'NULL on WebIntent - cannot process'
            });
            alertPop.then(function() {
                $scope.onBack();
            });
            return;
            }

            // check extra is UNDEFINED
            if (typeof $scope.webIntent.extra === "undefined") {
            var alertPop = $ionicPopup.alert({
                title: 'ERROR',
                template: 'UNDEFINED on WebIntent.extra - cannot process'
            });
            alertPop.then(function() {
                $scope.onBack();
            });
            return;
            }

            // check extra is NULL
            if ($scope.webIntent.extra === null) {
            var alertPop = $ionicPopup.alert({
                title: 'ERROR',
                template: 'NULL on WebIntent.extra - cannot process'
            });
            alertPop.then(function() {
                $scope.onBack();
            });
            return;
            }

            // check if its a file link to an image (just jpeg for now)
            if ($scope.webIntent.extra.indexOf("file")===0) {

                /*
                * FILE (IMAGE)
                */
                $scope.shareType = "image";

                // get file name
                $scope.items[0].name = $scope.webIntent.extra.substring($scope.webIntent.extra.lastIndexOf("/")+1, $scope.webIntent.extra.lastIndexOf("."))+"-"+new Date().getTime();

                // get file ending
                var ending = $scope.webIntent.extra.substr($scope.webIntent.extra.lastIndexOf(".")+1);

                // just allow the following
                if ((ending!=="jpg") &&
                    (ending!=="jpeg") &&
                    (ending!=="png") &&
                    (ending!=="gif") &&
                    (ending!=="tif") &&
                    (ending!=="bmp")) {
                    var alertPop = $ionicPopup.alert({
                        title: 'Info',
                        template: 'Das Bild ist leider nicht vom Typ JPEG, PNG oder GIF.'
                    });
                    alertPop.then(function() {
                        $scope.onBack();
                    });
                }

            } else

            // check if its a http link (only supported for now)
            if ($scope.webIntent.extra.indexOf("http")===0) {

                /*
                 * LINK
                 */
                $scope.shareType = "link";

                // set title
                $scope.items[0].name = $scope.getNameFromLink($scope.webIntent.extra);
                $scope.shareLink = $scope.webIntent.extra;

                // get preview of url
                $ionicLoading.show({
                    template: '<img src="./img/spinner.gif">'
                });
                EduApi.getWebsiteInfo($scope.webIntent.extra, function(previewData){
                    // WIN
                    $ionicLoading.hide();
                    if ((typeof previewData !== "undefined") && (previewData!==null) && (previewData.title!==null)) {
                        $scope.linkPreviewData = previewData;
                        $scope.items[0].name = previewData.title;
                    } else {
                        console.warn("was not able to get data about website",previewData);
                    } 
                }, function() {
                    // FAIL
                    $ionicLoading.hide();
                    console.log("failed to get data about website",$scope.webIntent.extra);
                });


            } else {

                /*
                * NOT SUPPORTED
                */
                var alertPop = $ionicPopup.alert({
                    title: 'Info',
                    template: 'Aktuell können nur Links und Bilder geteilt werden.'
                });
                alertPop.then(function() {
                    $scope.onBack();
                });

            }

        } else {

            // existing nodes
            $scope.items = System.getAddToCollectionItems();

            // make sure multiselect is deactivated
            if ($rootScope.multiSelectionMode) {
                $rootScope.multiSelectionMode = false;
                for (var i=0; i<$rootScope.multiSelection.length; i++) $rootScope.multiSelection[i].isSelected = false;
                $rootScope.multiSelectionText = "";
                $rootScope.multiSelection = [];
            }

        }
        
    });

    $scope.$on('$ionicView.leave', function() {

        console.log("Leave CollectionAddCtrl");

        // BACK Button unbind
        $scope.onBackUnbind();

    });

    $scope.enterOnSearch = function() {
        try {
            $cordovaKeyboard.close();
        } catch (e) { }
    };

    $scope.changedSearch = function(collectionSearchTerm, loadMore) {
        
        if (typeof loadMore === "undefined") loadMore = false;
        if (!loadMore) $scope.actualSkipCount = 0;
        if (loadMore && !$scope.moreResultsAvailable) {
            console.warn("load more was called by not moreResultsAvailable");
            return;
        }

        $scope.collectionSearchTerm = collectionSearchTerm;
        if (!loadMore) $scope.loadingCollections = true;
        $scope.showNoCollectionsInfo = false;
        var requestedTerm = JSON.parse(JSON.stringify($scope.collectionSearchTerm));

        EduApi.serachCollections(requestedTerm, $scope.loadPerBatch, $scope.actualSkipCount, function(data){
            if (requestedTerm!==$scope.collectionSearchTerm) {
                console.log("DROP RESULTS ("+requestedTerm+")!=("+$scope.collectionSearchTerm+")");
                return;
            }
            // WIN

            // filter collections that the user does not have write rights on
            var collections = [];
            for (var i=0; i < data.collections.length; i++) {
                var collection = data.collections[i];
                var isAllowedToPublishIn = false;
                if (typeof collection.access !== "undefined") {
                    for (var k=0; k<collection.access.length; k++) {
                        if ((collection.access[k]==="CCPublish") || (collection.access[k]==="Write")) isAllowedToPublishIn = true;
                    }
                }
                if (isAllowedToPublishIn) collections.push( collection );
            }

            if ($scope.actualSkipCount===0) {
                // set data fresh
                $scope.collections = collections;
                $scope.$broadcast('scroll.infiniteScrollComplete');
            } else {
                // add to already loaded
                for (var i=0; i < collections.length; i++) $scope.collections.push( collections[i] );
            }

            $scope.actualSkipCount += $scope.loadPerBatch ;
            $scope.moreResultsAvailable = (data.collections.length>=$scope.loadPerBatch );
            $scope.showNoCollectionsInfo = ( $scope.collections.length === 0);
            $scope.loadingCollections = false;
            if (loadMore) $scope.$broadcast('scroll.infiniteScrollComplete');

        }, function(e){
            // FAIL
            $scope.loadingCollections = false;
            $scope.showNoCollectionsInfo = true;
            console.log("FAIL",e);
        });
    };

    $scope.loadMore = function() {
        $scope.changedSearch($scope.collectionSearchTerm ,true);
    };

    $scope.collectionImage = function(collection) {
        var backurl = '';
        if (!collection.preview.isIcon) {
            backurl = 'background-image: url("'+collection.previewUrl+'")';
        }
        //console.log("Collection --> ",backurl);
        return backurl;
    };

    // gets called when new collection got created
    $scope.$on('collections:child', function(e, data) {
        $scope.choosedCollection(data);
    });

    $scope.goBackWithMessage = function(message) {
        try {
        $ionicLoading.hide();
        $cordovaToast.show(message, 'long', 'bottom')
            .then(function() {
                $timeout(function(){
                    $scope.onBack();
                },2000); 
            }, function () {
                $scope.loading = false;
                var alertPop = $ionicPopup.alert({
                    title: 'Info',
                    template: message
                });
                alertPop.then(function() {
                    $scope.onBack();
                });
            });
        } catch (e) {
            var alertPop = $ionicPopup.alert({
                title: 'Info',
                template: message
            });
            alertPop.then(function() {
                $scope.onBack();
            });
        }    
    };

    // on button click
    $scope.createNewCollection = function() {
        $location.path("/app/collectionedit/0/_root_");
    };

    // get name from a link
    $scope.getNameFromLink = function(httpLink) {

        // fall back
        var name = "LINK";
        if ((typeof httpLink === "undefined") || (httpLink===null)) {
            return name + " " + (new Date().getTime());
        }

        // cut front

        if (httpLink.indexOf("http://")>=0) {
            name = httpLink.substring(httpLink.indexOf("http://") + 7);
        }

        if (httpLink.indexOf("https://")>=0) {
            name = httpLink.substring(httpLink.indexOf("https://") + 8);
        }

        // cut back

        if (name.indexOf("/")>0) {
            name = name.substring(0,name.indexOf("/"));
        }

        if (name.indexOf(":")>0) {
            name = name.substring(0,name.indexOf(":"));
        }

        if (name.indexOf("?")>0) {
            name = name.substring(0,name.indexOf("?"));
        }

        return name + " " + (new Date().getTime());
    };

    // just store external content in Inbox - dont put into a folder
    $scope.justStoreInInbox = function() {
        $scope.selectedCollectionId = null;
        $scope.savePrepare();
    };

    // 1. get default folder and create it if needed
    $scope.savePrepare = function() {

        console.log("savePrepare");

        $ionicLoading.show({
            template: '<img src="./img/spinner.gif"><br>Upload {{progress}}'
        });

        $scope.saveShare("-inbox-");

    };

    // 1. store share to default folder
    $scope.saveShare = function(inNode) {

        console.log("saveShare");

        // get array of keywords
        var keyWordArray = [];
        if (($scope.linkPreviewData!==null) && ($scope.linkPreviewData.keywords!==null)) {
            console.log("using keywords from website preview service: "+JSON.stringify($scope.linkPreviewData.keywords));
            keyWordArray = $scope.linkPreviewData.keywords;
        }

        // win - after share content was created
        var winShare = function(createdNodeId) {

            // clean webIntent
            System.cleanWebIntent();
            $scope.webIntent = null;

            // external content is now internal content
            $scope.items = [{ref:{repo:'repo',id:createdNodeId}}];
                    
            // store in selected collection
            $scope.choosedCollection();
        };

        if ($scope.shareType==="image") {

            /*
             * STORE IMAGE / FILE
             */

            try {

            var name = $scope.webIntent.extra.substring($scope.webIntent.extra.lastIndexOf("/")+1, $scope.webIntent.extra.lastIndexOf("."))+"-"+new Date().getTime();
            var ending = $scope.webIntent.extra.substr($scope.webIntent.extra.lastIndexOf(".")+1);

            var mimeType = "image/jpeg";
            if (ending==="png") mimeType = "image/png";
            if (ending==="gif") mimeType = "image/gif";
            if (ending==="bmp") mimeType = "image/x-windows-bmp";

            $rootScope.progress = "";
            window.resolveLocalFileSystemURL($scope.webIntent.extra, function(fileEntry){

                // WIN
                fileEntry.file(function(file) {
                    var reader = new FileReader();
                    reader.onloadend = function() {

                        EduApi.createImageNode(inNode, name, keyWordArray, this.result, false, mimeType, winShare, $scope.saveFail, function(progress) {
                            $timeout(function(){
                                if (progress>0) $rootScope.progress = progress+"%";
                            },10);
                        });

                    };
                    reader.readAsBinaryString(file); // or the way you want to read it
                });
            }, function(e) {
                // FAIL
                console.error(e);
                $scope.goBackWithMessage("Auf Bilddaten konnte nicht zugegriffen werden.");
            });

            } catch (e) {
                console.error(e);
                $scope.goBackWithMessage("Fehler beim Zugriff auf Bilddaten.");
            }

        } else {

            /*
             * STORE LINK
             */

            // create Link on edu sharing
            EduApi.createLinkNode(inNode, $scope.items[0].name, $scope.shareLink, keyWordArray, winShare, function(){
                // FAIL
                $scope.goBackWithMessage("Fehler beim Speichern des Links.");
            });

        }

    };

    // 2. store content in collection
    $scope.choosedCollection = function(collectionId) {

        console.log("choosedCollection ("+collectionId+")");

        // init parameters
        if (typeof collectionId === "undefined") collectionId = $scope.selectedCollectionId;
        $scope.selectedCollectionId = null;
        if (collectionId===null) {
            $scope.goBackWithMessage("Objekt in Inbox gespeichert.");
            return;
        }
        if ($scope.items===null) {
            console.warn("$scope.items=null");
            return;
        }

        // for external content store as node first
        if ($scope.webIntent!=null) {

            console.log("webintent content - save in inbox first");

            // remember collection id to put in later
            $scope.selectedCollectionId = collectionId;

            // before adding to collection save external content to node
            // will then call choosedCollection again
            $scope.savePrepare();
            return;    
        }

        // add all items to collection
        
        var i = 0;
        var addToCollection = function(item) {
            var repo = "-home-";
            if (item.ref.repo!=="repo") repo = item.ref.repo;
            EduApi.addContentToCollection(repo, collectionId, item.ref.id, function(){
                i++;
                if (i<$scope.items.length) {
                    // next item
                    addToCollection($scope.items[i]);
                } else {
                    // all done
                    $ionicLoading.hide();
                    var message = "Objekt wurde in die Sammlung eingeordnet.";
                    if ($scope.items.length>1) message = "Objekte wurden in die Sammlung eingeordnet.";
                    $scope.goBackWithMessage(message);
                }
            }, function(e){
                $ionicLoading.hide();
                console.warn(JSON.stringify(e));
                var message = "Konnte nicht zur Sammlung hinzugefügt werden.";
                if ($scope.items.length>1) message = "Nicht alles konnte zur Sammlung hinzugefügt werden.";
                $scope.goBackWithMessage(message);
            });
        };
        $ionicLoading.show({
            template: '<img src="./img/spinner.gif">'
        });
        addToCollection($scope.items[0]);

    };

});