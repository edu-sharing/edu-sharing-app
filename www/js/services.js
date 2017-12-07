angular.module('starter.services', [])

/*
 * Give info about the System running on. Store System events.
 */
.factory('System', function() {

  var tempWebIntent = null;
  var tempAddToCollectionItems = [];

  var appWentOverLoginScreen = false;

  var getPlatformLowercase = function() {

      if (typeof window.device !== "undefined") {
          return window.device.platform.toLowerCase();
      }

      if (typeof device !== "undefined") {
          return device.platform.toLowerCase();
      }

      if (typeof window.cordova !== "undefined") {
          return window.cordova.platformId.toLowerCase();
      }

      return "browser";
  };

  // detect if running in emulator - e.g. browser
  var isEmulator = function() {
      return (getPlatformLowercase()==="browser");
  };

  return {
      isNativeIOS: function() {
          return getPlatformLowercase() === 'ios';
      },
      isNativeAndroid: function() {
          return getPlatformLowercase() === 'android';
      },
      isEmulator: function() {
          return isEmulator();
      },
      getPlatform: function() {
          return getPlatformLowercase();
      },
      pushWebIntent : function(webIntent) {
          tempWebIntent = webIntent;
      },
      pullWebIntent : function() {
          var temp = tempWebIntent;
          tempWebIntent = null;
          return temp;
      },
      peekWebIntent : function() {
          return tempWebIntent;
      },
      cleanWebIntent : function() {
          tempWebIntent = null;
      },
      hasWebIntent : function() {
          return tempWebIntent !== null;
      },
      setAddToCollectionItems : function(itemRefArray) {
          console.log(typeof itemRefArray);
          tempAddToCollectionItems = itemRefArray;
      },
      getAddToCollectionItems : function() {
        return tempAddToCollectionItems;
      },
      openContentBrowser: function(contentUrl) {
          try {
              // see https://github.com/apache/cordova-plugin-inappbrowser
              var ref = cordova.InAppBrowser.open(contentUrl, '_blank', 'location=yes');
              ref.addEventListener('loadstop', function() {
                  ref.executeScript({code: "document.getElementsByTagName('nav')[0].style.display = 'none';"});
              });
          } catch (e) {
              console.log("FAIL OPEN INAPP-BROWSER: "+e);
              window.open(contentUrl, '_blank');
          }
      },
      // make sure app is always started going over intro screen
      appWentOverLoginScreen: function() {
          appWentOverLoginScreen = true;
      },
      checkIfAppNeedFreshStart: function() {
        if (!appWentOverLoginScreen) {
            // restart app from login screen
            var url = window.location.href;
            url = url.substring(0,url.indexOf("#"));
            window.location.href = url;
        }
      },
      buildFullApiUrlFromUserInput : function(url) {

        if (url.indexOf("/",url.length-1)<0) url = url+"/";
        if (url.substring(0,url.length-1).indexOf("/",9)<=0) url = url + "edu-sharing/";

        // add http if missing
        if (url.indexOf("http")!==0) url = "https://" + url;
        
        return url;
      }
  };
})

.directive('fallbackSrc', function () {
    return {
        link: function postLink(scope, iElement, iAttrs) {
            iElement.bind('error', function () {
                angular.element(this).attr("src", iAttrs.fallbackSrc);
            });
        }
    };
})

/*
 * Manage the Share-WebIntents of Android
 */
.factory('Share', ['$log', '$timeout', '$location', 'System', '$rootScope', '$ionicPopup', function($log, $timeout, $location, System, $rootScope, $ionicPopup) {
        var tempParentNodeId = null;
            return {
                pushParentNodeId: function(nodeID) {
                    tempParentNodeId = nodeID;
                },
                pullParentNodeId: function() {
                    return tempParentNodeId;
                },
                process: function(type) {

                    try {

                        if (System.hasWebIntent()) {
                            alert("Ignoring Double WebIntent");
                            return;
                        }

                        var webIntent = {type: window.plugins.webintent.EXTRA_TEXT, url: "", extra: ""};
                        if (typeof type !== "undefined") {
                            webIntent = {type: type, url: "", extra: ""};
                        }

                        window.plugins.webintent.getUri(function (url) {
                            if (url !== "") webIntent.url = url;
                            window.plugins.webintent.getExtra(window.plugins.webintent.EXTRA_TEXT,
                                function (extra) {

                                    webIntent.extra = extra;
                                    System.pushWebIntent(webIntent);

                                    // route to account
                                    $timeout(function () {
                                        $location.path("/app/login");
                                    }, 300);

                                },
                                $log.error
                            );

                            var processFileURI = function (fileUri) {

                                try {

                                    if ((typeof fileUri !== "undefined") && (fileUri !== null)) {

                                        if (fileUri.indexOf("file://")===0) {

                                            // lets resolve to native path
                                            window.FilePath.resolveNativePath(fileUri, function (localFileUri) {

                                                webIntent.extra = localFileUri;
                                                System.pushWebIntent(webIntent);

                                                // route to account
                                                $timeout(function () {
                                                    $location.path("/app/login");
                                                }, 300);

                                            }, function(e){
                                                $ionicPopup.alert({
                                                    title: 'Hinweis',
                                                    template: 'Das Teilen dieses Bildes ist nicht möglich.<br><small style="color:#D3D3D3;">'+fileUri+'</small>'
                                                }).then(function () {ionic.Platform.exitApp();});
                                                console.log("ERROR(1): "+JSON.stringify(e));
                                            });

                                        } else

                                        if (fileUri.indexOf("content://")===0) {

                                            // try to resolve CONTENT-URL: https://developer.android.com/guide/topics/providers/content-providers.html
                                            window.FilePath.resolveNativePath(fileUri, function(win){

                                                console.log("Resolved ContentURL("+fileUri+") to FileURL("+win+")");
                                                processFileURI(win);

                                            }, function(fail){

                                                $ionicPopup.alert({
                                                    title: 'Hinweis',
                                                    template: 'Es handelt sich um einen Inhalt der nicht auf dem Gerät speichert ist. Es kann daher (noch) nicht mit edu-sharing geteilt werden.'
                                                }).then(function () {ionic.Platform.exitApp();});
                                                console.log("FAILED to resolve ContentURL("+fileUri+")",fail);

                                            });
                                        }

                                        else {
                                            alert("ImageShare ERROR: fileUri unkown " + fileUri);
                                        }


                                    } else {
                                        alert("ImageShare ERROR: fileUri undefined or NULL");
                                    }

                                } catch (e) {
                                    alert("FAIL: "+JSON.stringify(e));
                                    console.dir(e);
                                }

                            };

                            window.plugins.webintent.getExtra(window.plugins.webintent.EXTRA_STREAM,processFileURI,$log.error);
                        });

                    } catch (e) {
                        $ionicPopup.alert({
                            title: 'Hinweis',
                            template: 'Das Teilen dieses Bildes ist nicht möglich.'
                        }).then(function () {ionic.Platform.exitApp();});
                        console.log("ERROR(2): "+JSON.stringify(e));
                    }

                }
            };
}])

