angular.module('starter.directives', [])
/*
 * CONTENT CARD ITEM
 */
.directive('itemTileBig', function($rootScope, Toolbox) {
        function link(scope, element, attrs) {

            // get parameter context from html tag
            scope.context = (typeof attrs.context === "undefined") ? 'n/a' : attrs.context;

            /*
             * MENU CLICK
             */
            scope.menuItemClick = function($event, item) {

                // dont show while multi select mode
                if ($rootScope.multiSelectionMode) {
                    console.log("no menu on item while multi select");
                    return;
                }

                if ($event) {
                    if ($event.stopPropagation) $event.stopPropagation();
                    if ($event.preventDefault) $event.preventDefault();
                    $event.cancelBubble = true;
                    $event.returnValue = false;
                }

                Toolbox.openItemsEditDialog(scope, item);

            };

            scope.smallfolderTileNameBreak = function(name) {
                if (typeof name === "undefined") return "-";
                if (name === null) return "-";
                name = name.split("_").join(" ");
                if ((name.length>14) && ((name.indexOf(" ")<=0)||(name.indexOf(" ")>14)) ) {
                    name = name.substring(0,14) + " " + name.substring(14); 
                } 
                if (name.length>31) {
                    name = name.substring(0,28)+"..";
                }
                return name;
            };                     

            scope.getInfoSubLineList = function(item) {

                if (item.typeStyle==='file') {
                    
                    // its a file
                    var size = item.size;
                    if (size!==null) {
                        try {
                            if (size<1024) {
                                size = size + "Bytes";
                            } else {
                                if (size<1024*1024) {
                                    size = Math.round(size/1024) + "KB";
                                } else {
                                    size = Math.round(size/(1024*1024)) + "MB";
                                }
                            }
                            size = "<i class='icon ion-cube'></i> "+size;
                        } catch (e) {
                            size = "";
                        }
                    } else {
                        size = "";
                    }

                    var modified =  scope.getPropertyOfItem(item, "cm:modified");
                    if ((typeof item.modifiedAt !== "undefined") && (item.modifiedAt!==null)) modified = [Date.parse(item.modifiedAt)];
                    if (modified!==null) {
                        var dateStr = new Date((modified[0]*1)).toLocaleString();
                        if (dateStr!==null) {
                            if (dateStr.indexOf(',')>0) dateStr = dateStr.substring(0,dateStr.indexOf(','));
                            if (dateStr.indexOf('GMT')>0) dateStr = dateStr.substring(0,dateStr.indexOf('GMT')-1);
                            if (dateStr.indexOf('um')>0) dateStr = dateStr.substring(0,dateStr.indexOf('um')-1);
                            modified = "<i class='icon ion-clock'></i> "+dateStr;
                        } else {
                            console.log("dateStr = null");
                        }

                    } else {
                        modified = "";
                    }

                    if ((modified==="") && (size==="")) return "-";
                    if (($rootScope.contentViewMode==="list") && (scope.context==="workspace")) {
                        return size+(size!=="" ? " &nbsp; " : "")+modified;
                    } else {
                        return size+"<br>"+modified;
                    }

                } 
                else if (item.typeStyle==='collection') {

                    var name = (item.owner.profile.firstName + " " + item.owner.profile.lastName).trim();
                    return "<i class='icon ion-person'></i> "+name+"";

                } else {

                    // its a folder, link, ...

                    if ($rootScope.contentViewMode==="tiles") return "";

                    var result = item.modifiedAt;
                    try {

                        var d = new Date(Date.parse(result));
                        //var min = d.getMinutes();
                        //if (min<10) min = "0"+min;
                        return "<i class='icon ion-clock'></i> "+d.getDate()+"."+d.getMonth()+"."+d.getFullYear();

                    } catch (e) {
                        if (result !== null) return "<i class='icon ion-clock'></i> " + result;
                    }

                    return "-";

                }

            };

            scope.getPropertyOfItem = function(item, propName) {
                if (typeof item.properties[propName] !== "undefined") return item.properties[propName];
                return null;
            };

        }

        return {
            link: link,
            templateUrl: './templates/directive-itemTileBig.html'
        };

})
/*
 * CHOOSE COLLECTION ITEM
 */
