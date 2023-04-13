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
const repl = new Repl()
repl.start()
```
