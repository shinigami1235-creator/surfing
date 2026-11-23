# Surf photo and drone site

A one-page portfolio for a surf photographer in the Mentawai Islands. Photos are uploaded through Pages CMS and lined up in rows automatically. Films are YouTube links, so no video is stored on the site.

## What she does after setup

1. Go to app.pagescms.org and sign in with the email invite.
2. Open **Photo sessions**, press **Add an entry**, set the date, spot and "Shot from", and drop in the photos from that session.
3. Press **Save**. The site updates in about two minutes.

Films work the same way: paste the YouTube link under **Films**. Prices, the WhatsApp number, Instagram and the about text are under **Prices** and **Site**.

To check a session or film before it goes public, tick **Hide from the site**, save, and open the preview link (the site address with `?preview` at the end). Hidden items show there with a yellow Hidden tag. Untick the box and save to publish. Prices and Site changes have no hidden option and go live when saved.

The newest session shows first. Photos are grouped by the spot name, so spell it the same each time.

## Setup (once)

1. Create a new GitHub repository and push this folder to its `main` branch.
2. In the repository, open Settings, then Pages, and set Source to **GitHub Actions**.
3. Sign in to app.pagescms.org with GitHub and open the repository. Pages CMS reads `.pages.yml` and shows the four sections.
4. Under Collaborators in Pages CMS, invite the photographer by email. She does not need a GitHub account.
5. Fill in **Site** with her name, WhatsApp number, Instagram, email and top photo, then replace the placeholder prices.
6. Delete the placeholder sessions and films.

## How photos are kept small

Each save runs `.github/workflows/deploy.yml`, which runs `tools/shrink.py` before publishing:

- turns each photo the right way up and removes camera and GPS data,
- scales it to 2400 px on the long side and saves a 1000 px copy for the grid,
- records each photo's width and height in `media/_sizes.json` so rows line up before the photos load.

She can upload straight from the camera or phone. A shrunk photo plus its grid copy comes to about 600 KB, and a GitHub Pages site can hold 1 GB, so the site fits about 1,500 photos. Past that, move `media/` to Cloudflare R2 or Cloudinary and keep the rest as it is.

## Files

| File | What it holds |
|---|---|
| `index.html` | Page layout |
| `assets/site.css` | Styles. Fonts are Barlow and Barlow Condensed, stored in `assets/fonts` |
| `assets/site.js` | Reads the content files and builds the grid, lightbox, films and prices |
| `content/*.json` | Everything she edits in Pages CMS |
| `media/` | Uploaded photos and their grid copies |
| `.pages.yml` | Pages CMS setup |

## Placeholders

Text in square brackets is a placeholder. The placeholder photos are from Unsplash, by Kazuhisa Sadogawa, Silas Baisch, Jeremy Bishop, Lance Asper, James Donaldson, Keaton Dickinson, Kiril Dobrev, Sam Wermut, Alice Kotlyarenko, Lachlan Dempsey, Rishi, Josh Withers, Lisha Riabinina, Ilyuza Mingazova, Matt Paul Catalano, Alen Smola and Carles Rabada. The placeholder films are Mentawai surf videos from other YouTube channels. Replace all of them before the site goes public.
