
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var fs = require('fs');
var path = require('path');
var https = require('https');


var lrucache = require("lru-cache");



var cacheCert = lrucache({ max: 500 , maxAge: 1000 * 60 * 60 * 48 /* 48h */});

var callbacksWait = {};

var dircerts = __dirname + '/certs/' ;
//if( __dircache != undefined ) dircerts = path.normalize( __dircache + '/certs/' );

if( !fs.existsSync( dircerts ) ) fs.mkdirSync( dircerts );

module.exports.delCert = function( host ){
	return cacheCert.del(host);
};

module.exports.genCert = exports.getCert = function( host , callback , rewrite  ) {


	if( !fs.existsSync( __dirname + "/ca/db/serial" )) fs.writeFileSync( __dirname + "/ca/db/serial", '01\n');
	
	console.log(host);
	var crtFile = dircerts + host + '.crt';
	var csrFile = dircerts + host + '.csr';
	//rewrite = true;
	
	
	if ( cacheCert.has(host) && !rewrite ) {
		callback( cacheCert.get(host)  );
		return;
	}
	
	/*
	if ( fs.existsSync(crtFile) && !rewrite ) {
		callback( fs.readFileSync( path.normalize( crtFile ) ) );
		return;
	}*/

	if (callbacksWait[host]) {
		callbacksWait[host].push(callback);
		return;
	} else {
		callbacksWait[host] = [ callback ];
	}
	exec("openssl req -new -key master_server.key  -out \"" + csrFile + "\" " 
		+	" -subj \"/CN=" + host + "/OU=FILTER/O=FILTER\" -config  ca/openssl.ca.cnf" ,
		{ cwd: __dirname} ,
		function(error, stdout, stderr) {

		console.log("create cert: " + host);

		var openssl = spawn('openssl', [ 'ca', '-notext', '-startdate' , '000101000000-0000' , '-config',
				'ca/openssl.ca.cnf' /*, '-out',   crtFile*/ , '-in',  csrFile ],{ cwd: __dirname} );
		
		
		var cert = '' ; 
		var timerKill = setTimeout(function() {
			openssl.kill();
			console.log("kill openssl: " + host);
		}, 10000);

		openssl.stdout.on('data', function(data) {
			//console.log(data+'');
			cert += data;	
		});
		
		openssl.stderr.on('data', function(data) {
			//console.log(data+'');
			if (data.toString().indexOf('[y/n]') !== -1) {
				openssl.stdin.write('y\n');
			}
		});
		
		openssl.on('exit', function() {
			clearTimeout(timerKill);
			
			//console.log(cert);
			//var cert = fs.existsSync( crtFile ) ?  fs.readFileSync( path.normalize( crtFile ) ) : false;
			cert = cert ? cert : false;
			if(cert) cacheCert.set( host , cert );
			
			
				if(callbacksWait[host]){
					do{
						var callback = callbacksWait[host].shift();
						if (typeof callback == 'function') callback( cert );	
					}while(callback);
					delete callbacksWait[host];
				}
			
			
			fs.writeFile(__dirname+'/ca/db/index.txt', '');
			['ca/db/serial.old','ca/db/index.txt.old',csrFile]
			.forEach(function(file){
				fs.unlink( __dirname+"/" + file,function(){} );
			});
			
			fs.readdir(__dirname + '/ca/db/newcerts/', function(err, files) {
				files.forEach(function(file){
					if (file.match(/\.pem$/)) fs.unlink(__dirname + '/ca/db/newcerts/' + file, function(){});
				});
			});
			
		});

	});
};

var opensslCA = require("openssl-ca-node");


var ca = opensslCA.createCA();


var keyMaster = module.exports.keyMaster = ca.generatePrivateKey( 2084 ) ;//fs.readFileSync( __dirname + '/master_server.key' );
module.exports.caCert = fs.readFileSync( __dirname + '/ca/ca.crt' );

ca.loadCA( fs.readFileSync( __dirname + '/ca/ca.key' ) , module.exports.caCert);

var genCert = module.exports.genCert = function( host , callback , rewrite  ) {
	
	if ( cacheCert.has(host) && !rewrite && cacheCert.get(host) ) {
		callback( cacheCert.get(host)  );
		return;
	}
	
	if (callbacksWait[host]) {
		callbacksWait[host].push(callback);
		return;
	} else {
		callbacksWait[host] = [ callback ];
	}
	
	process.nextTick(function(){ 
	

		var cert = ca.createCertificate({
			"serial": Math.floor(Math.random()*0xfffffff) ,"startDate" :new Date(2010,1,1) ,"days": 300 , 
			"subject": {  "CN" : host , "C" :"IL" , "O": "FILTER"  , "OU": "FILTER" } 
		});
		
		//console.log(cert);
		
		if(cert) cacheCert.set( host , cert );
		
		if(callbacksWait[host]){
			do{
				var callback = callbacksWait[host].shift();
				if (typeof callback == 'function') callback( cert );	
			}while(callback);
			delete callbacksWait[host];
		}
	});
};

var cacheServers = lrucache({ max: 500 , maxAge: 1000 * 60 * 60 * 48 /* 48h */});

var cbServerWait = [];
module.exports.getServer = function( _this , host ,url , callback , rewrite  ) {
	
	
	
	if ( cacheServers.has(host) && !rewrite && cacheServers.get(host) ) {
		callback( cacheServers.get(host)  );
		return;
	}
	
	if (cbServerWait[host]) {
		cbServerWait[host].push(callback);
		return;
	} else {
		cbServerWait[host] = [ callback ];
	}
	
	callback = function(){
		var cbs = cbServerWait[host]; delete cbServerWait[host];
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
		
		cacheServers.set( host , proxySslServer );
		
		callback( proxySslServer );

	});
};

