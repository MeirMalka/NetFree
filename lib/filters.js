
var fs = require("fs");
var path = require("path");
//var rules = require ( './rules' );

function Filters( options ){

	this._baseFilter = { 
		onRequest:  function( sess ) { sess.next(); },
		onResponse: function( sess ) { sess.next(); }
	};
	
//	this.rules =  rules( { connection: options.connection } );
	
	this.filters =  { "allow" : this._baseFilter }; 
	//default
	this.listFilters = [ "rules" , "daley" ];
	this.pathName = options.dirName || options.pathName;	
	this.baseDefault = "allow";
	this.default = options.default || this.baseDefault;
	
	
	this.load();
	this._watch(); 
}

Filters.prototype.applyFilter = function( type , sess ){
	
	var _this = this;
    var orginalNext = sess.next;
        
    if(!sess.filters) sess.filters = {};
    var filters = sess.filters ;
    
    // clone listFilters
    filters.list = [];
    for(var i in this.listFilters)
    	filters.list[i] = this.listFilters[i];

    filters.countApply = 0;
    
	function applyFilter()
	{
		if(filters.countApply ++ > 40) return orginalNext();
		
		sess.type = type;
		var filterName = filters.current.name ;
		
		if( !filterName || !_this.filters.hasOwnProperty(filterName)) filters.current =  this.filters[_this.default];
		
		var on = false;
		switch (type) {
			case "request":
				on = _this.filters[filters.current.name].onRequest;
				break;
			case "response":
				on = _this.filters[filters.current.name].onResponse;
				break;
			default: return; break;
		}
		
		if("function" == typeof on)
			on.apply(sess,[sess]);
		else
			sess.next();
	}	
	
	sess.next = function(){
		filters.current = filters.list.shift();
		if(filters.current == undefined)
		{
			orginalNext();
		}else{
			if(!filters.current) filters.current = { name: _this.default };
			if("string" == typeof filters.current) filters.current = { name: filters.current };
			applyFilter();
		}
	};
	
	filters.apply = function( name ){
		filters.current = { name: name };
		applyFilter();
	};
	
	sess.next();
	/*
	if(sess.filter){
		sess.listFilters.push(sess.filter);
		sess.next();
	}
	else if( sess.request && sess.request.url)
	{
		this.rules.getFilter(sess.request.url, function( err , filter ){
			if(err || !filter)
				sess.filter = { name: _this.default };
			else
				sess.filter = filter;
			
			sess.listFilters.push(sess.filter);
			sess.next();
		});
	}*/
		

};

Filters.prototype.loadFile = function ( file , package ) {

	file = path.resolve(file);
	if(require.cache[file]) delete require.cache[file];
	var filter =  require(file);
	delete require.cache[file];
		
	for(var key in package) if(!filter.hasOwnProperty(key))
	filter[key] = package[key];
		
	if(filter.name) this.filters[filter.name] = filter;
	
	if(filter.name) console.log("load filter: %s", filter.name);
	
}

Filters.prototype._watch = function(){
	var _this = this;
	var fileReload = path.join(this.pathName , "list.reload");
	fs.watch(  fileReload , { persistent: true } , function(){
		if( !fs.existsSync(fileReload) )return;
		var reload = fs.readFileSync( fileReload, 'utf8');
		
		if(reload) fs.writeFile(fileReload, '');
		else return;
		
		reload = reload.split(/\s*[\r\n]+\s*/);
		reload = reload.filter(function(e){ return e; });
		
		_this.load(RegExp('^(' + reload.join('|').replace("*",".*") + ')(\.js)?$', 'i'));
	});
	
};

Filters.prototype.load = function(filter){

	var files = fs.readdirSync( this.pathName );
	
	for(i in files)
	{
		if( filter && filter.test && !filter.test(files[i]) != 0 ) continue;
			
		var filePath = path.join( this.pathName , files[i] );
		var stat = fs.statSync( filePath );
		
		if( stat.isFile() && files[i].match(/\.js$/) )
		{
			this.loadFile(filePath);
		}
		if( stat.isDirectory() )
		{
			if( fs.existsSync( path.join( filePath , 'package.json' ) ) )
			{
				try
				{	
					var package = 	fs.readFileSync(path.join( filePath , 'package.json' ), 'utf8');
					package =  JSON.parse(package);		
					if(package.main && fs.existsSync( path.join( filePath , package.main ) ))
					{
							this.loadFile( path.join( filePath , package.main )  , package );
					}
				}catch(e){}
				
			}
			else if( fs.existsSync( path.join(filePath ,'index.js' )) )
				this.loadFile(path.join(filePath ,'index.js' ))
			
		}
		
	}
	
	
	if(!this.filters.hasOwnProperty(this.default)) 
		this.default = this.baseDefault;
	if('function' !== typeof this.filters[this.default].onRequest) 
		this.filters[this.default].onRequest = this._baseFilter.onRequest;
	if('function' !== typeof this.filters[this.default].onResponse) 
		this.filters[this.default].onResponse = this._baseFilter.onResponse;
	
	for(i in this.filters)
	{
		if('function' !== typeof this.filters[i].onRequest) 
			this.filters[i].onRequest = this.filters[this.default].onRequest;
		if('function' !== typeof this.filters[i].onResponse) 
			this.filters[i].onResponse = this.filters[this.default].onResponse;
	}
		
	//console.log(this.filters);
};


module.exports = function(options){ return new Filters(options) } ;

//new Filters( {pathName: '../filters' } ).load();


