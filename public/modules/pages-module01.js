import { $a, $t, $ea as $e, $listen } from "./dollar-sign-module.js";
import { parseAttributesToObject, parseObjectToArray, checkObjProps, logErrorNode as logError, logErrorText } from "./parsing-logging.js";
import { BasicIdObject, Int, Str, IntBonusable, Num, TF, Pool } from "./stats-module01.js";

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


var $RPG = window["$RPG"],
	InformationObject = {
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
		buttonTypes: {
			navigation: {
				mandatoryProps: ["nextPage"],
				datasetProps: ["nextPage"],
				defaultText: "Next",
				listenFunc: loadPageFromButton
			},
			calculation: {
				mandatoryProps: [],
				datasetProps: [["which", "toCalc"]],
				defaultText: "Calculate",
				listenFunc: calculateFromPage
			},
			calcNav: {
				mandatoryProps: ["nextPage"],
				datasetProps: ["nextPage", "which", "haltable"],
				defaultText: "Save and Continue",
				listenFunc: calculateThenNavigate
			},
			resetNavigation: {
				mandatoryProps: ["nextPage"],
				datasetProps: ["nextPage", "which", "haltable"],
				defaultText: "Go Back",
				listenFunc: resetThenNavigate
			},
			closeSub: {
				mandatoryProps: ["subpage"],
				datasetProps: ["subpage"],
				defaultText: "Close",
				listenFunc: loadPageFromButton
			}
		},
		bundleFilters: {},
		bundleItemFilters: {},
		pageFilters: {},
 	  subLoaders: {
	 	  page: [],
		 	bundle: [
				[item => (item.ITEM !== undefined), loadBundleItem]        
 	    ],
	 	  bundleItem: [
		 	  [i => (i.ITEM !== undefined), loadBundleItem]
			],
 	  }
	};

$RPG.pages = InformationObject;


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
	handle = InformationObject.handlers[nombre];
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
	} else if ((format = InformationObject.pageTemplates[temp]) === undefined) {
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
	switch(stat.type) {
		case Int:
		case IntBonusable:
		case Num:
			atts.type = "number";
			inputObject = stat.get("minValue");
			if(inputObject !== undefined && inputObject === inputObject) {
				atts.min = inputObject.toString();
			}
			inputObject = stat.get("maxValue");
			if(inputObject !== undefined && inputObject === inputObject) {
				atts.max = inputObject.toString();
			}
			break;
		case Str:
			atts.type = "text";
			break;
		default:
			logError(node, "INPUT: Stat id=\"" + id + "\" is not of a user-definable type.");
			return null;
	}
	atts.value = stat.get("value");
	inputObject = $e("input", atts);
	inputObject.append(...filler);
	inputObject.classList.add("Stat");
	inputObject.dataset.stat = id;
	return inputObject;
}


// <INPUT-HIDDEN id="Stat" />
export function parseInputHidden(node, filler) {
	var atts = parseAttributesToObject(node),
		id = atts.id,
		stat = BasicIdObject.getById(id),
		tagID = atts.tagId,
		tagClass = atts.tagClass,
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
			let sep = stat.separator || ",";
			atts.value = Array.from(stat.getSelection()).join(sep);
			break;
		default:
			logError(node, "INPUT: Stat id=\"" + id + "\" is not of a user-definable type.");
			return null;
	}
	atts.type = "hidden";
	inputObject = $e("input", atts);
	CL = inputObject.classList;
	//inputObject.append(...filler);
	CL.add("Stat");
	tagClass.forEach(c => CL.add(c));
	inputObject.dataset.stat = id;
	return inputObject;
}


