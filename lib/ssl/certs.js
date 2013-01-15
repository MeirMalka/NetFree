var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var fs = require('fs');
var path = require('path');

var cache = {};

var dircerts = __dirname + '/certs/' ;
if( __dircache != undefined ) dircerts = path.normalize( __dircache + '/certs/' );

if( !fs.existsSync( dircerts ) ) fs.mkdirSync( dircerts );

exports.genCert = exports.getCert = function( host , callback , rewrite ) {

	process.chdir( __dirname );

	var crtFile = dircerts + host + '.crt';
	var csrFile = dircerts + host + '.csr';

	if ( fs.existsSync(crtFile) && !rewrite ) {
		callback( fs.readFileSync( path.normalize( crtFile ) ) );
		return;
	}

	if (cache[host]) {
		cache[host].push(callback);
		return;
	} else {
		cache[host] = [ callback ];
	}
	exec("openssl req -new -key master_server.key -out \"" + csrFile + "\" " 
		+	" -subj \"/CN=" + host + "\" -config ca/openssl.ca.cnf"
		, function(error, stdout, stderr) {
		console.log("create cert: " + host);
		
		var openssl = spawn('openssl', [ 'ca', '-notext', '-startdate' , '000101000000-0000' , '-config',
				'ca/openssl.ca.cnf', '-out',  crtFile , '-infiles',  csrFile ]);

		var timerKill = setTimeout(function() {
			openssl.kill();
			console.log("kill openssl: " + host);
		}, 10000);

		openssl.stdout.on('data', function(data) {
		console.log("data: " + data.toString());
			if (data.toString().indexOf('[y/n]') !== -1) {
				openssl.stdin.write('y\n');
			}
		});

		openssl.stderr.on('data', function(data) {
			
			if (data.toString().indexOf('[y/n]') !== -1) {
				openssl.stdin.write('y\n');
			}
			
		});
		openssl.on('exit', function() {
			clearTimeout(timerKill);
			
			
			var cert = fs.existsSync( crtFile ) ?  fs.readFileSync( path.normalize( crtFile ) ) : false;
			
			cache[host].forEach( function(callback){
					if (typeof callback == 'function'){			
						callback(  cert );
						delete callback;
					}
			});
			
			fs.writeFile('ca/db/index.txt', '');
			fs.unlink('ca/db/index.txt.old');
			fs.unlink( csrFile );
			fs.readdir('ca/db/newcerts/', function(err, files) {
				for (i in files) {
					if (files[i].match(/\.pem$/))fs.unlink('ca/db/newcerts/' + files[i]);
				}
			});
			
		});

	});
};

exports.getMasterKey = function(){
	return fs.readFileSync( __dirname + '/master_server.key' );
}


