


exports.name = "deny" ;

exports.varsion = "0.0.1" ;

exports.onRequest = exports.onResponse = function()
{  
	this.response.writeHead( 503 , { 'Content-Type': 'text/plain' } );
	this.response.end( 'deny \n' );
};
