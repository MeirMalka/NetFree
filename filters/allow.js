
exports.name = "allow" ;

exports.varsion = "0.0.1" ;

exports.onRequest = function( sess )
{
	this.next();
	//sess.applyFilter("allow");
};

exports.onResponse = function( sess )
{
	
	this.next();
	//_this.sourceResponse.on( 'data' , _this.response.write.bind( _this.response ) );
	
	//sess.applyFilter("allow");
};
