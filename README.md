# bare-repl

Read-Evaluate-Print-Loop environment for JavaScript.

```
npm i bare-repl
```

## Usage

```sh
npm i -g bare-repl
bare-repl
> "hello world"
hello world
> 1 + 1
2
> const bar = 1; const foo = 2;
undefined
> bar + foo
3
```

```js
const REPLServer = require('bare-repl')
const repl = new REPLServer()
repl.start()
```

## API

#### `repl.start([options])`

```js
repl.start()
```

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
repl.defineCommand('greet, { help: 'Greetings', action: () => console.log('hello') })
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
