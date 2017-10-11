<?php

 /***********************************************
  * PUBLIC SERVER DIRECTORY
  ***********************************************
  * - this file will be served from a public server 
  * - set url to this file in "service-api.js"" in method "loadPublicServerList""
  * - its PHP so that it can add the Cross-Origin header
  * - extend the list if new server get available
  *
  * 'name' (required) the name to display to user (should be under 25 chars)
  * 'url' (required) the base url used to login to edu-sharing (normally ends on '/edu-sharing/')
  * 'image' (optional) url of logo image to be shown - should be 50px x 50px gif, png or svg
  */   

 header("Access-Control-Allow-Origin: *");
 header("Content-Type: application/json"); ?>[
     {
         "name" : "JOINTLY : oer-contentbuffet",
         "url"  : "https://oer-contentbuffet.info/edu-sharing/"
     },
     {
         "name" : "Metaventis Testserver 4.0",
         "url"  : "http://edu40.edu-sharing.de/edu-sharing/",
         "image": "http://jointly.info/wp-content/uploads/sites/14/2016/11/jointly-Logo.svg"
     }
 ]