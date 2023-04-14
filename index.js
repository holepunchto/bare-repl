const binding = require('./binding')
const Pipe = require('@pearjs/pipe')

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
  }

  get context () {
    return this._contextProxy
  }

  start () {
    this._printPrompt()

    this._pipe.on('data', (data) => {
      const expr = data.toString()
      try {
        const result = this.run(expr)
        console.log(result)
      } catch (e) {
        console.log(e.name + ':', e.message)
      }
      this._printPrompt()
    })
  }

  break () {

  }

  save () {

  }

  load () {

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
