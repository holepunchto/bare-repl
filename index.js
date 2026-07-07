const { Writable } = require('bare-stream')
const Module = require('bare-module')
const path = require('bare-path')
const Readline = require('bare-readline')
const Pipe = require('bare-pipe')
const tty = require('bare-tty')
const inspect = require('bare-inspect')
const binding = require('./binding')

exports.start = function start(opts) {
  if (typeof opts === 'string') opts = { prompt: opts }

  return new exports.REPLServer(opts)
}

let nextIdentifier = 0

exports.REPLServer = class REPLServer extends Readline {
  constructor(opts = {}) {
    super({
      ...opts,

      input: opts.input || (tty.isTTY(0) ? new tty.ReadStream(0) : new Pipe(0)),
      output: opts.output || (tty.isTTY(1) ? new tty.WriteStream(1) : new Pipe(1))
    })

    this._useGlobal = opts.useGlobal === true
    this._eval = opts.eval || defaultEval
    this._writer = opts.writer || defaultWriter(this.input.isTTY)

    if (this.input.isTTY) this.input.setMode(tty.constants.MODE_RAW)

    if (this._useGlobal) {
      this._context = global
    } else {
      binding.createContext(this)

      this._context = binding.global(this)

      const context = Object.getOwnPropertyNames(this._context)

      // A fresh context only carries the JavaScript intrinsics, so the host
      // globals are bridged across.
      for (const name of Object.getOwnPropertyNames(global)) {
        if (name === 'global' || name === 'globalThis') continue
        if (context.includes(name)) continue

        Object.defineProperty(this._context, name, Object.getOwnPropertyDescriptor(global, name))
      }

      this._context.global = this._context
    }

    this._context._ = undefined
    this._context.require = Module.createRequire(path.join(path.resolve('.'), '/'), {
      cache: Object.create(null)
    })

    this._commands = Object.create(null)

    this._exited = false

    this.defineCommand('help', { help: 'Print this help message', action: this._onhelp })
    this.defineCommand('exit', { help: 'Exit the REPL', action: this._onexit })

    this.on('data', this._ondata).on('close', this._onclose).prompt()
  }

  get eval() {
    return this._eval
  }

  get writer() {
    return this._writer
  }

  get context() {
    return this._context
  }

  get commands() {
    return this._commands
  }

  defineCommand(keyword, { help, action }) {
    this._commands[keyword] = { help, action }
  }

  _onhelp() {}

  async _onexit() {
    this._exited = true

    this.close()
  }

  _onclose() {
    if (!this._exited) this.output.write(Readline.constants.EOL)

    this.input.push(null)

    this.output.on('close', () => this.emit('exit')).end()
  }

  async _ondata(line) {
    await Writable.drained(this.output)

    const expr = line.trim()

    if (expr[0] === '.') {
      const [command, ...args] = expr.substring(1).split(/\s+/)

      if (command in this._commands) {
        try {
          await this._commands[command].action.call(this, ...args)
        } catch (err) {
          this.output.write(err + Readline.constants.EOL)
        }
      } else {
        this.output.write('Invalid REPL keyword' + Readline.constants.EOL)
      }
    } else {
      const context = this._useGlobal ? null : this

      this._eval(expr, context, `REPL${++nextIdentifier}`, (err, value) => {
        this._context._ = value

        this.output.write(this._writer(err || value) + Readline.constants.EOL)

        if (this.destroyed) return

        this.prompt()
      })
    }
  }
}

function defaultWriter(colors) {
  return function defaultWriter(value) {
    return inspect(value, { colors })
  }
}

function defaultEval(expression, context, resource, cb) {
  let err = null
  let value
  try {
    value = binding.eval(expression, context)
  } catch (e) {
    err = e
  }

  cb(err, value)
}