/*
 * Toolbox
 */
.factory('Toolbox', function($rootScope, $timeout, EduApi, $ionicLoading, $ionicPopup, Share, System, $ionicActionSheet, $location, $cordovaToast, $sce, $ionicScrollDelegate, $ionicModal, $cordovaCamera, $cordovaFileTransfer, $http) {


    var addItemsToCollectionIntern = function(items, collectionId, callback) {
        var i = 0;
        var addToCollection = function(item) {
            var repo = "-home-";
            if (item.ref.repo!=="repo") repo = item.ref.repo;
            EduApi.addContentToCollection(repo, collectionId, item.ref.id, function(){
                i++;
                if (i<items.length) {
                    // next item
                    addToCollection(items[i]);
                } else {
                    // all done
                    $ionicLoading.hide();
                    var message = "Objekt wurde in die Sammlung eingeordnet.";
                    if (items.length>1) message = "Objekte wurden in die Sammlung eingeordnet.";
                    callback(message);
                }
            }, function(e){
                $ionicLoading.hide();
                console.warn(JSON.stringify(e));
                var message = "Konnte nicht zur Sammlung hinzugefügt werden.";
                if (items.length>1) message = "Nicht alles konnte zur Sammlung hinzugefügt werden.";
                callback(message);
            });
        };
        $ionicLoading.show({
            template: $rootScope.spinnerSVG
        });
        addToCollection(items[0]);
    };

    var headerButtonUpload = function(scope) {

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
                    uploadGallery(scope)
                }
                else if (buttons[index].action==='camera') {
                    uploadCamera(scope);
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
        var unbindBack = scope.$on('button:back',function(){
            hidesheet();
        });

        //reset back button to old function
        var onEndActionSheet = function() {
            $rootScope.actionSheet = false;
            unbindBack();
        };

    };

    var uploadGallery = function(scope) {

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

                createImageNode(imageData, scope);

            }, function(err) {
                $rootScope.ignorePause = false; // reset flag
                if ((typeof err != "undefined") && (err=="Selection cancelled.")) {
                    console.log("User canceled selection.");
                } else {
                    fail();
                    console.dir(err);
                }
            });
     };

     var uploadCamera = function(scope) {

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

                createImageNode(imageData, scope);

            }, function(err) {
                $rootScope.ignorePause = false; // reset flag
                if ((typeof err != "undefined") && (err=="Camera cancelled.")) {
                    console.log("User canceled camera operation - ignore.");
                } else {
                    fail();
                    console.dir(err);
                }
            });
     };

      var createImageNode = function(imageData, scope) {

            var parentNodeID = Share.pullParentNodeId();
            if ((typeof parentNodeID === "undefined") || (parentNodeID===null)) {
                alert("No parent Node ID.");
                return;
            }

            var fail = function(){

                // make sure screen time out gets back to normal
                try {
                    StayAwake.enableScreenTimeout();
                } catch (e) {
                    console("FAIL: StayAwake.enableScreenTimeout - "+e);
                }

                $ionicLoading.hide();
                $ionicPopup.alert({
                    title: 'Problem',
                    template: 'Fehler beim Speichern.'
                }).then(function() {});
            };

            $ionicLoading.show({
                template: $rootScope.spinnerSVG+'<div class="upload-progress-panel" ng-show="(progress>0) && (progress<100)">{{progress}} %</div>'
            });


            // make sure screen is not turning black during upload
            try {
                StayAwake.disableScreenTimeout();
            } catch (e) {
                console.log("FAIL: StayAwake.disableScreenTimeout() - "+e);
            }

            EduApi.createImageNode(parentNodeID, "Bild "+Date.now(), null, imageData, true, "image/jpeg", function(newNodeId){
                // WIN

                // make sure screen time out gets back to normal
                try {
                    StayAwake.enableScreenTimeout();
                } catch (e) {
                    console.log("FAIL: StayAwake.enableScreenTimeout - "+e);
                }

                $ionicLoading.hide();
                scope.$broadcast('workspace:reload', newNodeId);
            }, fail, function(progress){
                $timeout(function(){$rootScope.progress = progress;},10);
            });

      };

        var showDetailsModal = function(scope, contentNode, whenDone) {

               scope.detailLoading = true;
               scope.loadingDelay = true;
               scope.dynamicHTML = "";

               $ionicModal.fromTemplateUrl('templates/tab-detail.html', {
                    scope: scope,
                    animation: 'slide-in-up',
                    hardwareBackButtonClose: true
                }).then(function(modal) {
                    scope.modal = modal;
                    scope.modal.show();

                    // close button
                    scope.close = function() {

                        scope.modal.remove();
                        scope.onBackUnbind();

                        // remove old dynamic libs
                        var oldLibs = document.getElementsByClassName("renderscript");
                        if (oldLibs.length>0) {
                            for (var j=0; j<oldLibs.length; j++) {
                                oldLibs[j].parentNode.removeChild(oldLibs[j]);
                            }
                        }

                        // remove dynamic content
                        scope.dynamicHTML = null;

                        if (whenDone !== "undefined") whenDone();
                    };

                    // register onBack Button
                    scope.onBackUnbind = scope.$on('button:back',scope.close);

                    // download item
                    scope.download = function() {
                        downloadContent(contentNode, function(){
                            // when done
                            scope.close();
                        });
                    }

                    // figure out if user is allowed to add item to collection
                   scope.showAddCollection = (contentNode.access.indexOf("CCPublish") > -1);

                    // figure out if item can be downloaded
                   scope.showDownload = !(contentNode.mediatype=="link");

                    // add item to collection
                    scope.addToCollection = function() {
                       scope.close();
                       System.setAddToCollectionItems([contentNode]);
                       $location.path("/app/collectionadd");
                    }

                    // for PDF prevent rendering by forcing Preview
                    // because mobile chrome has problems with PDF displaying in our setup
                    // also on iOS it renders in iFrame but is nit usable
                    var forcePreview = false;
                    if (contentNode.mediatype == "file-pdf") forcePreview = true;

                    loadRenderSnippet(scope, contentNode.ref.id, forcePreview ,function(result) {
                        if (!result) scope.close();
                    });
                });
        };


        var loadRenderSnippet = function(scope, contentNodeId, forcePreview, result) {


            EduApi.getRenderSnippetForContent(contentNodeId, forcePreview, function(snippet) {

               // WIN
               $ionicLoading.hide();
               snippet = manipulateSnippet(snippet);

               scope.detailLoading = false;

               // set snippet HTML
               scope.dynamicHTML = $sce.trustAsHtml(snippet);
               if(!scope.$$phase) scope.$apply();

               $timeout(function(){
                    // filter scripts from snippet and attach at end of document
                    var scriptElementArray = document.getElementById('renderDiv').getElementsByTagName("script");
                    exceuteSnippetScripts(scriptElementArray, 0);
                    $ionicScrollDelegate.$getByHandle('detailScroll').resize();
               }, 200);

               // delayed display div
               $timeout(function(){
                   scope.loadingDelay = false;
               },400);

               result(true);

            }, function() {
            
                // FAIL
                scope.detailLoading = false;
                scope.loadingDelay = false;
                console.warn("getRenderSnippetForContent: Failed to load Detail info.");
                result(false);

            });
        };

        var manipulateSnippet = function(snippet) {

            // replace "Open Link in Browser
            snippet = snippet + "<script> var openInBrowser = function(element) { console.dir(element.href); var ev = new CustomEvent('openInBrowser', { 'detail': element.href, 'bubbles': true, 'cancelable': true}); console.dir(ev); window.dispatchEvent(ev); return false;}</script>";
            snippet = snippet.replace('target="_blank" class="edusharing_rendering_content"', 'onclick="return openInBrowser(this);" class="edusharing_rendering_content"');

            //console.log("Snippet",snippet);

            return snippet;
        };

        var exceuteSnippetScripts = function(scriptElementArray, index) {

            // check if done
            if (scriptElementArray.length===index) return;
            var nextScriptElement = scriptElementArray[index];

            //console.log("do render script index("+index+") of ("+scriptElementArray.length+")");

            if ((nextScriptElement.outerHTML!=null) && (nextScriptElement.outerHTML.indexOf('src=')>0)) {

                // external script
                var src = nextScriptElement.outerHTML.substr(nextScriptElement.outerHTML.indexOf('src=')+5);
                if ((src!==null) && (src.length>3)) {
                    
                    if (src.indexOf('"')>0) src=src.substr(0,src.indexOf('"'));
                    if (src.indexOf("'")>0) src=src.substr(0,src.indexOf("'"));

                    EduApi.simpleGetHttp(src, function(js) {
                        
                        // WIN attach script to end of document
                        var s = document.createElement('script');
                        s.type = 'text/javascript';  
                        s.className = "renderscript";          
                        try {
                            s.appendChild(document.createTextNode(js));
                            document.body.appendChild(s);
                        } catch (e) {
                            s.text = js;
                            document.body.appendChild(s);
                        }

                        // next script
                        exceuteSnippetScripts(scriptElementArray, index+1);


                    },function(){
                        // FAIL getting external script
                        console.log("faild getting external script ("+src+") --> SKIP");
                        exceuteSnippetScripts(scriptElementArray, index+1);
                    });

                } else {
                    // src not valid
                    console.log("src of external script is unvalid --> SKIP");
                    exceuteSnippetScripts(scriptElementArray, index+1);
                }

            } else {

               // local script
               var s = document.createElement('script');
               s.type = 'text/javascript';  
               s.className = "renderscript";          
               try {
                    s.appendChild(document.createTextNode(nextScriptElement.text));
                    document.body.appendChild(s);
               } catch (e) {
                    s.text = nextScriptElement.text;
                    document.body.appendChild(s);
               }

               // next script
               exceuteSnippetScripts(scriptElementArray, index+1);
            }

        };

        // edit dialog
        var editItemsDialog = function(scope, item) {

            scope.itemActionOpen = function() {
                scope.itemClick(item);
            };

            scope.itemActionShare = function() {
                alert("TODO: share item with group");
            };

            // delete item(s)
            scope.itemActionDelete = function() {

                if (typeof item.type !== "undefined") item = [item];
                var multiple = item.length>1;

                var confirmPopup = $ionicPopup.confirm({
                    title: multiple ? item.length+' Objekte wirklich löschen?' : 'Objekt wirklich löschen?',
                    template: '',
                    cancelText: 'ABBRECHEN',
                    okText: 'LÖSCHEN',
                    cssClass: 'popup-confirm-delete'
                });

                confirmPopup.then(function(res) {
                    if(res) {
                        $ionicLoading.show({
                        template: $rootScope.spinnerSVG
                    });
                    deleteNextItem(item, function(){
                        // WIN
                        try {
                            var message = "Objekt wurde gelöscht.";
                            if (multiple) message = "Objekte wurden gelöscht.";
                            $cordovaToast.show(message, 'long', 'bottom');
                        } catch (e) {}

                        $ionicLoading.hide();
                        scope.$broadcast('workspace:reload');
                        scope.$emit('workspace:reload');

                    },function() {
                        // FAIL
                        alert("Die Sammlung konnte nicht gelöscht werden.");
                      });
                    }
                });
            };

            // add item(s) to collection
            scope.itemActionAddCollection = function(useLatestCollection) {

                if (typeof useLatestCollection == "undefined") useLatestCollection = false;
                if (typeof item.type !== "undefined") item = [item];

                // check if no folders are selected
                for (var i=0; i<item.length; i++) {
                    if (item[i].type==="{http://www.alfresco.org/model/content/1.0}folder") {
                        $ionicPopup.alert({
                            title: 'Keine Verzeichnisse in Sammlungen',
                            template: 'Die Auswahl enthält Verzeichnisse. Diese können nicht einer Sammlung hinzugefügt werden.'
                        }).then(function() {});
                        return;
                    }
                }

                if (!useLatestCollection) {
                    // store item to share in system service and go to page
                    System.setAddToCollectionItems(item);
                    $location.path("/app/collectionadd");
                } else {
                    addItemsToCollectionIntern(item, $rootScope.lastActiveCollection.ref.id , function(message) {
                        try {
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
                                    });
                                });
                        } catch (e) {
                            var alertPop = $ionicPopup.alert({
                                title: 'Info',
                                template: message
                            });
                            alertPop.then(function() {
                            });
                        }
                    });
                }

            };

            // rename a folder
            scope.folderRename = function() {
                scope.tempitem = {};
                scope.tempitem.name = JSON.parse(JSON.stringify(item.name));
                scope.closeKeyboard = function() {
                try {
                    $cordovaKeyboard.close();
                } catch (e) {}
                };
                $ionicPopup.show({
                template: '<input class="input-foldername" type="text" ng-model="tempitem.name" placeholder="Name des Ordners" autofocus ng-keyup="$event.keyCode == 13 && closeKeyboard()">',
                title: 'Ordner umbenennen',
                scope: scope,
                cssClass: 'dialog-new-folder',
                buttons: [
                    { text: 'ABBRECHEN' },
                    {
                        text: 'OK',
                        type: 'button-positive',
                        onTap: function(e) {
                        if (!scope.tempitem.name) {
                                e.preventDefault();
                            } else {
                                scope.tempitem.name = scope.tempitem.name.trim();
                                if (scope.tempitem.name.length<=0) return;
                                var newProperties = JSON.parse(JSON.stringify(item.properties));
                                newProperties['cm:name'][0] = scope.tempitem.name;
                                $ionicLoading.show({
                                    template: $rootScope.spinnerSVG
                                });
                                EduApi.updateMetadataNode(item.ref.id, newProperties,
                                function(){
                                    // WIN
                                    $ionicLoading.hide();
                                    try {
                                        $cordovaToast.show("Ordner wurde umbenannt.", 'long', 'bottom');
                                    } catch(e) {} 
                                    scope.$broadcast('workspace:reload');
                                    scope.$emit('workspace:reload');
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
                                            template: 'Es war nicht möglich den Ordner umzubenennen.'
                                    });
                                });
                            }
                        }
                    }
                ]
                });
            };

                // add item(s) to collection
            scope.itemActionRemoveCollection = function() {

            if (typeof item.type !== "undefined") item = [item];

            var confirmPopup = $ionicPopup.confirm({
                title: 'Wirklich aus Sammlung löschen?',
                template: '',
                cancelText: 'ABBRECHEN',
                okText: 'LÖSCHEN',
                cssClass: 'popup-confirm-delete'
            });

            confirmPopup.then(function(res) {
                if(res) {
                  $ionicLoading.show({
                        template: $rootScope.spinnerSVG
                    });
                    removeFromCollectionNextItem(item, item[0].collection, true, function(allOK){
                        // DONE
                        $ionicLoading.hide();
                        scope.$broadcast('collections:reload');
                        scope.$emit('collections:reload');
                        if (allOK) {

                            // WIN feedback
                            try {
                                $cordovaToast.show("Objekt wurde aus Sammlung entfernt.", 'long', 'bottom');
                            } catch (e) {
                                $ionicPopup.alert({
                                    title: 'OK',
                                    template: 'Objekt wurde aus Sammlung entfernt.'
                                }).then(function() {});
                            }

                        } else {

                            // FAIL feedback
                            try {
                                $cordovaToast.show("Nicht alle Inhalte konnten aus der Sammlung entfernt werden.", 'long', 'bottom');
                            } catch (e) {
                                $ionicPopup.alert({
                                    title: 'Problem',
                                    template: 'Nicht alle Inhalte konnten aus der Sammlung entfernt werden.'
                                }).then(function() {});
                            }

                        }
                    });
                }
            });
    
            };

            var selectionWithFolder = false;
            var buttons = [];
            //var template = "<div style='text-align: center;'>";
            var headlineName = "";

            var hasDeleteRight = false;
            var hasPublishRight = false;

            if (typeof item.type !== "undefined") {

                // SINGLE ITEM
                headlineName = item.name;

                // check if user has right to delete/publish items
                hasDeleteRight = (item.access.indexOf("Delete") > -1);
                hasPublishRight = (item.access.indexOf("CCPublish") > -1);


                // FOLDER & COLLECTION OPTIONS
                if ((item.typeStyle==='folder') || (item.typeStyle==='collection')) {
                    
                    buttons.push({ 
                        action: 'open',
                        text: '<i class="icon ion-android-arrow-dropright-circle action-sheet-icon"></i> Öffnen'
                    });

                    if ((hasDeleteRight) && (item.typeStyle==='folder')) {

                        var folderProtected = false;
                        if (typeof item.properties['ccm:maptype'] != "undefined") {
                            if (item.properties['ccm:maptype'][0]==="USERDATAFOLDER") folderProtected = true;
                            if (item.properties['ccm:maptype'][0]==="IMAGES") folderProtected = true;
                        }
                        
                        if (folderProtected) {
                            buttons.push({
                                action: 'rename-folder-notpossible',
                                text: '<i class="icon ion-edit action-sheet-icon action-deactivated"></i> <span class="action-deactivated">Umbenennen</span>'
                            });
                        } else {
                            buttons.push({
                                action: 'rename-folder',
                                text: '<i class="icon ion-edit action-sheet-icon"></i> Umbenennen'
                            });
                        }

                    }

                    if (hasDeleteRight) buttons.push({ 
                            action: 'delete',
                            text: '<i class="icon ion-android-delete action-sheet-icon"></i> Löschen'
                        });
                
                }

                // FILE & LINK OPTIONS
                if ((item.typeStyle==='file') || (item.typeStyle==='link')) {

                    buttons.push({ 
                        action: 'open',
                        text: '<i class="icon ion-android-arrow-dropright-circle action-sheet-icon"></i> Öffnen'
                    });

                    if (scope.context!=='collections') {

                        if (hasPublishRight) {

                            if ($rootScope.lastActiveCollection==null) {
                                buttons.push({
                                    action: 'collection-add',
                                    text: '<i class="icon ion-social-buffer action-sheet-icon"></i> In eine Sammlung hinzufügen'
                                });
                            } else {

                                var imageDivContent = "<div class='collection-add-icon-wrapper action-text-image'><i class=\"icon ion-social-buffer action-text-icon\"></i></div>\n";
                                if (!$rootScope.lastActiveCollection.preview.isIcon) imageDivContent = "<div class='collection-add-image-wrapper-equal action-text-image'><img class='action-text-image-inner' src='"+$rootScope.lastActiveCollection.preview.url+"&width=30&height=30'/></div>";
                                buttons.push({
                                    action: 'collection-add',
                                    text: '<i class="icon ion-social-buffer action-sheet-icon"></i> In eine Sammlung hinzufügen'
                                });
                                buttons.push({
                                    action: 'collection-add-last',
                                    text: imageDivContent+$rootScope.lastActiveCollection.title.substring(0, 30)
                                });
                            }

                        } else {

                            buttons.push({
                                action: 'collection-add-notallowed',
                                text: '<i class="icon ion-social-buffer action-sheet-icon action-deactivated"></i> <span class="action-deactivated">Keine Berechtigung zum Sammeln</span>'
                            });

                        }

                        if (hasDeleteRight) buttons.push({ 
                            action: 'delete',
                            text: '<i class="icon ion-android-delete action-sheet-icon"></i> Löschen'
                        });
                        
                    } else {

                        buttons.push({ 
                            action: 'collection-remove',
                            text: '<i class="icon ion-social-buffer action-sheet-icon"></i> Aus Sammlung Entfernen'
                        });

                    }

                }

            } else {

                // ITEM ARRAY (MULTI SELECTION)

                // check if a folder is within selection
                hasDeleteRight = true;
                hasPublishRight = true;
                for (var i=0; i<item.length; i++) {
                    if (item[i].typeStyle==='folder') selectionWithFolder = true;
                    if (item[i].access.indexOf("Delete") <= -1) hasDeleteRight  = false;
                    if (item[i].access.indexOf("CCPublish") <= -1) hasPublishRight  = false;
                }

                headlineName = item.length+" Objekte";


                if (hasPublishRight) {

                    if (selectionWithFolder) {

                        buttons.push({
                            action: 'collection-add-notallowed',
                            text: '<span class="action-sheet-option-deactivated"><i class="icon ion-social-buffer action-sheet-icon"></i> Zu Sammlung Hinzufügen</span>'
                        });

                    } else {

                        if ($rootScope.lastActiveCollection==null) {

                            buttons.push({
                                action: 'collection-add',
                                text: '<i class="icon ion-social-buffer action-sheet-icon"></i> In eine Sammlung hinzufügen'
                            });

                        } else {

                            var imageDivContent = "<i class=\"icon ion-arrow-right-a action-text-icon\"></i>\n";
                            if (!$rootScope.lastActiveCollection.preview.isIcon) imageDivContent = "<img class='action-text-image-inner' src='"+$rootScope.lastActiveCollection.preview.url+"&width=30&height=30'/>";
                            buttons.push({
                                action: 'collection-add',
                                text: '<i class="icon ion-social-buffer action-sheet-icon"></i> In eine Sammlung hinzufügen'
                            });
                            buttons.push({
                                action: 'collection-add-last',
                                text: "<div class='collection-add-image-wrapper action-text-image'>\n"+
                                imageDivContent +
                                "</div>"+$rootScope.lastActiveCollection.title.substring(0, 30)
                            });
                        }

                    }

                } else {

                    buttons.push({
                        action: 'collection-add-notallowed',
                        text: '<i class="icon ion-social-buffer action-sheet-icon action-deactivated"></i> <span class="action-deactivated">Keine Berechtigung zum Sammeln</span>'
                    });

                }

                if (hasDeleteRight) buttons.push({ 
                    action: 'delete',
                    text: '<i class="icon ion-android-delete action-sheet-icon"></i> Löschen'
                });

            }

            buttons.push({ 
                action: 'close',
                text: '<i class="icon ion-close action-sheet-icon"></i> Abbrechen'
            });

            // Show the action sheet
            var hidesheet = $ionicActionSheet.show({
                buttons: buttons,
                titleText: headlineName,
                //cancelText: '<i class="icon ion-close action-sheet-icon"></i> Abbrechen',
                cancel: function() {
                    onEndActionSheet();
                },
                buttonClicked: function(index) {
                    onEndActionSheet();
                    if (buttons[index].action==='open') {
                        scope.itemActionOpen();
                    } 
                    else if (buttons[index].action==='delete') {
                        scope.itemActionDelete();
                    } 
                    else if (buttons[index].action==='collection-add') {
                        if (selectionWithFolder) {
                            // refuse to select
                            return false;
                        } 
                        scope.itemActionAddCollection(false);
                    }
                    else if (buttons[index].action==='collection-add-last') {
                        if (selectionWithFolder) {
                            // refuse to select
                            return false;
                        }
                        scope.itemActionAddCollection(true);
                    }
                    else if (buttons[index].action==='collection-add-notallowed') {
                        return false;
                    }
                    else if (buttons[index].action==='rename-folder') {
                        scope.folderRename();
                    }
                    else if (buttons[index].action==='rename-folder-notpossible') {
                        try {
                            var message = "Systemordner können nicht umbenannt werden.";
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
                                    });
                                });
                        } catch (e) {
                            var alertPop = $ionicPopup.alert({
                                title: 'Info',
                                template: message
                            });
                            alertPop.then(function () {
                            });
                        }
                    }
                    else if (buttons[index].action==='collection-remove') {
                        scope.itemActionRemoveCollection();
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
            var unbindBack = scope.$on('button:back',function(){
                hidesheet();
            });

            //reset back button to old function
            var onEndActionSheet = function() {
                $rootScope.actionSheet = false;
                unbindBack();
            };

        };

        var deleteNextItem = function(itemArray, then) {
            if (itemArray.length===0) {
                $timeout(function(){
                    then();
                },1000);
                return;
            }
            var nextItem = itemArray.pop();
            EduApi.deleteNode(nextItem.ref.id,function(){
                // WIN
                //console.log("WIN DELETE "+nextItem.ref.id);
                try {
                    document.getElementById('tile-'+nextItem.ref.id).classList.add("animationFadeOut");
                } catch (e) {}
                deleteNextItem(itemArray, then);
            }, function(){
                // FAIL
                console.log("FAIL DELETE "+nextItem.ref.id);
                deleteNextItem(itemArray, then);
            });
        };

        var addToCollectionNextItem = function(itemArray, collectionId, noErrorSoFar, then) {
            if (itemArray.length===0) {
                $timeout(function(){
                    then(noErrorSoFar);
                },1000);
                return;
            }
            var nextItem = itemArray.pop();
            EduApi.addContentToCollection("-home-", collectionId , nextItem.ref.id, function(){
                    // WIN
                    console.log("OK added to collection("+collectionId+") the node("+nextItem.ref.id+")");
                    addToCollectionNextItem(itemArray, collectionId, noErrorSoFar, then);
                }, function(){
                    // FAIL
                    console.error("FAIL added to collection("+collectionId+") the node("+nextItem.ref.id+")");
                    addToCollectionNextItem(itemArray, collectionId, false, then);
                }
            );
        };

        var removeFromCollectionNextItem = function(itemArray, collectionId, noErrorSoFar, then) {
            if (itemArray.length===0) {
                $timeout(function(){
                    then(noErrorSoFar);
                },1000);
                return;
            }
            var nextItem = itemArray.pop();
            EduApi.removeContentFromCollection("-home-", collectionId , nextItem.ref.id, function(){
                    // WIN
                    console.log("OK remove from collection("+collectionId+") the node("+nextItem.ref.id+")");
                    addToCollectionNextItem(itemArray, collectionId, noErrorSoFar, then);
                }, function(){
                    // FAIL
                    console.error("FAIL remove from collection("+collectionId+") the node("+nextItem.ref.id+")");
                    addToCollectionNextItem(itemArray, collectionId, false, then);
                }
            );
        };

        var prepareData = function (data, numberOfValidNodesCallback) {

            if (typeof data.nodes === "undefined") return data;
            data.folders = [];
            data.items = [];

            var countValidNodes = 0;
            for (var i = 0; i < data.nodes.length; i++) {

                try {

                    data.nodes[i].typeStyle = "unknown";
                    if (data.nodes[i].isDirectory) {
                        data.nodes[i].typeStyle = "folder";
                    } else {
                        // default is file
                        data.nodes[i].typeStyle = "file";
                        // check properties if maybe a link
                        try {
                            if ((typeof data.nodes[i].mediatype!=="undefined") && (data.nodes[i].mediatype==="link")) data.nodes[i].typeStyle = "link";
                        } catch (e) { console.warn("services.js -> FAIL ON check properties if maybe a link"); }
                    }
    
                    if (data.nodes[i].typeStyle !== "unknown") countValidNodes++;

                } catch (e) {
                    alert("FAIL(" + JSON.stringify(e) + ") on prepare node: " + JSON.stringify(data.nodes[i]));
                }
            }

            if (typeof numberOfValidNodesCallback !== "undefined") {
                numberOfValidNodesCallback(countValidNodes);
            }

            return data;
        };

    /*  DEACTIVATED because download is now handled by render service
        needs plugins:
        - https://github.com/apache/cordova-plugin-file-transfer
        - https://github.com/SpiderOak/FileViewerPlugin
    */
  var downloadContent = function(item, callback) {

    console.log("downloadContent START");

    try {

        // on browser simply open in browser
        if ( ( !System.isNativeIOS() ) && ( !System.isNativeAndroid() ) ) {
            console.log("File Transfer is not available on this environment");
            window.open(downloadUrl,'Download');
            callback();
            return;
        }

        // show spinner
        $ionicLoading.show({
            template: $rootScope.spinnerSVG
        });

        // open content viewer
        var openInOtherApp = function(filePath) {
            try {
                console.log("window.FileViewerPlugin",window.FileViewerPlugin);
                // https://github.com/SpiderOak/FileViewerPlugin
                window.FileViewerPlugin.view({
                        action: window.FileViewerPlugin.ACTION_VIEW,
                        url: filePath
                    },
                    function() {},
                    function(error) {
                        alert("OPEN FAIL-1:"+JSON.stringify(error));
                    }
                );
            } catch (e) {
                alert("OPEN FAIL-2:"+JSON.stringify(e));
            }
        };

        // when download is ready
        var winDownload = function(result, item, filePath) {

            if (System.isNativeIOS()) {

                // iOS
                openInOtherApp(filePath);
                $ionicLoading.hide();
                callback();

            } else {

                $ionicLoading.hide();

                // Android
                $ionicPopup.show({
                    template: 'Die Datei "'+item.name+'" wurde erfolgreich in den Ordner "Downloads" heruntergeladen.',
                    title: 'Objekt heruntergeladen',
                    buttons: [
                        {
                            text: 'Öffnen',
                            type: 'button-positive',
                            onTap: function() {
                                openInOtherApp(filePath);
                            }
                        },
                        { text: 'OK', type: 'button-positive' }
                    ]
                });
                callback();

            }
        };

        // when download failed
        var failDownload = function(err) {
            $ionicLoading.hide();
            console.dir(err);
            var alertPopup = $ionicPopup.alert({
                title: 'Problem',
                template: 'Die Datei konnte nicht heruntergeladen werden. '+JSON.stringify(err)
            });
            alertPopup.then(function() {});
            callback();
        };

        // the actual downloading
        var contentDownload = function(downloadUrl, item) {

            // set path to store on device
            var targetPath = cordova.file.externalRootDirectory + "Download/";
            if (System.isNativeIOS()) targetPath = cordova.file.documentsDirectory;
            var filePath = encodeURI(targetPath + item.name);
            // console.log("Path to store content",filePath);

            if (System.isNativeIOS()) {

                // iOS
                $cordovaFileTransfer.download(downloadUrl, filePath, {}, true)
                    .then(function(result) {

                        // WIN
                        winDownload(result, item, filePath);

                    }, function(err) {

                        // FAIL
                        failDownload(err);

                    }, function (progress) {
                        $timeout(function () {
                            var progressPercent = (progress.loaded / progress.total) * 100;
                            console.log(progressPercent);
                        });
                    });

            } else {

                // Android
                window.CordovaHttpPlugin.downloadFile(downloadUrl, {}, {}, filePath, function(result) {

                    // WIN
                    winDownload(result, item, filePath);

                }, function(response) {

                    // FAIL
                    failDownload(response);

                });

            }

        }

        // download URL (with redirect)
        var downloadUrl = item.downloadUrl + "&accessToken="+EduApi.getOAuthAccessToken();

        if (System.isNativeIOS()) {

            // in iOS following redirects works automatically - so go direct
            console.log("downloadContent IOS URL: "+downloadUrl);
            contentDownload(downloadUrl, item);

        } else {

            // resolve redirect (because plugin download can not follow redirect)
            console.log("Resolving URL ANDROID: "+downloadUrl);
            window.CordovaHttpPlugin.get(downloadUrl, {}, {}, function(response) {
                console.log("200 NOT A REDIRECT URL - use original: "+downloadUrl);
                contentDownload(downloadUrl, item);
            }, function(response) {
                if (response.status==302) {
                    var redirectUrl = decodeURIComponent(response.headers.Location);
                    console.log("302 Redirect Resolved to: "+redirectUrl);
                    contentDownload(redirectUrl, item);
                } else {
                    callback();
                }
            });

        }

    } catch (e) {
        // missing: cordova plugin add cordova-plugin-file-transfer
        alert("FAIL DOWNLOAD: "+e);
    }
};

        return {
            deleteNodeItems: function(itemArray, then) {
                deleteNextItem(itemArray, then);
            },
            downloadItem: function(item, then) {
                alert("DEACTIVATED: downloadContent in services.js");
                //downloadContent(item, then);
            },
            openItemsEditDialog: function(scope, item) {
                return editItemsDialog(scope, item);
            },
            collectionHasPermission: function(collection, permission) {
                if (typeof collection.access === "undefined") return false;
                for (var j=0; j<collection.access.length; j++) {
                    if (collection.access[j]===permission) {
                        return true;
                    }
                }
                return false;
            },
            afterProcessNodeDataFromServer: function(data, numberOfValidNodesCallback) {
                return prepareData(data, numberOfValidNodesCallback);
            },
            showItemDetailsModal : function(scope, item, whenDone) {
                return showDetailsModal(scope, item, whenDone);
            },
            uploadImageWorkspace : function(scope) {
                return headerButtonUpload(scope);
            },
            addItemsToCollection : function(items, collectionId, callback) {
                return addItemsToCollectionIntern(items, collectionId, callback);
            },
            setLatestCollection : function(collection) {
                if (typeof collection == "undefined") return;
                if (typeof collection.access == "undefined") return;
                var canPublishOnCollection = false;
                for (var i=0; i<collection.access.length; i++) if (collection.access[i]=="CCPublish") canPublishOnCollection = true;
                if (!canPublishOnCollection) return;
                $rootScope.lastActiveCollection = collection;
            }
        }
 
})

