#include <assert.h>
#include <bare.h>
#include <js.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <uv.h>

static js_value_t *
bare_repl_run (js_env_t *env, js_callback_info_t *info) {
  int err;

  js_value_t *argv[2];
  size_t argc = 2;

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  size_t expr_len = 0;
  err = js_get_value_string_utf8(env, argv[0], NULL, 0, &expr_len);
  assert(err == 0);

  char *expr = malloc(expr_len + 1);
  err = js_get_value_string_utf8(env, argv[0], expr, expr_len + 1, NULL);
  assert(err == 0);

  js_value_t *script;
  err = js_create_string_utf8(env, expr, -1, &script);
  assert(err == 0);

  free(expr);

  js_value_t *result;
  err = js_run_script(env, NULL, 0, 0, script, &result);

  return err == 0 ? result : NULL;
}

static js_value_t *
init (js_env_t *env, js_value_t *exports) {
  {
    js_value_t *fn;
    js_create_function(env, "run", -1, bare_repl_run, NULL, &fn);
    js_set_named_property(env, exports, "run", fn);
  }

  return exports;
}

BARE_MODULE(bare_repl, init);
