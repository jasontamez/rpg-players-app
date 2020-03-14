import { $i, $a, $t, $ea as $e, $listen } from "./dollar-sign-module.js";
import { parseAttributesToObject, parseObjectToArray, checkObjProps, logErrorNode as logError, logErrorText } from "./parsing-logging.js";
import { BasicIdObject, Int, Str, IntBonusable, Num, TF, Pool } from "./stats-module01.js";
import { parseBundledInfo } from "./bundles-module01.js";

// Define a class for XML tags
export class BasicPageObject {
	constructor(node, id, atts) {
		let a = new Map();
		this.node = node;
		atts.forEach(function(prop) {
			a.set(prop[0], prop[1]);
		});
		this.atts = a;
		this.html = [];
		BasicPageObject.allIDs.set(id, this);
	}
	static getById(id) {
		return BasicPageObject.allIDs.get(id);
	}
}
BasicPageObject.allIDs = new Map();


var $RPG = window["$RPG"];


// Parse an array of <Page> objects
export function parsePages(nodelist) {
	var pages = [];
	// Parse nodes
	nodelist.forEach( node => pages.push(parsePageNodes(node)) );
	return pages;
}


// parse a single <Page> node, returning a BasicPageObject with its data
export function parsePageNodes(pageNode) {
	var pageTag, kids,
		atts = parseAttributesToObject(pageNode),
		id = atts.id;
	if(id === undefined) {
		logError(pageNode, "PAGE: missing required parameter \"id\"");
		return null;
	}
	delete atts.id;
	pageTag = new BasicPageObject(pageNode, id, parseObjectToArray(atts));
	kids = Array.from(pageNode.childNodes);
	kids.forEach(function(node) {
		var retVal = recursePageNodes(node);
		if(retVal !== null) {
			pageTag.html.push(retVal);
		}
	});
	return pageTag;
}


export function recursePageNodes(node) {
	var kids = Array.from(node.childNodes),
		nombre = node.nodeName,
		type = node.nodeType,
		html, atts, handle, filler = [];
	if(type === 3) {
		// Text node.
		return $t(node.textContent);
	} else if (type !== 1) {
		// Assume a comment. Ignore.
		return null;
	} else if (kids.length > 0) {
		// Has kids.
		kids.forEach(function(kid) {
			var retVal = recursePageNodes(kid);
			if(retVal !== null) {
				filler.push(retVal);
			}
		});
	}
	handle = $RPG.pages.handlers[nombre];
	if (handle !== undefined) {
		// Get the html from the handler
		return handle(node, filler);
	}
	// Assume HTML.
	atts = parseAttributesToObject(node);
	html = $e(nombre, atts);
	//html.append(...filler);
	return filler.length > 0 ? [html, filler] : html;
}


// <Block template="whatever"> ... </Block>
export function parseBlock(node, filler) {
	var atts = parseAttributesToObject(node),
		temp = atts.template,
		contents = atts.contents,
		format;
	if(temp === undefined) {
		// Assume this is a plain <div>.
		let div = $e("div", atts);
		//div.append(...filler);
		return filler.length > 0 ? [div, filler] : div;
	} else if ((format = $RPG.pages.pageTemplates[temp]) === undefined) {
		logError(node, "BLOCK: template \"" + temp + "\" is not defined");
		return null;
	}
	if(contents === undefined) {
		contents = "ignore";
	} else {
		delete atts.contents;
	}
	delete atts.template;
	return format(filler, contents, atts);
}


export function parseTemplate() {
	
}


// <INPUT id="Stat" />
export function parseInput(node, filler) {
	var atts = parseAttributesToObject(node),
		id = atts.id,
		stat = BasicIdObject.getById(id),
		inputObject;
	if(id === undefined) {
		logError(node, "INPUT: missing required \"id\" parameter");
		return null;
	} else if (stat === undefined) {
		logError(node, "INPUT: unable to find a Stat named \"" + id + "\"");
		return null;
	}
	delete atts.id;
	return {
		deferred: true,
		stat: stat,
		id: id,
		atts: atts,
		node: node,
		loader: loadInput,
		contents: filler.slice()
	};
}


