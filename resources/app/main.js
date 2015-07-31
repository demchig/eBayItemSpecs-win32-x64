var app = require('app');  // Module to control application life.
var BrowserWindow = require('browser-window');  // Module to create native browser window.
var fs = require('fs');
var ebayTradingAPI = require("node-ebay-trading-api");

var config = require('./config.json');
ebayTradingAPI.setUserToken(config.eBayAuthToken);


// Report crashes to our server.
require('crash-reporter').start();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
var mainWindow = null;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  if (process.platform != 'darwin') {
    app.quit();
  }
});

// This method will be called when Electron has done everything
// initialization and ready for creating browser windows.
app.on('ready', function() {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 1700, height: 1100});

  // and load the index.html of the app.
  mainWindow.loadUrl('file://' + __dirname + '/index.html');

  // Open the devtools.
  //mainWindow.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
});

var CatTree = require(__dirname + '/CatTree.json');
var topCats = [];
for(var i in CatTree){
  if( CatTree[i].CategoryLevel == '1' ){
    topCats.push(CatTree[i]);
  }
}
topCats.sort(function(a, b){
  if (a.CategoryName.toString() < b.CategoryName.toString()){
    return -1;
  }else{
    return 1;
  }
});
//console.log(str);


// In main process.
var ipc = require('ipc');
ipc.on('asynchronous-message', function(event, arg) {
  console.log(arg);  // prints "ping"

  var reply = {method:'dummy'};

  if( arg.method == 'categories' ){
    var cats = getChildCats(arg.catId);
    reply = {
      "catId" : arg.catId,
      "method" : "categories",
      "body" : cats,
    }
  }

  if( arg.method == 'topCats' ){
    Cats = {};  // reset loaded cats
    reply = {
      "method" : "topCats",
      "body" : topCats,
    }
  }

  if( arg.method == 'itemSpecs' ){
    getCategorySpecifics(arg.catId, event);
  }

  event.sender.send('asynchronous-reply', reply);
});



function getChildCats(catId){
  if( ! catId in CatTree ){
    return [];
  }

  var cat = CatTree[catId];
  var childs = cat.childs;

  var ret = [];

  for(var i in childs){
    childId = childs[i];
    ret.push(CatTree[childId]);
  }

  ret.sort(function(a, b){
    if (a.CategoryName.toString() < b.CategoryName.toString()){
      return -1;
    }else{
      return 1;
    }
  });

  return ret;
}


function getCategorySpecifics(catId, event){
  var path = __dirname + '/cache/itemSpecs' + catId + '.json';

  var cat = CatTree[catId];
  var parentID = cat.CategoryParentID;
  var parentName = CatTree[parentID].CategoryName;

  fs.exists(path, function(exists){
    if(exists){
      var ret = require(path);

      var reply = {
        "catId" : catId,
        "method" : "itemSpecs",
        "catName" : CatTree[catId].CategoryName,
        "parentName" : parentName,
        "body" : ret,
      }
      event.sender.send('asynchronous-reply', reply);
    }
    else{

      ebayTradingAPI.call(
        "GetCategorySpecifics",
        {
          "CategoryID" : catId
        },
        function(result){
          //console.log(result);
          if( "Errors"  in result.GetCategorySpecificsResponse){
            console.log(result.GetCategorySpecificsResponse.Errors);
          }

          var Recommendations = result.GetCategorySpecificsResponse.Recommendations || [];
          //console.log(Recommendations);

          if( "NameRecommendation" in Recommendations ){
            var NameRecommendations = Recommendations.NameRecommendation;

            var ret = [];
            for(var i in NameRecommendations ){
              var recommendation = NameRecommendations[i];
              //console.log(recommendation);
              var Name = recommendation.Name;
              if( recommendation.ValidationRules ){
                var ValidationRule = recommendation.ValidationRules;
                var Required = ('MinValues' in ValidationRule) && ValidationRule['MinValues'] || false;
                var SelectionMode = ValidationRule.SelectionMode;
                var ValueRecommendations = recommendation['ValueRecommendation'] || [];  // array

                ret.push({
                  Name : Name,
                  Required : Required,
                  SelectionMode : SelectionMode,
                  ValueRecommendations : ValueRecommendations,
                });            
              }
              //console.log(ret);
            } 
          }

          var reply = {
            "catId" : catId,
            "method" : "itemSpecs",
            "catName" : CatTree[catId].CategoryName,
            "parentName" : parentName,
            "body" : ret,
          }

          saveCache(path, ret);

          event.sender.send('asynchronous-reply', reply);
        }
      );
    }
  });

}


function saveCache(path, obj){
  fs.writeFile(path, JSON.stringify(obj, null, 4), function (err) {
    if (err) throw err;
    console.log('It\'s saved!');
  });
}