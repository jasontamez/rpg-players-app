# rpg-players-app
An attempt at making an app for struggling players in my Pathfinder campaigns, with a focus on making it simple for other RPGs to be supported.

# XML

# Special Attributes

## id
    <Tag id="some string" />
The **id** must be unique across all tags. Unlike a regular HTML id, this can contain spaces, punctuation, and other non-alphanumeric characters.


# Major Tags

## Stats
    <Stats></Stats>
Contains the stats the app needs to function.

### Stat
    <Stat id="unique_name" title="optional" userEditable="true"
      type="Int" startingValue="0" minValue="0" maxValue="99" />
A stat is a single piece of data.
- **title** is optional, but gives the stat a user-readable name.
- **userEditable** indicates that the stat can be changed directly by the user. This defaults to false unless you explicitly set it to exactly "true".
- **type** declares what type of data this stat holds. Defaults to *Str* (string). Other possible values are *Int* (integer), *Num* (number), *IntBonusable* (integer, with extra code for handling bonuses/penalties,) and *Typeless* (allows type inheritance, or when type is not important).
- **startingValue** defines what the initial value of the stat is. It defaults to an empty string or zero, depending on stat type.
- **minValue** and **maxValue** are optional, and only work with *Int* and *Num* stats, limiting the possible values of the stat. 

### Group
    <Group id="some_name" type="Int" userEditable="true">
      <Stat id="unique1" />
      <Stat id="unique2" />
      <Stat id="unique3" userEditable="false" />
    </Group>

Groups are used to join several stats together. If a child stat doesn't have a particular attribute, it will default to one defined on its nearest parent group.

In the example above, all three stats will be of type *Int*. The first two will be user-editable, while the third one will not.

### Attribute
    <Stat id="funky">
      <Attribute name="huh">This "text" might be 'problematic'</Attribute>
    </Stat>
    <Group id="family">
      <Stat id="fresh" />
      <Stat id="smelly" />
      <Attribute name="really" getFromId="unique_name" attribute="fresh" />
      <Attribute name="type" getFromId="unique_name" />
    </Stat>

The attribute tag gives a new attribute to its parent stat or group, as if it was defined on the parent tag itself. In the examples above, the "funky" Stat will have a "huh" attribute, while the "fresh" and "smelly" Stats will both have "really" and "type" attributes.

This primary purpose of this tag is to include text that would be problematic to put inside a typical tag attribute. It also has some built-in ways to copy data from other stats or groups.

- **name** is the name of this attribute.
- **getFromId** indicates which group or stat we are pulling from.
- **attribute** is the name of the attribute in the stat we're copying. If omitted, the *name* of the attribute will be used. For example, the first attribute tag in the Group above is copying the "fresh" attribute of the "unique_name" stat (or group), and the second will copy the "type" of the same.

Note that an attribute tag cannot override **value** or **startingValue**.
    
