


exports.name = "deny" ;

exports.varsion = "0.0.1" ;

exports.onRequest = exports.onResponse = function( sess )
{   
	
	sess.response.writeHead( 503 , {'Content-Type': 'text/plain' } );
	sess.response.end( 'deny \n' );
	sess.next();
};
