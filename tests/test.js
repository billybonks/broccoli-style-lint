'use strict';

var co = require('co');
var StyleLinter =    require('..');
var walkSync =       require('walk-sync');
var broccoli =       require('broccoli');
var merge =          require('merge');
var fs =             require('fs');

var builder, lintErrors;

describe('Broccoli StyleLint Plugin', function() {
  afterEach(function() {
    if (builder.cleanup) {
      builder.cleanup();
    }
  });

  beforeEach(function() {
    lintErrors = [];
  });

  describe('Broccoli build', function() {
    it('catches errors', co.wrap(function *() {
      yield buildAndLint('tests/fixtures/has-errors');
      expect(lintErrors[0].warnings).toHaveLength(2);
    }));

    it('ignores file specified config', co.wrap(function *() {
      yield buildAndLint('tests/fixtures/ignore');
      expect(lintErrors).toHaveLength(0);
    }));

    it('stylelint plugins work', co.wrap(function *() {
      yield buildAndLint('tests/fixtures/test-plugin', {linterConfig:{syntax:'scss', configFile:'tests/fixtures/.bemTestStylelintrc'}});
      expect(lintErrors[0].warnings).toHaveLength(1);
    }));

    it('returns usefull source name onError', co.wrap(function *() {
      yield buildAndLint('tests/fixtures/test-plugin', {linterConfig:{syntax:'scss', configFile:'tests/fixtures/.bemTestStylelintrc'}});
      expect(lintErrors[0].source).toEqual('has-error.scss');
    }));
  });

  describe('Configuration', function() {

    describe('Formatter', function(){

      it('uses string formatter by default', function(){
        builder = StyleLinter.create('', {});
        expect(builder.internalOptions.linterConfig.formatter).toEqual('string');
      });

    });

    describe('Syntax', function(){

      function assertExtensions(syntax, targetExtension, extensions){
        var options = {linterConfig:{syntax:syntax}};
        builder = StyleLinter.create('', options);
        expect(builder.extensions).toEqual(extensions);
      }

      it('accepts less',function(){
        var extension = 'less';
        assertExtensions(extension, extension, [extension]);
      });

      it('accepts scss',function(){
        var extension = 'scss';
        assertExtensions(extension, extension, [extension]);
      });

      it('accepts sugarss',function(){
        var extension = 'sss';
        assertExtensions('sugarss', extension, [extension]);
      });

      it('accepts css',function(){
        var extension = 'css';
        assertExtensions(extension, extension, [extension]);
      });

    });

    describe('logging', function() {
      var fakeConsole;

      beforeEach(function(){
        fakeConsole = { log: jest.fn() };
      });

      it('should log when log=true', co.wrap(function *() {
        yield buildAndLint('tests/fixtures/has-errors', {log:true, console: fakeConsole});
        expect(fakeConsole.log).toHaveBeenCalled();
      }));

      it('should not log when log=false', co.wrap(function *() {
        yield buildAndLint('tests/fixtures/has-errors', {log: false,console: fakeConsole});
        expect(fakeConsole.log).not.toHaveBeenCalled();
      }));
    });

    describe('StyleLint Configuration', function(){
      it('cant set files option', function(){
        var options = {linterConfig:{files:['a','b']}};
        var tree = StyleLinter.create('', options);
        expect(tree.internalOptions.linterConfig.files).toBe(null);
      });
    });

    it('sets options on object', function(){
      var linterConfig = {files: null, formatter: 'string', syntax: 'scss'};
      var options = {linterConfig:linterConfig, testPassingFiles:true};
      var linter = StyleLinter.create('', options);
      expect(linter.internalOptions.testPassingFiles).toBe(true);
      expect(linter.internalOptions.linterConfig).toEqual(linterConfig);
    });

    describe('Tests', function () {

      describe('Generate Tests', function(){
        it('accepted testGenerator property', co.wrap(function *() {
          var opt = {
            testGenerators:{
              suite:function(){
                return 'custom test';
              }
            }
          };
          var test = 'custom test';

          let results = yield buildAndLint('tests/fixtures/no-errors', opt);
          let testPaths = walkTestsOutputReadableTree(results);
          expect(readTestFile(testPaths)).toBe(test);
        }));
      });

      let buildAndAssertFile = co.wrap(function *(options, relativePath) {
        let results = yield buildAndLint('tests/fixtures/test-generation', options);
        let path = results.directory + '/' + relativePath;
        let content = fs.readFileSync(path).toString();
        expect(content).toMatchSnapshot();
      });

      describe('Property testPassingFiles', function(){
       it('doesnt generate tests for passing files', function(){
         return buildAndAssertFile(
           {testPassingFiles: false},
           'nested-dir/no-errors.scss.stylelint-test.js'
         );
       });

       it('generates tests for passing files', function(){
         return buildAndAssertFile(
           {testPassingFiles: true},
           'nested-dir/no-errors.scss.stylelint-test.js'
         );
       });
      });

      describe('Property testFailingFiles', function(){
       it('doesnt generate tests for failing files', function(){
         return buildAndAssertFile(
           {testFailingFiles: false},
           'nested-dir/has-errors2.scss.stylelint-test.js'
         );
       });

       it('generates tests for failing files', function(){
         return buildAndAssertFile(
           {testFailingFiles: true},
           'nested-dir/has-errors2.scss.stylelint-test.js'
         );
       });
      });
    });
  });

  describe('Generated Tests', function(){
    describe('when using multiple languages', function(){
      it('generates happy path tests for each language',  co.wrap(function *(){
        let results = yield buildAndLint('tests/fixtures/multi-language/happy-path', {
          linterConfig: { formatter: 'string' },
          group:'app',
          testPassingFiles: true
        });
        return expect(readTestFile(walkTestsOutputReadableTree(results))).toMatchSnapshot();
      }));
      it('generates error path tests for each language',  co.wrap(function *(){
        let results = yield buildAndLint('tests/fixtures/multi-language/error-path', {
          linterConfig: { formatter: 'string' },
          group:'app',
          testFailingFiles: true
        });
        return expect(readTestFile(walkTestsOutputReadableTree(results))).toMatchSnapshot();
      }));
    });
    describe('when grouping is true', function() {
      it('correctly handles nested folders', co.wrap(function *() {
        let results = yield buildAndLint('tests/fixtures/grouped-test-generation', {testPassingFiles:false, group:'app'});
        return expect(walkTestsOutputTree(results)).toEqual([
          'app.stylelint-test.js'
        ]);
      }));

      it('generates correct failing test string', co.wrap(function *() {
        let results = yield buildAndLint('tests/fixtures/grouped-test-generation', {testPassingFiles:false, group:'app'});
        return expect(readTestFile(walkTestsOutputReadableTree(results))).toMatchSnapshot();
      }));

      it('generates correct passing test string', co.wrap(function *() {
        let results = yield buildAndLint('tests/fixtures/grouped-test-generation', {testFailingFiles:false, group:'app'});
        return expect(readTestFile(walkTestsOutputReadableTree(results))).toMatchSnapshot();
      }));
    });

    describe('when grouping is false', function () {

      it('correctly handles nested folders', co.wrap(function *() {
        let results = yield buildAndLint('tests/fixtures/test-generation', {testFailingFiles:true});
        return expect(walkTestsOutputTree(results)).toEqual([
          'has-errors.scss.stylelint-test.js',
          'nested-dir/has-errors2.scss.stylelint-test.js',
          'nested-dir/no-errors.scss.stylelint-test.js',
        ]);
      }));

      it('generates correct failing test string', co.wrap(function *() {
        let results = yield buildAndLint('tests/fixtures/has-errors', {testFailingFiles:true});
        return expect(readTestFile(walkTestsOutputReadableTree(results))).toMatchSnapshot();
      }));

      it('generates correct passing test string', co.wrap(function *() {
        let results = yield buildAndLint('tests/fixtures/no-errors', {testPassingFiles:true});
        return expect(readTestFile(walkTestsOutputReadableTree(results))).toMatchSnapshot();
      }));
    });
  });
});

function readTestFile(testPaths){
  var test = fs.readFileSync(testPaths.basePath+'/'+testPaths.tree[0]);
  return String(test).toString();
}
function walkTestsOutputTree(results){
    var outputPath = results.directory;
    results = walkSync(outputPath, ['**/*.js']);
    return results;
}

function walkTestsOutputReadableTree(results){
    return {basePath:results.directory, tree:walkTestsOutputTree(results)};
}

function buildAndLint(sourcePath, options) {
  var defaultOptions = {log:false, linterConfig:{syntax:'scss', formatter: 'string'}};
  if(options){
    options = merge(defaultOptions,options);
  } else {
    options = defaultOptions;
  }
  options.onError = function(results) {
    lintErrors.push(results);
  };

  var tree = StyleLinter.create(sourcePath, options);
  builder = new broccoli.Builder(tree);

  return builder.build();
}
