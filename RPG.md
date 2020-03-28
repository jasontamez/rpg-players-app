# $RPG

## .bundles

Used to hold information and functions regarding `<Bundle>` tags.

### .choicesToBeMade

Stores information currently being chosen by the user.

#### Set by

_`parseBundledInfo`_ in **`bundles-module`**

&rArr; via _`calculateBundle`_ in **`pages-module`**

&rArr; &rArr; via `<BUTTON type="calcBundle">`

#### Used by

_`bundleChoicesPreloader`_ in **`pages-module`**

#### Content

`Array` of "Choice" `Objects`.

- Each `Object` should have at least two properties (but can have many more)
  - `isChoice` should be `true`
  - `type` is a String representing a property present on `$RPG.bundles.pagePreloaders`

### .bundlePreloaders

Has `Functions` that translate "Choice" `Objects` into HTML arrays.

- `.BonusChoice`
- `.PoolBonusChoice`

#### Called by

_`bundleChoicesPreloader`_ in **`pages-module`**

### .previousBonuses

Holds information recently added to the character where no choice was needed.

- Probably don't need this for anything

#### Set by

_`parseBundledInfo`_ in **`bundles-module`**

&rArr; via _`calculateBundle`_ in **`pages-module`**

&rArr; &rArr; via `<BUTTON type="calcBundle">` in a `<Page>` tag

#### Used by

Nothing.

#### Content

Map where keys are taken from `Node``.id` and values are `Arrays` of `Objects` similar to "Choice" objects, except that `.isChoice` === `false`.

### .raw

Map of raw `<Bundle>` information.

#### Set by

_`parseBundle`_ in **`rpg-players-module`**

#### Used by

_`parseBundle`_ in **`pages-module`**

&rArr; via `<BUNDLE>` tag in a `<Page>` tag

_`parseChoose`_ in **`pages-module`**

&rArr; via `<CHOOSE>` tag in a `<Page>` tag

_`loadBundle`_ in **`pages-module`**

### .TagHandlers

Hold properties that hold `Functions` that transform bundled `Nodes` into "Choice" `Objects`.

- `.Bonus`
- `.BonusChoice`
- `.Notation`
- `.PoolBonus`
- `.PoolBonusSelect`
- `.PoolBonusChoice`

#### Called by

_`parseBundleNode`_ in **`bundles-module`**

&rArr; via _`parseBundledInfo`_ in **`bundles-module`**

&rArr; &rArr; via _`calculateBundle`_ in **`pages-module`**

&rArr; &rArr; &rArr; via `<BUTTON type="calcBundle">`

---

## .current

Stores information about the current state of the app.

### .character

Current _`CharacterObject`_

### .pageBeingParsed

The current _`PageObject`_ being parsed.

#### Set by

_`parsePageNodes`_ in **`pages-module`**

&rArr; via _`parsePages`_ in **`pages-module`**

&rArr; &rArr; via **`rpg-players-module`**

#### Used by

_`parsePageAttribute`_ and _`parseComplexPageAttribute`_ in **`pages-module`**

### .player

Current _`PlayerObject`_.

## .data

Information about the app's internal data, specifically the _Player_ and their _Characters_.

- `.character` === generic _`CharacterObject`_
- `.player` === generic _`PlayerObject`_

### .undoBonusMethods

`Object` holds `Functions` in its properties used by _`CharacterObject`_ to undo bonuses.

#### Properties

- `Bonus`
- `Notation`
- `PoolItem`
- `SetValue`
- `PoolSelection`

#### Used by

_`CharacterObject`_._`undoBonuses`_ in **`data-module`**

---

## .formulae

Blank `Object`, currently used by nothing.

---

## .pages

Holds information and `Functions` related to displaying HTML to the user.

### .BasicPageObject

Generic _`BasicPageObject`_

### .bundleFilters

Blank `Object` designed to hold `Functions` in its properties to modify HTML.

Functions take two arguments (`HTML Node`, _`PageObject`_). If a function returns `false` then the HTML is scrapped and nothing is returned.

#### Used by

_`loadBundle`_ in **`pages-module`**

&rArr; via `<BUNDLE ... filter="propertyName">`

### .bundleItemFilters

Blank `Object` designed to hold `Functions` in its properties to modify HTML.

Functions take four arguments (`HTML Node`, _`objDeferredItem`_, _`objBundleItem`_, _`stringIdOfBundleItem`_).

Functions should return one of the following:

- _`objDeferredItem`_ (changed or not)
- `HTML Node`
- Deep Array of `HTML Nodes` and _`objDeferredItems`_
- `null`

