cmake_minimum_required(VERSION 3.25)

project(bare_repl C)

include(bare)

add_bare_module(bare_repl)

target_sources(
  ${bare_repl}
  PRIVATE
    binding.c
)
