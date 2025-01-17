'use strict';
var util = require('util');
var lodash = require('lodash');

var h = require('../helper');
var file = require('../file');

var log = require('../log');
var core = require('../core');
var session = require('../session');

const cmd = {
  command: 'submit <filename>',
  aliases: ['push', 'commit'],
  desc: 'Submit code',
  builder: function (yargs) {
    return yargs
      .positional('filename', {
        type: 'string',
        describe: 'Code file to submit',
        default: ''
      })
      .example('leetcode submit 1.two-sum.cpp', 'Submit code');
  }
};


cmd.process_argv = function (argv) {
  var argv_config = h.base_argv().positional('filename', {
    type: 'string',
    describe: 'Code file to submit',
    default: ''
  })
  argv_config.process_argv(argv)

  return argv_config.get_result()
}


function printResult(actual, k, log_obj) {
  if (!actual.hasOwnProperty(k)) return;

  const v = actual[k] || '';
  const lines = Array.isArray(v) ? v : [v];
  for (let line of lines) {
    if (k !== 'state') {
      if (!log_obj.hasOwnProperty(lodash.startCase(k))) {
        log_obj[lodash.startCase(k)] = [line]
      } else {
        log_obj[lodash.startCase(k)].push(line)
      }
    } else {
      log_obj.messages.push(line)
    }
  }
}

function printLine(log_obj) {
  const args = Array.from(arguments).slice(1);
  const actual = args.shift();
  const line = util.format.apply(util, args);
  log_obj.messages.push(line)
}

cmd.handler = function (argv) {
  session.argv = argv;
  if (!file.exist(argv.filename))
    return log.fatal('File ' + argv.filename + ' not exist!');

  const meta = file.meta(argv.filename);

  // translation doesn't affect problem lookup
  core.getProblem(meta, true, function (e, problem) {
    if (e) return log.fail(e);

    problem.file = argv.filename;
    problem.lang = meta.lang;

    core.submitProblem(problem, function (e, results) {
      if (e) return log.fail(e);

      const result = results[0];

      var log_obj = {}
      log_obj.messages = []
      log_obj.system_message = {}
      log_obj.system_message.fid = problem.fid
      log_obj.system_message.id = problem.id
      log_obj.system_message.qid = problem.id
      log_obj.system_message.sub_type = "submit"
      log_obj.system_message.accepted = false;

      printResult(result, 'state', log_obj);
      printLine(log_obj, result, '%d/%d cases passed (%s)',
        result.passed, result.total, result.runtime);

      if (result.ok) {
        session.updateStat('ac', 1);
        session.updateStat('ac.set', problem.fid);
        log_obj.system_message.accepted = true;

        (function () {
          if (result.runtime_percentile)
            printLine(log_obj, result, 'Your runtime beats %d %% of %s submissions',
              result.runtime_percentile.toFixed(2), result.lang);
          else
            return log.warn('Failed to get runtime percentile.');
          if (result.memory && result.memory_percentile)
            printLine(log_obj, result, 'Your memory usage beats %d %% of %s submissions (%s)',
              result.memory_percentile.toFixed(2), result.lang, result.memory);
          else
            return log.warn('Failed to get memory percentile.');
        })();
      } else {
        result.testcase = result.testcase.slice(1, -1).replace(/\\n/g, '\n');
        printResult(result, 'error', log_obj);
        printResult(result, 'testcase', log_obj);
        printResult(result, 'answer', log_obj);
        printResult(result, 'expected_answer', log_obj);
        printResult(result, 'stdout', log_obj);
      }
      log.info(JSON.stringify(log_obj))
      core.updateProblem(problem, { state: (result.ok ? 'ac' : 'notac') });
    });
  });
};

module.exports = cmd;
