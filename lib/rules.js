
var url = require("url");
var lrucache = require("lru-cache");
  
                            
var Rules = function(option){
	
	var _this = this;
	if(option){
		this._connection = option.connection;
		//console.log(this._connection)
	}
	this.rulesCache = lrucache({ max: 1000 /*
              , length: function (n) { return n * 2 }
              , dispose: function (key, n) { n.close() }
              */, maxAge: 1000 * 60 * 60 * 24 } );
	
	
	
	
	if( this._connection.on ){
		this._connection.on('request', function( data , res , s ){
			if(data.action == "change_rules")
				for(var i in data.data)
					_this.rulesCache.del(data.data[i]);

		});
	}
	
	
	this._loadsWait = {};
	
}



Rules.prototype.getFilter = function( uri ,callback )
{
	var host , rules , _this = this;
	
	urlParse = url.parse( uri );
	
	urlParse.hostname = urlParse.hostname.replace(/^www\.|\.$/g, '');
	
	host = this.findFilter(urlParse.hostname);

	if(host) 
	{
		rule = this.rulesCache.get( host );
		var go = 5;
		while( rule.go && --go){
			if( this.rulesCache.has(rule.go) ) 
				rule = this.rulesCache.get( rule.go );
			else
			{
				this.rulesCache.del( host );
				_this.getFilter( uri ,callback );
				//callback(null,false);
				return;
			}
		}
		
		var filter = rule.filterDefault || rule.defaultFilter || false ;
		if( rule.paths && rule.paths.length )
		{
			rule.paths.forEach(function(value){
				if(value.match &&  value.filter && value.filter.name
					&&	value.match.test &&  value.match.test(urlParse.path) )
				{
					filter = value.filter;
					return false;
				}
			});	
		}	
		callback(null,filter);

	}else{
		this._load( urlParse.hostname , function(err){
			if(err) callback(err);
			else _this.getFilter( uri ,callback );
		});
	}
}

Rules.prototype._load = function( hostName , callback )
{
	var _this = this;
	
	
	if (this._loadsWait[hostName]) {
		this._loadsWait[hostName].push(callback);
		return;
	} else {
		this._loadsWait[hostName] = [ callback ];
	}
	
	
	if(this._connection && this._connection.request){
		this._connection.request( { action: 'rules-urls' , data:{ hostName: hostName } } , function( data ){

			if( data.rules )
			{
				for(var host in data.rules)
				{
					var rule = data.rules[host];
					if(rule.paths && rule.paths.length)
						{
							rule.paths.forEach(function(element, index, array){
								if( element.path )
								{exports = Rules;
									array[index].match = _this._pathRegexp(element.path );
									delete array[index].path;
								} 
							});
						}
				
						rule.keyRegExp = _this._pathRegexp(host , true);
						_this.rulesCache.set( host ,  rule );
				}
			}
			if(!_this.findFilter(hostName))
			{
				_this.rulesCache.set( hostName ,  false );
			}
			
			do{
				var shiftcb = _this._loadsWait[hostName].shift();
				if (typeof shiftcb == 'function') shiftcb();	
			}while(shiftcb);
		});
	}else{
		do{
			var shiftcb = _this._loadsWait[hostName].shift();
			if (typeof shiftcb == 'function') shiftcb("no connection");
		}while(shiftcb);
	}

}

Rules.prototype.findFilter = function( hostName )
{

	var host = false , _this = this;

	if(this.rulesCache.has(hostName)){
		return hostName;
	}else{
		this.rulesCache.forEach(function(value,key,cache){
			if(value.keyRegExp &&  value.keyRegExp.test && value.keyRegExp.test(hostName))
			{
				
				_this.rulesCache.set( hostName , { go: key } );
				host = key;
				return false;
			}
		});
		
		return host;
	}
	
}
	
Rules.prototype._pathRegexp = function( path , domainType ) {
		  if (path instanceof RegExp) return path;
		  if (Array.isArray(path)){
			  for (var i in path)
			  {
				  if(path[i] instanceof RegExp ) path[i] = path[i].source;
			  }
			  path = '(' + path.join('|') + ')';
		  }
		
		  path = path.replace(/([\/.])/g, '\\$1');
		  path = domainType ? path.replace(/\*(\\\.)?/g, '(.*)') : path.replace(/\*/g, '(.*)');
		  
		  return new RegExp('^' + (domainType ? '' : '\\/?') + path + '$', 'i');
}

module.exports = function(options){ return new Rules(options) } ;


/*
var json_rpc = require("json-rpc-multiplex");


var rules =  new Rules({connection: json_rpc.createConnection({ port: 5432 }) });


//rules._load('*.google.com',function(){});

rules.findFilter('http://google.com/sas/image',function(err,filter){
	console.log(err,filter);
});

//*/


/* Test 
setInterval(function(){
var client = json_rpc.createConnection({ port: 5432 });
client.request( { action: 'rules-urls' , data:{ hostName: "google.com" } } , function( data , res , s ){
	
	console.log(data);
	
});},5000);
*/



