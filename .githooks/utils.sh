#!/bin/bash
# Common utils used in git-hook scripts

# Formatting
b=$(tput bold)
n=$(tput sgr0)
HEADER () {
  echo "${b}${1}${n}"
}

# Get staged files for a directory
# additionally might perform pattern matching on given files
# Usage:
#   getStaged
#   getStaged <directory>
#   getStaged <directory> <pattern>
# Example:
#   getStaged appserver '\.(py)$'
getStaged () {
  relative_dir=${1:='.'}
  matching_pattern=${2:=''}
  cd "${relative_dir}"\
   && git diff --diff-filter=d --cached --name-only --relative\
    | grep -E "${matching_pattern}"
}

# Printout system information
environmentInfo () {
  echo "Shell: ${SHELL}"
  echo "Shell version: $($SHELL --version)"
  echo "OS:"
  cat /etc/os-release  2> /dev/null || systeminfo  2> /dev/null || sw_vers 2> /dev/null
  echo "Docker: $(docker --version)"
  echo "Docker compose: $(docker-compose --version)"
}

# Provide debugging insight
debug () {
  environmentInfo
  set -xv && echo $-
}

# Recurse hooks
#
# How it works
# This function will start at the root project directory and iterate over all
# directories, looking for the .githook directory. It will then execute
# the hook name passed by parameter if found.
#
# To use
# (1) Each directory might have a .githook directory
# (2) Each .githook directory might have an executable
# (3) Each .githook action should follow the naming conventions laid out by https://git-scm.com/docs/githooks
recurseHook () {
  hook_name=$1
  hook_dir=".githooks"

  #region Make utils available
  export -f HEADER
  export -f getStaged
  export -f debug
  #endregion

  for d in */; do
    code_path="./$d$hook_dir"
    if [[ -d $code_path ]] && [[ -f $code_path/$hook_name ]];
    then
      HEADER "🤖  Running hook ($hook_name) checks for $code_path"
      # Execute hook
      "$code_path/$hook_name"
      exit_code=$?

      if [ $exit_code != 0 ]; then
        echo "❌ Linting check has failed. You may use git commit --no-verify to skip."
        exit $exit_code
      fi
    fi
  done
}

# Turn debugging on by the flag
if [[ -n $DEBUG_HOOKS ]];
then
  debug
fi
