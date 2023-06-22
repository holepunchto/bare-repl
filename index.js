const TTY = require('bare-tty')
const inspect = require('bare-inspect')
const { writeFileSync, readFileSync } = require('bare-fs')
const { Writable } = require('streamx')
const binding = require('./binding')

const EOL = process.platform === 'win32' ? '\r\n' : '\n'

module.exports = class REPLServer {
  constructor () {
    this._prompt = '> '

    this._input = new TTY(0)
    this._output = new TTY(1)

    this._input.setMode(TTY.constants.MODE_RAW)
    this._output.setMode(TTY.constants.MODE_NORMAL)

    this._context = global // TODO: Investigate per-session global context
    this._context._ = undefined

    this._commands = new Map()
    this._commands.set('.save', this._save)
    this._commands.set('.load', this._load)
    this._commands.set('.help', this._help)

    this._writer = defaultWriter
    this._eval = defaultEval
    this._buffer = ''
    this._history = new History()
    this._historyIndex = 0
    this._cursorOffset = 0
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
    this._printWelcomeMessage()
    this._printPrompt()
    this._input.on('data', this._ondata.bind(this))
    return this
  }

  defineCommand (keyword, { help, action }) {
    this._commands.set('.' + keyword, action)
  }

  _log (value) {
    this._output.write(this._writer(value) + '\n')
  }

  async _ondata (data) {
    switch (key(data)) {
      case 'Ctrl+C':
        return process.exit(0)
      case 'Backspace':
        return this._onbackspace()
      case 'Enter':
        return this._onenter()
      case 'Up':
        return this._onup()
      case 'Down':
        return this._ondown()
      case 'Right':
        return this._onright()
      case 'Left':
        return this._onleft()
      case 'Home':
      case 'End':
      case 'PageUp':
      case 'PageDown':
        return
      default: {
        const index = this._buffer.length + this._cursorOffset
        this._buffer = this._buffer.slice(0, index) + data.toString() + this._buffer.slice(index)
        this._reset()
      }
    }
  }

  _onbackspace () {
    if (Math.abs(this._cursorOffset) < this._buffer.length) { // if cursor is not at the beginning of the line
      this._output.write('\b')
      this._output.write(' ')
      this._output.write('\b')
      const index = this._buffer.length + this._cursorOffset - 1
      this._buffer = this._buffer.slice(0, index) + this._buffer.slice(index + 1)
      this._reset()
    }
  }

  async _onenter () {
    this._output.write(EOL)
    await Writable.drained(this._output)
    const expr = this._buffer.trim()

    if (expr[0] === '.') {
      const command = expr.split(' ')[0]
      const args = expr.split(' ').slice(1)
      if (this._commands.get(command) !== undefined) {
        try {
          await this._commands.get(command).bind(this)(...args)
        } catch (err) {
          this._log(err)
        }
      }
    } else {
      try {
        const result = await this.run(expr)
        this._log(result)
      } catch (err) {
        this._log(err)
      }
      this._history.push(this._buffer)
    }

    this._buffer = '' // clean buffer after runninf expr
    this._cursorOffset = 0
    this._historyIndex = 0
    this._printPrompt()
  }

  _onup () {
    if ((this._historyIndex === 0) && (this._buffer.length > 0)) return // stops if there's something written in the buffer
    if (this._history.length === 0) return // stops if history is empty
    if ((this._history.length + this._historyIndex) <= 0) return // stops if reached end of history

    this._historyIndex--
    this._buffer = this._history.get(this._historyIndex)
    this._cursorOffset = 0
    this._reset()
  }

  _ondown () {
    if (this._historyIndex === 0) return // stops if beginning of history

    this._historyIndex++
    this._buffer = (this._historyIndex === 0) ? '' : this._history.get(this._historyIndex)
    this._cursorOffset = 0
    this._reset()
  }

  _onright () {
    if (this._cursorOffset < 0) {
      this._cursorOffset++
      this._output.write(Buffer.from([0x1b, 0x5b, 0x31, 0x43]))
    }
  }

  _onleft () {
    if (Math.abs(this._cursorOffset) < this._buffer.length) {
      this._cursorOffset--
      this._output.write('\b')
    }
  }

  _reset () {
    this._output.write(Buffer.from([0x20, 0x1b, 0x5b, 0x31, 0x47])) // move cursor to beginning of line
    this._output.write(Buffer.from([0x20, 0x1b, 0x5b, 0x32, 0x4b])) // delete until the end of the line
    this._output.write(Buffer.from([0x20, 0x1b, 0x5b, 0x31, 0x47])) // after deleting, cursor moves 1 column to the right, go back
    this._printPrompt()
    this._output.write(this._buffer)
    for (let i = 0; i < Math.abs(this._cursorOffset); i++) {
      this._output.write('\b')
    }
  }

  async _save (path) {
    return writeFileSync(path, this._history.toString())
  }

  async _load (path) {
    const session = (readFileSync(path)).toString().split('\n')

    for (const line of session) {
      await this.run(line)
    }
  }

  _help () {
  }

  _printPrompt () {
    this._output.write(this._prompt)
  }

  _printWelcomeMessage () {
    this._output.write('Welcome to the Bare interactive shell\n')
  }

  async run (expr) {
    const value = this._eval(expr, this._context)
    this._context._ = value
    return value
  }
}

function key (buf) {
  switch (buf.toString('hex')) {
    case '0d' : return 'Enter'
    case '7f' : return 'Backspace'
    case '1b5b41' : return 'Up'
    case '1b5b42' : return 'Down'
    case '1b5b43' : return 'Right'
    case '1b5b44' : return 'Left'
    case '03' : return 'Ctrl+C'
    case '1b5b48' : return 'Home'
    case '1b5b46' : return 'End'
    case '1b5b357e' : return 'PageUp'
    case '1b5b367e' : return 'PageDown'
  }
}

class History {
  constructor () {
    this.entries = []
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
