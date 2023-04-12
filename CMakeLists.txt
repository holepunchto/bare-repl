cmake_minimum_required(VERSION 3.25)

project(pear_repl C)

include(pear)

add_pear_module(pear_repl)

target_sources(
  pear_repl
  PRIVATE
    binding.c
)
