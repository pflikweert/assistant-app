# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Supabase setup

This app uses a Supabase PostgreSQL database to store imported transactions. The
schema is intentionally _generic_ so it can accommodate data from any CSV export
(not just Rabobank). The current migrations create/alter a
`transactions` table with the following columns:

- `id` (uuid primary key)
- `date` (date) – transaction date
- `details` (text) – human-readable description
- `counterparty` (text)
- `amount` (numeric)
- `currency` (text)
- `type` (text)
- `metadata` (jsonb) – catches any other columns from the CSV
- `created_at` (timestamp with time zone default now())

A unique index on `(date, details, amount)` prevents exact duplicates. The
migration sequence first creates a concrete table and later renames the
original `description` column to `details` while adding the generic fields.

You can apply these migrations using the Supabase CLI (install with
`npm install -g supabase`) or by copying the SQL files into the dashboard
editor.

```bash
# login once if needed
supabase login

# from the project root
supabase db push    # run pending migrations against your linked project
```

Once the table exists, importing a CSV will map the bank‑specific column names
into the generic fields and store the remaining columns under `metadata`.
Existing rows are updated if they match on `date+details+amount`.

## Local development auth bypass

Set `DEV_AUTH_BYPASS=true` (or `1`) in your local environment to skip Supabase
login during development. When enabled, the app creates a stubbed session so you
can launch the `(tabs)` experience without signing in.

You can override the fake user by defining these additional vars:

- `DEV_AUTH_USER_ID` (default `dev-local-user`)
- `DEV_AUTH_USER_EMAIL` (default `dev@localhost`)
- `DEV_AUTH_USER_NAME` (default `Local Dev`)
- `DEV_AUTH_USER_ROLE` (default `authenticated`)
- `DEV_AUTH_USER_METADATA` (a JSON object merged into the user's metadata)

The bypass only runs outside production builds and never removes the required
Supabase credentials for the rest of the app.