function loadInput(appendTo, unit) {
	var stat = unit.stat,
		atts = {},
		d = [],
		temp, i;
	Object.assign(atts, unit.atts);
	switch(stat.type) {
		case Int:
		case IntBonusable:
		case Num:
			atts.type = "number";
			temp = stat.get("minValue");
			if(temp !== undefined && temp === temp) {
				atts.min = temp.toString();
			}
			temp = stat.get("maxValue");
			if(temp !== undefined && temp === temp) {
				atts.max = temp.toString();
			}
			break;
		case Str:
			atts.type = "text";
			break;
		default:
			logError(unit.node, "INPUT: Stat id=\"" + unit.id + "\" is not of a user-definable type.");
			return null;
	}
	$RPG.pages.inputDatasetProps.forEach(function(p) {
		if(p instanceof Array) {
			let pr = p[0], f = p[1], test = atts[pr];
			if(test !== undefined) {
				d.push([pr, f(test)]);
				delete atts[pr];
			}
		} else {
			let test = atts[p];
			if(test !== undefined) {
				d.push([p, test]);
				delete atts[p];
			}
		}
	});
	atts.value = stat.get("value");
	i = $e("input", atts);
	i.classList.add("Stat");
	d.push(["stat", unit.id]);
	d.forEach(function(p) {
		i.dataset[p[0]] = p[1];
	});
	// Ignore unit.contents
	appendTo.append(i);
	return null;
}


// <INPUT-HIDDEN id="Stat" />
export function parseInputHidden(node, filler) {
	var atts = parseAttributesToObject(node),
		id = atts.id,
		stat = BasicIdObject.getById(id),
		tagID = atts.tagId,
		inputObject, CL;
	if(id === undefined) {
		logError(node, "INPUT-HIDDEN: missing required \"id\" parameter");
		return null;
	} else if (stat === undefined) {
		logError(node, "INPUT-HIDDEN: unable to find a Stat named \"" + id + "\"");
		return null;
	}
	delete atts.id;
	if(tagID !== undefined) {
		delete atts.tagId;
		atts.id = tagID;
	}
	return {
		deferred: true,
		stat: stat,
		id: id,
		atts: atts,
		node: node,
		loader: loadInputHidden,
		contents: filler.slice()
	};
}


function loadInputHidden(appendTo, unit) {
	var stat = unit.stat,
		atts = {},
		sep = stat.separator || ",",
		d = [],
		tagClass, temp, i, CL;
	Object.assign(atts, unit.atts);
	tagClass = atts.tagClass;
	if(tagClass !== undefined) {
		delete atts.tagClass;
		tagClass = tagClass.split(" ");
	} else {
		tagClass = [];
	}
	switch(stat.type) {
		case Int:
		case IntBonusable:
		case Num:
		case Str:
			atts.value = stat.get("value");
			break;
		case Pool:
			atts.value = Array.from(stat.getSelection()).join(sep);
			break;
		default:
			logError(unit.node, "INPUT-HIDDEN: Stat id=\"" + unit.id + "\" is not of a user-definable type.");
			return null;
	}
	atts.type = "hidden";
	$RPG.pages.inputDatasetProps.forEach(function(p) {
		if(p instanceof Array) {
			let pr = p[0], f = p[1], test = atts[pr];
			if(test !== undefined) {
				d.push([pr, f(test)]);
				delete atts[pr];
			}
		} else {
			let test = atts[p];
			if(test !== undefined) {
				d.push([p, test]);
				delete atts[p];
			}
		}
	});
	i = $e("input", atts);
	CL = i.classList;
	CL.add("Stat");
	tagClass.forEach(c => CL.add(c));
	d.push(["stat", unit.id], ["separator", sep]);
	d.forEach(function(p) {
		i.dataset[p[0]] = p[1];
	});
	// Ignore unit.contents
	appendTo.append(i);
	return null;
}