/*
 * Store Account relevant data and states
 */
.factory('Account', ['$log', 'System', 'EduApi', '$rootScope', '$timeout', function($log, System, EduApi, $rootScope, $timeout) {

    // is persistent
    var account = {
        accessToken : "",
        refreshToken : "",
        expiresIn : 0,
        lastRefresh: 0,
        profile  : {},
        lastLogin: 0,
        clientSettings : {
            workspaceViewMode : 'list',
            selectedServer: {name:null, url: null, apiVersionMajor: 1, apiVersionMinor: 0},
            introShownWorkspace : false,
            introShownSearch : false
        }
    };

    // needs to be updated from server frequently
    var sessionData = {
        currentScope : null,
        isAdmin : false,
        isGuest : false,
        isValidLogin : false,
        sessionTimeout : 3600,
        toolPermissions : [],
        userHome : null
    };

    var pathBeforeLogin = "";

    // persist local
    var storeAccount = function() {
        localStorage.setItem("account", JSON.stringify(account));
    };

    // try to load local
    var loadAccount = function() {
        var json = localStorage.getItem("account");
        if ((typeof json !== "undefined") && (json!==null) && (json.length>0)) {
            try {
                account = JSON.parse(json);
                $timeout(function(){
                    try {
                        $rootScope.profileName = account.profile.profile.firstName + " " +account.profile.profile.lastName;
                    } catch (e) {}
                },100);
            } catch (e) {
                console.log("EXCEPTION - failed to parse stored json account data '"+json+"'");
                console.dir(e);
            }
        }
    };

    // try to load on service init
    loadAccount();

    return {

        loginUser : function (name, pass, callbackWin, callbackFail) {

            EduApi.getOAuthTokensByUsernamePassword(name, pass, function(data){

                // check token data
                if (typeof data.access_token === "undefined") {
                    console.log("FAIL: undefined access_token on oauth response");
                    callbackFail();
                    return;
                }
                if (typeof data.refresh_token === "undefined") {
                    console.log("FAIL: undefined refresh_token on oauth response");
                    callbackFail();
                    return;
                }
                if (typeof data.expires_in === "undefined") {
                    console.log("FAIL: undefined expires_in on oauth response");
                    callbackFail();
                    return;
                }

                // store tokens
                account.accessToken = data.access_token;
                account.refreshToken = data.refresh_token;
                account.expiresIn = data.expires_in;
                account.lastRefresh = new Date().getTime();
                account.lastLogin = new Date().getTime();
                storeAccount();

                // store token for iOS share extension
                // https://github.com/protonet/cordova-plugin-nsuserdefaults-for-app-groups
                try {

                    //alert("STORE CRED")

                    // store eduserver to group for iOS
                    var value1 = EduApi.getBaseUrl();
                    value1 = value1.substring(0, value1.length-17);
                    window.AppGroupsUserDefaults.save({
                        suite: "group.edusharing",
                        key: "eduserver",
                        value: value1
                    },
                        function() {
                            // WIN
                            //alert("OK group.edusharing STORED --> key('eduserver') value("+value1+")");

                            // store access_token to group for iOS
                            var value2 = data.access_token;
                            window.AppGroupsUserDefaults.save({
                                suite: "group.edusharing",
                                key: "access_token",
                                value: value2
                            },
                            function() {
                                // WIN
                                //alert("OK group.edusharing STORED --> key('access_token') value("+value2+")");

                                // store refresh_token to group for iOS
                                var value3 = data.refresh_token;
                                window.AppGroupsUserDefaults.save({
                                    suite: "group.edusharing",
                                    key: "refresh_token",
                                    value: value3
                                }, function(){

                                    // WIN
                                    //alert("OK group.edusharing STORED --> key('refresh_token') value("+value3+")");

                                    // store refresh_token to group for iOS
                                    var value4 = data.expires_in;
                                    window.AppGroupsUserDefaults.save({
                                        suite: "group.edusharing",
                                        key: "expires_in",
                                        value: value4+""
                                    }, function() {

                                        // WIN
                                        //alert("OK group.edusharing STORED --> key('expires_in') value("+value4+")");

                                    }, function() {
                                        // FAIL
                                        //alert("save FAIL EXPIRES IN");
                                    });

                                }, function() {
                                    // FAIL
                                    //alert("save FAIL REFRESH TOKEN");
                                });


                            }, function() {
                                // FAIL
                                //alert("save FAIL ACCESS TOKEN");
                            });

                        }, function() {
                            // FAIL
                            //alert("save FAIL SERVER");
                        }
                    );
    
                } catch (e) {
                    // thats OK when running not on iOS
                    //alert("FAIL:"+JSON.stringify(e));
                }

                callbackWin();
            }, function() {
                callbackFail();
            });

        },

        storeOAuthData : function(accessToken, refreshToken, expiresIn) {
            account.accessToken = accessToken;
            account.refreshToken = refreshToken;
            account.expiresIn = expiresIn;
            account.lastRefresh = new Date().getTime();
            storeAccount();
        },

        isLoggedIn : function() {
            return (account.accessToken.length>1);
        },

        loginOut : function() {
            account.accessToken = "";
            account.refreshToken = "";
            account.expiresIn = 0;
            account.lastRefresh = 0;
            account.profile = {};
            storeAccount();
        },

        rememberPathBeforeLogin : function(path) {
            if (path.indexOf("login")>0) {
                console.log("dont remember login path before login");
                return;
            }
            pathBeforeLogin = path;
        },

        getPathBeforeLogin : function() {
            return pathBeforeLogin;
        },

        getProfile : function() {
            return account.profile;
        },

        getAccount : function() {
            return account;
        },

        setSessionData : function(data) {
            sessionData = data;
        },

        getSessionData : function() {
            return sessionData;
        },

        hasToolPermission : function(permissionStr) {
            if (sessionData === null) {
                console.log("sessionData === null");
                return false;
            }
            if (typeof sessionData.toolPermissions === "undefined") {
                console.log("typeof sessionData.toolPermissions === \"undefined\"");
                return false;
            }
            if (sessionData.toolPermissions == null) {
                console.log("sessionData.toolPermissions == null"); // !!!
                return false;
            }
            for (var i=0; i<sessionData.toolPermissions.length; i++) {
                if (sessionData.toolPermissions[i]===permissionStr) return true;
            }
            console.log("not found ("+permissionStr+")");
            return false;
        },

        storeProfile : function(profiledata) {
            account.profile = profiledata;
            storeAccount();
        },

        getClientSettings : function() {
            if (typeof account.clientSettings === "undefined") return {};
            return account.clientSettings;
        },

        storeClientSettings : function(clientSettings) {
            account.clientSettings = clientSettings;
            storeAccount();
        }

    };

}])

