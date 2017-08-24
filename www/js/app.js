// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js
angular.module('starter', ['ionic', 'starter.controllers', 'starter.controllerWorkspace', 'starter.controllerCollections', 'starter.controllerCollectionEdit', 'starter.controllerCollectionAdd', 'starter.controllerLogin', 'starter.controllerSearch','starter.services', 'starter.serviceApi', 'starter.directives', 'ngCordova', 'ngSanitize'])

.run(function($ionicPlatform, $timeout, $location, $rootScope, System, Share, EduApi, $cordovaInAppBrowser, Account) {

  /*
   * Init Server Api Endpoint
   */

  $ionicPlatform.ready(function() {


      // dynamic setting of tile width - so that on
      // portrait view always two tiles in a row
      var w = window,
          d = document,
          e = d.documentElement,
          g = d.getElementsByTagName('body')[0],
          screenX = w.innerWidth || e.clientWidth || g.clientWidth
      $rootScope.tileWidthPixel = 160;
      //if (System.isNativeIOS()) {
      if (screenX<=420) {
        $rootScope.tileWidthPixel = Math.round((screenX - 40) / 2);
      }

    // provide app version set in config.xml
    $rootScope.appVersion = "n/a";
    if (typeof cordova !== "undefined") {
        if (typeof cordova.getAppVersion !== "undefined") {
            cordova.getAppVersion.getVersionNumber(function(version) {
                $rootScope.appVersion = version;
            });
        } else {
            alert("Missing cordova plugin: https://github.com/whiteoctober/cordova-plugin-app-version.git");
        }
    } else {
       // app version not available when running in browser
       $rootScope.appVersion = "BROWSER";
    }

    // some root scope data init
    $rootScope.progress = 0;
    $rootScope.actionSheet = false;
    $rootScope.ionicReady = false;
    $rootScope.ignorePause = false;
    $rootScope.offerDownloadOption = true;
    $rootScope.displayDiv = "display:block;";
    $rootScope.displayDivFlex = "display:flex;";
    if (System.isNativeIOS()) $rootScope.displayDivFlex = "display:flex;";
    if (typeof $rootScope.profileName === "undefined") $rootScope.profileName = "";
    $rootScope.profileImageUrl = "./img/profile-default.png";
    $rootScope.isLoggedIn = false;
    $rootScope.contentViewMode = 'list';
    $rootScope.headerShowEditCollection = false;
    $rootScope.headerShowNewCollection = false;
    $rootScope.headerClass = "header-dialog";

    // listen if detail view wants to open link in system browser
    window.addEventListener('openInBrowser', function(m) {
        //alert("open in browser : "+m.detail);
        $cordovaInAppBrowser.open(m.detail,'_system');
    });

    if (window.StatusBar) {
      // org.apache.cordova.statusbar required
      StatusBar.styleLightContent();
    }

    // Check for WebIntents sharing content from outside
    try {

        if (System.isNativeAndroid()) {

            // process WebIntent when available on startup --> LINK
            window.plugins.webintent.hasExtra(window.plugins.webintent.EXTRA_TEXT,
                function (has) {
                    if (has) {
                        Share.process();
                    }
                }, function () {
                    console.log("FAIL - was not able to check for WebIntent data");
                }
            );

            // process WebIntent when available on startup --> IMAGE
            window.plugins.webintent.hasExtra(window.plugins.webintent.EXTRA_STREAM,
                function (has) {
                    if (has) {
                        Share.process(window.plugins.webintent.EXTRA_STREAM);
                    }
                }, function () {
                    console.log("FAIL - was not able to check for WebIntent data");
                }
            );

            // process WebIntent when occuring while app is running
            window.plugins.webintent.onNewIntent(Share.process);
        }


        // listen on cordova event when app goes into background
        document.addEventListener("pause", function() {
            if (System.hasWebIntent()) {
                // exit app when it goes into background
                ionic.Platform.exitApp();
            }  
        }, false);
        
        // listen on cordova event when app comes back from background
        document.addEventListener("resume", function() {
            $rootScope.$broadcast('app:resume');
        }, false);

        // connect EduApi and Context to keep user session data fresh
        EduApi.setUserSessionDataRefreshListener(function(userSessionData){
            Account.setSessionData(userSessionData);
        });

    } catch (e) {
        console.log("EXCEPTION - on check for WebIntent :");
        console.dir(e);
    }

    /* for simulating WebIntent on development in browser
    console.warn("running fake webintent - remove after testing");
    System.pushWebIntent({type: "android.intent.extra.TEXT", url: "", extra: "https://www.tagesschau.de/ausland/usa-faktenpruefer-101.html"});
    */

    // support native BACK button --> http://ionicframework.com/docs/api/service/$ionicPlatform/
    // send as broadcast to all sub scopes
    $ionicPlatform.registerBackButtonAction(function(e) {
        $rootScope.$broadcast('button:back', e);
    }, 400);

    // WORKAROUND: APP did not updating search text in input field
    $rootScope.$on('search:kleyword:set',function(event, args) {
        $rootScope.searchword = args;
        $timeout(function(){
            $rootScope.searchword = args;
        },100);
    });

    // let login view know that ionic is ready to maybe show intro screen
    $rootScope.ionicReady = true;
    $rootScope.$broadcast('ionic-ready', null);

  });

})

