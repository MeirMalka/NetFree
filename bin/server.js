

var phttp = require(__dirname + "/../lib/server");
var http = require("http");

var json_rpc = require("json-rpc-multiplex");
var connection =  json_rpc.createConnection({ port: 5432 , host: "db.cleanet.613m.org"  });

var s = phttp.createServer({ connection: connection });

s.listen( 7777 ,"0.0.0.0" ,function(){
	 console.log("run server on port 7777");
}); 