// makes sure that no word is longer then 20 chars
.filter('wordbreaker', function() {
    return function(input, maxWordLength) {

            input = input || '';
            var out = '';
            var countWithoutSpace = 0;

            for (var i = 0; i < input.length; i++) {
                out = out + input.charAt(i);

                if (input.charAt(i)==' ') {
                    countWithoutSpace = 0;
                } else {
                    countWithoutSpace = countWithoutSpace + 1;
                }
                if (countWithoutSpace>maxWordLength) {
                  countWithoutSpace = 0;
                  out = out + ' ';
                }
            }
        return out;
    };
})

.factory('Base64', function () {
        /* jshint ignore:start */

        var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

        return {
            encode: function (input) {
                var output = "";
                var chr1, chr2, chr3 = "";
                var enc1, enc2, enc3, enc4 = "";
                var i = 0;

                do {
                    chr1 = input.charCodeAt(i++);
                    chr2 = input.charCodeAt(i++);
                    chr3 = input.charCodeAt(i++);

                    enc1 = chr1 >> 2;
                    enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
                    enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
                    enc4 = chr3 & 63;

                    if (isNaN(chr2)) {
                        enc3 = enc4 = 64;
                    } else if (isNaN(chr3)) {
                        enc4 = 64;
                    }

                    output = output +
                        keyStr.charAt(enc1) +
                        keyStr.charAt(enc2) +
                        keyStr.charAt(enc3) +
                        keyStr.charAt(enc4);
                    chr1 = chr2 = chr3 = "";
                    enc1 = enc2 = enc3 = enc4 = "";
                } while (i < input.length);

                return output;
            },

            decode: function (input) {
                var output = "";
                var chr1, chr2, chr3 = "";
                var enc1, enc2, enc3, enc4 = "";
                var i = 0;

                // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
                var base64test = /[^A-Za-z0-9\+\/\=]/g;
                if (base64test.exec(input)) {
                    window.alert("There were invalid base64 characters in the input text.\n" +
                        "Valid base64 characters are A-Z, a-z, 0-9, '+', '/',and '='\n" +
                        "Expect errors in decoding.");
                }
                input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

                do {
                    enc1 = keyStr.indexOf(input.charAt(i++));
                    enc2 = keyStr.indexOf(input.charAt(i++));
                    enc3 = keyStr.indexOf(input.charAt(i++));
                    enc4 = keyStr.indexOf(input.charAt(i++));

                    chr1 = (enc1 << 2) | (enc2 >> 4);
                    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                    chr3 = ((enc3 & 3) << 6) | enc4;

                    output = output + String.fromCharCode(chr1);

                    if (enc3 !== 64) {
                        output = output + String.fromCharCode(chr2);
                    }
                    if (enc4 !== 64) {
                        output = output + String.fromCharCode(chr3);
                    }

                    chr1 = chr2 = chr3 = "";
                    enc1 = enc2 = enc3 = enc4 = "";

                } while (i < input.length);

                return output;
            }
        };

});

