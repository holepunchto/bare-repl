cmake_minimum_required(VERSION 3.25)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)

project(bare_repl C)

add_bare_module(bare_repl)

target_sources(
  ${bare_repl}
  PRIVATE
    binding.c
)