// <BUTTON type="navigation" to="page2">Continue</BUTTON>
export function parseButton(node, filler) {
	var atts = parseAttributesToObject(node),
		type = atts.type,
		buttonType = $RPG.pages.buttonTypes[type],
		button, listener, data, d;
	if(type === undefined) {
		logError(node, "BUTTON: missing required \"type\" parameter");
		return null;
	} else if (buttonType === undefined) {
		logError(node, "BUTTON: type \"" + type + "\" is invalid");
		return null;
	}
	// Check for any/all mandatory properties
	button = checkObjProps(node, atts, buttonType.mandatoryProps, "BUTTON, " + type);
	if(button.length !== 0) {
		// Some/all mandatory properties did not exist
		return null;
	}
	// All mandatory properties are present
	data = [["type", type]];
	delete atts.type;
	// Go through all datasetProps (they may or may not be present)
	buttonType.datasetProps.forEach(function(prop) {
		var info = atts[prop];
		// If the prop exists, save its value with its dataset name, then delete it from atts
		// Otherwise, ignore it and move on
		if(info !== undefined) {
			data.push([prop, info]);
			delete atts[prop];
		}
	});
	// Make button
	button = $e("button", atts);
	// Fill button with text
	if(filler.length === 0) {
		button.textContent = buttonType.defaultText;
	} else {
		button.append(...filler);
	}
	// Set dataset info
	d = button.dataset;
	data.forEach(pair => d[pair[0]] = pair[1]);
	// Save listener
	listener = buttonType.listenFunc;
	return {
		deferred: true,
		button: button,
		node: node,
		loader: loadButton,
		listener: listener
	};
}


function loadButton(appendTo, unit) {
	var button = unit.button.cloneNode(true);
	$listen(button, unit.listener);
	appendTo.append(button);
	return null;
}


// <CHOOSE category="name" />
// Makes a <select> tag filled with <options> drawn from a category of Bundles
export function parseChoose(node) {
	//<CHOOSE category="race" />
	var atts = parseAttributesToObject(node),
		cat = atts.category,
		bundles = $RPG.pages.rawBundles,
		saveTo = atts.saveTo,
		selectObject;
	if(cat === undefined) {
		logError(node, "CHOOSE: missing required \"category\" parameter");
		return null;
	}
	delete atts.category;
	delete atts.saveTo;
	selectObject = $e("select", atts);
	if(saveTo !== undefined) {
		selectObject.dataset.stat = saveTo;
	}
	if(bundles) {
		let info = bundles.get(cat);
		if(info) {
			info.forEach(function(optionObj, optionName) {
				selectObject.append($e("option", { value: optionName }, optionObj.get("title")));
			});
		}
	}
	return selectObject;
}


