const binding = require('./binding')
const Pipe = require('@pearjs/pipe')
const { writeFileSync, readFileSync } = require('@pearjs/fs')
const EOL = process.platform === 'win32' ? '\r\n' : '\n'

module.exports = class Repl {
  constructor () {
    this._prompt = '> '
    this._pipe = new Pipe(1)

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
  }

  get context () {
    return this._contextProxy
  }

  start () {
    this._printPrompt()

    this._pipe.on('data', async (data) => {
      const expr = data.toString().trim()

      if (expr[0] === '.') {
        const command = expr.split(' ')[0]
        const args = expr.split(' ').slice(1)
        if (this._commands.get(command) !== undefined) {
          try {
            await this._commands.get(command).bind(this)(...args)
          } catch (err) {
            console.log(err)
          }
        }
      } else {
        try {
          const result = this.run(expr)
          this._session += expr + EOL
          console.log(result)
        } catch (e) {
          console.log(e.name + ':', e.message)
        }
      }

      this._printPrompt()
    })
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
    this._pipe.write(this._prompt)
  }

  run (expr) {
    const value = binding.run(expr)
    binding.set_context('_', value)
    return value
  }
}
