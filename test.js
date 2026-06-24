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

test('isolated execution context', async (t) => {
  t.plan(3)

  const input = new PassThrough()
  const output = new PassThrough()

  const repl = start({ input, output })

  output.resume()

  // Declaring a global in one session must not leak into the host or into a
  // separate session.
  input.write('globalThis.leaked = 42')
  input.write('\r')
  input.write('.exit')
  input.write('\r')

  repl.on('close', async () => {
    t.is(repl.context.leaked, 42)
    t.absent('leaked' in global)

    const other = start({ input: new PassThrough(), output: new PassThrough() })

    t.absent('leaked' in other.context)

    other.close()
  })
})

test('useGlobal shares the host global', async (t) => {
  t.plan(2)

  const input = new PassThrough()
  const output = new PassThrough()

  const repl = start({ input, output, useGlobal: true })

  output.resume()

  // With `useGlobal` the session evaluates against the shared global, so a
  // global declaration leaks into the host.
  input.write('globalThis.shared = 42')
  input.write('\r')
  input.write('.exit')
  input.write('\r')

  repl.on('close', async () => {
    t.is(repl.context, global)
    t.is(global.shared, 42)

    delete global.shared
  })
})

test('host globals are bridged into the context', async (t) => {
  t.plan(3)

  const input = new PassThrough()
  const output = new PassThrough()

  const repl = start({ input, output })

  t.not(repl.context, global)
  t.is(repl.context.global, repl.context)
  t.is(repl.context.Buffer, global.Buffer)

  repl.close()
})
