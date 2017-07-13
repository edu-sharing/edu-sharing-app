<?php

 /***********************************************
  * PUBLIC SERVER DIRECTORY
  ***********************************************
  * - this file will be served from a public server 
  * - set url to this file in "service-api.js"" in method "loadPublicServerList""
  * - its PHP so that it can add the Cross-Origin header
  * - extend the list if new server get available
  */   

 header("Access-Control-Allow-Origin: *");
 header("Content-Type: application/json"); ?>[
    {
        "name" : "edu-sharing Demo",
        "url"  : "http://stable.demo.edu-sharing.net/edu-sharing"
    },  
    {
        "name" : "Metaventis Testserver HTTPS",
        "url"  : "https://appserver7.metaventis.com/edu-sharing/"
    },
    {
        "name" : "Metaventis Testserver 7140",
        "url"  : "http://appserver7.metaventis.com:7140/edu-sharing/"
    },                    
    {
        "name" : "Metaventis Testserver 7143",
        "url"  : "http://appserver7.metaventis.com:7143/edu-sharing/"
    }
]