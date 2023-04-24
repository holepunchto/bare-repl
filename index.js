const binding = require('./binding')
const Pipe = require('@pearjs/pipe')
const TTY = require('@pearjs/tty')
const { writeFileSync, readFileSync } = require('@pearjs/fs')
const EOL = process.platform === 'win32' ? '\r\n' : '\n'
const { Crayon } = require('tiny-crayon')

const logger = new Pipe('/tmp/debug')
const debug = (e) => logger.write(e + EOL)

module.exports = class REPLServer {
  constructor () {
    this._prompt = '> '

    this._input = new TTY(0)
    this._output = new TTY(1)
    this._input.setMode(TTY.constants.MODE_RAW)
    this._output.setMode(TTY.constants.MODE_NORMAL)

    this._context = {}
    this._contextProxy = new Proxy(this._context, {
      set (obj, prop, value) {
        binding.set_context(prop, value)
        obj[prop] = value
      }
    })
    binding.set_context('_', undefined)

    this._commands = new Map()
    this._commands.set('.save', this._save)
    this._commands.set('.load', this._load)
    this._commands.set('.help', this._help)

    this._writer = (e) => e
    this._log = (...e) => console.log(...e.map(this._writer))
    this._eval = null
    this._buffer = ''
    this._history = new History()
    this._historyIndex = 0
    this._cursorOffset = 0
  }

  get context () {
    return this._contextProxy
  }

  start (opts = {}) {
    if (opts.prompt) this._prompt = opts.prompt
    if (opts.writer) this._writer = opts.writer
    if (opts.eval) this._eval = opts.eval
    if (opts.input) this._input = opts.input
    if (opts.output) {
      this._output = opts.output
      this._log = (e) => this._output.write(this._writer(e))
    }
    if (opts.useColors === false) {
      global.console.crayon = new Crayon({ isTTY: false })
    }
    this._printWelcomeMessage()
    this._printPrompt()
    this._input.on('data', this._onData.bind(this))
    return this
  }

  defineCommand (keyword, { help, action }) {
    this._commands.set('.' + keyword, action)
  }

  async _onData (data) {
    const pressed = key(data)
    // console.log(data)
    // return
    switch (pressed) {
      case ('Ctrl+C'): {
        process.exit(0)
        break
      }
      case ('Backspace'): {
        await this._onBackspace()
        break
      }
      case ('Enter'): {
        await this._onEnter()
        break
      }
      case ('Up'): {
        await this._onUp()
        break
      }
      case ('Down'): {
        await this._onDown()
        break
      }
      case ('Right'): {
        await this._onRight()
        break
      }
      case ('Left'): {
        await this._onLeft()
        break
      }
      case ('Home'): {
        break
      }
      case ('End'): {
        break
      }
      case ('PageUp'): {
        break
      }
      case ('PageDown'): {
        break
      }
      default: {
        const index = this._buffer.length + this._cursorOffset
        this._buffer = this._buffer.slice(0, index) + data.toString() + this._buffer.slice(index)
        this._reset()
      }
    }
  }

  _onBackspace () {
    if (Math.abs(this._cursorOffset) < this._buffer.length) { // if cursor is not at the beginning of the line
      this._output.write('\b')
      this._output.write(' ')
      this._output.write('\b')
      const index = this._buffer.length + this._cursorOffset - 1
      this._buffer = this._buffer.slice(0, index) + this._buffer.slice(index + 1)
      this._reset()
    }
  }

  async _onEnter () {
    this._output.write(EOL)
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
      } catch (e) {
        this._log(e.name + ':', e.message)
      }
      this._history.push(this._buffer)
    }

    this._buffer = '' // clean buffer after runninf expr
    this._cursorOffset = 0
    this._historyIndex = 0
    this._printPrompt()
  }

  _onUp () {
    if ((this._historyIndex === 0) && (this._buffer.length > 0)) return // stops if there's something written in the buffer
    if (this._history.getLenght() === 0) return // stops if history is empty
    if ((this._history.getLenght() + this._historyIndex) <= 0) return // stops if reached end of history

    this._historyIndex--
    this._buffer = this._history.get(this._historyIndex)
    this._cursorOffset = 0
    this._reset()
  }

  _onDown () {
    if (this._historyIndex === 0) return // stops if beginning of history

    this._historyIndex++
    this._buffer = (this._historyIndex === 0) ? '' : this._history.get(this._historyIndex)
    this._cursorOffset = 0
    this._reset()
  }

  _onRight () {
    if (this._cursorOffset < 0) {
      this._cursorOffset++
      this._output.write(Buffer.from([0x1b, 0x5b, 0x31, 0x43]))
    }
  }

  _onLeft () {
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
    return writeFileSync(path, this._history.asSingleString())
  }

  async _load (path) {
    const session = (await readFileSync(path)).toString().split('\n')
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
    this._output.write('Welcome to 🍐.js interactive shell\n')
  }

  async run (expr) {
    const value = this.eval ? await this.eval(expr) : await binding.run(expr)
    binding.set_context('_', value)
    return value
  }
}

function key (buff) {
  const s = buff.toString('hex')
  switch (s) {
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
    this.arr = []
  }

  push (x) {
    this.arr.push(x)
  }

  get (x) {
    return this.arr[this.arr.length + x]
  }

  getLenght () {
    return this.arr.length
  }

  asSingleString () {
    return this.arr.join('\n')
  }
}
