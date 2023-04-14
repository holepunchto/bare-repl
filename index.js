const binding = require('./binding')
const Pipe = require('@pearjs/pipe')
const { writeFileSync, readFileSync } = require('@pearjs/fs')
const EOL = process.platform === 'win32' ? '\r\n' : '\n'

module.exports = class Repl {
  constructor () {
    this._prompt = '> '
    this._input = new Pipe(0)
    this._output = new Pipe(1)
    this._context = {}
    this._contextProxy = new Proxy(this._context, {
      set (obj, prop, value) {
        binding.set_context(prop, value)
        obj[prop] = value
      }
    })
    binding.set_context('_', undefined)

    this._commands = new Map()
    this._commands.set('.save', this.save)
    this._commands.set('.load', this.load)
    this._commands.set('.help', this.help)

    this._session = ''
    this._log = console.log
  }

  get context () {
    return this._contextProxy
  }

  start (opts = {}) {
    if (opts.prompt) this._prompt = opts.prompt
    if (opts.input) this._input = opts.input
    if (opts.output) {
      this._output = opts.output
      this._log = this._output.write
    }
    this._printPrompt()
    this._input.on('data', this._ondata.bind(this))
    return this
  }

  async _ondata (data) {
    const expr = data.toString().trim()

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
        const result = this.run(expr)
        this._session += expr + EOL
        this._log(result)
      } catch (e) {
        this._log(e.name + ':', e.message)
      }
    }

    this._printPrompt()
  }

  async save (path) {
    return writeFileSync(path, this._session)
  }

  async load (path) {
    const session = (await readFileSync(path)).toString()
    this._session = session
    for (const line of session.split(EOL)) {
      this.run(line)
    }
  }

  help () {
  }

  _printPrompt () {
    this._output.write(this._prompt)
  }

  run (expr) {
    const value = binding.run(expr)
    binding.set_context('_', value)
    return value
  }
}
