
exports.name = "generic_allow" ;

exports.requestHandle = function( createRequest , request , response , urlParse,  isSsl )
{
	
	
	var proxy_request = createRequest( function(proxy_response) {
		console.log( "proxy to %s" , urlParse.host + urlParse.path );
		
		proxy_response.on('data', function(d) {
			response.write(d);
		});
		
		response.writeHead(proxy_response.statusCode, proxy_response.headers);
	});
	
	request.on('data', function(d) {
		proxy_request.write(d);
	});
	
};
