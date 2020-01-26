import { $t, $ea as $e } from "./dollar-sign-module.js";
import { parseAttributesToObject, parseObjectToArray, logErrorNode as logError } from "./parsing-logging.js";
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
	}
};


export function parsePages(nodelist, sharedObject) {
	var pages = [];
	// Add in any additional properties
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
	// Parse nodes
	nodelist.forEach( node => pages.push(parsePageNodes(node)) );
	return pages;
}


export function parsePageNodes(pageNode) {
	var pageTag, kids,
		atts = parseAttributesToObject(pageNode),
		id = atts.id,
		html = [];
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
		e;
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
			e = stat.get("minValue");
			if(e !== undefined && e === e) {
				atts.min = e.toString();
			}
			e = stat.get("maxValue");
			if(e !== undefined && e === e) {
				atts.max = e.toString();
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
	e = $e("input", atts);
	e.append(...filler);
	return e;
}


export function parseButton(node, filler) {
	//<BUTTON to="page2">Continue</BUTTON>
	var atts = parseAttributesToObject(node),
		to = atts.to,
		e;
	if(to === undefined) {
		logError(node, "BUTTON: missing required \"to\" parameter");
		return null;
	}
	delete atts.to;
	e = $e("button", atts);
	if(filler.length === 0) {
		e.textContent = "Next";
	} else {
		e.append(...filler);
	}
	e.dataset.loadNext = to;
	return e;
}


export function parseChoose(node) {
	//<CHOOSE category="race" />
	var atts = parseAttributesToObject(node),
		cat = atts.category,
		e;
	if(cat === undefined) {
		logError(node, "CHOOSE: missing required \"category\" parameter");
		return null;
	}
	delete atts.category;
	e = $e("select", atts);
	return e;
}
