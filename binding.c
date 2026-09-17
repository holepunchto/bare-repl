#include <assert.h>
#include <bare.h>
#include <js.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <utf.h>
#include <uv.h>

typedef struct {
  js_env_t *env;
  js_ref_t *on_import;
} bare_repl_t;

static void
bare_repl__on_teardown(void *data) {
  int err;

  bare_repl_t *repl = (bare_repl_t *) data;

  err = js_delete_reference(repl->env, repl->on_import);
  assert(err == 0);
}

static js_value_t *
bare_repl__on_dynamic_import(js_env_t *env, js_value_t *specifier, js_value_t *assertions, js_value_t *referrer, js_value_t *id, void *data) {
  int err;

  bare_repl_t *repl = (bare_repl_t *) data;

  js_escapable_handle_scope_t *scope;
  err = js_open_escapable_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *on_import;
  err = js_get_reference_value(env, repl->on_import, &on_import);
  assert(err == 0);

  js_value_t *receiver;
  err = js_get_undefined(env, &receiver);
  assert(err == 0);

  js_value_t *argv[2] = {specifier, assertions};

  js_value_t *result;
  err = js_call_function(env, receiver, on_import, 2, argv, &result);
  if (err < 0) goto err;

  err = js_escape_handle(env, scope, result, &result);
  assert(err == 0);

  err = js_close_escapable_handle_scope(env, scope);
  assert(err == 0);

  return result;

err:
  err = js_close_escapable_handle_scope(env, scope);
  assert(err == 0);

  return NULL;
}

static js_value_t *
bare_repl_init(js_env_t *env, js_callback_info_t *info) {
  int err;

  js_value_t *argv[1];
  size_t argc = 1;

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_repl_t *repl;

  js_value_t *handle;
  err = js_create_unsafe_arraybuffer(env, sizeof(bare_repl_t), (void **) &repl, &handle);
  assert(err == 0);

  repl->env = env;

  err = js_create_reference(env, argv[0], 1, &repl->on_import);
  assert(err == 0);

  err = js_add_teardown_callback(env, bare_repl__on_teardown, (void *) repl);
  assert(err == 0);

  return handle;
}

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

  js_value_t *argv[4];
  size_t argc = 4;

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  bare_repl_t *repl;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &repl, NULL);
  assert(err == 0);

  size_t name_len = 0;
  err = js_get_value_string_utf8(env, argv[2], NULL, 0, &name_len);
  assert(err == 0);

  utf8_t *name = malloc(name_len + 1);
  err = js_get_value_string_utf8(env, argv[2], name, name_len + 1, NULL);
  assert(err == 0);

  js_script_t *script;
  int script_err = js_prepare_script(env, (char *) name, -1, 0, argv[1], &script);

  free(name);

  if (script_err < 0) return NULL;

  err = js_on_script_dynamic_import(env, script, bare_repl__on_dynamic_import, (void *) repl);
  assert(err == 0);

  // A `null` context evaluates in the current context, i.e. against the shared
  // global, matching the `useGlobal` option on the JavaScript side.
  bool use_global;
  err = js_is_null(env, argv[3], &use_global);
  assert(err == 0);

  js_context_t *context;

  if (!use_global) {
    err = js_unwrap(env, argv[3], (void **) &context);
    assert(err == 0);

    err = js_enter_context(env, context);
    assert(err == 0);
  }

  js_value_t *result;
  script_err = js_run_prepared_script(env, script, &result);

  if (!use_global) {
    err = js_exit_context(env, context);
    assert(err == 0);
  }

  err = js_delete_script(env, script);
  assert(err == 0);

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

  V("init", bare_repl_init)
  V("createContext", bare_repl_create_context)
  V("global", bare_repl_global)
  V("eval", bare_repl_eval)
#undef V

  return exports;
}

BARE_MODULE(bare_repl, bare_repl_exports)
