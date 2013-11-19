


var proto = module.exports.__proto__ = {};



proto.block = function(type){
	
	this.response.writeHead( 503 , { 'Content-Type': 'text/html' } );
	this.response.end('<script src="http://netfree.613m.org/b/'+ type + '" type="text/javascript"></script> '+ type);
	if(this.sourceResponse) this.sourceResponse.destroy();
	
};