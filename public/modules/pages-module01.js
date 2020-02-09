import { $t, $ea as $e, $listen } from "./dollar-sign-module.js";
import { parseAttributesToObject, parseObjectToArray, checkObjProps, logErrorNode as logError } from "./parsing-logging.js";
import { BasicIdObject, Int, Str, IntBonusable, Num } from "./stats-module01.js";


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
BasicPageObject.handlers = {
	Block: parseBlock,
	INPUT: parseInput,
	CHOOSE: parseChoose,
	BUTTON: parseButton
};


var InformationObject = {
	pageTemplates: {},
	handlers: {
		Block: parseBlock,
		INPUT: parseInput,
		CHOOSE: parseChoose,
		BUTTON: parseButton	
	},
	buttonTypes: {
		navigation: function(node, atts, filler) {
			var buttonElement = checkObjProps(node, atts, ["to"], "BUTTON, navigation");
			if(!buttonElement) {
				if(filler.length === 0) {
					buttonElement = $e("button", atts);
					buttonElement.textContent = "Next";
				} else {
					buttonElement.append(...filler);
				}
				buttonElement.dataset.loadNext = atts.to;
				$listen(buttonElement, loadPage);
			}
			return buttonElement;
		}
	}
};


// Parse an array of <Page> objects
export function parsePages(nodelist, sharedObject) {
	var pages = [];
	// Add in any additional properties
	populateInformation(sharedObject);
	// Parse nodes
	nodelist.forEach( node => pages.push(parsePageNodes(node)) );
	return pages;
}


function populateInformation(sharedObject) {
	Object.getOwnPropertyNames(sharedObject).forEach(function(prop) {
		if(InformationObject[prop] === undefined) {
			// New property.
			InformationObject[prop] = sharedObject[prop];
		} else {
			// Add to existing property.
			let Iprop = InformationObject[prop], sprop = sharedObject[prop];
			Object.getOwnPropertyNames(sprop).forEach(function(p) {
				Iprop[p] = sprop[p];
			});
		}
	});
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
	handle = BasicPageObject.handlers[nombre];
	if (handle !== undefined) {
		// Get the html from the handler
		return handle(node, filler);
	}
	// Assume HTML.
	atts = parseAttributesToObject(node);
	html = $e(nombre, atts);
	html.append(...filler);
	return html;
}


//
//
// Can't "return filler" if it's an array, now
//
//
//


export function parseBlock(node, filler) {
	var atts = parseAttributesToObject(node),
		temp = atts.template,
		contents = atts.contents,
		format;
	if(temp === undefined) {
		// Assume this is a plain <div>.
		let div = $e("div");
		div.append(...filler);
		return div;
		//return "<div>" + filler + "</div>";
//	} else if ((format = PageTemplate.find(temp)) === undefined) {
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
	return inputObject;
}


export function parseButton(node, filler) {
	//<BUTTON type="nav" to="page2">Continue</BUTTON>
	var atts = parseAttributesToObject(node),
		type = atts.type,
		buttonType = InformationObject.buttonTypes[type];
	if(type === undefined) {
		logError(node, "BUTTON: missing required \"type\" parameter");
		return null;
	} else if (buttonType === undefined) {
		logError(node, "BUTTON: type \"" + type + "\" is invalid");
		return null;
	}
	delete atts.type;
	return buttonType(node, atts, filler);
}


export function parseChoose(node) {
	//<CHOOSE category="race" />
	var atts = parseAttributesToObject(node),
		cat = atts.category,
		bundles = InformationObject.bundles,
		selectObject;
	if(cat === undefined) {
		logError(node, "CHOOSE: missing required \"category\" parameter");
		return null;
	}
	delete atts.category;
	selectObject = $e("select", atts);
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


// loadPageNamed(string pageName, ?boolean subPage, ?object sharedObject)
export function loadPageNamed(pageName, subPage, sharedObject) {
	var MAIN, page;
	sharedObject && populateInformation(sharedObject);
	MAIN = InformationObject.MAIN;
	page = BasicPageObject.getById(pageName);
	loadPage(page, subPage);
}


export function loadPage(page, subPage) {
	// If we're not a subpage, clear out all previous info on-screen
	if(!subPage) {
		while(MAIN.firstChild !== null) {
			MAIN.firstChild.remove();
		}
	}
	MAIN.append(...page.html);
}