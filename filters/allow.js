
exports.name = "allow" ;

exports.varsion = "0.0.1" ;

exports.onRequest = exports.onResponse = function( )
{
	this.next();
};
