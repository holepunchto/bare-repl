# bare-repl

Read-Evaluate-Print-Loop environment for JavaScript.

```
npm i bare-repl
```

## Usage

```js
const { start } = require('bare-repl')
const repl = start()
```

## API

#### `const repl = start([options])`

Options include:

```js
{
  prompt: string, // sets repl prompt
  useColors: boolean, // toogles ANSI style codes to colorize the output
  writer: (message) => message, // converts repl output
  input: stream, // sets repl input stream
  output: stream, // sets repl output stream
  eval: (cmd) => {} // sets eval function
}
```

#### `repl.defineCommand(keyword, { help, action })`

Define a repl command keyword.

```js
repl.defineCommand('greet', { help: 'Greetings', action: () => console.log('hello') })
```

```sh
bare-repl
> .greet
hello
```

#### `repl.context`

Set execution context.

```js
repl.context.f = () => console.log('Hello from context')
```

```js
bare-repl
> f()
Hello from context
```

## License

Apache-2.0
