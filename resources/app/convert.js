var fs = require('fs'),
    xml2js = require('xml2js');
 
var parser = new xml2js.Parser({explicitArray:false});
parser.addListener('end', function(result) {

    var categories = result.GetCategoriesResponse.CategoryArray.Category;
	
	var catTree = {};

	for( var i in categories ){
		var cat = categories[i];
		var catId = cat.CategoryID;
		catTree[catId] = cat[catId] || {childs:[]};
		copy(catTree[catId], cat);

		var parentId = cat.CategoryParentID;
		if( ! parentId in catTree ){
			catTree[parentId] = {
				'childs' : []
			};
		}
		//console.log(catTree[parentId]);
		if( catId != parentId ){
			catTree[parentId]['childs'].push(catId);
		}
	}

	fs.writeFile(__dirname + '/CatTree.json', JSON.stringify(catTree, null, 4), function(){
		console.log("done");
	})
});

function copy(dist, from){
	for(var key in from){
		dist[key] = from[key];
	}
}

fs.readFile(__dirname + '/AllCategories.xml', function(err, data) {
    parser.parseString(data);
});