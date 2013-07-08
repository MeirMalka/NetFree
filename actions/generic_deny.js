
exports.name = "generic_deny" ;

exports.requestHandle = function( createRequest , request , response , urlParse,  isSsl )
{
	
	response.writeHead(500, {'Content-Type': 'text/plain'});
	response.end('deny \n');
	
};