//<BUNDLE category="x" ?show="Tag"></BUNDLE>
export function loadBundle(appendTo, unit) {
	var	$RP = $RPG.pages,
		BUNDLES = $RP.bundles,
		node = unit.node,
		atts = {},
		contents = unit.contents,
		rawcategory = unit.raw,
		category, cat, stat, filter, statObj, chosen, bundle, show, tempDiv;
	Object.assign(atts, unit.atts);
	cat = atts.category;
	category = BUNDLES[cat];
	stat = atts.stat;
	filter = atts.filter;
	if(stat === undefined) {
		// Assume the stat is the same as the category
		stat = cat;
	} else {
		delete atts.stat;
	}
	statObj = BasicIdObject.getById(stat);
	if(statObj === undefined) {
		logError(node, "BUNDLE: stat \"" + stat + "\" not found");
		console.log([node, atts, rawcategory]);
		return null;
	}
	chosen = statObj.get("value");
	if(!rawcategory.has(chosen)) {
 		logError(node, "BUNDLE: bundle \"" + chosen + "\" (via stat \"" + stat + "\") not found within category \"" + cat + "\"");
		return null;
	} else if (category === undefined) {
		// Category exists but is not parsed yet
		let tempcat = new Map();
		// Parse each bundle in the category
		rawcategory.forEach(function(bundle, id) {
			// Bundle should be a map with an array of "kids" and a "title"
			// A separator is optional, defaulting to a comma
			var kids = bundle.get("kids"),
				separator = bundle.get("separator") || ",",
				masterNSlist = new Set(),
				masterTagList = new Set(),
				o = {
					title: bundle.get("title")
				};
			//recurseBundleCategory(kids);
			// Parse each kid in the bundle
			kids.forEach(function(node) {
				// Each kid should have an ID and a deliminated string of namespaces
				// Each tag name may be unique
				var atts = parseAttributesToObject(node),
					id = atts.id,
					namespaces = atts.namespaces,
					tagName = node.nodeName,
					kidmap = o[tagName] || new Map(),
					obj;
				if(id === undefined || namespaces === undefined) {
					logError(node, "BUNDLE: category \"" + cat + "\", tag \"" + tagName + "\" missing id and/or namespaces parameters");
					return null;
				}
				namespaces = namespaces.split(separator);
				obj = {
					namespaces: namespaces,
					node: node
				};
				delete atts.id;
				delete atts.namespaces;
				// Add any other attributes
				Object.getOwnPropertyNames(atts).forEach(function(n) {
					obj[n] = atts[n];
				});
				// Save these atts
				kidmap.set(id, obj);
				// Save to the bundle
				o[tagName] = kidmap;
				// Save namespaces
				namespaces.forEach(ns => masterNSlist.add(ns));
				// Save tagName
				masterTagList.add(tagName);
			});
			// Save namespaces
			o.allNamespaces = masterNSlist;
			// Save tagNames
			o.allTags = masterTagList;
			// Save separator
			o.separator = separator;
			tempcat.set(id, o);
		});
		category = tempcat;
		BUNDLES[cat] = category;
	}
	// Category is parsed
	bundle = category.get(chosen);
	show = atts.show;
	if(show !== undefined) {
		// Check if "show" exists
		chosen = bundle[show];
		if(chosen === undefined) {
			logError(node, "BUNDLE: no \"" + show + "\" tags to show");
			return null;
		}
		chosen = [chosen];
	} else {
		// Show all tags
		chosen = [];
		bundle.allTags.forEach(b => chosen.push(b));
	}
	//bundle.title, bundle.tagName, bundle.allNamespaces
	// Turn into HTML
	tempDiv = $e("div");
	// Go through chosen tags, looping through the given contents for each item in each tag
	chosen.forEach(function(tag) {
		tag.forEach(function(object, id) {
			// object.att ...
			parseDeepHTMLArray(tempDiv, contents, $RP.subLoaders.fromBundle, id, object);
		});
	});
	if(filter !== undefined) {
		let f = $RP.bundleFilters[filter];
		if(f === undefined) {
			logError(node, "BUNDLE: filter \"" + filter + "\" does not exist");
		} else {
			// Let the filter modify the div's contents
			let retVal = f(tempDiv, unit);
			if(retVal === false) {
				// Do not send any results
				return null;
			}
		}
	}
	// Send results to document.
	while(tempDiv.firstChild !== null) {
		appendTo.append(tempDiv.firstChild);
	}
	// probably some filter-type property to call a function to $listen these elements
	// return null so the processor won't re-process this
	return null;
}


export function loadBundleItem(appTo, item, id, object) {
	// item is an object with a set of properties
	var filter = item.filter,
		tag, text;
	if(filter !== undefined) {
		let f = $RPG.pages.bundleItemFilters[filter];
		if(f === undefined) {
			logErrorText("BUNDLE ITEM: filter \"" + filter + "\" does not exist");
		} else {
			return f(appTo, item, object, id);
		}
	}
	// No (or invalid) filter
	// Get the plain text of the element
	text = item.text;
	if(text === "id") {
		text = id;
	} else {
		text = object[text];
	}
	// See if this is asking to be surrounded by a tag
	tag = item.tag;
	if(tag === undefined && item.contents.length > 0) {
		// No tag attribute, but has contents. Assume this is inline.
		tag = "span";
	}
	if(tag !== undefined) {
		let a = Object.getOwnPropertyNames(item),
			atts = {},
			e;
		// Get any HTML attributes for the element
		a.forEach(function(att) {
			switch(att) {
				case "filter":
				case "tag":
				case "text":
					break;
				default:
					atts[att] = item[att];
			}
		});
		// Create the element
		e = $e(tag, atts, text || "");
		// Parse any contents
		parseDeepHTMLArray(e, item.contents, $RPG.pages.subLoaders.fromBundleItem, id, object);
		// Return the element
		return e;
	}
	// No tag attribute means turn it into text, ignoring contents
	return $t(text || "");
}



