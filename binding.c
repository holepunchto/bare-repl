#include <assert.h>
#include <js.h>
#include <pear.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <uv.h>

static js_value_t *
run (js_env_t *env, js_callback_info_t *info) {
  int e;

  js_value_t *argv[2];
  size_t argc = 2;

  e = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(e == 0);

  uint32_t exprLength;
  js_get_value_uint32(env, argv[1], &exprLength);
  assert(e == 0);

  char expr[exprLength];
  size_t written;
  e = js_get_value_string_utf8(env, argv[0], expr, exprLength, &written);
  assert(e == 0);

  js_value_t *script;
  e = js_create_string_utf8(env, expr, -1, &script);
  assert(e == 0);

  js_value_t *result;
  e = js_run_script(env, NULL, 0, 0, script, &result);
  assert(e == 0);

  bool has_exception;
  e = js_is_exception_pending(env, &has_exception);
  assert(e == 0);

  assert(!has_exception);

  return result;
}

static js_value_t *
init (js_env_t *env, js_value_t *exports) {

  {
    js_value_t *fn;
    js_create_function(env, "run", -1, run, NULL, &fn);
    js_set_named_property(env, exports, "run", fn);
  }

  return exports;
}

PEAR_MODULE(pear_repl, init);
