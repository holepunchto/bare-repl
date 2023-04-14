const Repl = require('../index.js')
const test = require('brittle')

test.solo('context', (t) => {
  const repl = new Repl()
  repl.context.bar = 1
  repl.context.bar = 2
  const result = repl.run('bar')
  t.is(result, repl.context.bar)
  t.is(result, 2)

  repl.context.buffer = Buffer.alloc(10)
  t.is(repl.run('buffer').length, 10)
})

test('basic run', (t) => {
  const repl = new Repl()
  const add = repl.run('1 + 1')
  const a = repl.run('let a = "a"; a')
  t.is(add, 2)
  t.is(a, 'a')
})
