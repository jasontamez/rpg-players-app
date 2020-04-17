# rpg-players-app

An attempt at making an app for struggling players in my Pathfinder campaigns, with a focus on making it simple for other RPGs to be supported.

## Currently

Moving from an XML-based approach to a JSON-based approach.

The last pre-JSON version is still available as a separate branch.

## xx-master.json

    {
		name: "shortName",
		title: "Title of RPG",
		description: "Longer description of this file.",
		Resources: [
			["type", "src-relative-to-ruleset"],
			...
		],
		Modules: [
			["src-relative-to-module-directory"],
			...
		],
		Groups: [
			{
				"name": "identifying name of group",
				"attributes": [
					["attributeName", <value - see below>],
					...
				]
			},
			...
		],
		MultiStats: [
			{
				"id": "identifying name for multistat",
				"groups": <string or array of strings>,
				"attributes": [
					["attributeName", <value - see below>],
					...
				]
			}
		],
		Stats: [
			{
				"id": "identifying name for stat",
				"groups": <string or array of strings>,
				"attributes": [
					["attributeName", <value - see below>],
					...
				]
			}
		],
		Pools: [
			{
				"id": "identifying name for pool",
				"groups": <string or array of strings>,
				"attributes": [
					["attributeName", <value - see below>],
					...
				]
			}
		]
	}

### Resources

### Modules

### Groups

### MultiStats

### Stats

### Pools

#### Value

One of the following:

1. string
2. number
3. true/false
4. null
    * indicates the stat's "value" property should be used
5. [null, string]
    * indicates the property "string" of the stat
6. [string]
    * indicates the "value" property of the Stat with the id matching the string
7. [string2, string2]
    * indicates the property string2 of the Stat with the id matching string1

### Bundles

### Pages

### Data
