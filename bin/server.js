

var free = require(__dirname + "/../lib/free");
var http = require("http");

var onnex = require("onnex").create();

onnex.addConnect({ port: 5432 ,host: "db0.netfree.613m.org" , alwaysConnect: true });

var httpFree = free.httpFree({ onnex: onnex });

httpFree.listen( 7777 ,"0.0.0.0" ,function(){
	 console.log("run server on port 7777");
}); 