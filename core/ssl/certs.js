var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var fs = require('fs');
var path = require('path');

var cache = {};

var genCert = function(host, callback) {

	process.chdir(__dirname);

	var crtFile = 'certs/' + host + '.crt';
	var csrFile = '' + host + '.csr';

	if (fs.existsSync(crtFile)) {
		callback(path.normalize(__dirname + '/' + crtFile));
		return;
	}

	if (cache[host]) {
		cache[host].push(callback);
		return;
	} else {
		cache[host] = [ callback ];
	}
	exec("openssl req -new -key master_server.key -out " + host + ".csr "
			+ "-days 365 -subj '/C=US/O=Organization/CN=" + host + "' -config ca/openssl.ca.cnf"
		, function(error, stdout, stderr) {
		console.log("create cert: " + host);
		//
		var openssl = spawn('openssl', [ 'ca', '-notext', '-config',
				'ca/openssl.ca.cnf', '-out', crtFile, '-infiles', csrFile ]);

		var timerKill = setTimeout(function() {
			openssl.kill();
		}, 3000);

		openssl.stdout.on('data', function(data) {
		
		});

		openssl.stderr.on('data', function(data) {
			
			if (data.toString().indexOf('? [y/n]') !== -1) {
				openssl.stdin.write('y\n');
			}
			
		});
		openssl.on('exit', function() {
			clearTimeout(timerKill);

			try {
				fs.unlinkSync(csrFile);
			} catch (err) {}

			cache[host].forEach( function(callback){
					if (typeof callback == 'function'){			
						callback( fs.existsSync(crtFile) ? path.normalize(__dirname + '/' + crtFile) : false );
						delete callback;
					}
			});
			
			fs.writeFile('ca/db/index.txt', '');
			fs.unlink('ca/db/index.txt.old');
			fs.readdir('ca/db/newcerts/', function(err, files) {
				for (i in files) {
					if (files[i].match(/\.pem$/))fs.unlink('ca/db/newcerts/' + files[i]);
				}
			});
			
		});

	});
};

exports.genCert = genCert;

/*
 genCert(  "www.google.com",function(s){
 console.log(s);
 console.log(process.uptime());	
 });
 */