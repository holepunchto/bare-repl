const test = require('brittle')
const { PassThrough } = require('bare-stream')
const { start } = require('.')

test('basic', async (t) => {
  t.plan(2)

  const input = new PassThrough()
  const output = new PassThrough()

  const repl = start({ input, output })

  let out = ''

  output.on('data', (data) => (out += data))

  input.write('1 + 2')
  input.write('\r')

  repl
    .once('line', (line) => {
      t.is(line, '1 + 2')

      input.write('.exit')
      input.write('\r')
    })
    .on('close', async () => {
      t.comment(out.trim())
      t.pass('closed')
    })
})

test('object literal', async (t) => {
  t.plan(2)

  const input = new PassThrough()
  const output = new PassThrough()

  const repl = start({ input, output })

  let out = ''

  output.on('data', (data) => (out += data))

  input.write('{ foo: 42 }')
  input.write('\r')

  repl
    .once('line', (line) => {
      t.is(line, '{ foo: 42 }')

      input.write('.exit')
      input.write('\r')
    })
    .on('close', async () => {
      t.comment(out.trim())
      t.pass('closed')
    })
})