.config(function($stateProvider, $urlRouterProvider, $logProvider) {

  try {

      $logProvider.debugEnabled(false);

      // Ionic uses AngularUI Router which uses the concept of states
      // Learn more here: https://github.com/angular-ui/ui-router
      // Set up the various states which the app can be in.
      // Each state's controller can be found in controllers.js
      $stateProvider

          // setup an abstract state for the menu directive
          .state('app', {
              url: '/app',
              abstract: true,
              templateUrl: 'templates/menu.html',
              controller: 'AppCtrl'
          })

          // setup an abstract state for the tabs directive
          .state('tab', {
              url: "/tab",
              abstract: true,
              templateUrl: "templates/tabs.html"
          })

          // Each tab has its own nav history stack:

          .state('app.search', {
              url: '/search',
              views: {
                  'menuContent' : {
                      templateUrl: 'templates/tab-search.html',
                      controller: 'SearchCtrl'
                  }
              }
          })
          .state('app.collections', {
              url: '/collections',
              views: {
                  'menuContent' : {
                      templateUrl: 'templates/tab-collections.html',
                      controller: 'CollectionsCtrl'
                  }
              }
          })
          .state('app.collectionedit', {
              url: '/collectionedit/:id/:second',
              views: {
                  'menuContent' : {
                      templateUrl: 'templates/tab-collection-edit.html',
                      controller: 'CollectionEditCtrl'
                  }
              }
          })
          .state('app.collectionadd', {
              url: '/collectionadd',
              views: {
                  'menuContent' : {
                      templateUrl: 'templates/tab-collection-add.html',
                      controller: 'CollectionAddCtrl'
                  }
              }
          })
          .state('app.account', {
              url: '/account',
              views: {
                  'menuContent' : {
                      templateUrl: 'templates/tab-account.html',
                      controller: 'AccountCtrl'
                  }
              }
          })
          .state('app.login', {
              url: '/login',
              views: {
                  'menuContent' : {
                      templateUrl: 'templates/tab-login.html',
                      controller: 'LoginCtrl'
                  }
              }
          })
          .state('app.workspace', {
              url: '/workspace',
              views: {
                  'menuContent' : {
                      templateUrl: 'templates/tab-workspace.html',
                      controller: 'WorkspaceCtrl'
                  }
              }
          });

      // if none of the above states are matched, use this as the fallback
      $urlRouterProvider.otherwise('/app/login');

  } catch (e) {
      alert("Config Error: ");
      alert(JSON.stringify(e));
  }

});