#!/usr/bin/env node

var fs = require('fs');
var path = require('path');

process.stdout.write('******** BEFORE BUILD HOOK - GIT BUILD NUMBER **************\n');

var exec = require('child_process').exec;
exec('svn info', function(error, stdout, stderr) {

  var rev = "n/a";

  /*
   *  ******** TRY TO GET LATEST SVN VERSION NUMBER **********
   *  --> make sure that command 'svn' is working on command line
  try {
    var start = stdout.indexOf("Revision:");
    if (start>0) {
      
      var end = stdout.indexOf("\n",start);
      start = start+10;
      rev = stdout.substr(start, end-start);
      process.stdout.write("REVISION IS #"+rev+"#\n");

    } else {
      process.stdout.write("NO REVISION INFO FOUND: "+stdout+"\n");
    }
  } catch (e) {
      process.stdout.write("BEFORE BUILD HOOK --> ERROR ON GETTING SVN REVISION : "+JSON.stringify(e)+" \n");
  }
   */

  /*
   *  ******** WRITE SVN VERSION NUMBER **********
   */

  try {

      var fileContent = "window.appSvnRevison='"+rev+"';";
      var jsPath = path.join('www', 'buildversion.js');
      fs.unlinkSync(jsPath);
      fs.writeFileSync(jsPath, fileContent, 'utf8');
      process.stdout.write("OK file '"+jsPath+"' updated\n");

  } catch (e) {
    process.stdout.write("BEFORE BUILD HOOK --> ERROR ON WRITING buildversion.js : "+JSON.stringify(e)+" \n");
  }

});