function parseBundle(node, filler) {
	var atts = parseAttributesToObject(node),
		cat = atts.category,
		raw = $RPG.pages.rawBundles;
	if(cat === undefined) {
		logError(node, "BUNDLE: missing required \"category\" parameter");
		return null;
	} else if (!raw.has(cat)) {
		logError(node, "BUNDLE: category \"" + cat + "\" does not seem to exist");
		return null;
	}
	/// Defer parsing this until later
	return {
		deferred: true,
		atts: atts,
		node: node,
		raw: raw.get(cat),
		loader: loadBundle,
		contents: filler.slice()
	};
}


function parseItem(node, filler) {
	var o = parseAttributesToObject(node);
	o.contents = filler.slice();
	o.deferred = true;
	o.ITEM = true;
	o.loader = String;
	return o;
}


// parseDeepHTMLArray(appendTo, deepArray, ?optionalChecks = [], ...?optional arguments)
export function parseDeepHTMLArray() {
	var args = Array.from(arguments),
			appendTo = args.shift(),
			html = args.shift().slice(),
			held = [],
			optionalChecks;
	if(args.length > 0) {
		optionalChecks = args.shift();
	}
	while(html.length > 0) {
		let unit = html.shift(), okToAppend = true;
		// Screen for a node/element
		while(!(unit instanceof Node)) {
			if(unit === null || unit === undefined) {
				// Null element detected - skip this
				okToAppend = false;
				break;
			} else if(optionalChecks.length > 0 && !optionalChecks.every(function(pair) {
				var a = pair.slice(),
					checker = a.shift(),
					loader = a.shift();
				if(checker(unit)) {
					unit = loader(appendTo, unit, ...args);
					return false;
				}
				return true;
			})) {
				// A passed-in check was triggered, stopping the flow.
				// unit should be changed into a node or valid array by the passed-in loader, or changed to null.
			} else if(unit.deferred === true) {
				// Deferred object
				// unit should be changed into a node or valid array by the passed-in loader, or changed to null.
				unit = unit.loader(appendTo, unit, ...args);
			} else {
				// Must be an array : [parentNode, [children]]
				// Get parent of next group
				let u = unit.slice(),
					x = u.shift().cloneNode(true);
				// Save current remainders
				held.push([appendTo, html]);
				// Load the new group as 'html'
				html = u[0].slice();
				// Load the new head as 'appendTo'
				appendTo = x;
				// Get the new 'unit'
				unit = html.shift();
			}
		}
		if(okToAppend) {
			// We have a node
			// Append to parent element
			appendTo.append(unit.cloneNode(true));
			//console.log(appendTo);
		}
		while(html.length === 0 && held.length > 0) {
			// We're out of the current array
			// See if we have more
			let last = held.pop(),
				aT = last[0];
			// Save the parent element to the new parent
			aT.append(appendTo);
			// Now set up the new appendTo and html
			appendTo = aT;
			html = last[1];
		}
	}
}


// Does the heavy lifting of displaying a new page
export function loadPage(page) {
	var $RP = $RPG.pages,
		MAIN = $RP.MAIN,
		OVERLAY = $RP.OVERLAY,
		atts = page.atts,
		filter = atts.get("filter"),
		preloader = atts.get("preloader"),
		subpage = TF.converter(atts.get("subpage")),
		overlay = TF.converter(atts.get("overlay")),
		html = page.html,
		tempDiv = $e("div");
	// Run through a preloader if needed
	if(preloader !== undefined) {
		let p = $RP.pagePreloaders[preloader];
		if(p !== undefined) {
			let preloaded = p(page, html);
			if(preloaded) {
				let ph = preloaded.html,
					psp = preloaded.subpage,
					po = preloaded.overlay,
					pf = preloaded.filter,
					prr = preloaded.reroute;
				if(prr) {
					return loadPageNamed(prr);
				}
				if(ph) {
					html = ph;
				}
				if(psp) {
					subpage = psp;
				}
				if(po) {
					overlay = po;
				}
				if(pf) {
					filter = pf;
				}
			}
		}
	}
	// If we're not a subpage or overlay, clear out all previous info on-screen
	if(!subpage && !overlay) {
		while(MAIN.firstChild !== null) {
			MAIN.firstChild.remove();
		}
	}
	// If an overlay is active, clear it
	if(OVERLAY.firstChild !== null) {
		document.body.classList.remove("overlayActive");
		while(OVERLAY.firstChild !== null) {
			OVERLAY.firstChild.remove();
		}
	}
	// If we're an overlay, append to OVERLAY instead of MAIN and add overlayActive class
	if(overlay) {
		MAIN = OVERLAY;
		document.body.classList.add("overlayActive");
	}
	// parse the page into tempDiv
	parseDeepHTMLArray(tempDiv, html, $RP.subLoaders.fromPage);
	// filter if necessary
	if(filter !== undefined) {
		let f = $RP.pageFilters[filter];
		if(f === undefined) {
			logError(page.node, "PAGE: filter \"" + filter + "\" does not exist");
		} else if(f(tempDiv, page) === false) {
			// Do nothing, print nothing.
			return;
		}
	}
	// Load to MAIN
	while(tempDiv.firstChild !== null) {
		MAIN.append(tempDiv.firstChild);
	}
}


