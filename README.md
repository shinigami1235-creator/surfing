# Kuya Rick: surf photography, films and boat charters

The site for Kuya Rick in the Mentawai Islands. Everything on it is edited in Pages CMS at app.pagescms.org, and the site updates about two minutes after each save. The site shows no prices, so every enquiry goes through WhatsApp, email or the enquiry form.

## Editing in Pages CMS

| Section | What it holds |
|---|---|
| **Photos** | Photo sets. Each set has a date, a location, one or more collections, an optional title and description, and the photos themselves. |
| **Collections** | The collections on the Photos page, in the order they appear. Each has a name, a one-line description, an optional cover photo and a hide switch. |
| **Spots** | Surf spots and locations, each with the area shown on the photo, for example Mentawai Islands. |
| **Pages** | Every page on the site, its top photo and its sections. |
| **Menu** | The links across the top of the site, in order, with optional dropdown items. |
| **Films** | YouTube links. |
| **Site** | Name, WhatsApp number, Instagram, YouTube channel and email. |

### Adding photos

1. Open **Photos** and press **Add an entry**.
2. Set the date and the location, typed as it appears under **Spots**.
3. Add one line per collection under **Collections**, spelled as it appears under **Collections**, for example `Surf Sessions` and `Aerial`.
4. Drop in the photos. Several can go in at once, straight from the camera or phone, since the site shrinks them and removes the GPS data.

To move photos to another collection, change the set's collections. To move a single photo, take it out of its set and pick it again in another set from the media library. Nothing needs uploading twice.

A collection or spot name that doesn't match shows as a warning at the top of the preview link.

### Pages and sections

A page is a list of sections shown in order. Drag sections to reorder them. The **Text** box in each section has a toolbar for bold, italic, headings, lists, quotes and links. Each section has a type:

| Section type | Uses |
|---|---|
| Text | Heading, text, an optional image beside it, and buttons under **Lines** |
| Photos and videos | Heading, photos and YouTube links |
| Details | Heading and **Lines** written as `Label: value`, for example `Cabins: 4` |
| List | Heading, a line of text and **Lines** as list items |
| Buttons | Heading and **Lines** written as `Button label \| link` |
| Enquiry form | Heading and a line of text. Sends by WhatsApp or email |
| Collections | The collection covers. Each opens that collection with a location filter |
| Films | Every link under **Films** |
| Contact | WhatsApp, Instagram and email buttons |

A link can be a page address such as `charters`, a full web address, `whatsapp` or `email`.

To add a page, add an entry under **Pages** with a title and a page address, add its sections, then add it to **Menu** with that address as the link.

### Checking before it goes public

Photo sets, collections, films, pages, sections and menu items each have a hide switch. A hidden item stays off the live site and shows on the preview link with a yellow Hidden tag:

https://shinigami1235-creator.github.io/surfing/?preview

Untick the switch and save to publish.

## How photos are kept small

Each save runs `.github/workflows/deploy.yml`, which runs `tools/shrink.py` before publishing:

- turns each photo the right way up and removes camera and GPS data,
- scales it to 2400 px on the long side and saves a 1000 px copy for the grid,
- records each photo's width and height in `media/_sizes.json` so rows line up before the photos load.

A shrunk photo plus its grid copy comes to about 600 KB, and a GitHub Pages site can hold 1 GB, so the site fits about 1,500 photos.

## Files

| File | What it holds |
|---|---|
| `index.html` | Header, footer and photo viewer |
| `assets/site.js` | Builds every page from the content files |
| `assets/site.css` | Styles. Fonts are Barlow and Barlow Condensed, stored in `assets/fonts` |
| `content/*.json` | Everything edited in Pages CMS |
| `media/` | Uploaded photos and their grid copies |
| `.pages.yml` | Pages CMS setup |

Text in square brackets is a placeholder. Photos from images.unsplash.com and the six films are placeholders from Unsplash and other YouTube channels, and need replacing before launch.