The value is used internally by _`parseDeepHTMLArray`_ in **`pages-module`**.

#### Used by

_`loadBundleItem`_ in **`pages-module`**

&rArr; via `$RPG.pages.subLoaders.fromBundle` and `.fromBundleItem` in **`pages-module`**

&rArr; &rArr; via _`parseDeepHTMLArray`_ in **`pages-module`**

&rArr; &rArr; &rArr; via _`loadBundle`_ and _`loadBundleItem`_ in **`pages-module`**

&rArr; &rArr; &rArr; &rArr; via `<BUNDLE><Item ... filter="propertyName"></BUNDLE>`

### .buttonTypes

Holds `Objects` containing information that determine what happens when the user clicks a `button`.

Every button property maps to an `Object` with four properties:

- `mandatoryProps`
  - an `Array` of properties the `<BUTTON>` **must** have
- `datasetProps`
  - an `Array` of properties that may or may not exist on the `<BUTTON>`
- `defaultText`
  - a `String` that will be the text of the button, if no other text is provided by the `<BUTTON>`
- `listenFunc`
  - a `Function` that will be called when the button is clicked

#### Properties

Mandatory properties are in **"bold"**

- `navigation` - moves user to new Page
  - **"nextPage"** - the page to be navigated to
  - "fromOverlay" - "true" if we're navigating from the Overlay
- `calculation` - Performs a calculation
  - **"calcName"** - a unique string that will identify the calculations being made, in case they need to be undone later
  - "whichClass" - defines a list of `classes` that the desired `<input>` and `<select>` objects will have
  - "whichId" - defines a list of `ids` that the desired `<input>` and `<select>` objects will have
    - Note: if neither "which" property is used, the calculation will be done on all `<input>` and `<select>` objects on the current Page, Subpage or Overlay
  - "separator" - a string used to `.split()` the two properties above into `Arrays` (defaults to " ")
- `calcNav` - Performs a calculation, then moves user to new page
  - **"nextPage"**
  - **"calcName"**
  - "whichClass"
  - "whichId"
  - "separator"
  - "haltable" - UNUSED, designed to halt a navigation if needed
- `calcBundle` - Performs a calculation specific to a `<BUNDLE>`
  - **"calcPage"** - Like "nextPage" but is only called if the `<BUNDLE>` indicates there are more calculations that need to be made
  - **"noCalc"** - Like "nextPage" but is only called if "calcPage" is not used
  - **"calcName"**
  - "whichClass"
  - "whichId"
  - "separator"
  - "haltable"
- `calcNavFromOverlay` - Performs a calculation, closes the Overlay, then moves user to new page
  - **"nextPage"**
  - **"calcName"**
  - "whichClass"
  - "whichId"
  - "separator"
  - "haltable"
- `resetNavigation` - Moves a user backwards, undoing any changes made by a previous calculation
  - **"resetName"** - Indicates which "calcName" this button will undo
  - **"nextPage"**
  - "haltable"
- `closeSubpage` - Closes a subpage
  - **"toClose"** - the `id` of the Subpage to close
- `closeOverlay` - Closes the Overlay
  - (no properties)

### .inputDatasetProps

An `Array` of values, used to set the `dataset` properties of `<Input>` tags.

- Each value can be either a `String` or an `Array` in the format \[`String`, `Function`\]
  - `String` represents a property of the `<INPUT>` or `<INPUT-HIDDEN>` tag that should be saved to the output `<Input>` tag
  - If `Function` is present, the value of the `<INPUT>` or `<INPUT-HIDDEN>` property is run through it and the return value is saved to the `dataset`

#### Used by

_`loadInput`_ and _`loadInputHidden`_ in **`pages-module`**

### .MAIN

The `HTML Node` where Pages are displayed.

#### Set by

**`rpg-players-module`**

#### Used by

_`loadPage`_ and _`getTargetsFromButton`_ in **`pages-module`**

### .OVERLAY

The `HTML Node` that is the Overlay.

#### Set by

**`rpg-players-module`**

#### Used by

_`loadPage`_, _`getTargetsFromButton`_, _`calculateFromOverlay`_ and _`closeOverlay`_ in **`pages-module`**

### .pageFilters

An `Object` with properties that map to `Functions`.

Each function takes two arguments (`HTML Node`, `PageObject`) and can modify the HTML.

If the function returns `false`, the process is stopped and no Page is loaded.

#### Used by

_`loadPage`_ in **`pages-module`**

