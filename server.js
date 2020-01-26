// server.js
// where your node app starts

// node server.js <- to start

// init project
const express = require("express");
const fs = require('fs');
const glob = require('glob');
const app = express();
var rulesets = new Map();
var debug = [];
// we've started you off with Express,
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function(request, response) {
	response.sendFile(__dirname + "/views/index.html");
});


// This section scans for "master" XML files and saves them to the map rulesets
glob("**/*-master.xml", getRulesets);
function getRulesets(err, files) {
	if (err) throw err;
	debug.push("files", files);
	files.forEach(function(file) {
		fs.readFile(file, 'utf8', parseRuleset.bind(file));
	});
}
function parseRuleset(err, file) {
	if (err) throw err;
	// 'this' is bound to the filename
	const f = file.replace(/[\n\t]/g, "").replace(/\s+/g, " "),
		m = f.match(/^<\?xml(?: version="1.0"| encoding="UTF-8"){2}\?><RuleSet [^>]*title="([^"]+)"/),
		fm = this.match(/^.*\/([^\/]+)-master\.xml$/),
		filename = fm[1];
	if(m === null) {
		return;
	}
	rulesets.set(m[1], filename);
}

// This section returns a string of basic HTML when the viewer looks for "/rulesets"
app.get("/rulesets", function(request, response) {
	var html = "";
	rulesets.forEach(function(filename, title) {
		html += "<option value=\"" + filename + "\">" + title + "</option>";
	});
	response.send(html);
});

//
//
// Could probably inject this info into the file itself before serving it!
//
//
//
//



app.get("/debug", function(request, response) {
	response.send("<xmp>" + JSON.stringify(Array.from(debug)) + "</xmp>");
});


// listen for requests :)
const listener = app.listen(process.env.PORT, function() {
	console.log("Your app is listening on port " + listener.address().port);
});
