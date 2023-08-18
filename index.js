const { Writable } = require('streamx')
const Readline = require('bare-readline')
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

      input: opts.input || new tty.ReadStream(0),
      output: opts.output || new tty.WriteStream(1)
    })

    this.eval = opts.eval || defaultEval
    this.writer = opts.writer || defaultWriter

    if (this.input.isTTY) this.input.setMode(tty.constants.MODE_RAW)

    this.context = global // TODO: Investigate per-session global context
    this.context._ = undefined

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
      if (!exited) this.write(Readline.constants.EOL)

      this.input.pause()

      this.emit('exit') // For Node.js compatibility
    }

    const ondata = async (line) => {
      await Writable.drained(this.output)

      const expr = line.trim()

      if (expr[0] === '.') {
        const [command, ...args] = expr.substring(1).split(/\s+/)

        if (command in this.commands) {
          try {
            await this.commands[command].action.apply(this, ...args)
          } catch (err) {
            this.write(err + Readline.constants.EOL)
          }
        } else {
          this.write('Invalid REPL keyword' + Readline.constants.EOL)
        }
      } else {
        try {
          const value = this.writer(this.eval(expr, this._context))
          this.context._ = value
          this.write(value + Readline.constants.EOL)
        } catch (err) {
          this.write(err + Readline.constants.EOL)
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

function defaultWriter (value) {
  return typeof value === 'string' ? value : inspect(value, { colors: true })
}

function defaultEval (expression, context) {
  return binding.eval(expression, context)
}
