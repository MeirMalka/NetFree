
var fs = require('fs');
var path = require('path');
var opensslCA = require("openssl-ca-node");
var lrucache = require("lru-cache");
var https = require('https');


var ca = opensslCA.createCA();


var keyMaster = module.exports.keyMaster = ca.generatePrivateKey( 2084 ) ;//fs.readFileSync( __dirname + '/master_server.key' );
module.exports.caCert = fs.readFileSync( __dirname + '/ca/ca.crt' );

ca.loadCA( fs.readFileSync( __dirname + '/ca/ca.key' ) , module.exports.caCert);

var genCert = module.exports.genCert = function( host , callback ) {	
	process.nextTick(function(){ 
	

		var cert = ca.createCertificate({
			"serial": Math.floor(Math.random()*0xfffffff) ,"startDate" :new Date(2010,1,1) ,"days": 300 , 
			"subject": {  "CN" : host , "C" :"IL" , "O": "FILTER"  , "OU": "FILTER" } 
		});

		callback( cert );	
		
	});
};

var cacheServers = lrucache({ max: 100 , maxAge: 1000 * 60 * 60 * 48 /* 48h */});

var cbServerWait = [];
module.exports.getServer = function( _this , request , callback , rewrite  ) {
	
	var host = request.host;
	var url = request.url;
	
	if ( cacheServers.has(url) && !rewrite && cacheServers.get(url) ) {
		callback( cacheServers.get(url)  );
		return;
	}
	
	if (cbServerWait[url]) {
		cbServerWait[url].push(callback);
		return;
	} else {
		cbServerWait[url] = [ callback ];
	}
	
	callback = function(){
		var cbs = cbServerWait[url]; delete cbServerWait[url];
		do{ 
			var fn = cbs.shift();
			if (typeof fn == 'function') fn.apply(null,arguments);	
		}while(fn);
	};
	
	
	genCert(host,function(cert){
		if(!cert) callback(false);
		
		var proxySslServer = https.createServer( 
			{
				key: keyMaster ,
				cert: cert  ,
			}
		);
		proxySslServer.on('request' , function( proxyRequest , response ){
				proxyRequest.url = 'https://' + url + proxyRequest.url;
				_this.emit('request' , proxyRequest , response );
		});
		proxySslServer.on( 'clientError' , function(err){ 
			cacheServers.del(host)
			console.log("clientError", err , cert);
			//socket.end();
		});
		
		cacheServers.set( url , proxySslServer );
		callback( proxySslServer );
	});
};