// loadPageNamed(string pageName, ?object sharedObject)
export function loadPageNamed(pageName) {
	var page = BasicPageObject.getById(pageName);
	if(page === undefined) {
		return logErrorText("There is no page with the id \"" + pageName + "\"");
	}
	loadPage(page);
}


// button = this
export function loadPageFromButton() {
	var d = this.dataset,
		to = d.nextPage;
	return loadPageNamed(to);
}


// This bit of code gets reused a lot, so it's spun off into its own function
function getTargetsFromButton(button, padre = button.parentNode, MAIN = $RPG.pages.MAIN) {
	var d = button.dataset,
		sep = d.separator || " ",
		which = d.whichClass,
		whichID = d.whichId,
		targets;
	if(which) {
		// Look for all Stats with the specified classes
		targets = $a(
			which.split(sep)
				.map(w => "input.Stat." + w + ",select[data-stat]." + w)
				.join(",")
		, MAIN);
	} else if(whichID) {
		targets = $a(whichID.split(sep).map(w => "#" + w).join(","), MAIN);
	} else {
		// Look up chain until we find a statContainer node, or hit the main node
		while(!padre.classList.contains("statContainer")) {
			let p = padre.parentNode;
			if(p === MAIN) {
				break;
			}
			padre = p;
		}
		// Look for all Stats
		targets = $a("input.Stat,select[data-stat]", padre);
	}
	return targets;
}


// button = this
// Set stats to the values present on the page
export function calculateFromPage() {
	var targets = getTargetsFromButton(this);
	// Look at the inputs and selects
	targets.forEach(function(input) {
		var d = input.dataset,
			id = d.stat,
			ss = d.selfSaving,
			stat = BasicIdObject.getById(id),
			value = input.value;
		if(stat === undefined) {
			logError(input, "Stat \"" + id + "\" not found (data-stat)");
			return false;
		} else if(ss !== "true") {
			stat.set("value", value);
		}
	});
	return true;
}


// button = this
export function calculateThenNavigate(e) {
	calculateFromPage.bind(this).call();
	loadPageFromButton.bind(this).call();
}


// button = this
export function calculateBundle(e) {
	var targets = getTargetsFromButton(this),
		bundles = [],
		d = this.dataset,
		x, choices;
	// Calculate values
	if(calculateFromPage.bind(this).call()) {
		// Look at the inputs and selects
		targets.forEach(function(input) {
			var id = input.dataset.stat,
				stat = BasicIdObject.getById(id);
			if(stat === undefined) {
				// Error message already sent
				return;
			} else if (stat instanceof Pool) {
				bundles = bundles.concat(stat.getSelectionValues().map( o => o.node ));
			}
		});
		choices = parseBundledInfo(bundles);
		if(choices > 0) {
			return loadPageNamed(d.calcPage);
		}
	}
	loadPageNamed(d.noCalc);
}


