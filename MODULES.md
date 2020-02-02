# Modules

Modules are used to extend the app. They are loaded on the fly when encountered in a **Ruleset** XML document, so include them as close to the top as possible.

## Use

A module uses ES6 export syntax, and at a minimum should export an **exports** array. Each element should be an array of property names, followed by a value.

    class NewType extends Str {
      [...]
    }
    export const exports = [
      ["type", "NewType", NewType],
      ["defaultTypeObject", NewType]
    ]

Assuming this is a module imported for "stats", this would add *NewType* to the list of valid *Stat* types, and overwrites the defaultTypeObject to be *NewType*

### Not recommended

If an exports array is not defined, the script will look for a comma-deliminated *exports* attribute on the XML tag.

    <Module type="stats" src="my-module.js" exports="NewType,defaultTypeObject" />

The script will then look for explictly **export**ed values *NewType* and *defaultTypeObject* in the module and set them according to their names. This is equivalent to:

    export const exports = [
      ["NewType", NewType],
      ["defaultTypeObject", defaultTypeObject]
    ]

If no *exports* attribute is present either, the script will load every **export**ed value in the same way.
