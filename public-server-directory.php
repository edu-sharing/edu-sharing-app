<?php
 header("Access-Control-Allow-Origin: *");
 header("Content-Type: application/json");
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
  * 'image' (optional) url of logo image to be shown - should be at least 50px x 50px gif, png or svg
  */
 // URL to the path this script is in
 // use can use it if you want to put images of server in the same directory
 $actual_link = "http://$_SERVER[HTTP_HOST]".substr($_SERVER[REQUEST_URI],0,strrpos( $_SERVER[REQUEST_URI],'/')+1);
 ?>[
     {
         "name" : "OER Contentbuffet",
         "url"  : "https://oer-contentbuffet.info/edu-sharing/"
     },
     {
         "name" : "Metaventis Testserver 4.0",
         "url"  : "http://edu40.edu-sharing.de/edu-sharing/",
         "image": "<? print $actual_link; ?>edu-sharing.jpg"
     }
 ]