// button = this
export function resetThenNavigate(e) {
	var targets = getTargetsFromButton(this),
		errors = [];
	//console.log(targets);
	// Look at the inputs and selects
	targets.forEach(function(input) {
		var id = input.dataset.stat,
			stat = BasicIdObject.getById(id);
		if(stat === undefined) {
			errors.push([input, id]);
			return logError(input, "Stat \"" + id + "\" not found (data-stat)");
		} else if (stat instanceof Pool) {
			return stat.values = new Map();
		}
		return stat.set("value", stat.get("startingValue"));
	});
	// Load new page
	loadPageFromButton.bind(this).call();
}


// button = this
export function closeOverlay(e) {
	var overlay = $i("overlay");
	while(overlay.firstChild !== null) {
		overlay.firstChild.remove();
	}
	document.body.classList.remove("overlayActive");
}



export function bundleChoicesPreloader(page) {
	var html = page.html.slice(),
		$RB = $RPG.bundles.pageHandlers;
	$RPG.bundles.choicesToBeMade.forEach(function(o) {
		var h = $RB[o.type](o);
		if(h !== false) {
			if(h instanceof Array) {
				html = h.concat(html);
			} else {
				html.unshift(h);
			}
		}
	});
	return {
		html: html,
	};
}



export function bundleChoicesFilter(html, unit) {
	$a(".chooser", html).forEach(function(c) {
		var ch = [Int.converter(c.dataset.choices)];
		if(ch > 1) {
			let i = Array.from($a("input", c)),
				f = maxChooserChoices.bind(ch.concat(i));
			i.forEach(inp => $listen(inp, f, "input"));
		}
	});
}


// this = array [integerNumberOfChoices, ...all input objects]
function maxChooserChoices(e) {
	var i = this.slice(),
		n = i.shift(),
		selected = i.reduce((acc, x) => acc += (x.checked ? 1 : 0), 0);
	if(selected > n) {
		i.every(function(x) {
			if(x.checked) {
				x.checked = false;
				return false;
			}
			return true;
		});
	}
}




$RPG.ADD("pages", {
	pageTemplates: {},
	bundles: {},
	handlers: {
		Block: parseBlock,
		INPUT: parseInput,
		"INPUT-HIDDEN": parseInputHidden,
		CHOOSE: parseChoose,
		BUTTON: parseButton,
		BUNDLE: parseBundle,
		ITEM: parseItem
	},
	inputDatasetProps: [["selfSaving", TF.converter], "postLoader"],
	inputPostLoaders: {},
	buttonTypes: {
		navigation: {
			mandatoryProps: ["nextPage"],
			datasetProps: ["nextPage"],
			defaultText: "Next",
			listenFunc: loadPageFromButton
		},
		calculation: {
			mandatoryProps: [],
			datasetProps: [["whichClass", "whichId", "separator", "toCalc"]],
			defaultText: "Calculate",
			listenFunc: calculateFromPage
		},
		calcNav: {
			mandatoryProps: ["nextPage"],
			datasetProps: ["nextPage", "whichClass", "whichId", "separator", "haltable"],
			defaultText: "Save and Continue",
			listenFunc: calculateThenNavigate
		},
		calcBundle: {
			mandatoryProps: ["calcPage", "noCalc"],
			datasetProps: ["calcPage", "noCalc", "whichClass", "whichId", "separator", "haltable"],
			defaultText: "Save and Continue",
			listenFunc: calculateBundle
		},
		resetNavigation: {
			mandatoryProps: ["nextPage"],
			datasetProps: ["nextPage", "whichClass", "whichId", "separator", "haltable"],
			defaultText: "Go Back",
			listenFunc: resetThenNavigate
		},
		closeSubpage: {
			mandatoryProps: ["toClose"],
			datasetProps: ["toClose"],
			defaultText: "Close",
			listenFunc: loadPageFromButton
		},
		closeOverlay: {
			mandatoryProps: [],
			datasetProps: [],
			defaultText: "Close",
			listenFunc: closeOverlay
		}
	},
	bundleFilters: {},
	bundleItemFilters: {},
	pageFilters: {
		bundleChoices: bundleChoicesFilter
	},
	pagePreloaders: {
		bundleChoices: bundleChoicesPreloader
	},
	subLoaders: {
		fromPage: [],
		fromBundle: [
			[item => (item.ITEM !== undefined), loadBundleItem]
		],
		fromBundleItem: [
			[item => (item.ITEM !== undefined), loadBundleItem]
		],
	 }
});
