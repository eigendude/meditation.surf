# meditation.surf

Welcome to the _meditation.surf_ Lightning 3 Blits App!

### Getting started

Follow the steps below to get the app up and running in no time.

#### IDE setup

It is highly recommended to install the Blits [VS Code extension](https://marketplace.visualstudio.com/items?itemName=LightningJS.lightning-blits) which will give you template highlighting and improved autocompletion.

#### pnpm setup

This project uses [pnpm](https://pnpm.io/) as a package manager. If you don't have it installed, you can install it globally with:

```sh
npm install -g pnpm
```

#### Project setup

Run the following command to install the dependencies of the app:

```sh
pnpm install
```

#### Build and run in development mode

Run the app in development mode, and listen on all network interfaces:

```sh
pnpm dev
```

This command uses Vite to fire up a local server, with Hot Reloading support. Visit the provided link in your web browser to see the app in action.

#### Build the app for production

Create an optimized and minified version of the app:

```sh
pnpm build
```

This will create a production version of the app in the `dist` folder.

#### Run test cases

Run the test cases to ensure everything is working as expected:

```sh
pnpm test
```

#### Run the linter

Run the linter to check for code quality and style issues:

```sh
pnpm lint
```

#### Run the formatter

Run the formatter to ensure code is formatted consistently:

```sh
pnpm format
```

### Resources

- [Blits documentation](https://lightningjs.io/v3-docs/blits/getting_started/intro.html) - official documentation
- [Blits Example App](https://blits-demo.lightningjs.io/?source=true) - a great reference to learn by example
- [Blits Components](https://lightningjs.io/blits-components.html) - off-the-shelf, basic and performant reference components
