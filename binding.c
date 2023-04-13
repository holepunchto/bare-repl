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

  js_value_type_t *type;
  js_value_t *return_value;

  js_typeof(env, result, &type);

  switch ((int) (long) type) {
  case js_undefined: {
    js_get_undefined(env, &return_value);
    break;
  }
  case js_null: {
    js_get_null(env, &return_value);
    break;
  }
  case js_boolean: {
    bool value;
    js_get_value_bool(env, result, &value);
    js_get_boolean(env, value, &return_value);
    break;
  }
  case js_number: {
    int value;
    js_get_value_int32(env, result, &value);
    js_create_int32(env, value, &return_value);
    break;
  }
  case js_string: {
    size_t str_len;
    js_get_value_string_utf8(env, result, NULL, 0, &str_len);
    char value[str_len];
    js_get_value_string_utf8(env, result, &value, -1, NULL);
    js_create_string_utf8(env, value, -1, &return_value);
    break;
  }
  case js_symbol: {
    js_create_symbol(env, result, &return_value);
    break;
  }
  case js_object: {
    js_create_object(env, &return_value);
    break;
  }
  case js_function: {
    js_create_function(env, "", -1, result, NULL, &return_value); // TODO get function name
    break;
  }
  case js_external: {
    break;
  }
  case js_bigint: {
    int64_t value;
    js_get_value_bigint_int64(env, result, &value);
    js_create_bigint_int64(env, value, &return_value);
    break;
  }
  }

  return return_value;
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
