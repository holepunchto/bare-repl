const REPLServer = require('../index.js')
const test = require('brittle')

test('context', async (t) => {
  const repl = new REPLServer()
  repl.context.bar = 1
  repl.context.bar = 2
  const result = await repl.run('bar')
  t.is(result, repl.context.bar)
  t.is(result, 2)

  repl.context.buffer = Buffer.alloc(10)
  t.is((await repl.run('buffer')).length, 10)
})

test('basic run', async (t) => {
  const repl = new REPLServer()
  const add = await repl.run('1 + 1')
  const a = await repl.run('let a = "a"; a')
  t.is(add, 2)
  t.is(a, 'a')
})

test('underscore', async (t) => {
  const repl = new REPLServer()
  t.is(await repl.run('_'), undefined)
  await repl.run('1 + 1')
  t.is(await repl.run('_'), 2)
  await repl.run('Buffer.alloc(10)')
  t.is((await repl.run('_')).length, 10)
})
