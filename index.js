const { Writable } = require('bare-stream')
const Module = require('bare-module')
const path = require('bare-path')
const os = require('bare-os')
const Readline = require('bare-readline')
const Pipe = require('bare-pipe')
const tty = require('bare-tty')
const inspect = require('bare-inspect')
const binding = require('./binding')

exports.start = function start (opts) {
  if (typeof opts === 'string') opts = { prompt: opts }

  return new exports.REPLServer(opts)
}

exports.REPLServer = class REPLServer extends Readline {
  constructor (opts = {}) {
    super({
      ...opts,

      input: opts.input || (tty.isTTY(0) ? new tty.ReadStream(0) : new Pipe(0)),
      output: opts.output || (tty.isTTY(1) ? new tty.WriteStream(1) : new Pipe(1))
    })

    this.eval = opts.eval || defaultEval
    this.writer = opts.writer || defaultWriter(this.input.isTTY)

    if (this.input.isTTY) this.input.setMode(tty.constants.MODE_RAW)

    this.context = global // TODO: Investigate per-session global context
    this.context._ = undefined
    this.context.require = Module.createRequire(path.join(os.cwd(), '/'), opts.require)

    this.commands = Object.create(null)

    let exited = false

    const onhelp = () => {}

    const onexit = async () => {
      exited = true

      this.close()
    }

    this.defineCommand('help', { help: 'Print this help message', action: onhelp })
    this.defineCommand('exit', { help: 'Exit the REPL', action: onexit })

    const onclose = () => {
      if (!exited) this.output.write(Readline.constants.EOL)

      this.input.push(null)

      this.output
        .on('close', () => this.emit('exit'))
        .end()
    }

    const ondata = async (line) => {
      await Writable.drained(this.output)

      const expr = line.trim()

      if (expr[0] === '.') {
        const [command, ...args] = expr.substring(1).split(/\s+/)

        if (command in this.commands) {
          try {
            await this.commands[command].action.call(this, ...args)
          } catch (err) {
            this.output.write(err + Readline.constants.EOL)
          }
        } else {
          this.output.write('Invalid REPL keyword' + Readline.constants.EOL)
        }
      } else {
        try {
          const value = this.writer(this.eval(expr, this._context))
          this.context._ = value
          this.output.write(value + Readline.constants.EOL)
        } catch (err) {
          this.output.write(err + Readline.constants.EOL)
        }
      }

      if (this.destroyed) return

      this.prompt()
    }

    this
      .on('data', ondata)
      .on('close', onclose)
      .prompt()
  }

  defineCommand (keyword, { help, action }) {
    this.commands[keyword] = { help, action }
  }
}

function defaultWriter (colors) {
  return function defaultWriter (value) {
    return inspect(value, { colors })
  }
}

function defaultEval (expression, context) {
  return binding.eval(expression, context)
}
