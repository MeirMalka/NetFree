var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var fs = require('fs');
var path = require('path');


var lrucache = require("lru-cache");



var cacheCert = lrucache({ max: 500
              , length: function (n) { return n * 2 }
              , dispose: function (key, n) { n.close() }
              , maxAge: 1000 * 60 * 60 * 48 /* 48h */});

var callbacksWait  = {};

var dircerts = __dirname + '/certs/' ;
//if( __dircache != undefined ) dircerts = path.normalize( __dircache + '/certs/' );

if( !fs.existsSync( dircerts ) ) fs.mkdirSync( dircerts );

module.exports.genCert = exports.getCert = function( host , callback , rewrite  ) {

	process.chdir( __dirname );
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
		+	" -subj \"/CN=" + host + "/OU=FILTER/O=FILTER\" -config ca/openssl.ca.cnf"
		, function(error, stdout, stderr) {

		console.log("create cert: " + host);

		var openssl = spawn('openssl', [ 'ca', '-notext', '-startdate' , '000101000000-0000' , '-config',
				'ca/openssl.ca.cnf' /*, '-out',   crtFile*/ , '-in',  csrFile ]);
		
		
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
			
			
			fs.writeFile('ca/db/index.txt', '');
			fs.unlink('ca/db/serial.old');
			fs.unlink('ca/db/index.txt.old');
			fs.unlink( csrFile );
			fs.readdir('ca/db/newcerts/', function(err, files) {
				for (i in files) {
					if (files[i].match(/\.pem$/)) fs.unlink('ca/db/newcerts/' + files[i]);
				}
			});
			
		});

	});
};


module.exports.keyMaster =  fs.readFileSync( __dirname + '/master_server.key' );

module.exports.getMasterKey = function(){
	return fs.readFileSync( __dirname + '/master_server.key' );
}


