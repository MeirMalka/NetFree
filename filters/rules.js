
var url = require("url");
var lrucache = require("lru-cache");
  
                            
var Rules = function(option){
	
	var _this = this;
	if(option){
		this.onnex = option.onnex;
	}
	this.rulesCache = lrucache({ max: 1000 , maxAge: 1000 * 60 * 60 * 24 } );
	
	if(this.onnex){
		
		this.onnex.subscribe("rules-urls/change",function(err , changeRulesArray ){
			for(var i in changeRulesArray)
				_this.rulesCache.del(changeRulesArray[i]);
			
			console.log("rules-urls/change" , changeRulesArray);
		});
		
	}
	
	
	this._loadsWait = {};
	
};



Rules.prototype.getFilter = function( uri ,callback )
{
	var host , rule , _this = this;
	
	var urlParse = url.parse( uri );
	
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

	
	if(this.onnex){
		
		this.onnex.callFunction("rules-urls", hostName , function( err , result ){

			if( result.rules )
			{
				console.log("rules-urls" , result);
				for(var host in result.rules)
				{
					var rule = result.rules[host];
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
			
			var cbs = _this._loadsWait[hostName]; delete _this._loadsWait[hostName];
			do{
				var shiftcb = cbs.shift(); if (typeof shiftcb == 'function') shiftcb();	
			}while(shiftcb);
			
		});
	}else{
		
		var cbs = _this._loadsWait[hostName] ;  delete  _this._loadsWait[hostName];
		do{
			var shiftcb = cbs.shift(); if (typeof shiftcb == 'function') shiftcb("no connection");
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
};

var rules = false;


exports.name = "rules" ;

exports.varsion = "0.0.1" ;

exports.onRequest = exports.onResponse = function(sess)
{
	
	if(!rules) rules  = new Rules({ onnex: this.onnex });
	
    if(this.filter !== undefined){
		this.filters.list.push(this.filter);
		this.next();
	}
	else if( this.request && this.request.url)
	{
		rules.getFilter(this.request.url, function( err , filter ){
			sess.filter = filter || false;
			sess.filters.list.push(sess.filter);
			sess.next();
		});
	}
};