.directive('chooseCollection', function($rootScope, Toolbox, EduApi, $ionicLoading, $ionicPopup, $ionicScrollDelegate) {
        function link(scope, element, attrs) {

            // parameter show-breadcrumbs='false' (true is default)
            scope.collectionShowBreadCrumbs = typeof attrs.showBreadcrumbs === "undefined" ? true : scope.$eval(attrs.showBreadcrumbs);

            // navigate one level back
            scope.backCollection = function() {
                if (scope.collectionSelectId==="-root-") {
                    if ((typeof $rootScope.dialogPopUp!=="undefined") && (typeof $rootScope.dialogPopUp.close!=="undefined")) $rootScope.dialogPopUp.close();
                    return;
                }
                var parent = scope.collectionParents.pop();
                scope.collectionSelectId = parent.id;
                scope.collectionSelectName = parent.name;
                scope.collectionRefresh();
            };

            // clicking on a bread crumb
            scope.collectionSelectCrumb = function(crumbId) {
                var remainingParents = [];
                for (var k=0; k < scope.collectionParents.length; k++) {
                    if (scope.collectionParents[k].id===crumbId) {
                        // set this crumb as selection
                        scope.collectionSelectId = scope.collectionParents[k].id;
                        scope.collectionSelectName = scope.collectionParents[k].name;
                        break;
                    } else {
                        remainingParents.push(scope.collectionParents[k]);
                    }
                } 
                scope.collectionParents = remainingParents;
                scope.collectionRefresh();
            };

            // navigate one level deeper
            scope.selectCollection = function(item) {
                $ionicScrollDelegate.$getByHandle('collections').scrollTop(); // TODO: find out why scrolltop not working
                scope.collectionParents.push({ 'id':scope.collectionSelectId, 'name': scope.collectionSelectName});
                scope.collectionSelectId = item.ref.id;
                scope.collectionSelectName = item.title;
                scope.collectionRefresh();
            };

            // final selection of collection to store in
            scope.chooseCollection = function() {
                // deliver result over rootscope if set (not pretty - improve later)
                if (typeof $rootScope.dialogCallback !== "undefined") $rootScope.dialogCallback({ "name" : scope.collectionSelectName, "id" :  scope.collectionSelectId});
                if ((typeof $rootScope.dialogPopUp!=="undefined") && (typeof $rootScope.dialogPopUp.close!=="undefined")) $rootScope.dialogPopUp.close();
            };

            // refresh display of collection navigation
            scope.collectionRefresh = function() {
                $ionicLoading.show({
                    template: $rootScope.spinnerSVG
                });
                scope.collectionLoading = true;
                EduApi.getCollections(scope.collectionSelectId, function(data) {

                    // filter collections user has edit rights on
                    scope.collectionList = [];
                    for (var i=0; i<data.collections.length; i++) {
                        if (Toolbox.collectionHasPermission(data.collections[i], 'Write')) scope.collectionList.push(data.collections[i]);
                    }
                    scope.collectionLoading = false;
                    $ionicLoading.hide();

                }, function() {
                    scope.collectionLoading = false;
                    $ionicLoading.hide();
                    console.log("Was not able to load collections.");
                });
            };

            scope.collectionParents = [];

            scope.collectionSelectId = "-root-";
            scope.collectionSelectName = "Sammlungen";

            scope.collectionLoading = true;
            scope.collectionRefresh();

        }

        return {
            link: link,
            templateUrl: './templates/directive-chooseCollection.html'
        };
})

.directive('focusMe', function($timeout) {
  return {
    scope: { trigger: '@focusMe' },
    link: function(scope, element) {
      scope.$watch('trigger', function(value) {
        if(value === "true") { 
          // console.log('trigger',value);
          $timeout(function() {
            element[0].focus(); 
          });
        }
      });
    }
  };
});