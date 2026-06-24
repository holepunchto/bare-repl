#include <assert.h>
#include <bare.h>
#include <js.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <utf.h>
#include <uv.h>

static void
bare_repl_finalize_context(js_env_t *env, void *data, void *finalize_hint) {
  int err;

  js_context_t *context = (js_context_t *) data;

  err = js_destroy_context(env, context);
  assert(err == 0);
}

static js_value_t *
bare_repl_create_context(js_env_t *env, js_callback_info_t *info) {
  int err;

  js_value_t *argv[1];
  size_t argc = 1;

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  js_context_t *context;
  err = js_create_context(env, &context);
  assert(err == 0);

  err = js_wrap(env, argv[0], (void *) context, bare_repl_finalize_context, NULL, NULL);
  assert(err == 0);

  return NULL;
}

static js_value_t *
bare_repl_global(js_env_t *env, js_callback_info_t *info) {
  int err;

  js_value_t *argv[1];
  size_t argc = 1;

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  js_context_t *context;
  err = js_unwrap(env, argv[0], (void **) &context);
  assert(err == 0);

  err = js_enter_context(env, context);
  assert(err == 0);

  js_value_t *global;
  err = js_get_global(env, &global);
  assert(err == 0);

  err = js_exit_context(env, context);
  assert(err == 0);

  return global;
}

static js_value_t *
bare_repl_eval(js_env_t *env, js_callback_info_t *info) {
  int err;

  js_value_t *argv[2];
  size_t argc = 2;

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  size_t expr_len = 0;
  err = js_get_value_string_utf8(env, argv[0], NULL, 0, &expr_len);
  assert(err == 0);

  utf8_t *expr = malloc(expr_len + 1);
  err = js_get_value_string_utf8(env, argv[0], expr, expr_len + 1, NULL);
  assert(err == 0);

  js_value_t *script;
  err = js_create_string_utf8(env, expr, -1, &script);
  assert(err == 0);

  free(expr);

  // A `null` context evaluates in the current context, i.e. against the shared
  // global, matching the `useGlobal` option on the JavaScript side.
  bool use_global;
  err = js_is_null(env, argv[1], &use_global);
  assert(err == 0);

  js_context_t *context;

  if (!use_global) {
    err = js_unwrap(env, argv[1], (void **) &context);
    assert(err == 0);

    err = js_enter_context(env, context);
    assert(err == 0);
  }

  js_value_t *result;
  int script_err = js_run_script(env, "<repl>", -1, 0, script, &result);

  if (!use_global) {
    err = js_exit_context(env, context);
    assert(err == 0);
  }

  return script_err == 0 ? result : NULL;
}

static js_value_t *
bare_repl_exports(js_env_t *env, js_value_t *exports) {
  int err;

#define V(name, fn) \
  { \
    js_value_t *val; \
    err = js_create_function(env, name, -1, fn, NULL, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("createContext", bare_repl_create_context)
  V("global", bare_repl_global)
  V("eval", bare_repl_eval)
#undef V

  return exports;
}

BARE_MODULE(bare_repl, bare_repl_exports)