&rArr; via `<Page ... filter="propertyName">...</Page>`

#### Properties

- `bundleChoices`
  - calls _`bundleChoicesFilter`_ in **`pages-module`**

### .pagePreloaders

An `Object` with properties that map to `Functions`.

Each function takes one argument (`PageObject`).

If the function returns a `truthy` value, it is assumed to be an `Object` and it is checked for properties.

- `.reroute` - A `String` ID of a `Page`; the current page stops loading and the indicated page is loaded instead
- `.filter` - A `String` that overrides the `"filter"` att of the current `Page`, thereby calling a different **`$RPG.pages.pageFilters`** property
- `.html` - A `Deep HTML Array` that overrides the one saved by the current `Page`
- `.overlay` - A true/false `String` that overrides the `"overlay"` att of the current `Page`
- `.subpage` - A true/false `String` that overrides the `"subpage"` att of the current `Page`

#### Used by

_`loadPage`_ in **`pages-module`**

&rArr; via `<Page ... preloader="propertyName">...</Page>`

#### Properties

- `bundleChoices`
  - calls _`bundleChoicesPreloader`_ in **`pages-module`**

### .pageTemplates

For use with `<Block>` tags. Unsure if we're going to keep this one. Or even the Block tag itself.

### .parsedBundles

An `Object` that holds parsed and categorized bundles.

#### Set by

_`loadBundle`_ in **`pages-module`**

#### Used by

_`loadBundle`_ in **`pages-module`**

### .specialCalculators

An `Object` with properties that map to `Functions`.

Each function takes two arguments (`<Input> Node`, `calcName`). The function saves information from the Node.

`calcName` is a `String` like the `"calcName"` property of a **`$RPG.pages.buttonTypes`** property.

#### Used by

_`calculateFromPage`_ and _`calculateFromOverlay`_ in **`pages-module`**

### .subLoaders

An `Object` with three properties that each store an `Array` of two-element `Arrays` in the form `[TestFunction, LoaderFunction]`.

The test function is used by _`parseDeepHTMLArray`_ with argument (`Object` being scanned), and should return `true` or `false`.

If the test function returns `true`, the loader function is called with the arguments (`HTML Node` for output, `Object` being scanned, ...any other arguments passed along in the original call to _`parseDeepHTMLArray`_).

The loader function returns an `HTML Node`, valid `Deep Array` or `null`.

(A `Deep Array` is an `Array` with two values: a parent `HTML Node` and an `Array` of its child `nodes` and/or `Objects`.)

#### Used by

_`parseDeepHTMLArray`_ in **`pages-module`**

&rArr; via _`loadPage`_, _`loadBundle`_ and _`loadBundleItem`_ in **`pages-module`**

#### .fromBundle

Called by _`loadBundle`_

#### .fromBundleItem

Called by _`loadBundleItem`_

#### .fromPage

Called by _`loadPage`_

### .TagHandlers

An `Object` with properties that map to `Functions` that are used to parse `HTML Nodes` in a `<Page>` tag.

The functions take the arguments (`HTML Node`, `Deep Array` of the node's children). The return value is either an `Object` or an `HTML Node`.

A tag `<FooBar>` would be parsed by the function `$RPG.pages.TagHandlers.FooBar`, for example.

---

## .stats

### .comparators

### .defaultTypeObject

### .formula

### .getTypeObject()

### .preprocessTags

### .StatTagHandlers

### .TagHandlers

### .type

$RPG.ADD("stats", {
	comparators: {
		If: If
	},
	defaultTypeObject: Str,
	formula: Formula,
	// A function to handle Type attributes
	getTypeObject: function(type, fallback) {
		var c = $RPG.stats.type[type];
		// Is this a valid type?
		if(c !== undefined) {
			// If so, return it
			return c;
		}
		// Otherwise, return Str or other specified default
		return fallback || $RPG.stats.defaultTypeObject;
	},
	preprocessTags: {},
	StatTagHandlers: {
		Group: parseGroup,
		Stat: parseStat,
		MultiStat: parseMultiStat,
		Math: parseMath,
		If: parseIf,
		Do: parseDo,
		Bonus: parseBonus,
		Notation: parseNotation,
		Pool: parsePool,
		Item: parsePoolItem
	},
	TagHandlers: {
		Attribute: parseAttribute,
		BasicIdObject: parseGroup
	},
	type: {
		Typeless: BasicStat,
		Num: Num,
		Int: Int,
		Str: Str,
		IntBonusable: IntBonusable,
		Pool: Pool,
		TF: TF
	}
});
