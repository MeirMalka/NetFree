

var phttp = require(__dirname + "/../lib/server");
var http = require("http");

var onnex = require("onnex").create();

onnex.addConnect({ port: 5432 ,host: "db0.netfree.613m.org" , alwaysConnect: true });

var s = phttp.createServer({ onnex: onnex });

s.listen( 7777 ,"0.0.0.0" ,function(){
	 console.log("run server on port 7777");
}); 