const tty = require('bare-tty')
const inspect = require('bare-inspect')
const fs = require('bare-fs')
const ansiEscapes = require('bare-ansi-escapes')
const { Writable } = require('streamx')
const binding = require('./binding')

const EOL = process.platform === 'win32' ? '\r\n' : '\n'

module.exports = class REPL {
  constructor () {
    this._prompt = '> '

    this._input = new tty.ReadStream(0)
    this._input.setMode(tty.constants.MODE_RAW)

    this._output = new tty.WriteStream(1)

    this._context = global // TODO: Investigate per-session global context
    this._context._ = undefined

    this._commands = new Map()
    this._commands.set('.save', this._save)
    this._commands.set('.load', this._load)
    this._commands.set('.help', this._help)

    this._writer = defaultWriter
    this._eval = defaultEval
    this._buffer = []
    this._cursor = 0
    this._history = new History()
  }

  get context () {
    return this._context
  }

  start (opts = {}) {
    if (opts.prompt) this._prompt = opts.prompt
    if (opts.writer) this._writer = opts.writer
    if (opts.eval) this._eval = opts.eval
    if (opts.input) this._input = opts.input
    if (opts.output) this._output = opts.output

    this._printPrompt()

    this._input
      .pipe(new ansiEscapes.KeyDecoder())
      .on('data', this._onkey.bind(this))

    return this
  }

  defineCommand (keyword, { help, action }) {
    this._commands.set('.' + keyword, action)
  }

  _log (value) {
    this._output.write(this._writer(value) + '\n')
  }

  _onkey (key) {
    let characters

    switch (key.name) {
      case 'd':
        if (key.ctrl) return this._onexit()
        characters = [key.shift ? 'D' : 'd']
        break

      case 'c':
        if (key.ctrl) return this._onclear()
        characters = [key.shift ? 'C' : 'c']
        break

      case 'backspace':
        return this._onbackspace()

      case 'return':
        return this._onreturn()

      case 'up':
        return this._onup()

      case 'down':
        return this._ondown()

      case 'right':
        return this._onright()

      case 'left':
        return this._onleft()

      case 'f1':
      case 'f2':
      case 'f3':
      case 'f4':
      case 'f5':
      case 'f6':
      case 'f7':
      case 'f8':
      case 'f9':
      case 'f10':
      case 'f11':
      case 'f12':
      case 'clear':
      case 'end':
      case 'home':
      case 'pageup':
      case 'pagedown':
      case 'insert':
      case 'delete':
      case 'tab':
      case 'undefined':
        return

      case 'space':
        characters = [' ']
        break

      default:
        if (key.shift) {
          characters = [...key.name.toUpperCase()]
        } else {
          characters = [...key.name]
        }
    }

    this._buffer.splice(this._cursor, 0, ...characters)
    this._cursor += characters.length

    this._reset()
  }

  _onexit () {
    this._input.destroy()
    this._output.end(EOL)
  }

  _onclear () {
    this._buffer = []
    this._cursor = 0
    this._history.cursor = 0

    this._output.write(EOL)

    this._printPrompt()
  }

  _onbackspace () {
    if (this._cursor) {
      this._output.write('\b \b')

      this._buffer.splice(--this._cursor, 1)

      this._reset()
    }
  }

  async _onreturn () {
    const expr = this._buffer.join('')

    if (expr === '') return this._onclear()

    this._output.write(EOL)

    await Writable.drained(this._output)

    if (expr[0] === '.') {
      const [command, ...args] = expr.split(/\s+/)

      if (this._commands.has(command)) {
        try {
          await this._commands.get(command).apply(this, ...args)
        } catch (err) {
          this._log(err)
        }
      }
    } else {
      try {
        this._log(await this.run(expr))
      } catch (err) {
        this._log(err)
      }

      this._history.push(expr)
    }

    this._buffer = []
    this._cursor = 0
    this._history.cursor = 0

    this._printPrompt()
  }

  _onup () {
    if (this._history.cursor === 0 && this._buffer.length > 0) return
    if (this._history.length === 0) return
    if (this._history.length + this._history.cursor <= 0) return

    this._history.cursor--

    this._buffer = [...this._history.get(this._history.cursor)]
    this._cursor = this._buffer.length

    this._reset()
  }

  _ondown () {
    if (this._history.cursor === 0) return

    this._history.cursor++

    this._buffer = this._history.cursor === 0
      ? []
      : [...this._history.get(this._history.cursor)]
    this._cursor = this._buffer.length

    this._reset()
  }

  _onright () {
    if (this._cursor < this._buffer.length) {
      this._cursor++
      this._output.write(Buffer.from([0x1b, 0x5b, 0x31, 0x43]))
    }
  }

  _onleft () {
    if (this._cursor) {
      this._cursor--
      this._output.write('\b')
    }
  }

  _reset () {
    this._output.write(Buffer.from([0x20, 0x1b, 0x5b, 0x31, 0x47])) // move cursor to beginning of line
    this._output.write(Buffer.from([0x20, 0x1b, 0x5b, 0x32, 0x4b])) // delete until the end of the line
    this._output.write(Buffer.from([0x20, 0x1b, 0x5b, 0x31, 0x47])) // after deleting, cursor moves 1 column to the right, go back

    this._printPrompt()

    this._output.write(this._buffer.join(''))

    for (let i = 0, n = this._buffer.length - this._cursor; i < n; i++) {
      this._output.write('\b')
    }
  }

  async _save (path) {
    return fs.writeFileSync(path, this._history.toString())
  }

  async _load (path) {
    const session = (fs.readFileSync(path)).toString().split('\n')

    for (const line of session) {
      await this.run(line)
    }
  }

  _help () {
  }

  _printPrompt () {
    this._output.write(this._prompt)
  }

  async run (expr) {
    const value = this._eval(expr, this._context)
    this._context._ = value
    return value
  }
}

class History {
  constructor () {
    this.entries = []
    this.cursor = 0
  }

  get length () {
    return this.entries.length
  }

  push (entry) {
    this.entries.push(entry)
  }

  get (index) {
    if (index < 0) index += this.length
    if (index < 0 || index >= this.length) return null

    return this.entries[index]
  }

  toString () {
    return this.entries.join('\n')
  }
}

function defaultWriter (value) {
  return typeof value === 'string' ? value : inspect(value)
}

function defaultEval (expression, context) {
  return binding.run(expression, context)
}
