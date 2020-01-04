# rpg-players-app
An attempt at making an app for struggling players in my Pathfinder campaigns, with a focus on making it simple for other RPGs to be supported.

# XML

# Special Attributes

## id
    <Tag id="some string" />
The **id** must be unique across all tags. Unlike a regular HTML id, this can contain spaces, punctuation, and other non-alphanumeric characters.


# Major Tags

## Data
    <Data></Data>
Contains the data the app needs to function.

### Datum
    <Datum id="unique_name" title="optional" userEditable="true"
      type="Int" startingValue="0" minValue="0" maxValue="99" />
A datum is a single piece of data.
- **title** is optional, but gives the datum a user-readable name.
- **userEditable** indicates that the datum can be changed directly by the user. This defaults to false unless you explicitly set it to exactly "true".
- **type** declares what type of data this datum holds. Defaults to *Str* (string). Other possible values are *Int* (integer), *Num* (number), and *Typeless* (allows type inheritance, or when type is not important)
- **startingValue** defines what the initial value of the datum is. It defaults to an empty string or zero, depending on datum type.
- **minValue** and **maxValue** are optional, and only work with *Int* and *Num* datums, limiting the possible values of the datum. 

### Group
    <Group id="some_name" type="Int" userEditable="true">
      <Datum id="unique1" />
      <Datum id="unique2" />
      <Datum id="unique3" userEditable="false" />
    </Group>

Groups are used to join several datums together. If a child datum doesn't have a particular attribute, it will default to one defined on its nearest parent group.

In the example above, all three datums will be of type *Int*. The first two will be user-editable, while the third one will not.

### Attribute
    <Datum id="funky">
      <Attribute name="huh">This "text" might be 'problematic'</Attribute>
    </Datum>
    <Group id="family">
      <Datum id="fresh" />
      <Datum id="smelly" />
      <Attribute name="really" getFromId="unique_name" attribute="fresh" />
      <Attribute name="type" getFromId="unique_name" />
    </Datum>

The attribute tag gives a new attribute to its parent datum or group, as if it was defined on the parent tag itself. In the examples above, the "funky" Datum will have a "huh" attribute, while the "fresh" and "smelly" Datums will both have "really" and "type" attributes.

This primary purpose of this tag is to include text that would be problematic to put inside a typical tag attribute. It also has some built-in ways to copy data from other datums or groups.

- **name** is the name of this attribute.
- **getFromId** indicates which group or datum we are pulling from.
- **attribute** is the name of the attribute in the datum we're copying. If omitted, the *name* of the attribute will be used. For example, the first attribute tag in the Group above is copying the "fresh" attribute of the "unique_name" datum (or group), and the second will copy the "type" of the same.


    
