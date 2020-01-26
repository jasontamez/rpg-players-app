# Bleep bloop.

<http://expressjs.com/en/resources/middleware.html>

- SQLite has been installed

## Errors

- How do I import modules for the entire script? Neither pf- modules are loading correctly.
- <https://stackoverflow.com/questions/30956636/sharing-data-between-es6-modules>

## Meh

1. Choose savefile
2. Choose Ruleset
   1. loads in background
3. Display - Initial
   1. ask setup questions
   2. changes should instantly apply

1) Char Sheet
2) Determine Ability Scores
3) Choose a Race
4) Choose a Class
5) Allocate Skill Ranks
6) Choose Feats
7) Determine Starting Hit Points (HP)
8) Get Equipped
9) Determine Saving Throws, Initiative, and Attack Values.
10) Description & Personality
11) Other (Starting Spells)

## To-Do

- **PfSpells** :: Gnome Magic
- UpgradePath? Which elements to update and in which order?

---

- Stats : use same save-in-the-background format, plus clone-document stuff
- Give classes to real estate, so certain widgets can pop up in multiple places when needed
- **Probably should determine how things get displayed, first**
- .remove() on Tags (delete from parent, perhaps delete kids)
- ...
- ...
- ModValue method="add" value="3"? fromId="STR" attribute="modifier"?
- ...
- ...
- IntBonusable should have an _overwrite_ option?
- <Choice> location attribute? Download on-demand as choices are loaded?

## Display

- **Page**
  - _style_
- **Block**
  - _named_

## Notes

- <https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs/Introduction>
- <http://expressjs.com/en/resources/middleware.html>
- BasicIdObject.allIDs.get("STR").parent.atts.get("modifier_text").value.grabValue(BasicIdObject.allIDs.get("STR")).get("value")
- .
- DATUM.value - converts at set
- ATTRIBUTE.value - converts at get
- GROUP - conversion should not be necessary
- IF - test condition, then calculate
- IF, MATH, WHILE - conversion is implicit - TAG.calculate(context)
  - context should be a datum
- THEN and ELSE should be Equations
  - Equations should only evaluate when called with a context
- References should only be used inside an Equation

## Your Project

On the front-end,

- edit `public/client.js`, `public/style.css` and `views/index.html`
- drag in `assets`, like images or music, to add them to your project

On the back-end,

- your app starts at `server.js`
- add frameworks and packages in `package.json`
- safely store app secrets in `.env` (nobody can see this but you and people you invite)

\ ゜ o ゜)ノ
