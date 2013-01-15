
global.__dircache = __dirname + '/cache'  ;

var options = { 
	proxyPort: 8080 , 
	verbose: true ,
	policyAction: 'generic_allow'
};

var http  = require('http');
var https  = require('https');
var net  = require('net');
var url   = require('url');
var fs   = require('fs');

var certs = require (__dirname + '/lib/ssl/certs' );

var __diractions = __dirname + '/actions/';

var actions = {} ;

var rules ={ 
	'blockhost.co.il1' : [
		 { url : /.*/  , action:  'generic_deny' }
	]
};

var getAction = function( host ,  url )
{
	host = host.replace(/^www\.|\.$/, '');
	
	if(rules[host])
	{
		for(i in rules[host])
		{
			if(url.match( rules[host][i].url ))
			{
				return  rules[host][i].action ;
			}
		}
	}
	return options.policyAction;
};

var loadAction = function( filename , overwrite )
{
	delete require.cache[require.resolve(filename)];
	action = require( filename );
	if(action.name && action.requestHandle)
	{
		if(!actions[ action.name ] ||  overwrite)
		{
			actions[ action.name ] = action;
			if( options.verbose ) console.log( 'load atcion: ' + action.name);
		}
	}
};

var actionFiles = fs.readdirSync( __diractions );

for(i in actionFiles)
{
	if(actionFiles[i].match(/\.js$/)) loadAction(__diractions + actionFiles[i]);
}

fs.watch(__diractions, function(event, filename){
	if(( event == 'change' || event == 'rename' ) && filename.match(/\.js$/) )
	{
		loadAction( __diractions + filename , true );
	}
});

console.log(actions);


function decodeHost(host){
	out={};
	host = host.split(':');
	out.host = host[0];
	if(host[1])out.port = host[1];
	return out;
}

var handleRequest = function(request , response , isSsl)
{
	var action = decodeHost( request.headers.host );
	var urlParse = url.parse(request.url, true);
	//console.log( urlParse);
	if(!urlParse.host) urlParse.host = action.host;
	
	var createRequest = function( callback ){
		var _proxy_request  =  (isSsl ? https : http).request(
		{
			host: action.host
			, port:  action.port || (isSsl ? 443 : 80)
			, path: urlParse.path
			, headers: request.headers
			, method: request.method
		},
			function(proxy_response)
			{
				proxy_response.on('end', function() {
					response.end();
				});
				proxy_response.on('close', function() {
					proxy_response.connection.end();
				});
				proxy_response.on('error', function(err) {});
				
				callback(proxy_response);
			}
		
		);
		_proxy_request.on('error', function(err) {
			response.end(); 
		});
		
		request.on('end', function() {
			_proxy_request.end();
		});
		
		request.on('close', function() {
			_proxy_request.end();
		});

		return _proxy_request;
	};

	(actions[getAction( urlParse.host  , urlParse.path )]  || actions[options.policyAction])
	.requestHandle( createRequest , request , response ,  urlParse , isSsl );
	
	request.on('error', function(err) { 
			response.end(); 
	});
};

var proxyServer = http.createServer();


proxyServer.addListener('request' , handleRequest );

var keyMaster = certs.getMasterKey();

proxyServer.addListener('connect', function( request ,  socket , head) {
	var action = decodeHost( request.url );

	if(0){
	
		var proxySocket = net.createConnection( action.port || 443 , action.host  );
		if( options.verbose )  console.log( "proxy connect to https " + action.host );
		
		proxySocket.pipe(socket);
		socket.pipe(proxySocket);
		
		socket.write( "HTTP/1.0 200 Connection established\r\n\r\n" ); 
		proxySocket.write(head);
		
	}else{
		certs.genCert( action.host , function( cert ){
			if(!cert)return;
			if( options.verbose )  console.log( "cert for " + action.host + " - head: " +head );
			var proxySslServer = https.createServer( 
				{
					key: keyMaster ,
					cert: cert  ,
				}
			);
			proxySslServer.addListener('request' , function( request , response ){
					handleRequest(request , response , true);
			});
			proxySslServer.on( 'clientError' , function(err){ 
				if( options.verbose )  console.log( err );
			});
			
			socket.write( "HTTP/1.0 200 Connection established\r\n\r\n" ); 
			proxySslServer.emit( 'connection' , socket );
			/*
			socket.on('end', function() { delete proxySslServer; });
			socket.on('close', function() { delete proxySslServer; });
			*/
		});
	}
});



proxyServer.addListener('error', function() {
	sys.log("error on server?");
});

proxyServer.listen( options.proxyPort , function(){
	if( options.verbose ) console.log( "proxy server is listen on port %d" , options.proxyPort );
});




