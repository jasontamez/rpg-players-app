// server.js
// where your node app starts

// node server.js <- to start

// init project
const express = require("express"),
	fs = require('fs'),
	glob = require('glob'),
	pug = require('pug'),
	http = require('http');
var rulesets = new Map(),
	debug = [],
	app = express(),
	server = http.createServer(app),
	io = require("socket.io").listen(server);
// we've started you off with Express,
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

io.on('connection', function(socket) {
	// when a socket connects, code here is called (if any)
	//console.log(["Connected", socket]);
	// we can listen for events from sockets with other .on functions
	socket.on('get ruleset', function(ruleset, callback) {
		// Do stuff
		var rules = rulesets.get(ruleset);
		if(rules === undefined) {
			return callback(false, "Cannot find ruleset \"" + ruleset + "\"");
		}
		fs.readFile(__dirname + "/public/rulesets/" + ruleset + "-master.json", 'utf8', function(err, file) {
			if(err) throw err;
			return callback(true, JSON.parse(file));
		});
	});
});


// This section scans for "master" XML files and saves them to the map rulesets
glob("**/*-master.json", getRulesets);
function getRulesets(err, files) {
	if (err) throw err;
	debug.push("files", files);
	files.forEach(function(file) {
		fs.readFile(file, 'utf8', parseRuleset.bind(file));
	});
}
function parseRuleset(err, file) {
	if (err) throw err;
	try {
		// Did we find anything?
		let info = JSON.parse(file);
		if(info.title !== undefined) {
			// Success!
			let fm = this.match(/^.*\/([^\/]+)-master\.json$/); // 'this' is the src, thanks to .bind()
			rulesets.set(fm[1], info.title);
		}
	} catch (e) {
		// Errors don't matter - just ignore.
		return;
	}
}
function OLD_getRulesets_xml(err, files) {
	if (err) throw err;
	debug.push("files", files);
	files.forEach(function(file) {
		fs.readFile(file, 'utf8', parseRuleset.bind(file));
	});
}
function OLD_parseRuleset(err, file) {
	if (err) throw err;
	// Remove linebreaks, condense spaces
	const f = file.replace(/[\n\t]/g, "").replace(/\s+/g, " "),
		// The file should start with a standard <?xml?> declaration
		// and the root node should be <RuleSet> with a title attribute
		m = f.match(/^<\?xml(?: version="1.0"| encoding="UTF-8"){2}\?><RuleSet [^>]*title="([^"]+)"/),
		// 'this' is bound to the string of the filename
		fm = this.match(/^.*\/([^\/]+)-master\.xml$/),
		filename = fm[1];
	// Did we find anything?
	if(m === null) {
		// Nope
		return;
	}
	//Yup! Save it.
	rulesets.set(m[1], filename);
}

app.get("/", function(request, response) {
	var fn = pug.compileFile('views/index.pug', {cache: false});
	console.log(Array.from(rulesets).map(rs => rs[1]));
	response.send(fn({rulesets: rulesets}));
	//response.sendFile(__dirname + "/views/index.html");
});

app.get(/^\/.*\.html/, function(request, response) {
	var r = /^\/[^.]*(?=.html$)/,
		m = request.url.match(r);
	if (m === null) {
		//Error?
		return response.sendStatus(500);
	}
	response.sendFile(__dirname + "/views/" + m[0] + ".html");
});


// Requests for XML documents can also be served by Pug documents
app.get(/^\/.*\.xml/, function(request, response) {
	//var fn = pug.compileFile('views/xml.pug', {cache: false});
	var url = request.url,
		r = /^\/[^.]*(?=.xml$)/,
		m = url.match(r),
		fn, pathXml, pathPug;
	if (m === null) {
		//Error?
		return response.sendStatus(500);
	}
	pathXml = __dirname + '/public' + m[0] + '.xml';
	if(fs.existsSync(pathXml)) {
		return response.sendFile(pathXml);
	}
	pathPug = __dirname + '/public' + m[0] + '.pug';
	if(fs.existsSync(pathPug)) {
		fn = pug.compileFile(pathPug, {cache: false});
		response.set('Content-Type', 'text/xml');
		response.type('text/xml');
		response.send(fn());
	} else {
		response.sendStatus(404);
	}
});



app.get(["/debug", "/path/to/file.html"], function(request, response) {
	//response.send("<xmp>" + JSON.stringify(Array.from(debug)) + "</xmp>");
	response.send("<xmp>[" + request.baseUrl + "]\n" + request.hostname + "\n" + request.path + "\n" + JSON.stringify(request.route) + "\n" + request.url + "</xmp>");
});


// listen for requests :)
const listener = server.listen(44088, function() {
	console.log('Starting server on port ' + listener.address().port);
});
//const listener = app.listen(44088, function() {
//	console.log("Your app is listening on port " + listener.address().port);
//});
