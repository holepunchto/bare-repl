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

  size_t expr_len = 0;
  e = js_get_value_string_utf8(env, argv[0], NULL, 0, &expr_len);
  assert(e == 0);

  char expr[expr_len + 1];
  e = js_get_value_string_utf8(env, argv[0], expr, expr_len + 1, NULL);
  assert(e == 0);

  js_value_t *script;
  e = js_create_string_utf8(env, expr, -1, &script);
  assert(e == 0);

  js_value_t *result;
  e = js_run_script(env, NULL, 0, 0, script, &result);

  if (e == 0) {
    return result;
  } else {
    return NULL;
  }
}

static js_value_t *
set_context (js_env_t *env, js_callback_info_t *info) {
  int e;

  js_value_t *argv[2];
  size_t argc = 2;

  e = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(e == 0);

  size_t prop_len = 0;
  e = js_get_value_string_utf8(env, argv[0], NULL, 0, &prop_len);
  assert(e == 0);

  char prop[prop_len + 1];
  e = js_get_value_string_utf8(env, argv[0], prop, prop_len + 1, NULL);
  assert(e == 0);

  js_value_t *global;
  e = js_get_global(env, &global);
  assert(e == 0);

  e = js_set_named_property(env, global, prop, argv[1]);
  assert(e == 0);
}

static js_value_t *
init (js_env_t *env, js_value_t *exports) {

  {
    js_value_t *fn;
    js_create_function(env, "run", -1, run, NULL, &fn);
    js_set_named_property(env, exports, "run", fn);
  }

  {
    js_value_t *fn;
    js_create_function(env, "set_context", -1, set_context, NULL, &fn);
    js_set_named_property(env, exports, "set_context", fn);
  }

  return exports;
}

PEAR_MODULE(pear_repl, init);
