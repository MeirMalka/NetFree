

var http  = require('http');
var https  = require('https');
var net  = require('net');
var url   = require('url');
var fs   = require('fs');
var util = require('util');
var path = require('path');

var certs = require( __dirname + '/ssl/certs' );
var filters = require( __dirname + '/filters' );
var context = require( __dirname + '/context' );

var phttp = exports;




function Server( opts, requestListener ) {

	//if (!(this instanceof Server)) return new Server(opts, requestListener);
  
	http.Server.call(this, null, http._connectionListener);
	this.options = opts || {};
    this.options.verbose = true;

	var _this = this;
	
	this.filters = filters({ pathName: path.join( __dirname , '../filters') ,default: "unknown" /* , onnex: this.options.onnex*/ });
	
	
	this.on('request',function (request, response) { 
		
		request.urlParse = url.parse( request.url );
		if( _this.options.verbose ) console.log(request.url);
		
		var ctx = {__proto__: context.__proto__};
	
		ctx.onnex = _this.options.onnex;
		ctx.request = request;
		ctx.response = response;
		
		
		//on Request
		ctx.next = function(){
			
			delete request.headers['accept-encoding'];
			//delete request.headers['if-modified-since'];
			//delete request.headers['if-none-match'];
			
			var _sourceRequest  =  (request.urlParse.protocol == 'https:' ? https : phttp).request(
			{
				 hostname: request.urlParse.hostname
				, port:  request.urlParse.port 
				, path: request.urlParse.path
				, headers: request.headers
				, method: request.method
				, rejectUnauthorized: false
			});
			
			
			_sourceRequest.on('response', function(sourceResponse)
			{       
				 
				 ctx.sourceResponse = sourceResponse;
				 
				 sourceResponse.on('error', function(err) {} );
				 
				 //on Response
				 ctx.next = function(){
					 response.writeHead(sourceResponse.statusCode, sourceResponse.headers);
				     //sourceResponse.on('data' , response.write.bind(response) );
				     //sourceResponse.on('end', function(){ response.end() } );
					 sourceResponse.pipe(response);
				 };
				 /*sourceResponse.on('end', function(){ 
					 //if(!response._header) response.writeHead(sourceResponse.statusCode, sourceResponse.headers);
					 response.end();
				 });*/
				 _this.filters.applyFilter("response" , ctx);
	
			});

			_sourceRequest.on('error', function(err){
				if( _this.options.verbose ) console.log("error:" , err);
				response.end(); 
			});
			
			request.on('end', function(){ _sourceRequest.end() }  );
			request.on('close', function(){ _sourceRequest.end() }  );
			
			
			request.on('data', function(data) {			
				_sourceRequest.write(data);
			});
		};
		
		_this.filters.applyFilter("request" , ctx);
		
	});

	
// SSL -----------------  SSL -----------------  SSL -----------------  SSL -----------------  SSL  
	this.on('connect', function( request ,  socket , head) {
		request.host = request.url.split(':')[0];
		
		if(0){
				
			var proxySocket = net.createConnection( action.port || 443 , action.host  );
			if( _this.options.verbose )  console.log( "proxy connect to https " + action.host );
					
			proxySocket.pipe(socket);
			socket.pipe(proxySocket);
					
			socket.write( "HTTP/1.0 200 Connection established\r\n\r\n" ); 
			proxySocket.write(head);
					
		}else{
			
			certs.getServer(_this, request ,function( proxySslServer ){
				if(!proxySslServer) return socket.end();
				socket.write( "HTTP/1.0 200 Connection established\r\n\r\n" ); 
				proxySslServer.emit( 'connection' , socket );
			});
		}
	});

	if (requestListener) {
		this.addListener('request', requestListener);
	}
}

util.inherits(Server, http.Server);

exports.Server = Server;

exports.createServer = function(opts, requestListener) {
	return new Server(opts, requestListener);
};


for(var key in http) if(!exports.hasOwnProperty(key))
		exports[key] = http[key];


Server.prototype.listenSsl = function( port , callback ) //TODO: ssl listen
{


};

exports.httpFree = function( opts, requestListener ){
	return new Server( opts, requestListener );
};


