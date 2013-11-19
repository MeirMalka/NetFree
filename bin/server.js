
var relive  = require("relive")({ watch: "../"});

var net = require("net");
var http = require("http");

	
var free = require(__dirname + "/../lib/free");
	


var onnex = require("onnex").create();
onnex.addConnect({ port: 5432 ,host: "db0.netfree.613m.org" , alwaysConnect: true });


relive.setDispose(function(){
	onnex.closeAll();
	onnex.removeAllListeners();
});
	
relive.httpFree = free.httpFree({ onnex: onnex });

if(relive.first){
	
	var port = process.env.PORT || 7777;
	var host = process.env.IP || "0.0.0.0";
	
	var server = net.createServer(function(socket) {
		relive.httpFree.emit( 'connection' , socket );
	});	
	
	server.listen( port , host , function() {
		 console.log("run server on %s:%d",host,port);
	});
}

