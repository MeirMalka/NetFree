
var url = require("url");
var lrucache = require("lru-cache");
  
                            
var Rules = function(option){
	
	var _this = this;
	if(option){
		this.onnex = option.onnex;
	}
	this.rulesCache = lrucache({ max: 1000 , maxAge: 1000 * 60 * 60 * 24 });
	
	if(this.onnex){
		
		this.onnex.subscribe("rules/change",function(err , changeRulesArray ){
			
			if(Array.isArray(changeRulesArray))
				changeRulesArray.forEach(function(rule){
					if(!rule.host)return; 
					_this.rulesCache.del(rule.host);
					if(rule.sourceHostRegex) rule.hostRegex = _this._pathRegexp(rule.sourceHostRegex , true);
					if(rule.hostRegex &&  rule.hostRegex.test)
						_this.rulesCache.forEach(function(value,key,cache){
							if(rule.hostRegex.test(value.host || '')) _this.rulesCache.del(key);
						});
		
				});
			
			
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
	
	callback = function(){
		var cbs = _this._loadsWait[hostName] ;  delete  _this._loadsWait[hostName];
		do{
			var shiftcb = cbs.shift(); if (typeof shiftcb == 'function') shiftcb.apply(null,arguments);
		}while(shiftcb);
	};
	
	if(this.onnex){
		
		this.onnex.callFunction("getRule", hostName , function( err , rule ){

			
			if( rule  && rule.host )
			{
				console.log("rules-urls" , rule);

				if(rule.paths && rule.paths.length)
				{
					rule.paths.forEach(function(element, index, array){
						if( element.path ){
							array[index].match = _this._pathRegexp(element.path );
							delete array[index].path;
						} 
					});
				}
						
				if(rule.sourceHostRegex) rule.hostRegex = _this._pathRegexp(rule.sourceHostRegex , true);
				_this.rulesCache.set( rule.host ,  rule );
				
			}
			if(!_this.findFilter(hostName))
			{
				_this.rulesCache.set( hostName ,  false );
			}
			
			callback();
		});
	}else{
		callback("no connection");
	}
}

Rules.prototype.findFilter = function( hostName )
{

	var host = false , _this = this;

	if(this.rulesCache.has(hostName)){
		return hostName;
	}else{
		this.rulesCache.forEach(function(value,key,cache){
			if(value.hostRegex &&  value.hostRegex.test && value.hostRegex.test(hostName))
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

exports.onRequest = exports.onResponse = function(ctx)
{
	if(!this.onnex) return this.next();
	
	if(!rules) rules  = new Rules({ onnex: this.onnex });
	
    if(this.filter !== undefined){
		this.filters.list.push(this.filter);
		this.next();
	}
	else if( this.request && this.request.url)
	{
		rules.getFilter(this.request.url, function( err , filter ){
			ctx.filter = filter || false;
			ctx.filters.list.push(ctx.filter);
			ctx.next();
		});
	}
};









