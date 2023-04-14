# Pearjs-repl

Read-Evaluate-Print-Loop environment for Pear.js.

``` bash
npm install -g @pearjs/repl
pearjs-repl
> "hello world"
hello world
> 1 + 1
2
> const bar = 1; const foo = 2;
undefined
> bar + foo
3
```


``` javascript
const REPLServer = require('../index.js')
const repl = new REPLServer()
repl.start()
```

## API

### start([options])

``` javascript
repl.start()
```

Options include:

``` javascript
{
  prompt: string, // sets repl prompt
  useColors: boolean, // toogles ANSI style codes to colorize the output
  writer: (message) => message, // converts repl output
  input: stream, // sets repl input stream
  output: stream, // sets repl output stream
  eval: (cmd) => {} // sets eval function
}
``` 

### defineCommand(keyword, { help, action })

Define a repl command keyword. 

``` javascript
repl.define('greet, { help: 'Greetings', action: () => console.log('hello') })
```

``` bash
pearjs-repl
> .greet
hello 
```