// <BUTTON type="navigation" to="page2">Continue</BUTTON>
export function parseButton(node, filler) {
	var atts = parseAttributesToObject(node),
		type = atts.type,
		buttonType = InformationObject.buttonTypes[type],
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
		bundles = InformationObject.rawBundles,
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


//  InformationObject.bundles = {
//    categoryName: Map(
//      bundleName => {
//        title: "Title",
//        tagName: Map(
//          id => {
//            namespaces => [],
//            kids => [kids],
//            att => att...
//          }
//        ),
//        separator: string,
//        allTags: Set (tagName, tagName...),
//        allNamespaces: Set [maybe don't use this, just assume Standard is chosen and don't duplicate other namespaces already chosen?]
//      }
//    )
//  }

//<BUNDLE category="x" ?show="Tag"></BUNDLE>
export function loadBundle(appendTo, unit) {
	var BUNDLES = InformationObject.bundles,
		node = unit.node,
		atts = unit.atts,
		contents = unit.contents,
		rawcategory = unit.raw,
		cat = atts.category,
		category = BUNDLES[cat],
		stat = atts.stat,
		filter = atts.filter,
		statObj, chosen, bundle, show, tempDiv;
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
					k = Array.from(node.children),
					obj;
				if(id === undefined || namespaces === undefined) {
					logError(node, "BUNDLE: category \"" + cat + "\", tag \"" + tagName + "\" missing id and/or namespaces parameters");
					return null;
				}
				namespaces = namespaces.split(separator);
				obj = {
					namespaces: namespaces,
					kids: Array.from(node.children)
					//
					//
					//
					//
					// KIDS NEED TO BE PARSED FOR BONUSES!!!
					// KIDS NEED TO BE PARSED FOR BONUSES!!!
					// KIDS NEED TO BE PARSED FOR BONUSES!!!
					// KIDS NEED TO BE PARSED FOR BONUSES!!!
					//
					//
					//
					//
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
			parseDeepHTMLArray(tempDiv, contents, InformationObject.subLoaders.bundle, id, object);
		});
	});
	if(filter !== undefined) {
		let f = InformationObject.bundleFilters[filter];
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
		let f = InformationObject.bundleItemFilters[filter];
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
			if(att !== "filter" && att !== "tag" && att !== "text") {
				atts[att] = item[att];
			}
		});
		// Create the element
		e = $e(tag, atts, text || "");
		// Parse any contents
		parseDeepHTMLArray(e, item.contents, InformationObject.subLoaders.bundleItem, id, object);
		// Return the element
		return e;
	}
	// No tag attribute means turn it into text, ignoring contents
	return $t(text || "");
}



function parseBundle(node, filler) {
	var atts = parseAttributesToObject(node),
		cat = atts.category,
		raw = InformationObject.rawBundles;
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
		raw: InformationObject.rawBundles.get(cat),
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


// loadPageNamed(string pageName, ?boolean subPage, ?object sharedObject)
export function loadPageNamed(pageName, subPage) {
	var page = BasicPageObject.getById(pageName);
	if(page === undefined) {
		return logErrorText("There is no page with the id \"" + pageName + "\"");
	}
	loadPage(page, subPage);
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
				unit = unit.loader(appendTo, unit);
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
export function loadPage(page, subPage) {
	var MAIN = InformationObject.MAIN,
		filter = page.atts.get("filter"),
		tempDiv = $e("div");
	// If we're not a subpage, clear out all previous info on-screen
	if(!subPage) {
		while(MAIN.firstChild !== null) {
			MAIN.firstChild.remove();
		}
	}
	// parse the page into tempDiv
	parseDeepHTMLArray(tempDiv, page.html, InformationObject.subLoaders.page);
	// filter if necessary
	if(filter !== undefined) {
		let f = InformationObject.pageFilters[filter];
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


// button = this
export function loadPageFromButton() {
	var d = this.dataset,
		to = d.nextPage,
		subPage = TF.converter(d.subpage);
	return loadPageNamed(to, subPage);
}


// button = this
export function calculateFromPage() {
	var MAIN = InformationObject.MAIN,
		parent = this.parentNode,
		d = this.dataset,
		which = d.which,
		targets = [],
		errors = [];
	if(which) {
		// Look for all Stats with the specified classes
		targets = $a(
			which.split(" ")
				.map(w => "input.Stat." + w + ",select[data-stat]." + w)
				.join(",")
		, MAIN);
	} else {
		// Look up chain until we find a statContainer node, or hit the main node
		while(!parent.classList.contains("statContainer")) {
			let p = parent.parentNode;
			if(p === MAIN) {
				break;
			}
			parent = p;
		}
		// Look for all Stats
		targets = $a("input.Stat,select[data-stat]", parent);
	}
	// Look at the inputs and selects
	targets.forEach(function(input) {
		var id = input.dataset.stat,
			stat = BasicIdObject.getById(id),
			value = input.value;
		if(stat === undefined) {
			errors.push([input, id]);
			return logError(input, "Stat \"" + id + "\" not found (data-stat)");
		}
		return stat.set("value", value);
	});
}


// button = this
export function calculateThenNavigate(e) {
	calculateFromPage.bind(this).call();
	loadPageFromButton.bind(this).call();
}


// button = this
export function resetThenNavigate(e) {
	var MAIN = InformationObject.MAIN,
		parent = this.parentNode,
		d = this.dataset,
		which = d.which,
		targets = [],
		errors = [];
	if(which) {
		// Look for all Stats with the specified classes
		targets = $a(
			which.split(" ")
				.map(w => "input.Stat." + w + ",select[data-stat]." + w)
				.join(",")
		, MAIN);
	} else {
		// Look up chain until we find a statContainer node, or hit the main node
		while(!parent.classList.contains("statContainer")) {
			let p = parent.parentNode;
			if(p === MAIN) {
				break;
			}
			parent = p;
		}
		// Look for all Stats
		targets = $a("input.Stat,select[data-stat]", parent);
	}
	console.log(targets);
	// Look at the inputs and selects
	targets.forEach(function(input) {
		var id = input.dataset.stat,
			stat = BasicIdObject.getById(id),
			starting;
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
