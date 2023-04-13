const binding = require('./binding')
const Pipe = require('@pearjs/pipe')

module.exports = class Repl {
  constructor () {
    this._prompt = '> '
    this._pipe = new Pipe(1)
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

  _printPrompt () {
    this._pipe.write(this._prompt)
  }

  run (expr) {
    return binding.run(expr, expr.length + 1)
  }
}
